const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    StringSelectMenuBuilder,
    MessageFlags,
} = require('discord.js');

const TextDisplayBuilder = require('../utils/TextDisplayBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticketembed')
        .setDescription('Wysyła embed z menu do tworzenia ticketów.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({ content: 'Tej komendy można użyć tylko na serwerze.', flags: MessageFlags.Ephemeral });
        }

        const allowedRoleId = '866995316510949376';
        const hasRole = Boolean(interaction.member?.roles?.cache?.has(allowedRoleId));
        if (!hasRole) {
            return interaction.reply({ content: 'Nie masz uprawnień do użycia tej komendy.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!interaction.channel) {
            return interaction.editReply({ content: 'Nie mogę wysłać embeda: brak kanału.' });
        }

        const header = '```⌚ • DEVSTORE.PL - Pomoc```';
        const body =
            'Witamy w systemie ticketów **DEVSTORE.PL**!\n' +
            'Wybierz kategorię z menu poniżej, aby utworzyć ticket\ni skontaktować się z naszą administracją\n\n' +
            '**Dostępne kategorie:**\n' +
            '> `🔧`  **Pomoc** - Pomoc ogólne/serwera\n' +
            '> `❓`  **Zapytanie** - Zapytanie ogólne\n' +
            '> `🐞`  **Błąd** - Zgłaszanie problemów z produktami.\n' +
            '> `☄️`  **Zgłoszenie** - Zgłaszanie gracza';

        const imageUrl = "https://cdn.discordapp.com/attachments/1467262078187340041/1467305985109524572/output-onlinepngtools_10.png?ex=697fe6b0&is=697e9530&hm=51a4b58467dab6cb25852b1fe9390b190372d62738561107b060e3ab2d440707&";

        const menu = new StringSelectMenuBuilder()
            .setCustomId('ticket_category_select')
            .setPlaceholder('Wybierz kategorię...')
            .addOptions(
                { label: 'POMOC', value: 'pomoc' },
                { label: 'PYTANIE', value: 'pytanie' },
                { label: 'BŁĄD', value: 'blad' },
                { label: 'ZGŁOSZENIE', value: 'zgloszenie' },
            );

        const display = new TextDisplayBuilder().setMessageContent({
            header,
            body,
            imageUrl,
            buttons: [menu],
        });

        await interaction.channel.send({ components: [display], flags: MessageFlags.IsComponentsV2 });
        await interaction.editReply({ content: 'Wysłano ticket embed na tym kanale.' });
    },
};
