const {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
} = require('discord.js');

const ALLOWED_CHANNEL_ID = '1333538913272467477';
const ALLOWED_ROLE_IDS = new Set([
    '1333538853000056912',
    '1333538854799413269',
]);

function normalizeUrl(value) {
    try {
        const url = new URL(String(value));
        return url;
    } catch {
        return null;
    }
}

function matchesPlatform(platform, url) {
    const host = String(url.hostname || '').toLowerCase();

    if (platform === 'tiktok') {
        return host === 'tiktok.com' || host.endsWith('.tiktok.com');
    }

    if (platform === 'yt') {
        return (
            host === 'youtube.com' ||
            host.endsWith('.youtube.com') ||
            host === 'youtu.be'
        );
    }

    return false;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('film')
        .setDescription('Dodaj film na wyznaczony kanał.')
        .addStringOption((opt) =>
            opt
                .setName('platforma')
                .setDescription('Wybierz platformę filmu.')
                .setRequired(true)
                .addChoices(
                    { name: 'TikTok', value: 'tiktok' },
                    { name: 'YouTube', value: 'yt' },
                )
        )
        .addStringOption((opt) =>
            opt
                .setName('link')
                .setDescription('Link do filmu.')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({ content: 'Tej komendy można użyć tylko na serwerze.', flags: MessageFlags.Ephemeral });
        }

        if (interaction.channelId !== ALLOWED_CHANNEL_ID) {
            return interaction.reply({ content: 'Tej komendy można użyć tylko na wyznaczonym kanale.', flags: MessageFlags.Ephemeral });
        }

        const member = interaction.member;
        const hasRole = member?.roles?.cache?.some((r) => ALLOWED_ROLE_IDS.has(r.id));
        if (!hasRole) {
            return interaction.reply({ content: 'Nie masz uprawnień do użycia tej komendy.', flags: MessageFlags.Ephemeral });
        }

        const platform = interaction.options.getString('platforma', true);
        const linkRaw = interaction.options.getString('link', true);

        const url = normalizeUrl(linkRaw);
        if (!url) {
            return interaction.reply({ content: 'Podaj poprawny link (URL).', flags: MessageFlags.Ephemeral });
        }

        if (!matchesPlatform(platform, url)) {
            const expected = platform === 'tiktok' ? 'tiktok' : 'youtube/youtu.be';
            return interaction.reply({ content: `Niepoprawny link dla tej platformy. Link musi być z: ${expected}`, flags: MessageFlags.Ephemeral });
        }

        const embed = new EmbedBuilder()
            .setTitle('FILM')
            .setColor(0x2b2d31)
            .setDescription(
                `> **Użytkownik:** <@${interaction.user.id}>\n` +
                `> **Platforma:** **${platform === 'tiktok' ? 'TikTok' : 'YouTube'}**\n` +
                `> **Link:** ${url.toString()}`
            )
            .setTimestamp();

        if (interaction.user?.displayAvatarURL) {
            embed.setThumbnail(interaction.user.displayAvatarURL({ size: 256 }));
        }

        try {
            await interaction.channel.send({ content: url.toString(), embeds: [embed] });
        } catch (err) {
            console.error('[FILM] send failed:', err);
            return interaction.reply({ content: 'Nie mogę wysłać embeda na tym kanale. Sprawdź uprawnienia bota.', flags: MessageFlags.Ephemeral });
        }

        return interaction.reply({ content: 'Dodano film.', flags: MessageFlags.Ephemeral });
    },
};
