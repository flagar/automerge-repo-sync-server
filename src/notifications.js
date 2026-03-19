// notifications module to track notifications in the homepage editor
// it manages a notifications.json state file that is updated by get and post requests to the /notifications endpoint provided by the main app (Server)
import fs from 'fs';
import path from 'path';
import { getFirstUserPing } from "./active_users.js";
const NOTIFICATIONS_FILE = path.join(process.cwd(), 'state/notifications.json');

export function getNotifications() {
    try {
        let notifications_data = fs.readFileSync(NOTIFICATIONS_FILE, 'utf-8');
        notifications_data = purgeObsoleteNotifications(JSON.parse(notifications_data));
        return notifications_data;
    } catch (err) {
        console.error('Error reading notifications file:', err);
        return [];
    }
}

function purgeObsoleteNotifications(notifications_data) {
    if (Array.isArray(notifications_data) && notifications_data.length > 0) {
        const first_user_ping = getFirstUserPing();
        if (first_user_ping) {
            // purge notifications that are older than the first user ping (assuming they are obsolete for all users)
            notifications_data = notifications_data.filter(notification => {
                let notification_timestamp;
                // if notification timestamp is integer, convert it to date, otherwise assume it's already a date string
                if (typeof notification.timestamp == 'number') {
                    notification_timestamp = new Date(notification.timestamp * 1000);
                } else {
                    notification_timestamp = new Date(notification.timestamp);
                }
                return notification_timestamp >= new Date(first_user_ping);
            });
        } else {
            // we could also implement a max age for notifications, e.g. 24 hours
            const max_age_interval = 24 * 60 * 60 * 1000; // 24 hours
            const now = new Date();
            notifications_data = notifications_data.filter(notification => {
                return (now - new Date(notification.timestamp)) < max_age_interval;
            });
        }
    }
    return notifications_data;
}

export function addNotifications(msg) {
    console.log('Adding notification: ', msg);
    let actually_add = false;
    let notifications_data = getNotifications();
    if (msg && typeof msg.data == 'object') {
        let nns;
        if (msg.data.length > 0) {
            nns = msg.data;
        } else {
            nns = [msg.data];
        }
        nns.forEach(nn => {
            let notification_data = JSON.parse(JSON.stringify(nn));
            //notification_data.user = { ...notification_data.user, ...JSON.parse(JSON.stringify(msg.client.user)) };
            let notification_index = notifications_data.findIndex(n => n.id == nn.id);
            if (notification_index >= 0) {
                if (notifications_data[notification_index].timestamp < nn.timestamp) {
                    notifications_data[notification_index] = notification_data;
                    actually_add = true;
                } else {
                    console.warn('Notification ' + nn.id + ' is already up to date', notifications_data[notification_index]);
                }
            } else {
                notifications_data.push(notification_data);
                actually_add = true;
            }
        });
    }
    if (actually_add) {
        console.log('Writing notifications data to file:', notifications_data);
        fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifications_data, null, 2));
    }
    return getNotifications();
}

export function clearNotifications() {
    fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify([], null, 2));
    return [];
}

export function handle(msg) {
    let msg_to_broadcast;
    if (msg && msg.context == 'notifications') {
        let notifications_data;
        if (msg.type == 'add') {
            notifications_data = addNotifications(msg);
        } else if (msg.type == 'clear') {
            notifications_data = clearNotifications();
        }
        if (notifications_data) {
            if (notifications_data.ready_to_broadcast === true && notifications_data.msg_to_broadcast) {
                msg_to_broadcast = notifications_data.msg_to_broadcast;
            } else {
                msg_to_broadcast = {
                    context: 'notifications',
                    data: notifications_data
                };
            }
        }
    }
    return msg_to_broadcast;
}
