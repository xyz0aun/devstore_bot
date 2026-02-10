const {
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');

const TextDisplayBuilder = require('../utils/TextDisplayBuilder');

const WELCOME_CHANNEL_ID = '1072170761743245362';

module.exports = {
    name: 'guildMemberAdd',

    async execute(member) {
        try {
            const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
            if (!channel) {
                console.error(`[ERROR] Welcome channel not found: ${WELCOME_CHANNEL_ID}`);
                return;
            }

            const button = new ButtonBuilder()
                        .setCustomId('hello')
                        .setLabel('×⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀Witaj na DEVSTORE.PL⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀×')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true);

            const avatarUrl = member.user.displayAvatarURL({ size: 128 });

            const display = new TextDisplayBuilder();
            display.addTextDisplayComponents((t) => t.setContent('```🧿 • DEVSTORE.PL - Powitanie```'));
            display.addSectionComponents((section) =>
                section
                    .setThumbnailAccessory((thumb) => thumb.setURL(avatarUrl))
                    .addTextDisplayComponents((t) =>
                        t.setContent(
                            `> Witaj ${member} na serwerze **DEVSTORE.PL**!\n` +
                                '> Zapraszamy do przeczytania **regulaminu** i zapoznania się z **zasadami**\n\n' +
                                '> Mamy nadzieję, że będziesz na dłużej!',
                        ),
                    )
            );
            display.addMediaGalleryComponents((gallery) =>
                gallery.addItems((item) =>
                    item.setURL(
                        'https://cdn.discordapp.com/attachments/1467262078187340041/1468692407628333068/output-onlinepngtools_14.png?ex=6984f1e4&is=6983a064&hm=f824ffe6ab5e4259f37ea6a3b5476178fa94d4ced5e53f6311f63cb7ff03a7f4&',
                    ),
                ),
            );
            display.addActionRowComponents((row) => row.setComponents(button));

            await channel.send({ components: [display], flags: MessageFlags.IsComponentsV2 });
        } catch (err) {
            console.error(`[ERROR] Failed to send welcome embed: ${err?.message || err}`);
        }
    },
};
