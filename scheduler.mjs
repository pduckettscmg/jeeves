// scheduler.mjs
// Guides a user through !schedule flow and posts finalized payload to Zapier

// In-memory sessions: { [userId]: { step, data } }
const sessions = new Map();

// Ordered steps
const steps = ['date', 'start_time', 'end_time', 'confirm'];

// Prompts for each step
const prompts = {
  date: 'Enter the event **date** (e.g., 2025-08-20):',
  start_time: 'Enter the **start time** (e.g., 09:00 AM):',
  end_time: 'Enter the **end time** (e.g., 05:00 PM):',
  confirm: 'Type `confirm` to create/update the calendar event, or `cancel` to abort.',
};

// Utility: send next prompt
async function promptNext(message, session) {
  const step = steps[session.step];
  await message.reply(prompts[step]);
}

// Entry point

// Returns true if the author is mid-scheduling in this channel
export function isScheduleSessionMessage(message) {
  const s = sessions.get(message.author.id);
  return !!s && s.channelId === message.channel.id;
}

export async function startScheduleFlow({ client, message, zapierHook }) {
  const userId = message.author.id;

  // If no session yet, start one
  if (!sessions.has(userId)) {
    sessions.set(userId, { step: 0, data: {}, channelId: message.channel.id });
    await promptNext(message, sessions.get(userId));
    return;
  }

  if (/^cancel$/i.test(input)) {
  sessions.delete(userId);
  await message.reply('Scheduling canceled.');
  return;
}


  // Continue existing session
  const session = sessions.get(userId);
  const stepKey = steps[session.step];
  const input = message.content.trim();

  if (stepKey === 'confirm') {
    if (/^cancel$/i.test(input)) {
      sessions.delete(userId);
      await message.reply('Scheduling canceled.');
      return;
    }
    if (/^confirm$/i.test(input)) {
      await finalizeSchedule({ message, session, zapierHook });
      sessions.delete(userId);
      return;
    }
    await message.reply('Please type `confirm` or `cancel`.');
    return;
  }

  // Save response
  session.data[stepKey] = input;

  // Advance step
  session.step++;
  if (session.step >= steps.length) {
    await message.reply('Unexpected end of scheduling flow.');
    sessions.delete(userId);
    return;
  }

  await promptNext(message, session);
}

// Helper to check if message belongs to schedule flow
export function isScheduleMessage(content) {
  return content.trim().toLowerCase() === '!schedule';
}

// Finalizer: posts to Zapier
async function finalizeSchedule({ message, session, zapierHook }) {
  const { data } = session;
  const { guild, channel } = message;

  const payload = {
    type: 'schedule',
    guild_id: guild.id,
    channel_id: channel.id,
    channel_name: channel.name,   // Event title
    start_text: data.start_time,
    end_text: data.end_time,
    date_text: data.date,
    timezone: 'America/Chicago',  // Fixed timezone
    channel_link: `https://discord.com/channels/${guild.id}/${channel.id}`, // Log link
    requested_by: message.author.id,
    requested_by_name: message.author.username,
    requested_at_iso: new Date().toISOString(),
  };

  const res = await fetch(zapierHook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    await message.reply(`Schedule request failed (${res.status}).`);
    throw new Error(`Zapier schedule POST failed: ${res.status} ${text}`);
  }

  await message.reply(`✅ Schedule request sent for **${channel.name}**.`);
}
