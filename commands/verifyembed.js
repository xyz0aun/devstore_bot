const {
    SlashCommandBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} = require('discord.js');

const TextDisplayBuilder = require('../utils/TextDisplayBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verifyembed')
        .setDescription('Wysyła embed weryfikacyjny z przyciskiem i modalem.'),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({ content: 'Tej komendy można użyć tylko na serwerze.'});
        }

        const allowedRoleId = process.env.ALLOWED_ROLE;
        const hasRole = Boolean(interaction.member?.roles?.cache?.has(allowedRoleId));
        if (!hasRole) {
            return interaction.reply({ content: 'Nie masz uprawnień do użycia tej komendy.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!interaction.channel) {
            return interaction.editReply({ content: 'Nie mogę wysłać embeda: brak kanału.' });
        }

        const header = '```🧿 • DEVSTORE.PL - Weryfikacja```';
        const body = '> Witamy cię na serwerze **DEVSTORE.PL**\n> Kliknij w przycisk poniżej, aby się zweryfikować!';
        const imageUrl = "https://cdn.discordapp.com/attachments/1467262078187340041/1467301342363259102/output-onlinepngtools_8.png?ex=697fe25d&is=697e90dd&hm=82ddb3db417b3a540a1e3361f9d98bf83418f33ef7cb0972b579122828354e9f&";

        const button = new ButtonBuilder()
            .setCustomId('verify_open')
            .setLabel('×⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀Kliknij w przycisk, aby się zweryfikować!⠀⠀⠀⠀⠀⠀⠀⠀⠀×')
            .setStyle(ButtonStyle.Secondary);

        const display = new TextDisplayBuilder().setMessageContent({
            header,
            body,
            imageUrl,
            buttons: [button],
        });

        await interaction.channel.send({ components: [display], flags: MessageFlags.IsComponentsV2 });
        await interaction.editReply({ content: 'Wysłano embed weryfikacyjny na tym kanale.' });
    },
};
