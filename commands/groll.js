const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getGiveaway } = require('../utils/giveawayUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('groll')
        .setDescription('Losuje ponownie zwycięzcę dla podanego konkursu')
        .addStringOption(option =>
            option.setName('message_id')
                .setDescription('ID wiadomości z konkursem')
                .setRequired(true)),
    async execute(interaction) {
        const allowedRoleId = '866995316510949376';
        const hasRole = Boolean(interaction.member?.roles?.cache?.has(allowedRoleId));
        if (!hasRole) {
            return interaction.reply({ content: 'Nie masz uprawnień do użycia tej komendy.', flags: MessageFlags.Ephemeral });
        }

        const messageId = interaction.options.getString('message_id');
        const giveaway = getGiveaway(messageId);

        if (!giveaway) {
            return interaction.reply({ content: 'Nie znaleziono konkursu o podanym ID.', flags: MessageFlags.Ephemeral });
        }

        if (giveaway.participants.length === 0) {
            return interaction.reply({ content: 'Nikt nie wziął udziału w tym konkursie.', flags: MessageFlags.Ephemeral });
        }

        const winnerCount = 1; 

        const winnerIndex = Math.floor(Math.random() * giveaway.participants.length);
        const winnerId = giveaway.participants[winnerIndex];

        await interaction.reply({
            content: `🎉 Nowym zwycięzcą konkursu na **${giveaway.prize}** jest <@${winnerId}>! Gratulacje!`,
            allowedMentions: { users: [winnerId] }
        });
    },
};
