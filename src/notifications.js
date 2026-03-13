// notifications module to track notifications in the homepage editor
// it manages a notifications.json state file that is updated by get and post requests to the /notifications endpoint provided by the main app (Server)
import fs from 'fs';
import path from 'path';

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
        notifications_data = notifications_data.filter(lock => {
            return true; // for now we keep all notifications, but we could implement a purge mechanism
        });
    }
    return notifications_data;
}

export function addNotification(msg) {
    console.log('Adding notification: ', msg);
    let actually_add = false;
    let notifications_data = getNotifications();
    if (msg && msg.data) {
        let notification_data = JSON.parse(JSON.stringify(msg.data));
        notification_data.user = JSON.parse(JSON.stringify(msg.client.user));
        let notification_index = notifications_data.findIndex(n => n.id == msg.data.id);
        if (notification_index >= 0) {
            if (notifications_data[notification_index].timestamp < msg.data.timestamp) {
                notifications_data[notification_index] = notification_data;
                actually_add = true;
            } else {
                console.warn('Notification ' + msg.data.notification.id + ' is already up to date', notifications_data[notification_index]);
            }
        } else {
            notifications_data.push(notification_data);
            actually_add = true;
        }
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
    if (msg && msg.context == 'notifications') {
        if (msg.type == 'add') {
            return addNotification(msg);
        } else if (msg.type == 'clear') {
            return clearNotifications();
        }
    }
    return null;
}
