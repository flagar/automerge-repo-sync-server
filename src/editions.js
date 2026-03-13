// editions module to track active editions in the homepage editor
// it manages an editions.json state file that is updated by get and post requests to the /editions endpoint provided by the main app (Server)
import fs from 'fs';
import path from 'path';

const EDITIONS_FILE = path.join(process.cwd(), 'state/editions.json');

export function getEditions() {
    try {
        let editions_data = fs.readFileSync(EDITIONS_FILE, 'utf-8');
        editions_data = purgeObsoleteEditions(JSON.parse(editions_data));
        return editions_data;
    } catch (err) {
        console.error('Error reading editions file:', err);
        return [];
    }
}

function purgeObsoleteEditions(editions_data) {
    if (Array.isArray(editions_data) && editions_data.length > 0) {
        editions_data = editions_data.filter(lock => {
            return true; // for now we keep all editions, but we could implement a purge mechanism
        });
    }
    return editions_data;
}

export function updateEdition(msg) {
    console.log('Updating edition: ', msg);
    let actually_update = false;
    let editions_data = getEditions();
    if (msg && msg.data && msg.data.id > 0) {
        let edition_data = {};
        edition_data.edition = JSON.parse(JSON.stringify(msg.data));
        edition_data.timestamp = msg.timestamp;
        edition_data.edition_id = msg.data.id;
        let edition_index = editions_data.findIndex(e => e.edition_id == msg.data.id);
        if (edition_index >= 0) {
            if (editions_data[edition_index].timestamp < msg.timestamp) {
                editions_data[edition_index] = edition_data;
                actually_update = true;
            } else {
                console.warn('Edition ' + msg.data.id + ' is already up to date', editions_data[edition_index]);
            }
        } else {
            editions_data.push(edition_data);
            actually_update = true;
        }
    }
    if (actually_update) {
        console.log('Writing editions data to file:', editions_data);
        fs.writeFileSync(EDITIONS_FILE, JSON.stringify(editions_data, null, 2));
    }
    return getEditions();
}

export function clearEditions() {
    fs.writeFileSync(EDITIONS_FILE, JSON.stringify([], null, 2));
    return [];
}

export function handle(msg) {
    let msg_to_broadcast;
    if (msg && msg.context == 'editions') {
        console.log('Handling editions message: ', msg);
        let editions_data;
        if (msg.type == 'update') {
            editions_data = updateEdition(msg);
        } else if (msg.type == 'clear') {
            editions_data = clearEditions(msg);
        }
        if (editions_data) {
            msg_to_broadcast = {
                context: 'editions',
                data: editions_data
            };
        }
    }
    return msg_to_broadcast;
}
