const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    EmbedBuilder,
    MessageFlags,
    ModalBuilder,
    PermissionsBitField,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { addParticipant, getGiveaway } = require('../utils/giveawayUtils');
const TextDisplayBuilder = require('../utils/TextDisplayBuilder');

const VERIFIED_ROLE_ID = '868021206694101022';

const SCREEN_ACCESS_ROLE_ID = '1072147184826454046';
const SCREEN_ACCESS_APPROVER_ROLE_ID = '1467434401620037682';

const TICKET_CATEGORY_IDS_BY_TYPE = {
    pomoc: '1072981514389819544',
    blad: '1467282098501976229',
    pytanie: '1467282217398042654',
    zgloszenie: '1467282297974820886',
};

const TICKET_CHANNEL_PREFIX_BY_TYPE = {
    pomoc: '🔎︲',
    blad: '🔧︲',
    pytanie: '❔︲',
    zgloszenie: '⛓️‍💥︲',
};

const ALL_TICKET_CATEGORY_IDS = new Set(Object.values(TICKET_CATEGORY_IDS_BY_TYPE));
const TICKET_ARCHIVE_CATEGORY_ID = '1399857395638861994';

const SHOP_CATEGORY_IDS_BY_TYPE = {
    web: String(process.env.SHOP_CATEGORY_WEB_ID || '1467285609876815973').trim(),
    bot: String(process.env.SHOP_CATEGORY_BOT_ID || '1467285685798174930').trim(),
    server: String(process.env.SHOP_CATEGORY_SERVER_ID || '1467285761291452589').trim(),
    grafika: String(process.env.SHOP_CATEGORY_GRAFIKA_ID || '1467286541587189853').trim(),
    plugin: String(process.env.SHOP_CATEGORY_PLUGIN_ID || '1467285808980558132').trim(),
    mapa: String(process.env.SHOP_CATEGORY_MAPA_ID || '1467285858326548490').trim(),
    paczka: String(process.env.SHOP_CATEGORY_PACZKA_ID || '').trim(),
};

const SHOP_CHANNEL_PREFIX_BY_TYPE = {
    web: '🌐︲',
    bot: '✨︲',
    server: '⚙️︲',
    grafika: '🎨︲',
    plugin: '🧩︲',
    mapa: '🗺️︲',
    paczka: '📦︲',
};

const ALL_SHOP_CATEGORY_IDS = new Set(Object.values(SHOP_CATEGORY_IDS_BY_TYPE).filter(Boolean));
const SHOP_ARCHIVE_CATEGORY_ID = String(process.env.SHOP_ARCHIVE_CATEGORY_ID || '1399857699960651787').trim();

