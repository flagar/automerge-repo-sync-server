// active_users module to track active users in the homepage editor
// it manages an active_users.json state file that is updated by get and post requests to the /active_users endpoint provided by the main app (Server)
import fs from 'fs';
import path from 'path';

const ACTIVE_USERS_FILE = path.join(process.cwd(), 'active_users.json');

export function getActiveUsers() {
    try {
        const data = fs.readFileSync(ACTIVE_USERS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading active users file:', err);
        return [];
    }
}

export function addActiveUser(user) {
    const activeUsers = getActiveUsers();
    if (!activeUsers.find(u => u.id === user.id)) {
        activeUsers.push(user);
        fs.writeFileSync(ACTIVE_USERS_FILE, JSON.stringify(activeUsers, null, 2));
    }
}

export function removeActiveUser(userId) {
    let activeUsers = getActiveUsers();
    activeUsers = activeUsers.filter(u => u.id !== userId);
    fs.writeFileSync(ACTIVE_USERS_FILE, JSON.stringify(activeUsers, null, 2));
}

export function clearActiveUsers() {
    fs.writeFileSync(ACTIVE_USERS_FILE, JSON.stringify([], null, 2));
}

