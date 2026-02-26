// 911 relay bot – forwards any message containing "/admin" from GAME_CHAT_CHANNEL (or any thread under it) to MEDICS_CHANNEL
// with @Field Medic role ping and verbose logs.

const { Client, GatewayIntentBits, ChannelType, PermissionsBitField } = require('discord.js');

// ---------- env ----------
const tok = process.env.BOT_TOKEN;
const GAME_CHAT_CHANNEL = process.env.GAME_CHAT_CHANNEL_ID; // parent text channel id
const MEDICS_CHANNEL = process.env.MEDICS_CHANNEL_ID;
const FIELD_MEDIC_ROLE_ID = process.env.FIELD_MEDIC_ROLE_ID; // optional role ID to ping

// default pattern: "/admin" anywhere (case-insensitive)
const PATTERN = process.env.FORWARD_PATTERN || String.raw`/admin`;
const regex = new RegExp(PATTERN, "i");

function mask(s){ return s ? s.slice(0,8) + "..." : s }
function log(...args){ console.log(new Date().toISOString(), "-", ...args) }
function fail(msg){ console.error("[FATAL]", msg); process.exit(1); }

if (!tok) fail("BOT_TOKEN not set on SERVICE Variables.");
if (!GAME_CHAT_CHANNEL) fail("GAME_CHAT_CHANNEL_ID not set.");
if (!MEDICS_CHANNEL) fail("MEDICS_CHANNEL_ID not set.");

log("[BOOT] Env ok",
  "| token:", mask(tok),
  "| game:", GAME_CHAT_CHANNEL,
  "| medics:", MEDICS_CHANNEL,
  "| role:", FIELD_MEDIC_ROLE_ID || "none",
  "| pattern:", `/${regex.source}/${regex.flags}`
);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ---------- helpers ----------
function extractTextFromMessage(message) {
  const parts = [];
  if (message.content) parts.push(message.content);

  if (message.embeds?.length) {
    for (const emb of message.embeds) {
      if (emb.title) parts.push(emb.title);
      if (emb.description) parts.push(emb.description);
      if (Array.isArray(emb.fields)) {
        for (const f of emb.fields) {
          if (f?.name) parts.push(f.name);
          if (f?.value) parts.push(f.value);
        }
      }
      if (emb.footer?.text) parts.push(emb.footer.text);
    }
  }
  return parts;
}

function cleanupRelayPrefix(text) {
  return text.replace(/^\(.*?\)\s*\[[^\]]+\]:\s*/i, "").trim();
}

// ---------- events ----------
client.once("clientReady", async () => {
  log(`✅ Ingelogd als ${client.user.tag}`);

  try {
    const relay = await client.channels.fetch(GAME_CHAT_CHANNEL);
    const medics = await client.channels.fetch(MEDICS_CHANNEL);

    log("[INFO] Relay channel:", relay?.name || relay?.id, "| type:", relay?.type);
    log("[INFO] Medics channel:", medics?.name || medics?.id, "| type:", medics?.type);

    const me = relay?.guild?.members?.me;
    if (me && relay) {
      const perms = relay.permissionsFor(me);
      log("[PERMS] Relay -> View:", perms?.has(PermissionsBitField.Flags.ViewChannel),
          "ReadHistory:", perms?.has(PermissionsBitField.Flags.ReadMessageHistory));
    }
    if (me && medics) {
      const perms2 = medics.permissionsFor(me);
      log("[PERMS] Medics -> View:", perms2?.has(PermissionsBitField.Flags.ViewChannel),
          "Send:", perms2?.has(PermissionsBitField.Flags.SendMessages));
    }

    log("Listening in relay channel (and threads) → forwarding to medics channel.");
  } catch (e) {
    console.error("[WARN] Could not fetch channels at startup:", e.message);
  }
});

// compat met v14
client.once("ready", () => {
  log(`✅ (ready) Ingelogd als ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  try {
    const ch = message.channel;

    // Alleen relay channel of threads daaronder
    const inRelayChannel = ch?.id === GAME_CHAT_CHANNEL;
    const inThreadUnderRelay = (ch?.type === ChannelType.PublicThread || ch?.type === ChannelType.PrivateThread)
      && ch?.parentId === GAME_CHAT_CHANNEL;

    if (!inRelayChannel && !inThreadUnderRelay) return;

    const parts = extractTextFromMessage(message);
    const joined = parts.join("\n").trim();

    const place = inRelayChannel ? `#${ch?.name || ch?.id}` : `(thread:${ch?.name || ch?.id}) -> parent:${ch?.parentId}`;
    log(`[SEE] ${place} msg:${message.id} author:${message.author?.tag || message.webhookId || "unknown"} `
      + `| parts:${parts.length} | sample:`, (joined.slice(0, 160) + (joined.length > 160 ? "..." : "")));

    if (!joined) {
      log("[SKIP] No textual content or embeds to scan.");
      return;
    }

    const matched = regex.test(joined);
    log(matched ? "[MATCH] pattern found in message." : "[NO MATCH] pattern not found.");
    if (!matched) return;

    const raw = message.content?.trim().length ? message.content : joined;
    const cleaned = cleanupRelayPrefix(raw);

    const medicsChannel = await client.channels.fetch(MEDICS_CHANNEL);
    const mention = FIELD_MEDIC_ROLE_ID ? `<@&${FIELD_MEDIC_ROLE_ID}>` : '';

    await medicsChannel.send({
      content: `🚨 **911 Call:** ${cleaned} ${mention}`.trim(),
      allowedMentions: FIELD_MEDIC_ROLE_ID ? { roles: [FIELD_MEDIC_ROLE_ID] } : { parse: [] }
    });

    log(`[FORWARDED] -> #${medicsChannel?.name || MEDICS_CHANNEL} | pingRole=${!!FIELD_MEDIC_ROLE_ID} | len=${cleaned.length}`);
  } catch (err) {
    console.error("[ERROR] while processing message:", err);
  }
});

client.on("error", (e) => console.error("[CLIENT ERROR]", e));
client.on("shardError", (e) => console.error("[SHARD ERROR]", e));

client.login(tok).catch((e) => {
  console.error("[FATAL] Login failed:", e);
  process.exit(1);
});
