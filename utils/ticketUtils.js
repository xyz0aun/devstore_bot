const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../tickety.json');

let dbCache = null;

function getDb() {
    if (dbCache) return dbCache;

    if (!fs.existsSync(DB_PATH)) {
        dbCache = { tickets: {}, orders: {} };
        return dbCache;
    }
    try {
        dbCache = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
        return dbCache;
    } catch (err) {
        console.error('[TicketUtils] Error reading DB:', err);
        return { tickets: {}, orders: {} };
    }
}

function saveDb() {
    if (!dbCache) return;
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(dbCache, null, 2));
    } catch (err) {
        console.error('[TicketUtils] Error saving DB:', err);
    }
}

function getOpenTicket(userId) {
    const db = getDb();
    return db.tickets[userId] || null;
}

function getOpenOrder(userId) {
    const db = getDb();
    return db.orders[userId] || null;
}

function addTicket(userId, channelId) {
    const db = getDb();
    db.tickets[userId] = channelId;
    saveDb();
}

function addOrder(userId, channelId) {
    const db = getDb();
    db.orders[userId] = channelId;
    saveDb();
}

function removeTicket(userId) {
    const db = getDb();
    if (db.tickets[userId]) {
        delete db.tickets[userId];
        saveDb();
    }
}

function removeOrder(userId) {
    const db = getDb();
    if (db.orders[userId]) {
        delete db.orders[userId];
        saveDb();
    }
}

function removeByChannelId(channelId) {
    const db = getDb();
    let found = false;

    for (const userId in db.tickets) {
        if (db.tickets[userId] === channelId) {
            delete db.tickets[userId];
            found = true;
            break;
        }
    }

    if (!found) {
        for (const userId in db.orders) {
            if (db.orders[userId] === channelId) {
                delete db.orders[userId];
                found = true;
                break;
            }
        }
    }

    if (found) {
        saveDb();
    }
}

module.exports = {
    getOpenTicket,
    getOpenOrder,
    addTicket,
    addOrder,
    removeTicket,
    removeOrder,
    removeByChannelId
};
