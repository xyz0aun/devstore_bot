const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const TextDisplayBuilder = require('../utils/TextDisplayBuilder');
const { createGiveaway, parseDuration } = require('../utils/giveawayUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gcreate')
        .setDescription('Tworzy nowy giveaway')
        .addStringOption(option =>
            option.setName('czas')
                .setDescription('Czas trwania (np. 10m, 1h, 1d)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('nagroda')
                .setDescription('Nagroda do wygrania')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('zwyciezcy')
                .setDescription('Liczba zwycięzców')
                .setRequired(true)),
    async execute(interaction) {
        const allowedRoleId = '866995316510949376';
        const hasRole = Boolean(interaction.member?.roles?.cache?.has(allowedRoleId));
        if (!hasRole) {
            return interaction.reply({ content: 'Nie masz uprawnień do użycia tej komendy.', flags: MessageFlags.Ephemeral });
        }

        const timeStr = interaction.options.getString('czas');
        const prize = interaction.options.getString('nagroda');
        const winnersCount = interaction.options.getInteger('zwyciezcy');

        const durationMs = parseDuration(timeStr);
        if (!durationMs) {
            return interaction.reply({ content: 'Nieprawidłowy format czasu. Użyj np. 10m, 1h, 1d.', flags: MessageFlags.Ephemeral });
        }

        const endTime = Date.now() + durationMs;

        const display = new TextDisplayBuilder()
            .setGiveawayContent({
                prize,
                endTime,
                winnersCount,
                participantCount: 0,
                ended: false
            });

        const response = await interaction.reply({
            components: [display],
            flags: MessageFlags.IsComponentsV2,
            withResponse: true
        });

        const message = response.resource ? response.resource.message : response;

        createGiveaway({
            messageId: message.id,
            channelId: interaction.channelId,
            guildId: interaction.guildId,
            prize,
            endTime,
            winnersCount,
            participants: [],
            ended: false,
            hosterId: interaction.user.id
        });

        const { scheduleGiveaway } = require('../utils/giveawayManager');
        scheduleGiveaway(interaction.client, message.id, endTime);
    },
};
