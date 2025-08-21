// index.mjs
import 'dotenv/config';
import { startScheduleFlow, isScheduleMessage, isScheduleSessionMessage } from './scheduler.mjs';

import {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
} from 'discord.js';
import { startInviteFlow } from './invite.mjs';
import { jeevesReply } from './aiClient.mjs';

const {
  BOT_TOKEN,
  DISCORD_CLIENT_ID,
  ZAPIER_SCHEDULE_HOOK,
} = process.env;

if (!BOT_TOKEN) throw new Error('Missing BOT_TOKEN in .env');
if (!DISCORD_CLIENT_ID) throw new Error('Missing DISCORD_CLIENT_ID in .env');
if (!ZAPIER_SCHEDULE_HOOK) throw new Error('Missing ZAPIER_SCHEDULE_HOOK in .env');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// ---- Utility: generate invite URL with required perms
function buildInviteURL() {
  const perms = new PermissionsBitField();
  perms.add(
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.ReadMessageHistory,
    PermissionsBitField.Flags.EmbedLinks,
  );
  const scope = ['bot', 'applications.commands'].join('%20');
  return `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&permissions=${perms.bitfield}&scope=${scope}`;
}

export async function pingpong(msg) {
  const content = msg.content.trim();
  if (content === '!pong') {
    await msg.reply('ping');
    return;
  }
}

// ---- Message router
client.on('messageCreate', async (msg) => {
  try {
    if (!msg.guild || msg.author.bot) return;
    const content = msg.content.trim();

    // --- AI semantic chat: !jeeves <message>
    if (content.toLowerCase().startsWith('!jeeves')) {
      const text = content.replace(/^!jeeves\s+/i, '');
      const reply = await jeevesReply({
        text,
        userName: msg.author.username,
        channelName: msg.channel?.name,
      });
      await msg.reply(reply);
      return;
    }

    // --- Scheduling flow (requires continuation)
    if (
  content.startsWith('!schedule') ||
  isScheduleMessage?.(content) ||
  isScheduleSessionMessage?.(msg)
) {
  await startScheduleFlow({ client, message: msg, zapierHook: ZAPIER_SCHEDULE_HOOK });
  return;
}


    // --- Invite flow
    if (content.startsWith('!invite')) {
      await startInviteFlow({
        message: msg,
        zapierHook: ZAPIER_SCHEDULE_HOOK,
      });
      return;
    }

    // --- Invite URL helper
    if (content.startsWith('!inviteurl')) {
      await msg.reply(buildInviteURL());
      return;
    }
  } catch (err) {
    console.error('Jeeves error:', err);
    try { await msg.reply('I hit a snag processing that.'); } catch {}
  }
});

client.once('ready', () => {
  console.log(`Jeeves online as ${client.user.tag}`);
  console.log('Invite URL:', buildInviteURL());
});

client.login(BOT_TOKEN);
