const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const GAME_CHAT_CHANNEL = process.env.GAME_CHAT_CHANNEL_ID;
const MEDICS_CHANNEL = process.env.MEDICS_CHANNEL_ID;

client.once('ready', () => {
  console.log(`✅ Ingelogd als ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.channel.id !== GAME_CHAT_CHANNEL) return;

  if (message.content && message.content.includes('/911')) {
    const medics = await client.channels.fetch(MEDICS_CHANNEL);
    await medics.send(`🚨 **911 Call:** ${message.content}`);
  }
});

client.login(process.env.BOT_TOKEN);
