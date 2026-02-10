const {
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');

const TextDisplayBuilder = require('../utils/TextDisplayBuilder');

const BOOST_CHANNEL_ID = '1467281581084381286';

module.exports = {
    name: 'guildMemberUpdate',

    async execute(oldMember, newMember) {
        try {
            const oldBoost = oldMember?.premiumSince;
            const newBoost = newMember?.premiumSince;

            const startedBoosting = !oldBoost && !!newBoost;
            if (!startedBoosting) {
                return;
            }

            const channel = newMember.guild.channels.cache.get(BOOST_CHANNEL_ID);
            if (!channel) {
                console.error(`[ERROR] Boost channel not found: ${BOOST_CHANNEL_ID}`);
                return;
            }

                const button = new ButtonBuilder()
                            .setCustomId('hello')
                            .setLabel('×⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀Dziękujemy za wsparcię!⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀×')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true);

            const avatarUrl = newMember.user.displayAvatarURL({ size: 128 });

            const display = new TextDisplayBuilder();
            display.addTextDisplayComponents((t) => t.setContent('```🧿 • DEVSTORE.PL - Ulepszenie```'));
            display.addSectionComponents((section) =>
                section
                    .setThumbnailAccessory((thumb) => thumb.setURL(avatarUrl))
                    .addTextDisplayComponents((t) =>
                        t.setContent(
                            `> Dziękujemy ${newMember} za ulepszenie serwera **DEVSTORE.PL**!\n` +
                                '> Twoje wsparcie pomaga nam rozwijać społeczność',
                        ),
                    )
            );
            display.addMediaGalleryComponents((gallery) =>
                gallery.addItems((item) =>
                    item.setURL(
                        'https://cdn.discordapp.com/attachments/1467262078187340041/1468692715540840500/output-onlinepngtools_16.png?ex=6984f22e&is=6983a0ae&hm=f6c94ff985cb5fff9c933d04d4c9f90370ed8522c8859ebaa7c41dcc75ad481c&',
                    ),
                ),
            );
            display.addActionRowComponents((row) => row.setComponents(button));

            await channel.send({ components: [display], flags: MessageFlags.IsComponentsV2 });
        } catch (err) {
            console.error(`[ERROR] Failed to send boost embed: ${err?.message || err}`);
        }
    },
};
