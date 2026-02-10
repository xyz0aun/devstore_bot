const { SlashCommandBuilder, MessageFlags, PermissionsBitField, ButtonBuilder, ButtonStyle } = require('discord.js');
const TextDisplayBuilder = require('../utils/TextDisplayBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('droppremium')
        .setDescription('Losuje drop premium'),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({ content: 'Tej komendy można użyć tylko na serwerze.', flags: MessageFlags.Ephemeral });
        }

        if (interaction.channelId !== '1467090887283839118') {
            return interaction.reply({ content: 'Tej komendy można użyć tylko na wyznaczonym kanale.', flags: MessageFlags.Ephemeral });
        }

        if (interaction.user.id !== '1358521149452980364') {
            return interaction.reply({ content: 'Nie masz uprawnień do użycia tej komendy.', flags: MessageFlags.Ephemeral });
        }

        const perms = interaction.appPermissions || null;

        const prizes = [15, 20, 25];
        const isGreen = Math.random() < 0.015;
        const wonPrize = isGreen ? prizes[Math.floor(Math.random() * prizes.length)] : null;

        const button = new ButtonBuilder()
            .setCustomId('hello')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);

        const header = '```🧿 • DEVSTORE.PL - Drop Premium```';
        const imageUrl = "https://cdn.discordapp.com/attachments/1467262078187340041/1467307287512354816/output-onlinepngtools_11.png?ex=697fe7e6&is=697e9666&hm=76d8c06d595bda4ef73c91582718021e917c55deecdda1d89683bf4eaed0d5ad&";

        const prizesText =
            '> **Możliwe nagrody (Premium):**\n' +
            '> `-15%` zniżki\n' +
            '> `-20%` zniżki\n' +
            '> `-25%` zniżki\n\n' +
            '> Chcesz też `zalosować?` wpisz **/droppremium**';

        let body;

        if (isGreen) {
            body =
                `> **Wygrałeś/aś:** \`-${wonPrize}%\` zniżki\n` +
                '> Zrób `screenshota (SS)` i zrób ticket.\n\n' +
                prizesText;

            button.setLabel('×⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀Gratulację wygrałeś!⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀×');
        } else {
            body =
                '> Nic nie wygrałeś/aś!\n' +
                '> Spróbuj ponownie za `6 godzin.`\n\n' +
                prizesText;

            button.setLabel('×⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀Niestety się nie udało!⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀×');
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
            console.error('[DROPPREMIUM] reply failed:', err);
            return interaction.reply({ content: 'Wystąpił błąd przy wysyłaniu wyniku. Sprawdź uprawnienia bota na kanale (Send Messages / Embed Links).', flags: MessageFlags.Ephemeral });
        }
    },
};
