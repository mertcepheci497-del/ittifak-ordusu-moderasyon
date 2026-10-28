require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const OWNER_IDS = (process.env.OWNER_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (!TOKEN || !CLIENT_ID) {
  console.error('DISCORD_TOKEN ve CLIENT_ID ortam degiskenleri gerekli.');
  process.exit(1);
}

// ---------- Render icin kucuk web sunucusu (health check) ----------
const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot calisiyor');
  })
  .listen(PORT, () => console.log(`Web sunucusu ${PORT} portunda.`));

// ---------- Global yasak listesi (basit JSON dosyasi) ----------
const BAN_FILE = path.join(__dirname, 'globalbans.json');

function loadGlobalBans() {
  try {
    return JSON.parse(fs.readFileSync(BAN_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveGlobalBans(data) {
  try {
    fs.writeFileSync(BAN_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('globalbans.json yazilamadi:', err.message);
  }
}

let globalBans = loadGlobalBans();

// ---------- Komut tanimlari ----------
const kullaniciOpt = (o) =>
  o
    .setName('kullanici')
    .setDescription('Kullaniciyi etiketle veya ID yapistir')
    .setRequired(true);

const sebepOpt = (o) =>
  o.setName('sebep').setDescription('Sebep (istege bagli)').setRequired(false);

const commands = [
  new SlashCommandBuilder()
    .setName('tam_yasakla')
    .setDescription('Kisiyi botun bulundugu TUM sunuculardan yasaklar (sadece yoneticiler)')
    .addUserOption(kullaniciOpt)
    .addStringOption(sebepOpt)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Kisiyi bu sunucudan yasaklar')
    .addUserOption(kullaniciOpt)
    .addStringOption(sebepOpt)
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kisiyi bu sunucudan atar')
    .addUserOption(kullaniciOpt)
    .addStringOption(sebepOpt)
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false),
].map((c) => c.toJSON());

// ---------- Bot ----------
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (c) => {
  console.log(`${c.user.tag} olarak giris yapildi. ${c.guilds.cache.size} sunucuda.`);
  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Slash komutlari kaydedildi.');
  } catch (err) {
    console.error('Komut kaydi hatasi:', err);
  }
});

// Bot yeni bir sunucuya eklenirse, global yasaklilari orada da yasakla
client.on(Events.GuildCreate, async (guild) => {
  for (const [userId, info] of Object.entries(globalBans)) {
    try {
      await guild.members.ban(userId, { reason: `Tam yasak: ${info.reason}` });
    } catch (err) {
      console.log(`[${guild.name}] ${userId} yasaklanamadi: ${err.message}`);
    }
  }
});

const ephemeral = MessageFlags.Ephemeral;

client.on(Events.InteractionCreate, async (i) => {
  if (!i.isChatInputCommand()) return;

  try {
    const user = i.options.getUser('kullanici');
    const reason = i.options.getString('sebep') || 'Sebep belirtilmedi';

    // ---------------- /tam_yasakla ----------------
    if (i.commandName === 'tam_yasakla') {
      const isAdmin = i.memberPermissions.has(PermissionFlagsBits.Administrator);
      if (!isAdmin && !OWNER_IDS.includes(i.user.id)) {
        return i.reply({ content: '❌ Bu komutu sadece yonetici yetkisi olanlar kullanabilir.', flags: ephemeral });
      }
      if (user.id === i.user.id || user.id === client.user.id || OWNER_IDS.includes(user.id)) {
        return i.reply({ content: '❌ Bu kullaniciyi yasaklayamazsin.', flags: ephemeral });
      }

      await i.deferReply({ flags: ephemeral });

      globalBans[user.id] = {
        reason,
        by: i.user.id,
        date: new Date().toISOString(),
      };
      saveGlobalBans(globalBans);

      let ok = 0;
      const failed = [];

      for (const guild of client.guilds.cache.values()) {
        try {
          await guild.members.ban(user.id, {
            reason: `Tam yasak (${i.user.tag}): ${reason}`,
          });
          ok++;
        } catch (err) {
          failed.push(`${guild.name} (${err.message})`);
        }
      }

      let msg = `✅ **${user.tag}** (\`${user.id}\`) ${ok}/${client.guilds.cache.size} sunucuda yasaklandi.`;
      if (failed.length) {
        msg += `\n\n⚠️ Basarisiz (${failed.length}):\n` + failed.slice(0, 10).map((f) => `• ${f}`).join('\n');
        if (failed.length > 10) msg += `\n... ve ${failed.length - 10} sunucu daha`;
      }
      return i.editReply(msg.slice(0, 2000));
    }

    // ---------------- /ban ----------------
    if (i.commandName === 'ban') {
      if (!i.memberPermissions.has(PermissionFlagsBits.BanMembers)) {
        return i.reply({ content: '❌ Yasaklama yetkin yok.', flags: ephemeral });
      }
      if (!i.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
        return i.reply({ content: '❌ Botun "Uyeleri Yasakla" yetkisi yok.', flags: ephemeral });
      }
      if (user.id === i.user.id || user.id === client.user.id) {
        return i.reply({ content: '❌ Bu kullaniciyi yasaklayamazsin.', flags: ephemeral });
      }

      const member = await i.guild.members.fetch(user.id).catch(() => null);
      if (member) {
        if (!member.bannable) {
          return i.reply({ content: '❌ Bu kisiyi yasaklayamam (rolu benden yuksek olabilir).', flags: ephemeral });
        }
        if (i.user.id !== i.guild.ownerId && member.roles.highest.position >= i.member.roles.highest.position) {
          return i.reply({ content: '❌ Bu kisinin rolu seninkinden yuksek veya esit.', flags: ephemeral });
        }
      }

      await i.guild.members.ban(user.id, { reason: `${i.user.tag}: ${reason}` });
      return i.reply(`🔨 **${user.tag}** (\`${user.id}\`) yasaklandi.\n**Sebep:** ${reason}`);
    }

    // ---------------- /kick ----------------
    if (i.commandName === 'kick') {
      if (!i.memberPermissions.has(PermissionFlagsBits.KickMembers)) {
        return i.reply({ content: '❌ Atma yetkin yok.', flags: ephemeral });
      }
      if (!i.guild.members.me.permissions.has(PermissionFlagsBits.KickMembers)) {
        return i.reply({ content: '❌ Botun "Uyeleri At" yetkisi yok.', flags: ephemeral });
      }
      if (user.id === i.user.id || user.id === client.user.id) {
        return i.reply({ content: '❌ Bu kullaniciyi atamazsin.', flags: ephemeral });
      }

      const member = await i.guild.members.fetch(user.id).catch(() => null);
      if (!member) {
        return i.reply({ content: '❌ Bu kisi sunucuda degil.', flags: ephemeral });
      }
      if (!member.kickable) {
        return i.reply({ content: '❌ Bu kisiyi atamam (rolu benden yuksek olabilir).', flags: ephemeral });
      }
      if (i.user.id !== i.guild.ownerId && member.roles.highest.position >= i.member.roles.highest.position) {
        return i.reply({ content: '❌ Bu kisinin rolu seninkinden yuksek veya esit.', flags: ephemeral });
      }

      await member.kick(`${i.user.tag}: ${reason}`);
      return i.reply(`👢 **${user.tag}** (\`${user.id}\`) sunucudan atildi.\n**Sebep:** ${reason}`);
    }
  } catch (err) {
    console.error(err);
    const payload = { content: `❌ Bir hata olustu: ${err.message}`, flags: ephemeral };
    if (i.deferred || i.replied) i.editReply(payload.content).catch(() => {});
    else i.reply(payload).catch(() => {});
  }
});

client.login(TOKEN);
