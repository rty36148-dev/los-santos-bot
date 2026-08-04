const express = require('express');
const session = require('express-session');
const path = require('path');
const { Client, GatewayIntentBits } = require('discord.js');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'los-santos-secret',
  resave: false,
  saveUninitialized: true
}));

let botClient = null;
let botToken = null;
let botGuildId = null;
let botIsOnline = false;
let botTimer = null;

async function startBot(token, guildId) {
  if (botClient) { botClient.destroy(); botClient = null; }
  botToken = token;
  botGuildId = guildId;
  botClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMembers
    ]
  });
  try {
    await botClient.login(token);
    botClient.once('ready', () => {
      console.log(`✅ البوت شغال: ${botClient.user.tag}`);
      botIsOnline = true;
    });
    botClient.on('error', () => { botIsOnline = false; });
    botClient.on('disconnect', () => { botIsOnline = false; });
    return true;
  } catch (err) {
    console.error('خطأ:', err);
    return false;
  }
}

function stopBot() {
  if (botTimer) clearTimeout(botTimer);
  if (botClient) { botClient.destroy(); botClient = null; }
  botIsOnline = false;
}

async function scheduleBot(token, guildId) {
  stopBot();
  const success = await startBot(token, guildId);
  if (success) {
    botTimer = setTimeout(() => {
      stopBot();
      console.log('⏰ انتهت الساعة، تم إيقاف البوت');
    }, 3600000);
    return true;
  }
  return false;
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
  if (!req.session.token) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.post('/api/login', async (req, res) => {
  const { token, guildId } = req.body;
  if (!token || !guildId) {
    return res.status(400).json({ error: 'الرجاء إدخال جميع البيانات' });
  }
  try {
    const testClient = new Client({ intents: [GatewayIntentBits.Guilds] });
    await testClient.login(token);
    await testClient.destroy();
    req.session.token = token;
    req.session.guildId = guildId;
    res.json({ success: true, redirect: '/dashboard' });
  } catch (err) {
    res.status(400).json({ error: 'توكن غير صحيح' });
  }
});

app.post('/api/bot/schedule', async (req, res) => {
  const token = req.session.token || botToken;
  const guildId = req.session.guildId || botGuildId;
  if (!token || !guildId) {
    return res.status(400).json({ error: 'يرجى تسجيل الدخول أولاً' });
  }
  const success = await scheduleBot(token, guildId);
  if (success) {
    res.json({ success: true, message: 'البوت شغال لمدة ساعة' });
  } else {
    res.status(500).json({ error: 'فشل تشغيل البوت' });
  }
});

app.post('/api/bot/stop', (req, res) => {
  stopBot();
  res.json({ success: true, message: 'تم إيقاف البوت' });
});

app.get('/api/bot/status', (req, res) => {
  res.json({
    isOnline: botIsOnline,
    botName: botClient ? botClient.user?.tag : 'غير متصل'
  });
});

app.get('/api/guilds', (req, res) => {
  if (!botClient || !botIsOnline) {
    return res.status(400).json({ error: 'البوت غير متصل' });
  }
  const guilds = botClient.guilds.cache.map(g => ({
    id: g.id,
    name: g.name,
    icon: g.iconURL(),
    memberCount: g.memberCount
  }));
  res.json({ guilds });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🌐 الموقع شغال على: http://0.0.0.0:${port}`);
});
