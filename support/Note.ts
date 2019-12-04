import { v1 } from 'uuid'

import { MockSyncedTable } from './MockSyncedTable'

export interface Note {
    key: string
    text: string
    updatedAt: Date
    syncedAt?: Date
}

export function newNote(text: string): Note {
    return { key: v1().toString(), text, updatedAt: new Date() }
}

export class NotesDatabase extends MockSyncedTable<Note> {

    static createPopulated(numberOfNotes: number, syncedAt: Date): NotesDatabase {
        let db = new NotesDatabase()

        for (let ix = 1; ix <= numberOfNotes; ix++) {
            db.add(newNote(`Note ${ix}`), syncedAt)
        }
        return db
    }
}