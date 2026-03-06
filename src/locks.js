// locks module to track locks in the homepage editor
// it manages an locks.json state file that is updated by get and post requests to the /locks endpoint provided by the main app (Server)
import fs from 'fs';
import path from 'path';

const LOCKS_FILE = path.join(process.cwd(), 'state/locks.json');

export function getLocks() {
    try {
        let locks_data = fs.readFileSync(LOCKS_FILE, 'utf-8');
        locks_data = purgeObsoleteLocks(JSON.parse(locks_data));
        return locks_data;
    } catch (err) {
        console.error('Error reading locks file:', err);
        return {};
    }
}

function purgeObsoleteLocks(locks_data) {
    if (Array.isArray(locks_data) && locks_data.length > 0) {
        locks_data = locks_data.filter(lock => {
            return true; // for now we keep all locks, but we could implement a purge mechanism
        });
    }
    return locks_data;
}

export function addSectionLock(msg) {
    console.log('Adding section lock for user:', msg);
    let actually_add = false;
    let locks_data = getLocks();
    if (msg && msg.data && msg.data.edition_id && msg.data.section_id && msg.data.user && msg.data.user.id) {
        let lock = JSON.parse(JSON.stringify(msg.data));
        lock.timestamp = msg.timestamp;
        if (typeof locks_data.sections != 'object') {
            locks_data.sections = [];
        }
        let lock_index = locks_data.sections.findIndex(l => l.edition_id == msg.data.edition_id && l.section_id == msg.data.section_id);
        if (lock_index >= 0) {
            if (locks_data.sections[lock_index].user.id == msg.data.user.id) {
                if (!locks_data.sections[lock_index].manual) { // update only if not manual lock
                    locks_data.sections[lock_index] = lock;
                    actually_add = true;
                }
            } else {
                console.warn('Section ' + msg.data.section_id + ' is already locked by another user:', locks_data.sections[lock_index].user);
            }
        } else {
            // if there is no lock for this edition, we add it to the locks data
            locks_data.sections.push(lock);
            actually_add = true;
        }
    }
    if (actually_add) {
        console.log('Writing locks data to file:', locks_data);
        fs.writeFileSync(LOCKS_FILE, JSON.stringify(locks_data, null, 2));
    }
    return getLocks();
}

export function removeSectionLock(msg) {
    console.log('Removing section lock for user:', msg);
    let actually_remove = false;
    let locks_data = getLocks();
    if (msg && msg.data && msg.data.edition_id && msg.data.section_id && msg.data.user && msg.data.user.id) {
        if (typeof locks_data.sections != 'object') {
            locks_data.sections = [];
        }
        let initial_sections_length = locks_data.sections.length;
        locks_data.sections = locks_data.sections.filter(lock => {
            return !(lock.user.id == msg.data.user.id && lock.edition_id == msg.data.edition_id && lock.section_id == msg.data.section_id);
        });
        if (initial_sections_length != locks_data.sections.length) {
            actually_remove = true;
        }
    }
    if (actually_remove) {
        console.log('Writing locks data to file:', locks_data);
        fs.writeFileSync(LOCKS_FILE, JSON.stringify(locks_data, null, 2));
    }
    return getLocks();
}

export function removeEditionSectionLocks(msg) {
    console.log('Removing edition section locks for user:', msg);
    let actually_remove = false;
    let locks_data = getLocks();
    if (msg && msg.data && msg.data.edition_id && msg.data.user && msg.data.user.id) {
        if (typeof locks_data.sections != 'object') {
            locks_data.sections = [];
        }
        let initial_sections_length = locks_data.sections.length;
        locks_data.sections = locks_data.sections.filter(lock => {
            return !(lock.user.id == msg.data.user.id && lock.edition_id == msg.data.edition_id && lock.manual === false);
        });
        if (initial_sections_length != locks_data.sections.length) {
            actually_remove = true;
        }
    }
    if (actually_remove) {
        console.log('Writing locks data to file:', locks_data);
        fs.writeFileSync(LOCKS_FILE, JSON.stringify(locks_data, null, 2));
    }
    return getLocks();
}

export function addEditionLock(msg) {
    console.log('Adding edition lock for user:', msg);
    let actually_add = false;
    let locks_data = getLocks();
    if (msg && msg.data && msg.data.edition_id && msg.data.user && msg.data.user.id) {
        let lock = JSON.parse(JSON.stringify(msg.data));
        lock.timestamp = msg.timestamp;
        if (typeof locks_data.editions != 'object') {
            locks_data.editions = [];
        }
        let lock_index = locks_data.editions.findIndex(l => l.edition_id == msg.data.edition_id);
        if (lock_index >= 0) {
            if (locks_data.editions[lock_index].user.id == msg.data.user.id) {
                locks_data.editions[lock_index] = lock;
                actually_add = true;
            } else {
                console.warn('Edition ' + msg.data.edition_id + ' is already locked by another user:', locks_data.editions[lock_index].user);
            }
        } else {
            // if there is no lock for this edition, we add it to the locks data
            locks_data.editions.push(lock);
            actually_add = true;
        }
    }
    if (actually_add) {
        console.log('Writing locks data to file:', locks_data);
        fs.writeFileSync(LOCKS_FILE, JSON.stringify(locks_data, null, 2));
    }
    return getLocks();
}

export function removeEditionLock(msg) {
    console.log('Removing edition lock for user:', msg);
    let actually_remove = false;
    let locks_data = getLocks();
    if (msg && msg.data && msg.data.edition_id && msg.data.user && msg.data.user.id) {
        if (typeof locks_data.editions != 'object') {
            locks_data.editions = [];
        }
        let initial_editions_length = locks_data.editions.length;
        locks_data.editions = locks_data.editions.filter(lock => {
            return !(lock.user.id == msg.data.user.id && lock.edition_id == msg.data.edition_id);
        });
        if (initial_editions_length != locks_data.editions.length) {
            actually_remove = true;
        }
    }
    if (actually_remove) {
        console.log('Writing locks data to file:', locks_data);
        fs.writeFileSync(LOCKS_FILE, JSON.stringify(locks_data, null, 2));
    }
    return getLocks();
}

export function clearLocks() {
    fs.writeFileSync(LOCKS_FILE, JSON.stringify({}, null, 2));
    return {};
}

export function handle(msg) {
    let msg_to_broadcast;
    if (msg && msg.context == 'locks') {
        console.log('Handling locks message: ', msg);
        let locks_data;
        if (msg.type == 'add_section_lock') {
            locks_data = addSectionLock(msg);
        } else if (msg.type == 'remove_section_lock') {
            locks_data = removeSectionLock(msg);
        } else if (msg.type == 'add_edition_lock') {
            locks_data = addEditionLock(msg);
        } else if (msg.type == 'remove_edition_lock') {
            locks_data = removeEditionLock(msg);
        } else if (msg.type == 'remove_edition_section_locks') {
            locks_data = removeEditionSectionLocks(msg);
        }
        if (locks_data) {
            msg_to_broadcast = {
                context: 'locks',
                data: locks_data
            };
        }
    }
    return msg_to_broadcast;
}