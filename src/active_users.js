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
        // purge not active users (no ping for more than 60 seconds)
        const now = new Date();
        const max_inactive_interval = 60 * 1000; // 60 seconds
        users_data = users_data.filter(user => {
            return (now - new Date(user.last_ping)) < max_inactive_interval;
        });
    }
    return users_data;
}

export function addActiveUser(msg) {
    let active_users = getActiveUsers();
    if (msg && msg.data && msg.client && msg.client.user && msg.client.user.username && msg.data.status === 'active') {
        let user_index = active_users.findIndex(x => x.username == msg.client.user.username);
        if (user_index >= 0) {
            if (typeof active_users[user_index].tabs != 'object') {
                active_users[user_index].tabs = {};
            }
            if (msg.client.tab_id && !Object.keys(active_users[user_index].tabs).includes(msg.client.tab_id)) {
                active_users[user_index].tabs[msg.client.tab_id] = msg.data.edition_id;
            }
            active_users[user_index].last_ping = msg.data.last_ping;
        } else {
            let active_user = JSON.parse(JSON.stringify(msg.client.user));
            active_user.first_ping = msg.data.first_ping;
            active_user.last_ping = msg.data.last_ping;
            active_user.tabs = {};
            active_user.tabs[msg.client.tab_id] = msg.data.edition_id;
            active_users.push(active_user);
        }
    }
    if (active_users) {
        fs.writeFileSync(ACTIVE_USERS_FILE, JSON.stringify(active_users, null, 2));
    }
    return getActiveUsers();
}

export function removeActiveUser(user_id) {
    let active_users = getActiveUsers();
    active_users = active_users.filter(u => u.id !== user_id);
    fs.writeFileSync(ACTIVE_USERS_FILE, JSON.stringify(active_users, null, 2));
    return getActiveUsers();
}

export function removeActiveUserTab(tab_id) {
    let active_users = getActiveUsers();
    let active_user_index = active_users.findIndex(u => typeof u.tabs == 'object' && Object.keys(u.tabs).includes(tab_id));
    if (active_user_index >= 0) {
        console.log('Found active user with tab_id, removing tab_id from user tabs', active_users[active_user_index]);
        delete active_users[active_user_index].tabs[tab_id];
        if (Object.keys(active_users[active_user_index].tabs).length == 0) {
            let user_id = active_users[active_user_index].id;
            return removeActiveUser(user_id);
        } else {
            fs.writeFileSync(ACTIVE_USERS_FILE, JSON.stringify(active_users, null, 2));
            return getActiveUsers();
        }
    } else {
        console.log('No active user found with tab_id: ', tab_id);
        return getActiveUsers();
    }
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
            active_users_data = addActiveUser(msg);
        } else if (msg.type == 'remove' && msg.client && msg.client.tab_id) {
            active_users_data = removeActiveUserTab(msg.client.tab_id);
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
