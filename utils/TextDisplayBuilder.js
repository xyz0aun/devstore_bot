const { ContainerBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MediaGalleryItemBuilder } = require('discord.js');

class TextDisplayBuilder extends ContainerBuilder {
    constructor() {
        super();
        this.setAccentColor(0x2b2d31);
    }

    setMessageContent({ header, body, imageUrl, buttons = [] }) {
        if (header) {
            this.addTextDisplayComponents((t) => t.setContent(header));
        }

        if (body) {
            this.addTextDisplayComponents((t) => t.setContent(body));
        }

        if (imageUrl) {
            this.addMediaGalleryComponents((gallery) =>
                gallery.addItems((item) => item.setURL(imageUrl))
            );
        }

        if (Array.isArray(buttons) && buttons.length > 0) {
            this.addActionRowComponents((row) => row.setComponents(...buttons));
        }

        return this;
    }

    setGiveawayContent({ prize, endTime, winnersCount, participantCount, ended = false, winners = null }) {
        const code = (txt) => `\`${txt}\``;

        this.addTextDisplayComponents((t) =>
            t.setContent(ended ? "```🧿 • BAZARMC.PL - Konkurs```" : "```🧿 • BAZARMC.PL - Konkurs```")
        );

        this.addTextDisplayComponents((t) =>
            t.setContent(
                `> **Nagroda:** ${code(prize)}\n` +
                `> **Czas:** ${ended ? code('ZAKOŃCZONO') : `<t:${Math.floor(endTime / 1000)}:R>`}\n` +
                `> **Ilość wygranych:** ${code(winnersCount)}\n` +
                `> **Bierze udział:** ${code(participantCount)}`
            )
        );

        this.addMediaGalleryComponents((gallery) =>
            gallery.addItems((item) =>
                item.setURL("https://cdn.discordapp.com/attachments/1467262078187340041/1467475588209053757/output-onlinepngtools_13.png?ex=698084a4&is=697f3324&hm=944a3afe861f9afaaff9189d7b753ea2fdf4dc2a5372bf5b141a7b5c9cd2a112&")
            )
        );

        const button = new ButtonBuilder()
            .setCustomId(ended ? 'giveaway_ended' : 'giveaway_join')
            .setLabel(ended ? `Zakończony (${participantCount})` : `Weź udział (${participantCount})`)
            .setStyle(ended ? ButtonStyle.Secondary : ButtonStyle.Secondary)
            .setDisabled(ended);

        if (!ended) button.setEmoji('1467317021032185997');

        const listButton = new ButtonBuilder()
            .setCustomId('giveaway_list')
            .setLabel('Uczestnicy')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('1335004010779775039');

        this.addActionRowComponents((row) => row.setComponents(button, listButton));

        if (ended && winners) {
            this.addSeparatorComponents((s) => s);
            this.addTextDisplayComponents((t) => t.setContent(`**<:1446312424067043348:1467317021032185997> Zwycięzcy:** ${winners}`));
        }

        return this;
    }

    addGiveawayButton(count, ended = false) {
        return this;
    }
}

module.exports = TextDisplayBuilder;
