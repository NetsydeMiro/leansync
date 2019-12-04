import { v1 } from 'uuid'

import { MockSyncedTable } from './MockSyncedTable'

export interface Note {
    key: string
    text: string
    syncedAt?: Date
}

export function newNote(text: string): Note {
    return { key: v1().toString(), text }
}

export class NotesDatabase extends MockSyncedTable<Note> {

    static createPopulated(numberOfNotes: number, syncedAt: Date): NotesDatabase {
        let db = new NotesDatabase()

        for (let ix = 1; ix <= numberOfNotes; ix++) {
            db.add({ key: v1().toString(), text: `Note ${ix}` }, syncedAt)
        }
        return db
    }
}
