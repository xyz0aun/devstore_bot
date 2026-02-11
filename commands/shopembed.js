const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    StringSelectMenuBuilder,
    MessageFlags,
} = require('discord.js');

const TextDisplayBuilder = require('../utils/TextDisplayBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shopembed')
        .setDescription('Wysyła embed z menu do tworzenia zamówień.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({ content: 'Tej komendy można użyć tylko na serwerze.', flags: MessageFlags.Ephemeral });
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

        const brand = String(process.env.SHOP_BRAND || 'DEVSTORE.PL');
        const imageUrl = String(process.env.SHOP_EMBED_IMAGE_URL || '').trim();

        const header = '```⌚ • DEVSTORE.PL - Zamówienia```';
        const body =
            `Witamy w systemie zamówień **${brand}**!\n` +
            'Wybierz kategorię z menu poniżej, aby utworzyć zamówienie i\n' +
            'skontaktować się z naszym zespołem.\n\n' +
            '**Dostępne kategorie:**\n' +
            '> `🌐`  **Strona internetowa**\n' +
            '> `✨`  **Bot discord**\n' +
            '> `⚙️`  **Serwer discord**\n' +
            '> `🎨`  **Grafika**\n' +
            '> `🧩`  **Plugin minecraft**\n' +
            '> `🗺️`  **Mapa minecraft**\n' +
            '> `📦`  **Paczka minecraft**';

        const defaultImageUrl = "https://cdn.discordapp.com/attachments/1467262078187340041/1467302204544385107/output-onlinepngtools_9.png?ex=697fe32a&is=697e91aa&hm=c86e87429237f99f32d088a3883b81452b122a9d5756cb2fccc70236a7133004&";
        const finalImageUrl = imageUrl || defaultImageUrl;

        const menu = new StringSelectMenuBuilder()
            .setCustomId('shop_category_select')
            .setPlaceholder('Wybierz kategorię zamówienia...')
            .addOptions(
                { label: 'Strona internetowa', value: 'web', emoji: '🌐' },
                { label: 'Bot discord', value: 'bot', emoji: '✨' },
                { label: 'Serwer discord', value: 'server', emoji: '⚙️' },
                { label: 'Grafika', value: 'grafika', emoji: '🎨' },
                { label: 'Plugin minecraft', value: 'plugin', emoji: '🧩' },
                { label: 'Mapa minecraft', value: 'mapa', emoji: '🗺️' },
                { label: 'Paczka', value: 'paczka', emoji: '📦' },
            );

        const display = new TextDisplayBuilder().setMessageContent({
            header,
            body,
            imageUrl: finalImageUrl,
            buttons: [menu],
        });

        await interaction.channel.send({ components: [display], flags: MessageFlags.IsComponentsV2 });
        await interaction.editReply({ content: 'Wysłano shop embed na tym kanale.' });
    },
};
