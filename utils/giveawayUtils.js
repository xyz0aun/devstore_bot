const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../giveaways.json');

let dbCache = null;

function getAllGiveaways() {
    if (dbCache) return dbCache;

    if (!fs.existsSync(DB_PATH)) {
        dbCache = {};
        return dbCache;
    }
    try {
        const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
        if (Array.isArray(data)) {
            console.log('[GiveawayUtils] Detected legacy Array DB. Resetting to Object.');
            dbCache = {};
            return dbCache;
        }
        dbCache = data;
        return dbCache;
    } catch (err) {
        console.error('[GiveawayUtils] Error reading DB:', err);
        return {};
    }
}

function saveGiveaways() {
    if (!dbCache) return;
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(dbCache, null, 2));
    } catch (err) {
        console.error('[GiveawayUtils] Error saving DB:', err);
    }
}

function createGiveaway(data) {
    const db = getAllGiveaways();
    db[data.messageId] = data;
    saveGiveaways();
    console.log(`[GiveawayUtils] Created giveaway ${data.messageId}`);
}

function addParticipant(messageId, userId) {
    const db = getAllGiveaways();
    if (!db[messageId]) {
        console.error(`[GiveawayUtils] Giveaway ${messageId} not found for user ${userId}`);
        return false;
    }
    if (db[messageId].participants.includes(userId)) {
        console.log(`[GiveawayUtils] User ${userId} already in ${messageId}`);
        return false;
    }

    db[messageId].participants.push(userId);
    saveGiveaways();
    console.log(`[GiveawayUtils] Added user ${userId} to ${messageId}. Total: ${db[messageId].participants.length}`);
    return db[messageId].participants.length;
}

function removeParticipant(messageId, userId) {
    const db = getAllGiveaways();
    if (!db[messageId]) return false;

    const index = db[messageId].participants.indexOf(userId);
    if (index === -1) return false;

    db[messageId].participants.splice(index, 1);
    saveGiveaways();
    console.log(`[GiveawayUtils] Removed user ${userId} from ${messageId}`);
    return db[messageId].participants.length;
}

function getGiveaway(messageId) {
    const db = getAllGiveaways();
    return db[messageId] || null;
}

function parseDuration(durationStr) {
    const regex = /^(\d+)([smhd])$/;
    const match = durationStr.match(regex);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
        case 's': return value * 1000;
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        default: return null;
    }
}

function endGiveawayInDb(messageId) {
    const db = getAllGiveaways();
    if (db[messageId]) {
        db[messageId].ended = true;
        saveGiveaways();
    }
}

module.exports = {
    getAllGiveaways,
    createGiveaway,
    addParticipant,
    removeParticipant,
    getGiveaway,
    parseDuration,
    endGiveawayInDb
};
