const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    PermissionsBitField,
} = require('discord.js');

const fs = require('fs');
const path = require('path');

const TextDisplayBuilder = require('../utils/TextDisplayBuilder');

const PROPOSALS_CHANNEL_ID = '1117160102953234634';
const SCREEN_CHANNEL_ID = '867680539358920724';
const SCREEN_ACCESS_APPROVER_ROLE_ID = '1467434401620037682';

const LEGITCHECK_IN_CHANNEL_ID = '1467449579057447105';
const LEGITCHECK_OUT_CHANNEL_ID = '1467315122555982140';
const LEGITCHECK_CHANNEL_NAME_PREFIX = '〢✅・ʟᴇɢɪᴛ-ᴄʜᴇᴄᴋ';

const LEGITCHECK_STATE_FILE = path.join(__dirname, '..', 'legitcheck.json');

const LEGITCHECK_RENAME_COOLDOWN_MS = 5 * 60 * 1000;

let legitcheckRenameTimer = null;

function readLegitcheckState() {
    try {
        const raw = fs.readFileSync(LEGITCHECK_STATE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        const count = Number(parsed?.count);
        const lastRenameAt = Number(parsed?.lastRenameAt);
        const pendingNextName = typeof parsed?.pendingNextName === 'string' ? parsed.pendingNextName : '';

        return {
            count: Number.isFinite(count) && count >= 0 ? count : 0,
            lastRenameAt: Number.isFinite(lastRenameAt) && lastRenameAt >= 0 ? lastRenameAt : 0,
            pendingNextName,
        };
    } catch {
        return { count: 0, lastRenameAt: 0, pendingNextName: '' };
    }
}

function writeLegitcheckState(state) {
    try {
        fs.writeFileSync(
            LEGITCHECK_STATE_FILE,
            JSON.stringify({
                count: Number(state?.count) || 0,
                lastRenameAt: Number(state?.lastRenameAt) || 0,
                pendingNextName: typeof state?.pendingNextName === 'string' ? state.pendingNextName : '',
            }, null, 2),
            'utf8',
        );
    } catch (err) {
        console.error('[LEGITCHECK] Failed to write legitcheck.json:', err);
    }
}

const ANTI_LINK_LOG_CHANNEL_ID = '1072233517032931328';

const ANTI_LINK_ENABLED = true;
const ANTI_LINK_BYPASS_PERMISSIONS = [
    PermissionsBitField.Flags.Administrator,
    PermissionsBitField.Flags.ManageMessages,
];
const ANTI_LINK_ALLOWED_CHANNEL_IDS = [];

module.exports = {
    name: 'messageCreate',

    async execute(message) {
        if (!message.guild) return;
        if (message.author.bot) return;

        if (ANTI_LINK_ENABLED) {
            const isAllowedChannel = ANTI_LINK_ALLOWED_CHANNEL_IDS.includes(message.channelId);

            const member = message.member;
            const hasBypassPerm = Boolean(
                member && ANTI_LINK_BYPASS_PERMISSIONS.some((perm) => member.permissions.has(perm)),
            );

            const contentToCheck = [message.content, ...message.embeds.map((e) => e.url).filter(Boolean)]
                .filter(Boolean)
                .join(' ');

            const hasLink = /(?:https?:\/\/|www\.|discord\.gg\/|discord(?:app)?\.com\/invite\/|invite\.gg\/|(?:\b[a-z0-9-]+\.)+[a-z]{2,})(?:\S*)/i.test(
                contentToCheck,
            );

            if (!isAllowedChannel && !hasBypassPerm && hasLink) {
                const originalContent = String(message.content || '');
                const createdTimestamp = message.createdTimestamp;
                const sourceChannelId = message.channelId;

                try {
                    await message.delete();
                } catch (err) {
                    console.error('[ANTI-LINK] Failed to delete message:', err);
                }

                try {
                    const logChannel = await (
                        message.guild.channels.fetch(ANTI_LINK_LOG_CHANNEL_ID).catch(() => null) ||
                        message.client.channels.fetch(ANTI_LINK_LOG_CHANNEL_ID).catch(() => null)
                    );

                    if (logChannel && logChannel.isTextBased()) {
                        const maxLoggedChars = 900;
                        const trimmedContent = originalContent.length > maxLoggedChars
                            ? `${originalContent.slice(0, maxLoggedChars)}...`
                            : originalContent;

                        const logEmbed = new EmbedBuilder()
                            .setColor(0x2b2d31)
                            .setTitle('LOGI')
                            .setFooter({ text: 'Logi | 2025/2026' })
                            .setThumbnail(message.author.displayAvatarURL({ size: 256 }))
                            .addFields(
                                { name: '> Użytkownik', value: `${message.author} (${message.author.tag})`, inline: false },
                                { name: '> Kanał', value: `<#${sourceChannelId}>`, inline: true },
                                { name: '> Godzina', value: `<t:${Math.floor(createdTimestamp / 1000)}:F>`, inline: true },
                                { name: '> Treść', value: trimmedContent ? `\`\`\`\n${trimmedContent}\n\`\`\`` : '(brak treści)', inline: false },
                            );
                            

                        await logChannel.send({ embeds: [logEmbed] });
                    } else {
                        console.error(
                            `[ANTI-LINK] Log channel not found or not text-based: ${ANTI_LINK_LOG_CHANNEL_ID}`,
                        );
                    }
                } catch (err) {
                    console.error('[ANTI-LINK] Failed to send log:', err);
                }

                try {
                    const warnEmbed = new EmbedBuilder()
                        .setColor(0x2b2d31)
                        .setTitle('ANTY-LINK')
                        .setImage("https://cdn.discordapp.com/attachments/1467262078187340041/1467276599345811619/embed-free-WAITSMC_29.png?ex=697fcb51&is=697e79d1&hm=4006221d702c8596585d219acecfdc034b0b60c196cfe73b6d16c70ce7590481&")
                        .setFooter({ text: 'Anty-Link | 2025/2026' })
                        .setDescription(`> Użytkowniku ${message.author} twoja wiadomość została usunięta\n> Powód: **LINK**`);

                    const warnMsg = await message.channel.send({
                        embeds: [warnEmbed],
                        allowedMentions: { users: [message.author.id] },
                    });

                    setTimeout(() => {
                        warnMsg.delete().catch(() => null);
                    }, 5000);
                } catch (err) {
                    console.error('[ANTI-LINK] Failed to send warning:', err);
                }

                return;
            }
        }

        if (message.channelId === LEGITCHECK_IN_CHANNEL_ID) {
            const imageAttachment = [...message.attachments.values()].find((att) => {
                if (att.contentType && String(att.contentType).toLowerCase().startsWith('image/')) return true;
                const name = String(att.name || '').toLowerCase();
                return /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);
            });

            if (!imageAttachment) return;

            const state = readLegitcheckState();
            const nextCount = state.count + 1;
            writeLegitcheckState({ ...state, count: nextCount });

            const outChannel = await message.guild.channels.fetch(LEGITCHECK_OUT_CHANNEL_ID).catch(() => null);

            if (!outChannel) {
                console.error('[LEGITCHECK] Output channel not found:', LEGITCHECK_OUT_CHANNEL_ID);
                return;
            }

            if (!outChannel.isTextBased()) {
                console.error('[LEGITCHECK] Output channel is not text-based:', outChannel.id);
                return;
            }

            const display = new TextDisplayBuilder();
            display.addTextDisplayComponents((t) => t.setContent('```🧿 • DEVSTORE.PL - Potwierdzenie wiarygodności```'));
            display.addTextDisplayComponents((t) =>
                t.setContent(
                    `> Klient otrzymał swoje zamówienie!\n` +
                        `> Jest teraz **${nextCount}** legitchecków.\n` +
                        `> Dowód poniżej!\n\n` +
                        `> Użytkownik: ${message.author}`,
                ),
            );
            display.addMediaGalleryComponents((gallery) =>
                gallery.addItems((item) => item.setURL('attachment://screen.png'))
            );

            await outChannel.send({
                components: [display],
                flags: MessageFlags.IsComponentsV2,
                files: [{ attachment: imageAttachment.url, name: 'screen.png' }],
            });

            try {
                const latestState = readLegitcheckState();
                const currentName = String(outChannel.name || '');
                const nextName = `${LEGITCHECK_CHANNEL_NAME_PREFIX}ˑ${nextCount}`;
                if (currentName !== nextName) {
                    const now = Date.now();
                    const msSinceLastRename = now - latestState.lastRenameAt;
                    const desiredNextName = latestState.pendingNextName || nextName;

                    if (latestState.lastRenameAt && msSinceLastRename < LEGITCHECK_RENAME_COOLDOWN_MS) {
                        writeLegitcheckState({ ...latestState, count: nextCount, pendingNextName: desiredNextName });

                        if (legitcheckRenameTimer) clearTimeout(legitcheckRenameTimer);
                        const delayMs = LEGITCHECK_RENAME_COOLDOWN_MS - msSinceLastRename + 1500;
                        legitcheckRenameTimer = setTimeout(async () => {
                            try {
                                const pending = readLegitcheckState();
                                if (!pending.pendingNextName) return;

                                const ch = await message.guild.channels.fetch(LEGITCHECK_OUT_CHANNEL_ID).catch(() => null);
                                if (!ch) return;

                                await ch.setName(pending.pendingNextName);
                                writeLegitcheckState({
                                    ...pending,
                                    lastRenameAt: Date.now(),
                                    pendingNextName: '',
                                });
                                console.log('[LEGITCHECK] Renamed OK (delayed):', {
                                    channelId: ch.id,
                                    nextName: pending.pendingNextName,
                                });
                            } catch (e) {
                                console.error('[LEGITCHECK] Delayed rename failed:', e);
                            }
                        }, delayMs);

                        console.log('[LEGITCHECK] Rename skipped (cooldown):', {
                            channelId: outChannel.id,
                            currentName,
                            nextName: desiredNextName,
                            nextCount,
                            msUntilRenameAllowed: LEGITCHECK_RENAME_COOLDOWN_MS - msSinceLastRename,
                        });
                    } else {
                        writeLegitcheckState({ ...latestState, count: nextCount, pendingNextName: '' });
                    }

                    const me = message.guild.members.me;
                    const perms = me && outChannel ? outChannel.permissionsFor(me) : null;
                    const isThread = typeof outChannel.isThread === 'function' ? outChannel.isThread() : false;
                    const hasManageChannels = perms ? perms.has(PermissionsBitField.Flags.ManageChannels) : null;
                    const hasManageThreads = perms ? perms.has(PermissionsBitField.Flags.ManageThreads) : null;

                    console.log('[LEGITCHECK] Renaming channel:', {
                        channelId: outChannel.id,
                        isThread,
                        currentName,
                        nextName,
                        hasManageChannels,
                        hasManageThreads,
                    });

                    if (isThread) {
                        if (hasManageThreads === false) {
                            console.error('[LEGITCHECK] Missing ManageThreads permission for rename');
                        }
                        if (typeof outChannel.setArchived === 'function' && outChannel.archived) {
                            await outChannel.setArchived(false).catch(() => null);
                        }
                    } else {
                        if (hasManageChannels === false) {
                            console.error('[LEGITCHECK] Missing ManageChannels permission for rename');
                        }
                    }

                    const finalName = readLegitcheckState().pendingNextName || nextName;
                    await outChannel.setName(finalName);
                    writeLegitcheckState({ ...readLegitcheckState(), count: nextCount, lastRenameAt: Date.now(), pendingNextName: '' });
                    console.log('[LEGITCHECK] Renamed OK:', { channelId: outChannel.id, nextName: finalName });
                }
            } catch (err) {
                const me = message.guild.members.me;
                const perms = me && outChannel ? outChannel.permissionsFor(me) : null;
                console.error('[LEGITCHECK] Failed to update channel name:', {
                    channelId: outChannel?.id,
                    currentName: outChannel?.name,
                    nextCount,
                    nextName: `${LEGITCHECK_CHANNEL_NAME_PREFIX}ˑ${nextCount}`,
                    hasManageChannels: perms ? perms.has(PermissionsBitField.Flags.ManageChannels) : null,
                    hasManageThreads: perms ? perms.has(PermissionsBitField.Flags.ManageThreads) : null,
                    isThread: outChannel && typeof outChannel.isThread === 'function' ? outChannel.isThread() : null,
                    error: err,
                });
            }

            try {
                await message.delete();
            } catch (err) {
                console.error('[LEGITCHECK] Failed to delete original message:', err);
            }

            return;
        }

        if (message.channelId === SCREEN_CHANNEL_ID) {
            const imageAttachment = [...message.attachments.values()].find((att) => {
                if (att.contentType && String(att.contentType).toLowerCase().startsWith('image/')) return true;
                const name = String(att.name || '').toLowerCase();
                return /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);
            });

            if (!imageAttachment) return;

            const header = '```🧿 • DEVSTORE.PL - Wymagania```';
            const body =
                `> **Użytkownik:** ${message.author}\n` +
                `> **Do akceptacji:** <@&${SCREEN_ACCESS_APPROVER_ROLE_ID}>\n\n` +
                '> Wybierz jedną z opcji poniżej:';

            const grantButton = new ButtonBuilder()
                .setCustomId(`screen_req_grant:${message.author.id}`)
                .setLabel('×⠀⠀⠀⠀⠀⠀⠀⠀⠀Nadaj dostęp⠀⠀⠀⠀⠀⠀⠀⠀×')
                .setStyle(ButtonStyle.Success);

            const noReqButton = new ButtonBuilder()
                .setCustomId(`screen_req_none:${message.author.id}`)
                .setLabel('×⠀⠀⠀⠀⠀⠀⠀⠀⠀Brak wymagań⠀⠀⠀⠀⠀⠀⠀⠀×')
                .setStyle(ButtonStyle.Secondary);

            const avatarUrl = message.author.displayAvatarURL({ size: 128 });

            const display = new TextDisplayBuilder();
            display.addTextDisplayComponents((t) => t.setContent(header));
            display.addSectionComponents((section) =>
                section
                    .setThumbnailAccessory((thumb) => thumb.setURL(avatarUrl))
                    .addTextDisplayComponents((t) => t.setContent(body))
            );
            display.addMediaGalleryComponents((gallery) =>
                gallery.addItems((item) => item.setURL('attachment://screen.png'))
            );
            display.addSeparatorComponents((s) => s);
            display.addTextDisplayComponents((t) => t.setContent('\u200b'));
            display.addActionRowComponents((row) => row.setComponents(grantButton, noReqButton));
            display.addTextDisplayComponents((t) => t.setContent('\u200b'));
            display.addSeparatorComponents((s) => s);

            await message.channel.send({
                components: [display],
                flags: MessageFlags.IsComponentsV2,
                files: [{ attachment: imageAttachment.url, name: 'screen.png' }],
            });

            try {
                await message.delete();
            } catch (err) {
                console.error('[SCREEN] Failed to delete original message:', err);
            }

            return;
        }

        if (message.channelId !== PROPOSALS_CHANNEL_ID) return;

        const content = String(message.content || '').trim();
        if (!content) return;

        const avatarUrl = message.author.displayAvatarURL({ size: 128 });

        const yesButton = new ButtonBuilder()
            .setCustomId(`proposal_vote_yes:${message.author.id}`)
            .setLabel('⠀⠀⠀⠀⠀⠀⠀TAK | (0%)⠀⠀⠀⠀⠀⠀⠀⠀')
            .setStyle(ButtonStyle.Success);

        const noButton = new ButtonBuilder()
            .setCustomId(`proposal_vote_no:${message.author.id}`)
            .setLabel('⠀⠀⠀⠀⠀⠀⠀⠀NIE | (0%)⠀⠀⠀⠀⠀⠀⠀')
            .setStyle(ButtonStyle.Danger);

        const display = new TextDisplayBuilder();
        display.addTextDisplayComponents((t) => t.setContent('```🧿 • DEVSTORE.PL - Propozycja```'));
        display.addSectionComponents((section) =>
            section
                .setThumbnailAccessory((thumb) => thumb.setURL(avatarUrl))
                .addTextDisplayComponents((t) =>
                    t.setContent(
                        `> **Autor:**\n${message.author}\n\n` +
                            `> **Treść:**\n${content}\n\n` +
                            `> **Głosy:**\n` +
                            `> ✅ TAK: **0** (0%)\n` +
                            `> ❌ NIE: **0** (0%)\n` +
                            `> Łącznie: **0**`,
                    ),
                )
        );
        display.addMediaGalleryComponents((gallery) =>
            gallery.addItems((item) =>
                item.setURL(
                    'https://cdn.discordapp.com/attachments/1467262078187340041/1468692407225811066/output-onlinepngtools_15.png?ex=6984f1e4&is=6983a064&hm=7d24d63ab8a81d17aeeb9252cdd8f791f7d34c7ce58aaf3d2e5fb1103e9d2a9a&',
                ),
            ),
        );
        display.addActionRowComponents((row) => row.setComponents(yesButton, noButton));

        await message.channel.send({ components: [display], flags: MessageFlags.IsComponentsV2 });

        try {
            await message.delete();
        } catch (err) {
            console.error('[PROPOSAL] Failed to delete user message:', err);
        }
    },
};