const TICKET_STAFF_ROLE_IDS = String(process.env.TICKET_STAFF_ROLE_IDS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

const SHOP_STAFF_ROLE_IDS = String(process.env.SHOP_STAFF_ROLE_IDS || process.env.TICKET_STAFF_ROLE_IDS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

function parseIdList(value, max = 6) {
    return String(value || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, max);
}

const SHOP_ACCESS_GLOBAL_IDS = parseIdList(process.env.SHOP_ACCESS_IDS, 6);

const SHOP_ACCESS_IDS_BY_TYPE = {
    web: parseIdList(process.env.SHOP_ACCESS_WEB_IDS, 6),
    bot: parseIdList(process.env.SHOP_ACCESS_BOT_IDS, 6),
    server: parseIdList(process.env.SHOP_ACCESS_SERVER_IDS, 6),
    grafika: parseIdList(process.env.SHOP_ACCESS_GRAFIKA_IDS, 6),
    plugin: parseIdList(process.env.SHOP_ACCESS_PLUGIN_IDS, 6),
    mapa: parseIdList(process.env.SHOP_ACCESS_MAPA_IDS, 6),
    paczka: parseIdList(process.env.SHOP_ACCESS_PACZKA_IDS, 6),
};

function getShopAccessEffectiveIdsByType(type) {
    const typeIds = SHOP_ACCESS_IDS_BY_TYPE[type] || [];
    const merged = [...SHOP_ACCESS_GLOBAL_IDS, ...typeIds];
    const unique = [...new Set(merged)].slice(0, 6);
    return unique.filter((id) => !SHOP_STAFF_ROLE_IDS.includes(id));
}

const proposalVotesByMessageId = new Map();

function getProposalState(messageId) {
    let state = proposalVotesByMessageId.get(messageId);
    if (!state) {
        state = { yes: new Set(), no: new Set() };
        proposalVotesByMessageId.set(messageId, state);
    }
    return state;
}

function computeProposalStats(state) {
    const yesCount = state.yes.size;
    const noCount = state.no.size;
    const total = yesCount + noCount;

    const yesPct = total === 0 ? 0 : Math.round((yesCount / total) * 100);
    const noPct = total === 0 ? 0 : 100 - yesPct;

    return { yesCount, noCount, total, yesPct, noPct };
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sanitizeChannelNamePart(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9\-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40);
}

function createQuestion() {
    const a = randomInt(1, 10);
    const b = randomInt(1, 10);
    const ops = ['+', '-'];
    const op = ops[randomInt(0, ops.length - 1)];

    const answer = op === '+' ? a + b : a - b;
    const text = `${a} ${op} ${b}`;

    return { text, answer };
}

async function safeEphemeralError(interaction, content) {
    try {
        if (interaction.deferred || interaction.replied) {
            return await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
        }

        return await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    } catch (err) {
        if (err?.code === 40060) {
            try {
                return await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
            } catch (_) {
                return;
            }
        }
        return;
    }
}

module.exports = {
    name: 'interactionCreate',

    async execute(interaction, client) {
        if (!interaction.inGuild()) return;

        if (interaction.isButton() && (interaction.customId.startsWith('screen_req_none:') || interaction.customId.startsWith('screen_req_grant:'))) {
            const clickerHasRole = Boolean(interaction.member?.roles?.cache?.has(SCREEN_ACCESS_APPROVER_ROLE_ID));
            if (!clickerHasRole) {
                return safeEphemeralError(interaction, 'Nie możesz użyć tego przycisku.');
            }

            const [action, targetUserId] = String(interaction.customId).split(':');
            if (!targetUserId || !/^\d{17,20}$/.test(targetUserId)) {
                return safeEphemeralError(interaction, 'Niepoprawne dane przycisku (brak ID użytkownika).');
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const guild = interaction.guild;
            if (!guild) {
                return interaction.editReply({ content: 'Nie mogę pobrać serwera.' });
            }

            const member = await guild.members.fetch(targetUserId).catch(() => null);
            if (!member) {
                return interaction.editReply({ content: 'Nie mogę pobrać użytkownika do nadania dostępu (może opuścił serwer).' });
            }

            const channel = interaction.channel;
            const message = channel?.isTextBased()
                ? await channel.messages.fetch(interaction.message.id).catch(() => null)
                : null;

            const attachment = message?.attachments?.first() || null;
            const keepAttachments = message?.attachments
                ? [...message.attachments.values()].map((a) => ({ id: a.id }))
                : [];
            let screenFile = null;
            if (attachment?.url) {
                try {
                    const res = await fetch(attachment.url);
                    const ab = await res.arrayBuffer();
                    screenFile = { attachment: Buffer.from(ab), name: 'screen.png' };
                } catch (err) {
                    console.error('[SCREEN] Failed to download screenshot for edit:', err);
                    screenFile = null;
                }
            }

            if (action === 'screen_req_none') {
                const resultButton = new ButtonBuilder()
                    .setCustomId('screen_req_result_none')
                    .setLabel('×⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀Brak wymagań!⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀×')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true);

                try {
                    const display = new TextDisplayBuilder();
                    display.addTextDisplayComponents((t) => t.setContent('```🧿 • DEVSTORE.PL - Wymagania```'));
                    display.addTextDisplayComponents((t) =>
                        t.setContent(
                            `> **Użytkownik:** <@${targetUserId}>\n` +
                            `> **Do akceptacji:** <@&${SCREEN_ACCESS_APPROVER_ROLE_ID}>\n\n` +
                            '> Wybierz jedną z opcji poniżej:'
                        )
                    );
                    if (screenFile) {
                        display.addMediaGalleryComponents((gallery) =>
                            gallery.addItems((item) => item.setURL('attachment://screen.png'))
                        );
                    } else if (attachment?.url) {
                        display.addMediaGalleryComponents((gallery) =>
                            gallery.addItems((item) => item.setURL(attachment.url))
                        );
                    }
                    display.addSeparatorComponents((s) => s);
                    display.addTextDisplayComponents((t) => t.setContent('\u200b'));
                    display.addActionRowComponents((row) => row.setComponents(resultButton));
                    display.addTextDisplayComponents((t) => t.setContent('\u200b'));
                    display.addSeparatorComponents((s) => s);

                    if (message) {
                        const editPayload = {
                            components: [display],
                            flags: MessageFlags.IsComponentsV2,
                            attachments: keepAttachments,
                        };

                        if (screenFile) {
                            editPayload.files = [screenFile];
                        }

                        await message.edit(editPayload);
                    }
                } catch (err) {
                    console.error('[SCREEN] Failed to update message (none):', err);
                }

                return interaction.editReply({ content: `Brak wymagań - nie nadano żadnej rangi użytkownikowi ${member}.` });
            }

            try {
                await member.roles.add(SCREEN_ACCESS_ROLE_ID);

                const resultButton = new ButtonBuilder()
                    .setCustomId('screen_req_result_granted')
                    .setLabel('×⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀Nadano dostęp!⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀×')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true);

                try {
                    const display = new TextDisplayBuilder();
                    display.addTextDisplayComponents((t) => t.setContent('```🧿 • DEVSTORE.PL - Wymagania```'));
                    display.addTextDisplayComponents((t) =>
                        t.setContent(
                            `> **Użytkownik:** <@${targetUserId}>\n` +
                            `> **Do akceptacji:** <@&${SCREEN_ACCESS_APPROVER_ROLE_ID}>\n\n` +
                            '> Wybierz jedną z opcji poniżej:'
                        )
                    );
                    if (screenFile) {
                        display.addMediaGalleryComponents((gallery) =>
                            gallery.addItems((item) => item.setURL('attachment://screen.png'))
                        );
                    } else if (attachment?.url) {
                        display.addMediaGalleryComponents((gallery) =>
                            gallery.addItems((item) => item.setURL(attachment.url))
                        );
                    }
                    display.addSeparatorComponents((s) => s);
                    display.addTextDisplayComponents((t) => t.setContent('\u200b'));
                    display.addActionRowComponents((row) => row.setComponents(resultButton));
                    display.addTextDisplayComponents((t) => t.setContent('\u200b'));
                    display.addSeparatorComponents((s) => s);

                    if (message) {
                        const editPayload = {
                            components: [display],
                            flags: MessageFlags.IsComponentsV2,
                            attachments: keepAttachments,
                        };

                        if (screenFile) {
                            editPayload.files = [screenFile];
                        }

                        await message.edit(editPayload);
                    }
                } catch (err) {
                    console.error('[SCREEN] Failed to update message (grant):', err);
                }

                return interaction.editReply({ content: `Nadano dostęp użytkownikowi ${member}.` });
            } catch (err) {
                console.error('[SCREEN] Failed to add role:', err);
                return interaction.editReply({ content: 'Nie udało się nadać rangi (sprawdź uprawnienia bota i pozycję roli).' });
            }
        }

        if (interaction.isChatInputCommand()) {
            const command = client?.commands?.get(interaction.commandName);
            if (!command) {
                return interaction.reply({ content: 'Nieznana komenda.', flags: MessageFlags.Ephemeral });
            }

            try {
                await command.execute(interaction, client);
            } catch (err) {
                console.error(
                    `[COMMAND ERROR] /${interaction.commandName} user=${interaction.user?.tag} (${interaction.user?.id}) guild=${interaction.guildId} channel=${interaction.channelId}`,
                    err
                );
                await safeEphemeralError(interaction, 'Wystąpił błąd podczas wykonywania komendy.');
            }
            return;
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_category_select') {
            const selected = interaction.values?.[0];
            const allowed = new Set(['pomoc', 'blad', 'zgloszenie', 'pytanie']);
            const categoryKey = String(selected || '').trim().toLowerCase();
            const categoryDisplay = {
                pomoc: '🔧 Pomoc',
                pytanie: '❓ Pytanie',
                blad: '🐞 Błąd',
                zgloszenie: '☄️ Zgłoszenie',
            };

            if (!allowed.has(categoryKey)) {
                return safeEphemeralError(interaction, 'Niepoprawna kategoria ticketa.');
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const guild = interaction.guild;
            const member = interaction.member;
            if (!guild || !member) {
                return interaction.editReply({ content: 'Nie mogę pobrać danych serwera/użytkownika.' });
            }

            const existingTicket = guild.channels.cache.find((ch) => {
                if (ch.type !== ChannelType.GuildText) return false;
                if (!ALL_TICKET_CATEGORY_IDS.has(ch.parentId)) return false;
                const topic = String(ch.topic || '');
                return topic.includes(`ticketOwner=${interaction.user.id}`);
            });

            if (existingTicket) {
                return interaction.editReply({ content: `Masz już otwarty ticket: ${existingTicket}` });
            }

            const prefix = TICKET_CHANNEL_PREFIX_BY_TYPE[categoryKey] || '';
            const nameUser = sanitizeChannelNamePart(interaction.user.username);
            const channelName = `${prefix}${nameUser}`.slice(0, 90);

            const ticketCategoryId = TICKET_CATEGORY_IDS_BY_TYPE[categoryKey];
            if (!ticketCategoryId) {
                return interaction.editReply({ content: 'Niepoprawna kategoria ticketa.' });
            }

            const category = await guild.channels.fetch(ticketCategoryId).catch(() => null);
            if (!category || category.type !== ChannelType.GuildCategory) {
                return interaction.editReply({ content: 'Nie znaleziono kategorii ticketów (sprawdź ID kategorii).' });
            }

            try {
                const channel = await guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    parent: ticketCategoryId,
                    topic: `ticketOwner=${interaction.user.id};ticketType=${categoryKey}`,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            deny: [PermissionsBitField.Flags.ViewChannel],
                        },
                        {
                            id: '868384027453829120',
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.ReadMessageHistory,
                                PermissionsBitField.Flags.AttachFiles,
                                PermissionsBitField.Flags.EmbedLinks,
                            ],
                        },
                        {
                            id: '1467281259402236097',
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.ReadMessageHistory,
                                PermissionsBitField.Flags.AttachFiles,
                                PermissionsBitField.Flags.EmbedLinks,
                            ],
                        },
                        {
                            id: interaction.user.id,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.ReadMessageHistory,
                                PermissionsBitField.Flags.AttachFiles,
                                PermissionsBitField.Flags.EmbedLinks,
                            ],
                        },
                    ],
                });

                const createdAt = Math.floor(Date.now() / 1000);
                const accountCreatedAt = Math.floor(interaction.user.createdTimestamp / 1000);
                const joinedServerAt = member?.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;

                const closeButton = new ButtonBuilder()
                    .setCustomId(`ticket_close:${interaction.user.id}`)
                    .setLabel('×⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀Kliknij w przycisk, aby zamknąć ticketa!⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀×')
                    .setStyle(ButtonStyle.Danger);

                const header = '```🧿 • DEVSTORE.PL - Pomoc```';
                const body =
                    `> **Użytkownik:** <@${interaction.user.id}>\n` +
                    `> **ID:** \`${interaction.user.id}\`\n` +
                    `> **Konto:** <t:${accountCreatedAt}:F> (**<t:${accountCreatedAt}:R>**)` +
                    (joinedServerAt ? `\n> **Dołączono:** <t:${joinedServerAt}:F> (**<t:${joinedServerAt}:R>**)` : '') +
                    `\n\n> **Ticket:**\n` +
                    `> **Kategoria:** **${categoryDisplay[categoryKey] || categoryKey}**\n` +
                    `> **Utworzono:** <t:${createdAt}:F> (**<t:${createdAt}:R>**)\n\n` +
                    '> Opisz swój problem lub pytanie, a nasza administracja odpowie w ciągu **24 godzin**. Dziękujemy za kontakt!';

                const imageUrl = 'https://media.discordapp.net/attachments/1467262078187340041/1467276600700567658/embed-free-WAITSMC_27.png?ex=697fcb52&is=697e79d2&hm=4fb61d472b297a5b31e05b0dcdffe1cc6195d3ec97d0418f910f07adbb8cce2d&=&format=webp&quality=lossless';

                const display = new TextDisplayBuilder();
                display.addTextDisplayComponents((t) => t.setContent(header));
                display.addMediaGalleryComponents((gallery) =>
                    gallery.addItems((item) => item.setURL(imageUrl))
                );
                display.addTextDisplayComponents((t) => t.setContent(body));
                display.addActionRowComponents((row) => row.setComponents(closeButton));

                await channel.send({ components: [display], flags: MessageFlags.IsComponentsV2 });
                return interaction.editReply({ content: `Utworzono ticket: ${channel}` });
            } catch (err) {
                console.error('[TICKET] create failed:', err);
                const details = err?.code ? ` (code: ${err.code})` : '';
                return interaction.editReply({ content: `Nie udało się utworzyć ticketa. Sprawdź uprawnienia bota.${details}` });
            }
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'shop_category_select') {
            const selected = interaction.values?.[0];
            const allowed = new Set(['web', 'bot', 'server', 'grafika', 'plugin', 'mapa', 'paczka']);
            const categoryKey = String(selected || '').trim().toLowerCase();
            const categoryDisplay = {
                web: '🌐 Strona internetowa',
                bot: '✨ Bot discord',
                server: '⚙️ Serwer discord',
                grafika: '🎨 Grafika',
                plugin: '🧩 Plugin minecraft',
                mapa: '🗺️ Mapa minecraft',
                paczka: '📦 Paczka',
            };

            if (!allowed.has(categoryKey)) {
                return safeEphemeralError(interaction, 'Niepoprawna kategoria zamówienia.');
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const guild = interaction.guild;
            const member = interaction.member;
            if (!guild || !member) {
                return interaction.editReply({ content: 'Nie mogę pobrać danych serwera/użytkownika.' });
            }

            const existingOrder = guild.channels.cache.find((ch) => {
                if (ch.type !== ChannelType.GuildText) return false;
                if (!ALL_SHOP_CATEGORY_IDS.has(ch.parentId)) return false;
                const topic = String(ch.topic || '');
                return topic.includes(`shopOwner=${interaction.user.id}`);
            });

            if (existingOrder) {
                return interaction.editReply({ content: `Masz już otwarte zamówienie: ${existingOrder}` });
            }

            const shopCategoryId = SHOP_CATEGORY_IDS_BY_TYPE[categoryKey];
            if (!shopCategoryId) {
                return interaction.editReply({ content: 'Nie skonfigurowano kategorii zamówień dla tej opcji (sprawdź ID).' });
            }

            const category = await guild.channels.fetch(shopCategoryId).catch(() => null);
            if (!category || category.type !== ChannelType.GuildCategory) {
                return interaction.editReply({ content: 'Nie znaleziono kategorii zamówień (sprawdź ID kategorii).' });
            }

            const prefix = SHOP_CHANNEL_PREFIX_BY_TYPE[categoryKey] || '';
            const nameUser = sanitizeChannelNamePart(interaction.user.username);
            const channelName = `${prefix}${nameUser}`.slice(0, 90);

            try {
                const accessIds = getShopAccessEffectiveIdsByType(categoryKey);
                const channel = await guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    parent: shopCategoryId,
                    topic: `shopOwner=${interaction.user.id};shopType=${categoryKey}`,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            deny: [PermissionsBitField.Flags.ViewChannel],
                        },
                        {
                            id: interaction.user.id,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.ReadMessageHistory,
                                PermissionsBitField.Flags.AttachFiles,
                                PermissionsBitField.Flags.EmbedLinks,
                            ],
                        },
                        ...accessIds.map((id) => ({
                            id,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.ReadMessageHistory,
                                PermissionsBitField.Flags.AttachFiles,
                                PermissionsBitField.Flags.EmbedLinks,
                            ],
                        })),
                    ],
                });

                const createdAt = Math.floor(Date.now() / 1000);
                const accountCreatedAt = Math.floor(interaction.user.createdTimestamp / 1000);
                const joinedServerAt = member?.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;

                const closeButton = new ButtonBuilder()
                    .setCustomId(`shop_close:${interaction.user.id}`)
                    .setLabel('×⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀Kliknij w przycisk, aby zamknąć zamówienie!⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀×')
                    .setStyle(ButtonStyle.Danger);

                const header = '```🧿 • DEVSTORE.PL - Zamówienie```';
                const body =
                    `> **Użytkownik:** <@${interaction.user.id}>\n` +
                    `> **ID:** \`${interaction.user.id}\`\n` +
                    `> **Konto:** <t:${accountCreatedAt}:F> (**<t:${accountCreatedAt}:R>**)` +
                    (joinedServerAt ? `\n> **Dołączono:** <t:${joinedServerAt}:F> (**<t:${joinedServerAt}:R>**)` : '') +
                    `\n\n> **Zamówienie:**\n` +
                    `> **Kategoria:** **${categoryDisplay[categoryKey] || categoryKey}**\n` +
                    `> **Utworzono:** <t:${createdAt}:F> (**<t:${createdAt}:R>**)\n\n` +
                    '> Opisz czego potrzebujesz (szczegóły, budżet, termin), a nasz zespół odpowie możliwie szybko!';

                const finalImageUrl = String(process.env.SHOP_TICKET_IMAGE_URL || process.env.SHOP_EMBED_IMAGE_URL || 'https://cdn.discordapp.com/attachments/1467262078187340041/1467276601279648019/embed-free-WAITSMC_26.png?ex=697fcb52&is=697e79d2&hm=ab941049f30e2e305123c80f4c099c8fb34609829e4476f90e2ba6076898cabc&').trim();

                const display = new TextDisplayBuilder();
                display.addTextDisplayComponents((t) => t.setContent(header));
                display.addMediaGalleryComponents((gallery) =>
                    gallery.addItems((item) => item.setURL(finalImageUrl))
                );
                display.addTextDisplayComponents((t) => t.setContent(body));
                display.addActionRowComponents((row) => row.setComponents(closeButton));

                await channel.send({ components: [display], flags: MessageFlags.IsComponentsV2 });
                return interaction.editReply({ content: `Utworzono zamówienie: ${channel}` });
            } catch (err) {
                console.error('[SHOP] create failed:', err);
                const details = err?.code ? ` (code: ${err.code})` : '';
                return interaction.editReply({ content: `Nie udało się utworzyć zamówienia. Sprawdź uprawnienia bota.${details}` });
            }
        }

        if (interaction.isButton() && interaction.customId.startsWith('ticket_close:')) {
            const channel = interaction.channel;
            if (!channel || channel.type !== ChannelType.GuildText) {
                return safeEphemeralError(interaction, 'To nie jest kanał ticketa.');
            }

            const guild = interaction.guild;
            if (!guild) {
                return safeEphemeralError(interaction, 'Nie mogę pobrać serwera.');
            }

            const fromCustomIdOwnerId = interaction.customId.split(':')[1];
            const topic = String(channel.topic || '');
            const fromTopicOwnerId = topic.match(/ticketOwner=(\d{17,20})/)?.[1] || null;
            const ownerId = fromTopicOwnerId || fromCustomIdOwnerId || null;

            if (!ownerId) {
                return safeEphemeralError(interaction, 'Nie mogę ustalić właściciela ticketa.');
            }

            try {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            } catch (err) {
                if (err?.code === 10062) {
                    return;
                }
                return;
            }

            const canClose =
                interaction.user.id === ownerId ||
                Boolean(interaction.member?.roles?.cache?.has('1467281259402236097')) ||
                interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageChannels) ||
                interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);

            if (!canClose) {
                return interaction.editReply({ content: 'Nie masz uprawnień do zamknięcia tego ticketa.' });
            }

            const archiveCategory = await guild.channels.fetch(TICKET_ARCHIVE_CATEGORY_ID).catch(() => null);
            if (!archiveCategory || archiveCategory.type !== ChannelType.GuildCategory) {
                return interaction.editReply({ content: 'Nie znaleziono kategorii archiwum ticketów (sprawdź ID kategorii).' });
            }

            try {
                await channel.setParent(TICKET_ARCHIVE_CATEGORY_ID, { lockPermissions: false });

                await channel.permissionOverwrites.edit(guild.roles.everyone.id, {
                    ViewChannel: false,
                });

                for (const roleId of TICKET_STAFF_ROLE_IDS) {
                    await channel.permissionOverwrites.edit(roleId, {
                        ViewChannel: true,
                        ReadMessageHistory: true,
                        SendMessages: true,
                    });
                }

                await channel.permissionOverwrites.edit(ownerId, {
                    ViewChannel: false,
                    SendMessages: false,
                    ReadMessageHistory: false,
                });

                return interaction.editReply({ content: 'Ticket zamknięty i przeniesiony do archiwum.' });
            } catch (err) {
                console.error('[TICKET] close failed:', err);
                return interaction.editReply({ content: 'Nie udało się zamknąć ticketa. Sprawdź uprawnienia bota.' });
            }
        }

        if (interaction.isButton() && interaction.customId.startsWith('shop_close:')) {
            const channel = interaction.channel;
            if (!channel || channel.type !== ChannelType.GuildText) {
                return safeEphemeralError(interaction, 'To nie jest kanał zamówienia.');
            }

            const guild = interaction.guild;
            if (!guild) {
                return safeEphemeralError(interaction, 'Nie mogę pobrać serwera.');
            }

            const fromCustomIdOwnerId = interaction.customId.split(':')[1];
            const topic = String(channel.topic || '');
            const fromTopicOwnerId = topic.match(/shopOwner=(\d{17,20})/)?.[1] || null;
            const shopType = topic.match(/shopType=([a-z0-9_\-]+)/i)?.[1]?.toLowerCase() || null;
            const ownerId = fromTopicOwnerId || fromCustomIdOwnerId || null;

            if (!ownerId) {
                return safeEphemeralError(interaction, 'Nie mogę ustalić właściciela zamówienia.');
            }

            try {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            } catch (err) {
                if (err?.code === 10062) {
                    return;
                }
                return;
            }

            if (!SHOP_ARCHIVE_CATEGORY_ID) {
                return interaction.editReply({ content: 'Nie skonfigurowano archiwum zamówień (SHOP_ARCHIVE_CATEGORY_ID).' });
            }

            const archiveCategory = await guild.channels.fetch(SHOP_ARCHIVE_CATEGORY_ID).catch(() => null);
            if (!archiveCategory || archiveCategory.type !== ChannelType.GuildCategory) {
                return interaction.editReply({ content: 'Nie znaleziono kategorii archiwum zamówień (sprawdź ID kategorii).' });
            }

            const canClose =
                interaction.user.id === ownerId ||
                interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageChannels) ||
                interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);

            if (!canClose) {
                return interaction.editReply({ content: 'Nie masz uprawnień do zamknięcia tego zamówienia.' });
            }

            try {
                await channel.setParent(SHOP_ARCHIVE_CATEGORY_ID, { lockPermissions: false });

                await channel.permissionOverwrites.edit(guild.roles.everyone.id, {
                    ViewChannel: false,
                });

                for (const roleId of SHOP_STAFF_ROLE_IDS) {
                    await channel.permissionOverwrites.edit(roleId, {
                        ViewChannel: true,
                        ReadMessageHistory: true,
                        SendMessages: true,
                    });
                }

                const accessIds = shopType ? getShopAccessEffectiveIdsByType(shopType) : [];
                for (const id of accessIds) {
                    await channel.permissionOverwrites.edit(id, {
                        ViewChannel: false,
                        SendMessages: false,
                        ReadMessageHistory: false,
                    });
                }

                await channel.permissionOverwrites.edit(ownerId, {
                    ViewChannel: false,
                    SendMessages: false,
                    ReadMessageHistory: false,
                });

                return interaction.editReply({ content: 'Zamówienie zamknięte i przeniesione do archiwum.' });
            } catch (err) {
                console.error('[SHOP] close failed:', err);
                return interaction.editReply({ content: 'Nie udało się zamknąć zamówienia. Sprawdź uprawnienia bota.' });
            }
        }

        if (interaction.isButton() && (interaction.customId.startsWith('proposal_vote_yes') || interaction.customId.startsWith('proposal_vote_no'))) {
            const message = interaction.message;
            const userId = interaction.user.id;

            const [baseCustomId, customAuthorId] = String(interaction.customId).split(':');
            if (baseCustomId !== 'proposal_vote_yes' && baseCustomId !== 'proposal_vote_no') {
                return;
            }

            // read current state from message's action row labels
            const yesLabel = message.components?.[0]?.components?.find((c) => String(c.customId || '').startsWith('proposal_vote_yes'))?.label;
            const noLabel = message.components?.[0]?.components?.find((c) => String(c.customId || '').startsWith('proposal_vote_no'))?.label;

            const state = {
                yes: new Set(yesLabel?.match(/(\d+)/)?.[1] ? yesLabel.match(/(\d+)/)?.[1].split(',').map(Number) : []),
                no: new Set(noLabel?.match(/(\d+)/)?.[1] ? noLabel.match(/(\d+)/)?.[1].split(',').map(Number) : []),
            };

            const vote = baseCustomId === 'proposal_vote_yes' ? 'yes' : 'no';
            const other = vote === 'yes' ? 'no' : 'yes';

            state[other].delete(userId);
            state[vote].add(userId);

            const stats = computeProposalStats(state);

            let proposalAuthorId = customAuthorId;

            const yesButton = new ButtonBuilder()
                .setCustomId(`proposal_vote_yes${proposalAuthorId ? `:${proposalAuthorId}` : ''}`)
                .setLabel(`⠀⠀⠀⠀⠀⠀⠀TAK | (${stats.yesPct}%)⠀⠀⠀⠀⠀⠀⠀⠀`)
                .setStyle(ButtonStyle.Success);

            const noButton = new ButtonBuilder()
                .setCustomId(`proposal_vote_no${proposalAuthorId ? `:${proposalAuthorId}` : ''}`)
                .setLabel(`⠀⠀⠀⠀⠀⠀⠀⠀NIE | (${stats.noPct}%)⠀⠀⠀⠀⠀⠀⠀`)
                .setStyle(ButtonStyle.Danger);

            let baseText = '';
            try {
                const containers = Array.isArray(message.components) ? message.components : [];
                const allText = [];

                const collectTextDisplays = (node) => {
                    if (!node) return;
                    if (node?.type === 10 && typeof node?.content === 'string') {
                        allText.push(node.content);
                    }

                    if (Array.isArray(node?.components)) {
                        for (const child of node.components) {
                            collectTextDisplays(child);
                        }
                    }
                };

                for (const top of containers) {
                    collectTextDisplays(top);
                }

                const proposalText = allText.find((t) => t.includes('> **Treść:**')) || allText.find((t) => t.includes('> **Głosy:**')) || '';
                if (proposalText) {
                    const split = proposalText.split('> **Głosy:**');
                    baseText = split[0].trimEnd();
                }
            } catch (_) {
                baseText = '';
            }

            if (!proposalAuthorId) {
                const autorLine = baseText.split('\n').find((l) => l.includes('> **Autor:**'));
                const match = /<@!?(\d+)>/.exec(baseText) || (autorLine ? /<@!?(\d+)>/.exec(autorLine) : null);
                proposalAuthorId = match?.[1] || '';
            }

            if (!baseText) {
                baseText = '> **Treść:**\n(nie udało się pobrać treści propozycji)\n\n';
            }

            const statsText =
                `> **Głosy:**\n` +
                `> ✅ TAK: **${stats.yesCount}** (${stats.yesPct}%)\n` +
                `> ❌ NIE: **${stats.noCount}** (${stats.noPct}%)\n` +
                `> Łącznie: **${stats.total}**`;

            let avatarUrl = interaction.user.displayAvatarURL({ size: 128 });
            if (proposalAuthorId) {
                try {
                    const u = await interaction.client.users.fetch(proposalAuthorId);
                    avatarUrl = u.displayAvatarURL({ size: 128 });
                } catch (_) {
                    // keep fallback avatarUrl
                }
            }

            const display = new TextDisplayBuilder();
            display.addTextDisplayComponents((t) => t.setContent('```🧿 • DEVSTORE.PL - Propozycja```'));
            display.addSectionComponents((section) =>
                section
                    .setThumbnailAccessory((thumb) => thumb.setURL(avatarUrl))
                    .addTextDisplayComponents((t) => t.setContent(`${baseText}\n\n${statsText}`))
            );
            display.addMediaGalleryComponents((gallery) =>
                gallery.addItems((item) =>
                    item.setURL(
                        'https://cdn.discordapp.com/attachments/1467262078187340041/1468692407225811066/output-onlinepngtools_15.png?ex=6984f1e4&is=6983a064&hm=7d24d63ab8a81d17aeeb9252cdd8f791f7d34c7ce58aaf3d2e5fb1103e9d2a9a&',
                    ),
                ),
            );
            display.addActionRowComponents((row) => row.setComponents(yesButton, noButton));

            try {
                const hasLegacyEmbeds = Array.isArray(message.embeds) && message.embeds.length > 0;
                if (hasLegacyEmbeds) {
                    await interaction.deferUpdate().catch(() => null);
                    const newMsg = await interaction.channel.send({ components: [display], flags: MessageFlags.IsComponentsV2 });

                    const existing = proposalVotesByMessageId.get(message.id);
                    if (existing) {
                        proposalVotesByMessageId.set(newMsg.id, existing);
                        proposalVotesByMessageId.delete(message.id);
                    }

                    await message.delete().catch(() => null);
                    return;
                }
                await interaction.update({ components: [display], flags: MessageFlags.IsComponentsV2 });
            } catch (err) {
                console.error('[PROPOSAL] vote update failed:', err);
                return safeEphemeralError(interaction, 'Nie udało się zaktualizować głosów.');
            }

            return;
        }

        if (interaction.isButton() && interaction.customId === 'giveaway_join') {
            const giveaway = getGiveaway(interaction.message.id);
            if (!giveaway) {
                return interaction.reply({ content: 'Ten konkurs już nie istnieje w bazie danych.', flags: MessageFlags.Ephemeral });
            }
            if (giveaway.ended) {
                return interaction.reply({ content: 'Ten konkurs już się zakończył.', flags: MessageFlags.Ephemeral });
            }

            const newCount = addParticipant(interaction.message.id, interaction.user.id);
            if (newCount === false) {
                return interaction.reply({ content: 'Już bierzesz udział w tym konkursie!', flags: MessageFlags.Ephemeral });
            }

            const TextDisplayBuilder = require('../utils/TextDisplayBuilder');
            const display = new TextDisplayBuilder()
                .setGiveawayContent({
                    prize: giveaway.prize,
                    endTime: giveaway.endTime,
                    winnersCount: giveaway.winnersCount,
                    participantCount: newCount,
                    ended: false
                });

            await interaction.update({ components: [display], flags: MessageFlags.IsComponentsV2 });
            return;
        }

        if (interaction.isButton() && interaction.customId === 'giveaway_list') {
            const giveaway = getGiveaway(interaction.message.id);
            if (!giveaway) {
                return interaction.reply({ content: 'Nie znaleziono danych konkursu.', flags: MessageFlags.Ephemeral });
            }

            const participants = giveaway.participants || [];
            const count = participants.length;

            if (count === 0) {
                return interaction.reply({ content: 'Nikt jeszcze nie bierze udziału.', flags: MessageFlags.Ephemeral });
            }
            
            const sliced = participants.slice(0, 60);
            const listStr = sliced.map((id, index) => `**${index + 1}.** <@${id}>`).join('\n');
            const footer = count > 60 ? `\n...i ${count - 60} więcej osób.` : '';

            const embed = new EmbedBuilder()
                .setTitle(`👥 Uczestnicy (${count})`)
                .setColor(0x2b2d31)
                .setDescription(listStr + footer)
                .setFooter({ text: 'Lista jest widoczna tylko dla Ciebie.' });

            return interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral
            });
        }

        if (interaction.isButton() && interaction.customId === 'verify_open') {
            const q = createQuestion();

            const modalCustomId = `verify_modal:${q.answer}`;

            const modal = new ModalBuilder()
                .setCustomId(modalCustomId)
                .setTitle('Weryfikacja');

            const input = new TextInputBuilder()
                .setCustomId('verify_answer')
                .setLabel(`Ile to: ${q.text}?`)
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(10);

            const row = new ActionRowBuilder().addComponents(input);
            modal.addComponents(row);

            await interaction.showModal(modal);
            return;
        }

        if (interaction.isModalSubmit() && interaction.customId.startsWith('verify_modal:')) {
            const expectedRaw = interaction.customId.split(':')[1];
            const expected = Number(expectedRaw);

            const userAnswerRaw = interaction.fields.getTextInputValue('verify_answer');
            const userAnswer = Number(String(userAnswerRaw).trim().replace(',', '.'));

            if (!Number.isFinite(expected)) {
                return interaction.reply({ content: 'Wystąpił błąd weryfikacji (złe dane). Spróbuj ponownie.', flags: MessageFlags.Ephemeral });
            }

            if (!Number.isFinite(userAnswer)) {
                return interaction.reply({ content: 'Podaj poprawną liczbę.', flags: MessageFlags.Ephemeral });
            }

            if (userAnswer !== expected) {
                return interaction.reply({ content: 'Zła odpowiedź. Spróbuj jeszcze raz.', flags: MessageFlags.Ephemeral });
            }

            const member = interaction.member;
            if (!member || !member.roles) {
                return interaction.reply({ content: 'Nie mogę pobrać Twoich ról. Spróbuj ponownie.', flags: MessageFlags.Ephemeral });
            }

            const role = interaction.guild.roles.cache.get(VERIFIED_ROLE_ID);
            if (!role) {
                return interaction.reply({ content: 'Nie znaleziono roli weryfikacji na serwerze.', flags: MessageFlags.Ephemeral });
            }

            try {
                if (member.roles.cache.has(VERIFIED_ROLE_ID)) {
                    return interaction.reply({ content: 'Masz już tę rangę.', flags: MessageFlags.Ephemeral });
                }

                await member.roles.add(VERIFIED_ROLE_ID);
                return interaction.reply({ content: 'Poprawna odpowiedź. Nadano rangę!', flags: MessageFlags.Ephemeral });
            } catch (err) {
                return interaction.reply({ content: 'Nie mogę nadać rangi. Sprawdź uprawnienia bota i kolejność ról.', flags: MessageFlags.Ephemeral });
            }
        }
    },
};
