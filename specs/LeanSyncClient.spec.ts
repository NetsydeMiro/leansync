import { SyncResult } from '../src/shared'
import { Note, NotesDatabase } from '../support/Note'
import { LeanSyncClientConfig } from '../src/LeanSyncClient'

describe('LeanSyncClient', () => {

    test('Creates new entities', () => {
        let testStart = new Date()

        let db = NotesDatabase.createPopulated(2, testStart)

        let config: LeanSyncClientConfig<Note> = {
            keySelector: (note) => note.id,
            getClientEntitiesRequiringSync: () => db.getRequiringSync(),
            getClientEntities: (keys: Array<any>) => db.getByKey(keys),
            getLastSyncStamp: async () => testStart,

            updateEntity: (note, syncStamp, newKey?) => db.update(note, syncStamp, newKey),
            createEntity: (note, syncStamp) => db.add(note, syncStamp),
            syncWithServer: async (notes, lastSync) => {
                let result: SyncResult<Note>

                return result
            }

        }

    })
})