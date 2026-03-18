// sections module to track active sections in the homepage editor
// it manages an sections.json state file that is updated by get and post requests to the /sections endpoint provided by the main app (Server)
import fs from 'fs';
import path from 'path';

const SECTIONS_FILE = path.join(process.cwd(), 'state/sections.json');

export function getSections() {
    try {
        let sections_data = fs.readFileSync(SECTIONS_FILE, 'utf-8');
        sections_data = purgeObsoleteSections(JSON.parse(sections_data));
        return sections_data;
    } catch (err) {
        console.error('Error reading sections file:', err);
        return [];
    }
}

function purgeObsoleteSections(sections_data) {
    if (Array.isArray(sections_data) && sections_data.length > 0) {
        sections_data = sections_data.filter(lock => {
            return true; // for now we keep all sections, but we could implement a purge mechanism
        });
    }
    return sections_data;
}

export function updateSection(msg) {
    console.log('Updating section: ', msg);
    let actually_update = false;
    let sections_data = getSections();
    let section_data;
    if (msg && msg.data && msg.data.edition_id && msg.data.section && msg.data.section.id > 0) {
        section_data = JSON.parse(JSON.stringify(msg.data));
        section_data.timestamp = msg.timestamp;
        let section_index = sections_data.findIndex(s => s.edition_id == msg.data.edition_id && s.section && s.section.id == msg.data.section.id);
        if (section_index >= 0) {
            if (sections_data[section_index].timestamp < msg.timestamp) {
                sections_data[section_index] = section_data;
                actually_update = true;
            } else {
                console.warn('Section ' + msg.data.section.id + ' is already up to date', sections_data[section_index]);
            }
        } else {
            sections_data.push(section_data);
            actually_update = true;
        }
    }
    if (actually_update) {
        console.log('Writing sections data to file:', sections_data);
        fs.writeFileSync(SECTIONS_FILE, JSON.stringify(sections_data, null, 2));
    }
    if (section_data) {
        return section_data;
    } else {
        return getSections();
    }
}

export function clearSections() {
    fs.writeFileSync(SECTIONS_FILE, JSON.stringify([], null, 2));
    return [];
}

export function handle(msg) {
    let msg_to_broadcast;
    if (msg && msg.context == 'sections') {
        console.log('Handling sections message: ', msg);
        let return_data;
        if (msg.type == 'update') {
            return_data = updateSection(msg); // actually single section data
        } else if (msg.type == 'clear') {
            return_data = clearSections(msg);
        } else if (msg.type == 'list') {
            return_data = getSections();
        }
        if (return_data) {
            if (return_data.ready_to_broadcast === true && return_data.msg_to_broadcast) {
                msg_to_broadcast = return_data.msg_to_broadcast;
            } else {
                msg_to_broadcast = {
                    context: 'sections',
                    data: return_data
                };
            }
        }
    }
    return msg_to_broadcast;
}
