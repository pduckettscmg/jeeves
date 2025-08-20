// Handles `!invite` and forwards attendee IDs to Zapier
export async function startInviteFlow({ message, zapierHook }) {
  const { guild, channel, content } = message;

  const mentioned = Array.from(message.mentions?.users?.keys?.() || []);
  const raw = content
    .replace(/^!invite\s*/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const idLike = raw.filter((t) => /^\d{5,}$/.test(t));
  const attendee_ids = Array.from(new Set([...mentioned, ...idLike]));

  if (attendee_ids.length === 0) {
    await message.reply('Usage: `!invite @tech1 @tech2` or IDs separated by spaces.');
    return;
  }

  const payload = {
    type: 'invite',
    guild_id: guild.id,
    channel_id: channel.id,
    channel_name: channel.name,
    attendee_ids,
    channel_link: `https://discord.com/channels/${guild.id}/${channel.id}`,
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
    await message.reply(`Invite request failed (${res.status}).`);
    throw new Error(`Zapier invite POST failed: ${res.status} ${text}`);
  }

  await message.reply(
    `Invite request sent for ${attendee_ids.length} ${attendee_ids.length === 1 ? 'user' : 'users'}.`
  );
}
