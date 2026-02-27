// active_users module to track active users in the homepage editor
// it manages an active_users.json state file that is updated by get and post requests to the /active_users endpoint provided by the main app (Server)
import fs from 'fs';
import path from 'path';

const ACTIVE_USERS_FILE = path.join(process.cwd(), 'state/active_users.json');

export function getActiveUsers() {
    try {
        let users_data = fs.readFileSync(ACTIVE_USERS_FILE, 'utf-8');
        users_data = purgeInactiveUsers(JSON.parse(users_data));
        return users_data;
    } catch (err) {
        console.error('Error reading active users file:', err);
        return [];
    }
}

function purgeInactiveUsers(users_data) {
    if (Array.isArray(users_data) && users_data.length > 0) {
        // purge not active users (no ping for more than 30 seconds)
        const now = new Date();
        const max_inactive_interval = 30 * 1000; // 30 seconds
        users_data = users_data.filter(user => {
            return (now - new Date(user.last_ping)) < max_inactive_interval;
        });
    }
    return users_data;
}

export function addActiveUser(data) {
    let active_users = getActiveUsers();
    if (data && data.user && data.user.username && data.status === 'active') {
        let user_index = active_users.findIndex(x => x.username == data.user.username);
        if (user_index >= 0) {
            if (typeof active_users[user_index].tabs != 'object') {
                active_users[user_index].tabs = {};
            }
            if (data.tab_id && !Object.keys(active_users[user_index].tabs).includes(data.tab_id)) {
                active_users[user_index].tabs[data.tab_id] = data.edition_id;
            }
        } else {
            let active_user = JSON.parse(JSON.stringify(data.user));
            active_user.tabs = {};
            active_user.tabs[data.tab_id] = data.edition_id;
            active_users.push(active_user);
        }
    }
    if (active_users) {
        fs.writeFileSync(ACTIVE_USERS_FILE, JSON.stringify(active_users, null, 2));
    }
    return getActiveUsers();
}

export function removeActiveUser(userId) {
    let activeUsers = getActiveUsers();
    activeUsers = activeUsers.filter(u => u.id !== userId);
    fs.writeFileSync(ACTIVE_USERS_FILE, JSON.stringify(activeUsers, null, 2));
    return getActiveUsers();
}

export function clearActiveUsers() {
    fs.writeFileSync(ACTIVE_USERS_FILE, JSON.stringify([], null, 2));
    return [];
}

export function handle(msg) {
    let msg_to_broadcast;
    if (msg && msg.context == 'active_users') {
        let active_users_data;
        if (msg.type == 'add') {
            active_users_data = addActiveUser(msg.data);
        } else if (msg.type == 'remove') {
            active_users_data = removeActiveUser(msg.data.id);
        }
        if (active_users_data) {
            msg_to_broadcast = {
                context: 'active_users',
                data: active_users_data
            };
        }
    }
    return msg_to_broadcast;
}
