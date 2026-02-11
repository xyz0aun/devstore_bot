const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    EmbedBuilder,
    MessageFlags,
    ModalBuilder,
    PermissionsBitField,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { addParticipant, getGiveaway } = require('../utils/giveawayUtils');
const { getOpenTicket, getOpenOrder, addTicket, addOrder, removeByChannelId } = require('../utils/ticketUtils');
const TextDisplayBuilder = require('../utils/TextDisplayBuilder');
const discordTranscripts = require('discord-html-transcripts');
const config = require('../config.json');
    

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

            try {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            } catch (err) {
                console.warn('[TICKET] Interaction timeout/error during deferReply');
                return;
            }

            const guild = interaction.guild;
            const member = interaction.member;
            if (!guild || !member) {
                return interaction.editReply({ content: 'Nie mogę pobrać danych serwera/użytkownika.' });
            }

            const openTicketId = getOpenTicket(interaction.user.id);
            if (openTicketId) {
                const openChannel = guild.channels.cache.get(openTicketId);
                if (openChannel) {
                    return interaction.editReply({ content: `Masz już otwarty ticket: ${openChannel}` });
                }
            }

            const prefix = TICKET_CHANNEL_PREFIX_BY_TYPE[categoryKey] || '';
            const nameUser = sanitizeChannelNamePart(interaction.user.username);
            const channelName = `${prefix}${nameUser}`.slice(0, 90);

            const ticketCategoryId = config.ticketKategories[categoryKey];
            if (!ticketCategoryId) {
                return interaction.editReply({ content: 'Niepoprawna kategoria ticketa.' });
            }

            const category = await guild.channels.fetch(ticketCategoryId).catch(() => null);
            if (!category || category.type !== ChannelType.GuildCategory) {
                return interaction.editReply({ content: 'Nie znaleziono kategorii ticketów (sprawdź ID kategorii).' });
            }

            const permissionOverwrites = [
                {
                    id: config.everyoneRole,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                ...config.ticketPermRoles.map((role) => {
                    return {
                        id: role,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory,
                            PermissionsBitField.Flags.AttachFiles,
                            PermissionsBitField.Flags.EmbedLinks,
                        ],
                    };
                }),
                {
                    id: interaction.user.id,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory,
                        PermissionsBitField.Flags.AttachFiles,
                        PermissionsBitField.Flags.EmbedLinks,
                    ],
                }
            ]

            try {
                const channel = await guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    parent: ticketCategoryId,
                    topic: `ticketOwner=${interaction.user.id};ticketType=${categoryKey}`,
                    permissionOverwrites: permissionOverwrites
                    //     [
                    //     {
                    //         id: guild.roles.everyone.id,
                    //         deny: [PermissionsBitField.Flags.ViewChannel],
                    //     },
                    //     {
                    //         id: '868384027453829120',
                    //         allow: [
                    //             PermissionsBitField.Flags.ViewChannel,
                    //             PermissionsBitField.Flags.SendMessages,
                    //             PermissionsBitField.Flags.ReadMessageHistory,
                    //             PermissionsBitField.Flags.AttachFiles,
                    //             PermissionsBitField.Flags.EmbedLinks,
                    //         ],
                    //     },
                    //     {
                    //         id: '1467281259402236097',
                    //         allow: [
                    //             PermissionsBitField.Flags.ViewChannel,
                    //             PermissionsBitField.Flags.SendMessages,
                    //             PermissionsBitField.Flags.ReadMessageHistory,
                    //             PermissionsBitField.Flags.AttachFiles,
                    //             PermissionsBitField.Flags.EmbedLinks,
                    //         ],
                    //     },
                    //     {
                    //         id: interaction.user.id,
                    //         allow: [
                    //             PermissionsBitField.Flags.ViewChannel,
                    //             PermissionsBitField.Flags.SendMessages,
                    //             PermissionsBitField.Flags.ReadMessageHistory,
                    //             PermissionsBitField.Flags.AttachFiles,
                    //             PermissionsBitField.Flags.EmbedLinks,
                    //         ],
                    //     },
                    // ],
                });

                const createdAt = Math.floor(Date.now() / 1000);
                const accountCreatedAt = Math.floor(interaction.user.createdTimestamp / 1000);
                const joinedServerAt = member?.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;

                const managementMenu = new StringSelectMenuBuilder()
                    .setCustomId(`ticket_manage:${interaction.user.id}`)
                    .setPlaceholder('Zarządzaj ticketem...')
                    .addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Zamknij')
                            .setDescription('Zamyka aktualny ticket')
                            .setValue('zamknij')
                            .setEmoji('🔒'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Dodaj użytkownika')
                            .setDescription('Dodaje użytkownika do ticketa')
                            .setValue('dodaj_uzytkownika')
                            .setEmoji('➕'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Usuń użytkownika')
                            .setDescription('Usuwa użytkownika z ticketa')
                            .setValue('usun_uzytkownika')
                            .setEmoji('➖'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Zmień nazwę')
                            .setDescription('Zmienia nazwę kanału')
                            .setValue('zmien_nazwe')
                            .setEmoji('📝'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Zmień kategorię')
                            .setDescription('Zmienia kategorię ticketa')
                            .setValue('zmien_kategorie')
                            .setEmoji('📁'),
                    );

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
                display.addActionRowComponents((row) => row.setComponents(managementMenu));

                addTicket(interaction.user.id, channel.id);
                const welcomeMsg = await channel.send({ components: [display], flags: MessageFlags.IsComponentsV2 });
                await welcomeMsg.pin().catch(() => {});
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

            try {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            } catch (err) {
                console.warn('[SHOP] Interaction timeout/error during deferReply');
                return;
            }

            const guild = interaction.guild;
            const member = interaction.member;
            if (!guild || !member) {
                return interaction.editReply({ content: 'Nie mogę pobrać danych serwera/użytkownika.' });
            }

            const openOrderId = getOpenOrder(interaction.user.id);
            if (openOrderId) {
                const openChannel = guild.channels.cache.get(openOrderId);
                if (openChannel) {
                    return interaction.editReply({ content: `Masz już otwarte zamówienie: ${openChannel}` });
                }
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

            const permissionOverwrites = [
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: interaction.user.id,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                },
                ...SHOP_STAFF_ROLE_IDS.map((roleId) => ({
                    id: roleId,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                })),
            ];

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

                const managementMenu = new StringSelectMenuBuilder()
                    .setCustomId(`shop_manage:${interaction.user.id}`)
                    .setPlaceholder('Zarządzaj zamówieniem...')
                    .addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Zamknij')
                            .setDescription('Zamyka aktualne zamówienie')
                            .setValue('zamknij')
                            .setEmoji('🔒'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Dodaj użytkownika')
                            .setDescription('Dodaje użytkownika do zamówienia')
                            .setValue('dodaj_uzytkownika')
                            .setEmoji('➕'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Usuń użytkownika')
                            .setDescription('Usuwa użytkownika z zamówienia')
                            .setValue('usun_uzytkownika')
                            .setEmoji('➖'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Zmień nazwę')
                            .setDescription('Zmienia nazwę kanału')
                            .setValue('zmien_nazwe')
                            .setEmoji('📝'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Zmień kategorię')
                            .setDescription('Zmienia kategorię zamówienia')
                            .setValue('zmien_kategorie')
                            .setEmoji('📁'),
                    );

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
                display.addActionRowComponents((row) => row.setComponents(managementMenu));

                addOrder(interaction.user.id, channel.id);
                const welcomeMsg = await channel.send({ components: [display], flags: MessageFlags.IsComponentsV2 });
                await welcomeMsg.pin().catch(() => {});
                return interaction.editReply({ content: `Utworzono zamówienie: ${channel}` });
            } catch (err) {
                console.error('[SHOP] create failed:', err);
                const details = err?.code ? ` (code: ${err.code})` : '';
                return interaction.editReply({ content: `Nie udało się utworzyć zamówienia. Sprawdź uprawnienia bota.${details}` });
            }
        }

        if (interaction.isStringSelectMenu() && (interaction.customId.startsWith('ticket_manage:') || interaction.customId.startsWith('shop_manage:'))) {
            const selectedValue = interaction.values?.[0];
            const [customIdPrefix, ownerId] = interaction.customId.split(':');
            const isTicket = customIdPrefix === 'ticket_manage';
            
            if (selectedValue === 'zamknij') {
                const channel = interaction.channel;
                if (!channel || channel.type !== ChannelType.GuildText) {
                    return safeEphemeralError(interaction, 'To nie jest poprawny kanał.');
                }

                const guild = interaction.guild;
                if (!guild) {
                    return safeEphemeralError(interaction, 'Nie mogę pobrać serwera.');
                }

                if (!ownerId) {
                    return safeEphemeralError(interaction, 'Nie mogę ustalić właściciela.');
                }

                try {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                } catch (err) {
                    return;
                }

                const staffRole = isTicket ? '1467281259402236097' : null; // Add shop staff role if needed or use SHOP_STAFF_ROLE_IDS
                const canClose =
                    config.ticketCloseRoles.some((role) => interaction.member?.roles?.cache?.has(role)) ||
                    (staffRole && interaction.member?.roles?.cache?.has(staffRole)) ||
                    interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageChannels) ||
                    interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);

                if (!canClose) {
                    return interaction.editReply({ content: 'Nie masz uprawnień do wykonania tej akcji.' });
                }

                const transcriptChannelId = isTicket ? config.transcriptChannelId : config.orderTranscriptChannelId;
                const transcriptChannel = interaction.guild.channels.cache.get(transcriptChannelId);
                
                const headerText = isTicket ? '⌚ • DEVSTORE.PL - Zapis Ticketów' : '⌚ • DEVSTORE.PL - Zapis Zamówień';
                
                const body = '\n> Zamknięto przez `' + interaction.user.tag + '`\n'
                    + '> Kanał: `' + interaction.channel.name + '`\n'
                    + '> Właściciel: `' + (interaction.guild.members.cache.get(ownerId)?.user?.tag || ownerId) + '`\n'
                    + '> Utworzono: `' + interaction.channel.createdAt + '`\n'
                    + '> Zamknięto: `' + interaction.createdAt + '`\n';

                const attachment = await discordTranscripts.createTranscript(interaction.channel, {
                    fileName: `transcript-${interaction.channel.name}.html`,
                });

                const display = new TextDisplayBuilder().setMessageContent({
                    header: '```' + headerText + '```',
                    body: body,
                });

                if (transcriptChannel) {
                    await transcriptChannel.send({ components: [display], files: [attachment], flags: MessageFlags.IsComponentsV2 });
                    await transcriptChannel.send({ files: [attachment] });
                }

                try {
                    setTimeout(() => {
                        removeByChannelId(channel.id);
                        channel.delete().catch(() => {});
                    }, 5000);

                    return interaction.editReply({ content: `${isTicket ? 'Ticket' : 'Zamówienie'} zamknięte i zostanie usunięte za 5 sekund.` });
                } catch (err) {
                    console.error(`[${isTicket ? 'TICKET' : 'SHOP'}] close failed:`, err);
                    return interaction.editReply({ content: 'Nie udało się zamknąć kanału. Sprawdź uprawnienia bota.' });
                }
            } else if (selectedValue === 'zmien_nazwe') {
                const modal = new ModalBuilder()
                    .setCustomId(`management_rename_modal:${ownerId}`)
                    .setTitle('Zmień nazwę');

                const input = new TextInputBuilder()
                    .setCustomId('new_name')
                    .setLabel('Nowa nazwa kanału')
                    .setValue(interaction.channel.name)
                    .setPlaceholder('np. pomoc-problem-z-botem')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(40);

                const row = new ActionRowBuilder().addComponents(input);
                modal.addComponents(row);

                await interaction.showModal(modal);
            } else if (selectedValue === 'zmien_kategorie') {
                const modal = new ModalBuilder()
                    .setCustomId(`management_recategory_modal:${ownerId}`)
                    .setTitle('Zmień kategorię');

                const input = new TextInputBuilder()
                    .setCustomId('new_category_id')
                    .setLabel('ID nowej kategorii')
                    .setPlaceholder('Wklej ID kategorii discord')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const row = new ActionRowBuilder().addComponents(input);
                modal.addComponents(row);

                await interaction.showModal(modal);
            } else if (selectedValue === 'dodaj_uzytkownika') {
                const modal = new ModalBuilder()
                    .setCustomId(`management_add_user_modal:${ownerId}`)
                    .setTitle('Dodaj użytkownika');

                const input = new TextInputBuilder()
                    .setCustomId('user_id')
                    .setLabel('ID użytkownika')
                    .setPlaceholder('Wklej ID użytkownika discord')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const row = new ActionRowBuilder().addComponents(input);
                modal.addComponents(row);

                await interaction.showModal(modal);
            } else if (selectedValue === 'usun_uzytkownika') {
                const modal = new ModalBuilder()
                    .setCustomId(`management_remove_user_modal:${ownerId}`)
                    .setTitle('Usuń użytkownika');

                const input = new TextInputBuilder()
                    .setCustomId('user_id')
                    .setLabel('ID użytkownika')
                    .setPlaceholder('Wklej ID użytkownika discord')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const row = new ActionRowBuilder().addComponents(input);
                modal.addComponents(row);

                await interaction.showModal(modal);
            } else {
                return interaction.reply({ content: 'Ta funkcjonalność zostanie dodana wkrótce!', flags: MessageFlags.Ephemeral });
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
        if (interaction.isModalSubmit() && interaction.customId.startsWith('management_rename_modal:')) {
            const ownerId = interaction.customId.split(':')[1];
            const newNameRaw = interaction.fields.getTextInputValue('new_name');
            const newName = sanitizeChannelNamePart(newNameRaw);

            if (!newName) {
                return interaction.reply({ content: 'Podaj poprawną nazwę.', flags: MessageFlags.Ephemeral });
            }

            const canManage = interaction.user.id === ownerId || 
                             interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageChannels) ||
                             interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);

            if (!canManage) {
                return interaction.reply({ content: 'Nie masz uprawnień do zarządzania tym kanałem.', flags: MessageFlags.Ephemeral });
            }

            try {
                await interaction.channel.setName(newName);
                return interaction.reply({ content: `Zmieniono nazwę kanału na \`${newName}\`.`, flags: MessageFlags.Ephemeral });
            } catch (err) {
                console.error('[MANAGEMENT] Rename failed:', err);
                return interaction.reply({ content: 'Nie udało się zmienić nazwy kanału.', flags: MessageFlags.Ephemeral });
            }
        }

        if (interaction.isModalSubmit() && interaction.customId.startsWith('management_recategory_modal:')) {
            const ownerId = interaction.customId.split(':')[1];
            const categoryId = interaction.fields.getTextInputValue('new_category_id').trim();

            if (!/^\d{17,20}$/.test(categoryId)) {
                return interaction.reply({ content: 'Podaj poprawne ID kategorii.', flags: MessageFlags.Ephemeral });
            }

            const canManage = interaction.user.id === ownerId || 
                             interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageChannels) ||
                             interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);

            if (!canManage) {
                return interaction.reply({ content: 'Nie masz uprawnień do zarządzania tym kanałem.', flags: MessageFlags.Ephemeral });
            }

            const category = interaction.guild.channels.cache.get(categoryId);
            if (!category || category.type !== ChannelType.GuildCategory) {
                return interaction.reply({ content: 'Nie znaleziono takiej kategorii na serwerze.', flags: MessageFlags.Ephemeral });
            }

            try {
                await interaction.channel.setParent(categoryId, { lockPermissions: false });
                return interaction.reply({ content: `Zmieniono kategorię kanału na \`${category.name}\`.`, flags: MessageFlags.Ephemeral });
            } catch (err) {
                console.error('[MANAGEMENT] Recategory failed:', err);
                return interaction.reply({ content: 'Nie udało się zmienić kategorii kanału.', flags: MessageFlags.Ephemeral });
            }
        }
        if (interaction.isModalSubmit() && interaction.customId.startsWith('management_add_user_modal:')) {
            const ownerId = interaction.customId.split(':')[1];
            const userId = interaction.fields.getTextInputValue('user_id').trim();

            if (!/^\d{17,20}$/.test(userId)) {
                return interaction.reply({ content: 'Podaj poprawne ID użytkownika.', flags: MessageFlags.Ephemeral });
            }

            const canManage = interaction.user.id === ownerId || 
                             interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageChannels) ||
                             interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);

            if (!canManage) {
                return interaction.reply({ content: 'Nie masz uprawnień do zarządzania tym kanałem.', flags: MessageFlags.Ephemeral });
            }

            try {
                await interaction.channel.permissionOverwrites.edit(userId, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                    AttachFiles: true,
                    EmbedLinks: true,
                });
                return interaction.reply({ content: `Dodano użytkownika <@${userId}> do kanału.`, flags: MessageFlags.Ephemeral });
            } catch (err) {
                console.error('[MANAGEMENT] Add user failed:', err);
                return interaction.reply({ content: 'Nie udało się dodać użytkownika do kanału.', flags: MessageFlags.Ephemeral });
            }
        }

        if (interaction.isModalSubmit() && interaction.customId.startsWith('management_remove_user_modal:')) {
            const ownerId = interaction.customId.split(':')[1];
            const userId = interaction.fields.getTextInputValue('user_id').trim();

            if (!/^\d{17,20}$/.test(userId)) {
                return interaction.reply({ content: 'Podaj poprawne ID użytkownika.', flags: MessageFlags.Ephemeral });
            }

            const canManage = interaction.user.id === ownerId || 
                             interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageChannels) ||
                             interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);

            if (!canManage) {
                return interaction.reply({ content: 'Nie masz uprawnień do zarządzania tym kanałem.', flags: MessageFlags.Ephemeral });
            }

            try {
                await interaction.channel.permissionOverwrites.delete(userId);
                return interaction.reply({ content: `Usunięto użytkownika <@${userId}> z kanału.`, flags: MessageFlags.Ephemeral });
            } catch (err) {
                console.error('[MANAGEMENT] Remove user failed:', err);
                return interaction.reply({ content: 'Nie udało się usunąć użytkownika z kanału.', flags: MessageFlags.Ephemeral });
            }
        }
    },
};
