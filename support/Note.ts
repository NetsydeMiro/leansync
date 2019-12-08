import { v1 } from 'uuid'

import { MockSyncedTable } from './MockSyncedTable'

export interface Note {
    id: string
    text: string
    updatedAt: Date
    syncedAt?: Date
}

export function newNote(text: string, updatedAt: Date = new Date()): Note {
    return { id: v1().toString(), text, updatedAt }
}

export class NotesDatabase extends MockSyncedTable<Note> {

    static createPopulated(numberOfNotes: number, syncedAt: Date): NotesDatabase {
        let db = new NotesDatabase()

        for (let ix = 1; ix <= numberOfNotes; ix++) {
            db.add(newNote(`Note ${ix}`, syncedAt), syncedAt)
        }
        return db
    }
}