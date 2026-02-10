const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { status } = require('minecraft-server-util');
require('dotenv').config();
const { initGiveaways } = require('./utils/giveawayManager');

let config = {};
try {
    config = require('./config.json');
} catch (err) {
    config = {};
}

const botToken = (process.env.TOKEN || '').trim().replace(/^\"|\"$/g, '');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates, 

    ]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
let commandFiles = [];
try {
    commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    console.log(`[INFO] Załadowano ${commandFiles.length} komend: ${commandFiles.join(', ')}`);
} catch (error) {
    console.log('[INFO] Folder "commands" nie istnieje lub jest pusty. Tworzenie folderu...');
    fs.mkdirSync(commandsPath, { recursive: true });
}

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`[INFO] Załadowano komendę: ${command.data.name}`);
    } else {
        console.log(`[OSTRZEŻENIE] Komenda w ${filePath} nie ma wymaganej właściwości "data" lub "execute".`);
    }
}

const eventsPath = path.join(__dirname, 'events');
let eventFiles = [];
try {
    eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    console.log(`[INFO] Załadowano ${eventFiles.length} zdarzeń: ${eventFiles.join(', ')}`);
} catch (error) {
    console.log('[INFO] Folder "events" nie istnieje lub jest pusty. Tworzenie folderu...');
    fs.mkdirSync(eventsPath, { recursive: true });
}

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (!event.name || !event.execute) {
        console.log(`[OSTRZEŻENIE] Zdarzenie w ${filePath} nie ma wymaganej właściwości "name" lub "execute".`);
        continue;
    }
    console.log(`[DEBUG] Ładuję zdarzenie ${event.name} z pliku ${file}`);
    if (event.once) {
        client.once(event.name, (...args) => {
            console.log(`[DEBUG] Wywołano zdarzenie raz: ${event.name}, client istnieje: ${!!client}`);
            event.execute(...args, client);
        });
    } else {
        client.on(event.name, (...args) => {
            console.log(`[DEBUG] Wywołano zdarzenie: ${event.name}, client istnieje: ${!!client}`);
            event.execute(...args, client);
        });
    }
}

client.once('ready', async () => {
    console.log(`[INFO] Zalogowano jako ${client.user.tag}!`);
    initGiveaways(client);

    const { REST } = require('@discordjs/rest');
    const { Routes } = require('discord.js');

    const commands = client.commands.map(command => command.data.toJSON());
    const rest = new REST({ version: '10' }).setToken(botToken);

    try {
        console.log('[INFO] Rozpoczynam odświeżanie globalnych komend slash.');

        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );

        console.log('[INFO] Pomyślnie zarejestrowano globalne komendy slash.');
    } catch (error) {
        console.error(`[BŁĄD] Błąd podczas rejestracji komend slash: ${error.message}`);
    }

    const MC_STATUS_CHANNEL_ID = '1351631748408152155';
    const MC_HOST = '83.168.106.243';
    const MC_PORT = 25772;

    const DISCORD_MEMBERS_CHANNEL_ID = '1121164148357734493';
    const DISCORD_ONLINE_CHANNEL_ID = '1121164292180414575';

    const updateMcVoiceChannel = async () => {
        const channel = await client.channels.fetch(MC_STATUS_CHANNEL_ID).catch(() => null);
        if (!channel) {
            return;
        }

        let newName = 'Offline';
        try {
            const res = await status(MC_HOST, MC_PORT, { timeout: 5000 });
            const online = res?.players?.online;
            if (Number.isFinite(online)) {
                newName = `「👥」ᴏɴʟɪɴᴇ: ${online}`;
            }
        } catch (_) {
            newName = 'Offline';
        }

        if (channel.name === newName) {
            return;
        }

        await channel.setName(newName).catch(() => null);
    };

    const updateDiscordStatsChannels = async () => {
        const guildId = String(process.env.GUILD_ID || '').trim();
        const guild = guildId ? client.guilds.cache.get(guildId) : client.guilds.cache.first();
        if (!guild) {
            console.error('[STATS] Nie znaleziono serwera do statystyk (ustaw GUILD_ID lub dodaj bota na serwer).');
            return;
        }

        try {
            await guild.members.fetch({ withPresences: true }).catch(() => null);
        } catch (_) {
            // ignore
        }

        const membersCount = Number(guild.memberCount || 0);

        let onlineCount = 0;
        try {
            onlineCount = guild.presences.cache.filter((p) => p?.status && p.status !== 'offline').size;
        } catch (_) {
            onlineCount = 0;
        }

        const membersName = `〢📈・ᴄᴢʟᴏɴᴋᴏᴡɪᴇ〔 ${membersCount} 〕`;
        const onlineName = `〢🟢・ᴏɴʟɪɴᴇ〔 ${onlineCount} 〕`;

        const membersChannel = await client.channels.fetch(DISCORD_MEMBERS_CHANNEL_ID).catch(() => null);
        if (membersChannel && membersChannel.name !== membersName && typeof membersChannel.setName === 'function') {
            await membersChannel.setName(membersName).catch((err) => console.error('[STATS] members channel rename failed:', err));
        }

        const onlineChannel = await client.channels.fetch(DISCORD_ONLINE_CHANNEL_ID).catch(() => null);
        if (onlineChannel && onlineChannel.name !== onlineName && typeof onlineChannel.setName === 'function') {
            await onlineChannel.setName(onlineName).catch((err) => console.error('[STATS] online channel rename failed:', err));
        }
    };

    await updateMcVoiceChannel();
    setInterval(updateMcVoiceChannel, 60_000);

    await updateDiscordStatsChannels();
    setInterval(updateDiscordStatsChannels, 60_000);
});

client.login(botToken);
