const { SlashCommandBuilder, MessageFlags, PermissionsBitField, ButtonBuilder, ButtonStyle } = require('discord.js');
const TextDisplayBuilder = require('../utils/TextDisplayBuilder');
const fs = require('fs');
const path = require('path');

const DROP_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const DROP_COOLDOWN_FILE = path.join(__dirname, '..', 'dropCooldowns.json');

async function readDropCooldownState() {
    try {
        const raw = await fs.promises.readFile(DROP_COOLDOWN_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return { users: {} };
        if (!parsed.users || typeof parsed.users !== 'object') return { users: {} };
        return { users: parsed.users };
    } catch (err) {
        if (err?.code === 'ENOENT') return { users: {} };
        console.error('[DROP] Failed to read cooldown state:', err);
        return { users: {} };
    }
}

async function writeDropCooldownState(state) {
    try {
        const safe = {
            users: state?.users && typeof state.users === 'object' ? state.users : {},
        };
        await fs.promises.writeFile(DROP_COOLDOWN_FILE, JSON.stringify(safe, null, 2), 'utf8');
    } catch (err) {
        console.error('[DROP] Failed to write cooldown state:', err);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('drop')
        .setDescription('Losuje drop'),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({ content: 'Tej komendy można użyć tylko na serwerze.', flags: MessageFlags.Ephemeral });
        }

        if (interaction.channelId !== '1246051835605946479') {
            return interaction.reply({ content: 'Tej komendy można użyć tylko na wyznaczonym kanale.', flags: MessageFlags.Ephemeral });
        }

        const now = Date.now();
        const cooldownState = await readDropCooldownState();
        const nextAt = Number(cooldownState.users?.[interaction.user.id] || 0);
        if (Number.isFinite(nextAt) && nextAt > now) {
            const nextTs = Math.floor(nextAt / 1000);
            return interaction.reply({
                content: `Możesz użyć tej komendy ponownie <t:${nextTs}:R>.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        cooldownState.users[interaction.user.id] = now + DROP_COOLDOWN_MS;
        await writeDropCooldownState(cooldownState);

        const perms = interaction.appPermissions || null;

        const prizes = [5, 10, 15];
        const isGreen = Math.random() < 0.01;
        const wonPrize = isGreen ? prizes[Math.floor(Math.random() * prizes.length)] : null;

        const button = new ButtonBuilder()
            .setCustomId('hello')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);

        const header = '```🧿 • DEVSTORE.PL - Drop```';
        const imageUrl = "https://cdn.discordapp.com/attachments/1467262078187340041/1467307287512354816/output-onlinepngtools_11.png?ex=697fe7e6&is=697e9666&hm=76d8c06d595bda4ef73c91582718021e917c55deecdda1d89683bf4eaed0d5ad&";

        const prizesText =
            '> **Możliwe nagrody:**\n' +
            '> `-5%` zniżki\n' +
            '> `-10%` zniżki\n' +
            '> `-15%` zniżki\n\n' +
            '> Chcesz też `zalosować?` wpisz **/drop**';

        let body;
        if (isGreen) {
            body =
                `> **Wygrałeś/aś:** \`-${wonPrize}%\` zniżki\n` +
                '> Zrób `screenshota (SS)` i zrób ticket.\n\n' +
                prizesText;
            button.setLabel('×⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀Gratulację wygrałeś!⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀×')
        } else {
            body =
                '> Nic nie wygrałeś/aś!\n' +
                '> Spróbuj ponownie za `6 godzin.`\n\n' +
                prizesText;
            button.setLabel('×⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀Niestety się nie udało!⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀×')
        }

        if (perms && !perms.has(PermissionsBitField.Flags.SendMessages)) {
            return interaction.reply({ content: 'Nie mam uprawnień do wysyłania wiadomości na tym kanale (**Send Messages**).', flags: MessageFlags.Ephemeral });
        }

        const avatarUrl = interaction.user.displayAvatarURL({ size: 128 });

        const display = new TextDisplayBuilder();
        display.addTextDisplayComponents((t) => t.setContent(header));
        display.addSectionComponents((section) =>
            section
                .setThumbnailAccessory((thumb) => thumb.setURL(avatarUrl))
                .addTextDisplayComponents((t) => t.setContent(body))
        );
        display.addMediaGalleryComponents((gallery) =>
            gallery.addItems((item) => item.setURL(imageUrl))
        );
        display.addActionRowComponents((row) => row.setComponents(button));

        try {
            return await interaction.reply({ components: [display], flags: MessageFlags.IsComponentsV2 });
        } catch (err) {
            console.error('[DROP] reply failed:', err);
            return interaction.reply({ content: 'Wystąpił błąd przy wysyłaniu wyniku. Sprawdź uprawnienia bota na kanale (Send Messages / Embed Links).', flags: MessageFlags.Ephemeral });
        }
    },
};
