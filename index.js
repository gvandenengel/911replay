// 911 relay bot – forwards any message containing "/911" from GAME_CHAT_CHANNEL to MEDICS_CHANNEL
// with verbose logging so you can see exactly what the bot sees & matches.

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// ---------- env & startup checks ----------
const tok = process.env.BOT_TOKEN;
const GAME_CHAT_CHANNEL = process.env.GAME_CHAT_CHANNEL_ID;
const MEDICS_CHANNEL = process.env.MEDICS_CHANNEL_ID;

// optional: custom pattern via env; default matches "/911" anywhere (case-insensitive) and respects word boundary
const PATTERN = process.env.FORWARD_PATTERN || String.raw`/911\b`;
const regex = new RegExp(PATTERN, "i");

function mask(s){ return s ? s.slice(0,8) + "..." : s }
function log(...args){ console.log(new Date().toISOString(), "-", ...args) }

if (!tok || typeof tok !== "string" || tok.trim() === "") {
  console.error("[FATAL] BOT_TOKEN not set on the SERVICE Variables in Railway. Exiting.");
  process.exit(1);
}
if (!GAME_CHAT_CHANNEL || !MEDICS_CHANNEL) {
  console.error("[FATAL] GAME_CHAT_CHANNEL_ID or MEDICS_CHANNEL_ID missing. Exiting.");
  process.exit(1);
}

log("[BOOT] Env ok",
  "| token:", mask(tok),
  "| game:", GAME_CHAT_CHANNEL,
  "| medics:", MEDICS_CHANNEL,
  "| pattern:", `/${regex.source}/${regex.flags}`
);

// ---------- client ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ---------- helpers ----------
/** Pull all textual bits we might receive (plain content + common embed fields) */
function extractTextFromMessage(message) {
  const pieces = [];
  if (message.content) pieces.push(message.content);

  if (message.embeds && message.embeds.length) {
    for (const emb of message.embeds) {
      if (emb.title) pieces.push(emb.title);
      if (emb.description) pieces.push(emb.description);
      if (Array.isArray(emb.fields)) {
        for (const f of emb.fields) {
          if (f?.name) pieces.push(f.name);
          if (f?.value) pieces.push(f.value);
        }
      }
      if (emb.footer?.text) pieces.push(emb.footer.text);
    }
  }
  return pieces;
}

/** Light cleanup for common relay prefixes like "(Side) [Name]: " */
function cleanupRelayPrefix(text) {
  return text.replace(/^\(.*?\)\s*\[[^\]]+\]:\s*/i, "").trim();
}

// ---------- events ----------
client.once("clientReady", () => {
  log(`✅ Ingelogd als ${client.user.tag}`);
  log("Listening in channel", GAME_CHAT_CHANNEL, "→ forwarding to", MEDICS_CHANNEL);
});

// Backwa
