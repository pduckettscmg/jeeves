// aiClient.mjs
// OpenAI-powered semantic chat for Jeeves (ESM). Personality: long-suffering, hyper-competent butler.

import OpenAI from 'openai';

const { OPENAI_API_KEY, OPENAI_MODEL } = process.env;
if (!OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY in .env');
}

// Default to a fast, capable chat model; allow optional override via OPENAI_MODEL
const MODEL = OPENAI_MODEL || 'gpt-4o-mini';

// Singleton client
export const aiClient = new OpenAI({ apiKey: OPENAI_API_KEY });

/**
 * Build Jeeves' persona as a system prompt.
 * Style: unfailingly polite, subtly sardonic, overly formal, helpful.
 */
function personaSystemPrompt() {
  return [
    'You are Jeeves, a long-suffering but impeccably competent butler embedded in a Discord bot.',
    'Register as formal, precise, and unflappably polite. Prefer brevity.',
    'Veil sarcasm beneath courtesy. Never be cruel; keep barbs understated.',
    'Voice examples: "Would the gentleman like assistance?" "It appears sir is attempting to..."',
    'Role: general UX enhancement in work-order channels—surface likely intents, common fixes, and next actions.',
    'When unsure, ask a single, focused question rather than guessing.',
    'Never invent links or facts. If data is unavailable, state that plainly.',
    'Output should be plain text suited for Discord; avoid markdown heavy styling unless requested.',
  ].join(' ');
}

/**
 * Compose a messages array for OpenAI Chat.
 * @param {Array<{role:'user'|'assistant'|'system', content:string}>} conversation - optional prior turns
 * @param {string} userText - the latest user input
 * @param {object} context - optional context (channel name, user name, etc.)
 */
function buildMessages(conversation = [], userText = '', context = {}) {
  const system = {
    role: 'system',
    content: personaSystemPrompt() + `\nContext: ${JSON.stringify({
      channel_name: context.channelName || null,
      user_name: context.userName || null,
      timezone: 'America/Chicago',
      notes: 'Work-order channels map 1:1 to calendar event titles. Bot has !schedule and !invite.',
    })}`,
  };

  const msgs = [system, ...conversation.filter(Boolean)];
  if (userText) msgs.push({ role: 'user', content: userText });
  return msgs;
}

/**
 * Generate a Jeeves reply for a given message/context.
 * @param {object} params
 * @param {string} params.text - latest user message
 * @param {Array} [params.conversation] - prior turns (optional)
 * @param {string} [params.userName] - author username (optional)
 * @param {string} [params.channelName] - channel name (optional)
 * @returns {Promise<string>} assistant reply
 */
export async function jeevesReply({ text, conversation = [], userName, channelName }) {
  const messages = buildMessages(conversation, text, { userName, channelName });

  const resp = await aiClient.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.4,
    presence_penalty: 0,
    frequency_penalty: 0.2,
  });

  const out = resp?.choices?.[0]?.message?.content?.trim();
  return out || 'It appears, sir, that silence is the better part of valor—for the moment.';
}

/**
 * Lightweight intent helper: suggests whether the user likely wants scheduling, invites, or general help.
 * Returns one of: "schedule" | "invite" | "general".
 * Pure classification; you still gate on explicit commands to execute actions.
 */
export async function classifyIntent({ text, userName, channelName }) {
  const system = {
    role: 'system',
    content: [
      'Classify the user intent into one of: schedule, invite, general.',
      'schedule: arranging times/dates, rescheduling, time ranges, confirming a work appointment.',
      'invite: adding/removing attendees, @mentions for calendar, who is coming.',
      'general: everything else (questions, status, summaries, troubleshooting).',
      'Return ONLY the label: schedule | invite | general',
    ].join(' '),
  };

  const resp = await aiClient.chat.completions.create({
    model: MODEL,
    messages: [
      system,
      { role: 'user', content: `Channel:${channelName || ''} User:${userName || ''} Text:${text}` },
    ],
    temperature: 0,
    max_tokens: 4,
  });

  const label = resp?.choices?.[0]?.message?.content?.toLowerCase().trim();
  if (label === 'schedule' || label === 'invite') return label;
  return 'general';
}

/**
 * Polite guardrail message when Jeeves cannot comply or needs clarity.
 * @param {string} reason - short human-friendly reason
 */
export function jeevesGuardrail(reason = 'insufficient information') {
  return `With your kind permission, sir, I must demur: ${reason}. Might I trouble you for a touch more specificity?`;
}

/**
 * Example: format a proactive suggestion block (plain text) Jeeves can post when he detects a common pattern.
 * Keep it terse and formal.
 */
export function jeevesSuggestion({ headline, bullets = [] }) {
  const head = `• ${headline}`;
  const lines = bullets.slice(0, 4).map(b => `  – ${b}`);
  return `${head}\n${lines.join('\n')}`;
}
