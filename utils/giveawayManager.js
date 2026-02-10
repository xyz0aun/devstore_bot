const { MessageFlags } = require('discord.js');
const { getAllGiveaways, endGiveawayInDb, getGiveaway } = require('./giveawayUtils');

async function handleEnd(client, giveawayId) {
    const giveaway = getGiveaway(giveawayId);
    if (!giveaway || giveaway.ended) return;

    endGiveawayInDb(giveawayId);

    try {
        const fileGiveaway = getGiveaway(giveawayId); // Re-fetch from file to get latest participants
        if (!fileGiveaway) {
            console.log(`[Giveaway] Giveaway data missing for ${giveawayId}`);
            return;
        }
        console.log(`[Giveaway] Ending giveaway ${giveawayId}...`);

        const channel = await client.channels.fetch(fileGiveaway.channelId).catch(() => null);
        if (!channel) {
            console.log(`[Giveaway] Channel not found for ${giveawayId}`);
            return;
        }
        const message = await channel.messages.fetch(fileGiveaway.messageId).catch(() => null);
        if (!message) {
            console.log(`[Giveaway] Message not found for ${giveawayId}`);
            return;
        }

        const winners = [];
        const participants = [...(fileGiveaway.participants || [])];
        console.log(`[Giveaway] Participants: ${participants.length}, Winners Count: ${fileGiveaway.winnersCount}`);

        const count = Math.min(fileGiveaway.winnersCount, participants.length);

        if (participants.length > 0) {
            for (let i = 0; i < count; i++) {
                const idx = Math.floor(Math.random() * participants.length);
                winners.push(participants[idx]);
                participants.splice(idx, 1);
            }
        } else {
            console.log(`[Giveaway] No participants to pick from.`);
        }

        const winnersString = winners.length > 0 ? winners.map(w => `<@${w}>`).join(', ') : 'Brak uczestników';
        console.log(`[Giveaway] Winners picked: ${winnersString}`);

        await message.reply({
            content: `<:1446312424067043348:1458935222677536992> **KONKURS ZAKOŃCZONY!** <:1446312424067043348:1458935222677536992>\n> **Nagroda:** ${giveaway.prize}\n> **Zwycięzcy:** ${winnersString}`
        });

        const TextDisplayBuilder = require('./TextDisplayBuilder');
        const display = new TextDisplayBuilder()
            .setGiveawayContent({
                prize: fileGiveaway.prize,
                endTime: fileGiveaway.endTime,
                winnersCount: fileGiveaway.winnersCount,
                participantCount: fileGiveaway.participants ? fileGiveaway.participants.length : 0,
                ended: true,
                winners: winnersString
            });

        await message.edit({ components: [display], flags: MessageFlags.IsComponentsV2 });
        console.log(`[Giveaway] Giveaway ${giveawayId} updated successfully.`);

    } catch (err) {
        console.error(`[Giveaway] Error ending giveaway ${giveawayId}:`, err);
    }
}

function scheduleGiveaway(client, giveawayId, endTime) {
    const timeLeft = endTime - Date.now();
    if (timeLeft <= 0) {
        handleEnd(client, giveawayId);
    } else {
        setTimeout(() => handleEnd(client, giveawayId), timeLeft);
    }
}

function initGiveaways(client) {
    const giveaways = getAllGiveaways();
    let activeCount = 0;

    for (const id in giveaways) {
        const g = giveaways[id];
        if (g.ended) continue;

        activeCount++;
        scheduleGiveaway(client, id, g.endTime);
    }
    console.log(`[Giveaway] Loaded ${activeCount} active giveaways.`);
}

module.exports = { initGiveaways, scheduleGiveaway };
