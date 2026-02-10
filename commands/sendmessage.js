const { SlashCommandBuilder, MessageFlags, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

const SENT_MESSAGES_FILE = path.join(__dirname, '..', 'sent_messages.json');

let sentMessages = {};
try {
    if (fs.existsSync(SENT_MESSAGES_FILE)) {
        sentMessages = JSON.parse(fs.readFileSync(SENT_MESSAGES_FILE, 'utf8'));
    }
} catch (error) {
    console.log('[SENDMESSAGE] Nie udało się załadować wysłanych wiadomości, tworzę nową bazę.');
    sentMessages = {};
}

const saveSentMessages = () => {
    try {
        fs.writeFileSync(SENT_MESSAGES_FILE, JSON.stringify(sentMessages, null, 2));
    } catch (error) {
        console.error('[SENDMESSAGE] Błąd podczas zapisywania wysłanych wiadomości:', error);
    }
};

const hasBeenSentRecently = (userId, messageId) => {
    const key = `${userId}_${messageId}`;
    const lastSent = sentMessages[key];
    if (!lastSent) return false;
    
    const hoursSinceLastSent = (Date.now() - lastSent) / (1000 * 60 * 60);
    return hoursSinceLastSent < 24;
};

const markAsSent = (userId, messageId) => {
    const key = `${userId}_${messageId}`;
    sentMessages[key] = Date.now();
    saveSentMessages();
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sendmessage')
        .setDescription('Wysyła wiadomość do wszystkich użytkowników na serwerze z opóźnieniami')
        .addStringOption(option =>
            option.setName('wiadomosc')
                .setDescription('Treść wiadomości do wysłania')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('opoznienie')
                .setDescription('Opóźnienie między wiadomościami w minutach (domyślnie 5)')
                .setMinValue(1)
                .setMaxValue(60)),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({ content: 'Tej komendy można użyć tylko na serwerze.', flags: MessageFlags.Ephemeral });
        }

        const member = interaction.member;
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: 'Tylko administratorzy mogą używać tej komendy.', flags: MessageFlags.Ephemeral });
        }

        const message = interaction.options.getString('wiadomosc');
        const delayMinutes = interaction.options.getInteger('opoznienie') || 5;
        const delayMs = delayMinutes * 60 * 1000;

        await interaction.reply({ 
            content: `📨 Rozpoczynam wysyłanie wiadomości do wszystkich użytkowników z opóźnieniem ${delayMinutes} minut.`, 
            flags: MessageFlags.Ephemeral 
        });

        try {
            const guild = interaction.guild;
            const members = await guild.members.fetch();
            
            const allMembers = members.filter(member => 
                !member.user.bot &&
                !hasBeenSentRecently(member.user.id, message)
            );

            if (allMembers.size === 0) {
                return await interaction.followUp({ 
                    content: '❌ Nie znaleziono użytkowników, którzy nie otrzymali tej wiadomości w ciągu ostatnich 24 godzin.', 
                    flags: MessageFlags.Ephemeral 
                });
            }

            console.log(`[SENDMESSAGE] Rozpoczynam wysyłanie do ${allMembers.size} użytkowników`);

            let sentCount = 0;
            let failedCount = 0;
            const memberArray = Array.from(allMembers.values());

            for (let i = 0; i < memberArray.length; i++) {
                const member = memberArray[i];
                
                try {
                    await member.send({
                        content: `📬 **Wiadomość z serwera ${guild.name}**\n\n${message}\n\n*Jeśli nie chcesz otrzymywać takich wiadomości, skontaktuj się z administracją serwera.*`
                    });
                    
                    markAsSent(member.user.id, message);
                    sentCount++;
                    console.log(`[SENDMESSAGE] Wysłano do ${member.user.tag} (${i + 1}/${memberArray.length})`);
                    
                    await interaction.followUp({ 
                        content: `✅ Wysłano do ${member.user.tag} (${sentCount}/${memberArray.length})`, 
                        flags: MessageFlags.Ephemeral 
                    });
                    
                } catch (error) {
                    failedCount++;
                    console.error(`[SENDMESSAGE] Błąd podczas wysyłania do ${member.user.tag}:`, error.message);
                }

                if (i < memberArray.length - 1) {
                    console.log(`[SENDMESSAGE] Czekam ${delayMinutes} minut przed następną wiadomością...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }

            const finalMessage = `📊 **Zakończono wysyłanie wiadomości**\n\n` +
                `✅ Pomyślnie wysłano: ${sentCount}\n` +
                `❌ Nie udało się wysłać: ${failedCount}\n` +
                `📊 Łącznie użytkowników: ${memberArray.length}\n` +
                `⏰ Opóźnienie: ${delayMinutes} minut`;

            await interaction.followUp({ 
                content: finalMessage, 
                flags: MessageFlags.Ephemeral 
            });

        } catch (error) {
            console.error('[SENDMESSAGE] Błąd podczas wykonywania komendy:', error);
            await interaction.followUp({ 
                content: '❌ Wystąpił błąd podczas wysyłania wiadomości. Sprawdź konsolę dla szczegółów.', 
                flags: MessageFlags.Ephemeral 
            });
        }
    },
};
