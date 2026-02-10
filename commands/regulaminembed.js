const { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const TextDisplayBuilder = require('../utils/TextDisplayBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('regulaminembed')
        .setDescription('Wysyła embed z informacjami (tylko dla właściciela serwera).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const allowedRoleId = '866995316510949376';
        const hasRole = Boolean(interaction.member?.roles?.cache?.has(allowedRoleId));
        if (!hasRole) {
            return interaction.reply({ content: 'Nie masz uprawnień do użycia tej komendy.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const channel = interaction.channel;
        if (!channel) {
            console.error('[ERROR] Could not access the channel where the command was executed');
            return interaction.editReply({ content: 'Nie udało się znaleźć kanału!', flags: MessageFlags.Ephemeral });
        }

        if (!channel.permissionsFor(interaction.guild.members.me).has(['SendMessages'])) {
            console.error(`[ERROR] Bot lacks SendMessages permission in channel ${channel.id}`);
            return interaction.editReply({ content: 'Błąd: Bot nie ma uprawnień do wysyłania wiadomości na tym kanale!', flags: MessageFlags.Ephemeral });
        }

        const body =
                "```🧿 • DEVSTORE.PL - Regulamin```\n" +
                `# §1 Zasady Ogólne\n` +
                `Witamy na **DEVSTORE.PL**, Twojej platformie dla pluginów, map i innych usług!\n` +
                `Dołączając, akceptujesz poniższe zasady, które zapewniają porządek i przyjazną atmosferę.\n\n` +
                `**1.1** Serwer **DEVSTORE.PL** oferuje autorskie pluginy, mapy, skrypty i inne dodatki do Minecrafta stworzone przez nasz zespół.\n` +
                `**1.2** Wszystkie materiały są chronione prawami autorskimi i należą do **DEVSTORE.PL**.\n` +
                `**1.3** Każdy użytkownik zobowiązuje się przestrzegać regulaminu.\n\n` +
                `# §2 Kultura i Zachowanie\n` +
                `**2.1** Zabrania się:\n` +
                `- Używania wulgaryzmów, obrażania, dyskryminacji lub wywoływania konfliktów.\n` +
                `- Spamowania, nadużywania wzmianek (@everyone, @here) bez zgody administracji.\n` +
                `- Reklamowania innych serwerów, produktów lub usług bez zgody.\n` +
                `- Publikowania treści nielegalnych, obraźliwych lub naruszających prawa autorskie.\n` +
                `**2.2** Używaj kanałów zgodnie z ich przeznaczeniem, np. #tickety dla pytań o zakupy.\n` +
                `**2.3** Podszywanie się pod innych lub manipulowanie treściami (np. fałszywe zrzuty ekranu) jest zabronione.\n` +
                `**2.4** Nie twórz nieoficjalnych grup ani serwerów promujących nasze materiały bez zgody.\n\n` +
                `# §3 Materiały i Usługi\n` +
                `**3.1** Zabrania się kopiowania, modyfikowania lub udostępniania naszych materiałów bez zgody.\n` +
                `**3.2** Zgłaszaj błędy lub propozycje na dedykowanych kanałach, np. #tickety.\n` +
                `**3.3** Dekompilacja lub ingerencja w kod pluginów jest surowo zabroniona.\n` +
                `**3.4** Naruszenie licencji skutkuje zablokowaniem dostępu do produktów.\n\n` +
                `# §4 Weryfikacja i Dostęp\n` +
                `**4.1** Aby uzyskać dostęp do darmowej strefy, wyślij zrzut ekranu na kanale potwierdzający:\n` +
                `- Polubienie i skomentowanie najnowszego filmu na https://www.youtube.com/@devstoreee\n` +
                `- Subskrypcję kanału YouTube **DEVSTORE.PL**.\n` +
                `**4.2** Weryfikacja matematyczna jest wymagana do uzyskania roli weryfikacyjnej.\n\n` +
                `# §5 Zakupy i Transakcje\n` +
                `**5.1** Zakupy są ostateczne i nie podlegają zwrotom.\n` +
                `**5.2** Problemy z produktami zgłaszaj na #tickety w ciągu 7 dni od zakupu.\n` +
                `**5.3** Próby nieautoryzowanego cofnięcia płatności (chargeback) lub udostępniania produktów skutkują banem.\n` +
                `**5.4** Licencja jest dożywotnia, ale może zostać cofnięta za naruszenia.\n\n` +
                `# §6 Administracja i Kary\n` +
                `**6.1** Administracja egzekwuje regulamin i może nałożyć kary: ostrzeżenie, wyciszenie, ban.\n` +
                `**6.2** Odwołania od kar zgłaszaj na #tickety (odpowiedź w ciągu 24h).\n` +
                `**6.3** Zabrania się bezpodstawnego pingowania administracji lub działań szkodliwych dla serwera.\n` +
                `**6.4** Administracja może ograniczyć dostęp do kanałów w celu wyjaśnienia sytuacji.\n\n` +
                `# §7 Postanowienia Końcowe\n` +
                `**7.1** Regulamin może być aktualizowany – zmiany pojawią się na #ogloszenia.\n` +
                `**7.2** Pytania? Skontaktuj się przez #tickety.\n` +
                "**7.3** Dziękujemy za dołączenie i życzymy udanych zakupów! 🚀\n" +
                `\n# ❗ INFORMACJA ❗
                Sprostowanie i dodatkowe info cd. usług i zwrotów.
                Nie odpowiadamy też za błędy klientów z powodu zaniedbań lub nie stosowania się do naszych sugestii!
                Zwrot nie przysługuje:
                > W przypadku gdy usługa została wysłana klientowi
                > Ponieważ: Usługi świadczone przez nas to usługi cyfrowe i często personalizowane. W przypadku gdy klient dostaje plugin czy stronę dostaje dożywotnie wsparcie i aktualizacje poprawki błędów itd. Zwrot nie jest możliwy ze względu na fakt tego ze ktoś dostanie pieniądze a plugin dalej mu zostaje. Jest to zabezpieczenie na takie mnożenie darmowych pluginów itd i na obiekt cyfrowy aktywowany lub do pobrania nie przysługuje zwrot a informacja o tym jest jasno podana.
                **Strefa premium**
                > Ponieważ: jest to strefa której koszt dożywotni wynosi 10zł nie jest to dużo a jeśli ktoś dokonuje jej zakupu może tak samo pobrać sobie kontent premium`;

        const button = new ButtonBuilder()
            .setCustomId('regulamin')
            .setLabel('×⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀Przeczytaj regulamin⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀×')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);

        try {

            const display = new TextDisplayBuilder();
            display.addTextDisplayComponents((t) => t.setContent(body));
            display.addMediaGalleryComponents((gallery) =>
                gallery.addItems((item) =>
                    item.setURL(
                        'https://cdn.discordapp.com/attachments/1467262078187340041/1467280382809604138/EMBEDDEVSTORE.png?ex=697fced8&is=697e7d58&hm=ae94e4a3e1dc3dc253a471ed3be112917180e31b1f7109dcc8d1b29893b5d080&',
                    ),
                ),
            );
            display.addActionRowComponents((row) => row.setComponents(button));

            await channel.send({ components: [display], flags: MessageFlags.IsComponentsV2 });
            await interaction.editReply({ content: 'Embed z informacjami został wysłany!', flags: MessageFlags.Ephemeral });
            console.log(`[INFO] Access embed sent by ${interaction.user.tag} to channel ${channel.id}`);
        } catch (error) {
            console.error(`[ERROR] Failed to send access embed to channel ${channel.id}: ${error.message}`);
            await interaction.editReply({ content: 'Wystąpił błąd podczas wysyłania embeda!', flags: MessageFlags.Ephemeral });
        }
    },
};