import { LeanSyncServer, LeanSyncServerConfig, ConflictResolutionStrategy } from '../src/LeanSyncServer'
import { MockSyncedTable } from '../support/MockSyncedTable'
import { v1 } from 'uuid'

interface Note {
    key: string
    text: string
    syncedAt?: Date
}

class NotesDatabase extends MockSyncedTable<Note> {}

function createNotesDb(numberOfNotes: number, syncedAt: Date) : NotesDatabase {
    let db = new NotesDatabase()

    for(let ix = 1; ix <= numberOfNotes; ix++) {
        db.add({ key: v1().toString(), text: `Note ${ix}` }, syncedAt)
    }
    return db
}

function createConfig(db: NotesDatabase, conflictResolutionStrategy: ConflictResolutionStrategy<Note>): LeanSyncServerConfig<Note> {
    let config: LeanSyncServerConfig<Note> = {
        keySelector: (note) => note.key,
        isNewEntity: (note) => !note.syncedAt,
        areEqual: (note1, note2) => note1.text == note2.text, 
        getServerEntities: (keys) => db.byKey(keys), 
        getServerEntitiesSyncedSince: (syncStamp) => db.syncedSince(syncStamp), 
        updateEntity: (clientEntity, syncStamp) => db.update(clientEntity, syncStamp), 
        createEntity: (clientEntity, syncStamp) => db.add(clientEntity, syncStamp), 
        conflictResolutionStrategy: conflictResolutionStrategy
    }

    return config
}

async function createSyncState(numberOfNotes: number, syncStamp: Date, conflictResolutionStrategy: ConflictResolutionStrategy<Note> = 'takeClient'): Promise<[NotesDatabase, Array<Note>, LeanSyncServer<Note>]> {
    let db = createNotesDb(numberOfNotes, syncStamp)
    let clientNotes = await db.syncedSince()
    let config = createConfig(db, conflictResolutionStrategy)
    let leanSync = new LeanSyncServer(config)

    return [db, clientNotes, leanSync]
}

describe('LeanSyncServer', () => {

    it('Creates new entities', async () => {
        let testStart = new Date()

        let [db, clientNotes, leanSync] = await createSyncState(0, testStart)

        // create a couple new entities on client end
        clientNotes.push({ key: v1().toString(), text: 'Note 1' })
        clientNotes.push({ key: v1().toString(), text: 'Note 2' })

        // sync them
        let syncResult = await leanSync.sync(clientNotes)

        // there should now be 2 entries at server end
        expect(db.rows.length).toBe(clientNotes.length)

        // each server note should match what client submitted
        for(let ix = 0; ix < db.rows.length; ix++) {
            expect(db.rows[ix].text).toBe(clientNotes[ix].text)
            expect(db.rows[ix].key).toBe(clientNotes[ix].key)
            expect(db.rows[ix].syncedAt.getTime()).toBeGreaterThanOrEqual(testStart.getTime())
        }

        // the client should be informed that the new entries synched successfully
        expect(syncResult.syncedEntities.length).toBe(2)
        expect(syncResult.conflictedEntities.length).toBe(0)
        expect(syncResult.syncStamp.getTime()).toBeGreaterThanOrEqual(testStart.getTime())

        for(let ix = 0; ix < db.rows.length; ix++) {
            expect(syncResult.syncedEntities[ix].entity.text).toBe(clientNotes[ix].text)
            expect(syncResult.syncedEntities[ix].entity.key).toBe(clientNotes[ix].key)
            expect(syncResult.syncedEntities[ix].newKey).toBeUndefined()
        }
    })

    it('Creates new entities and notifies client of key updates in case of conflict', async () => {
        let testStart = new Date()

        let [db, clientNotes, leanSync] = await createSyncState(2, testStart)

        // alter client notes so that it appears we've created new ones with existing ids
        clientNotes[0].syncedAt = null
        clientNotes[0].text = 'Note 3'
        clientNotes[1].syncedAt = null
        clientNotes[1].text = 'Note 4'

        let syncResult = await leanSync.sync(clientNotes)

        // server creates new entities
        expect(db.rows.length).toBe(4)

        // server entities match what we created
        expect(db.rows[2].text).toBe(clientNotes[0].text)
        expect(db.rows[3].text).toBe(clientNotes[1].text)

        expect(syncResult.conflictedEntities.length).toBe(0)
        expect(syncResult.syncStamp.getTime()).toBeGreaterThanOrEqual(testStart.getTime())

        // client should be notified of new entries, and the fact that we should adjust their keys
        for(let ix = 0; ix < clientNotes.length; ix++) {
            expect(syncResult.syncedEntities[ix].entity.text).toBe(clientNotes[ix].text)
            expect(syncResult.syncedEntities[ix].entity.key).toBe(clientNotes[ix].key)
            expect(syncResult.syncedEntities[ix].newKey).toBe(db.rows[ix+2].key)
        }
    })


    it('Updates server entities when using takeClient resolution', async () => {
        let testStart = new Date()

        let [db, clientNotes, leanSync] = await createSyncState(2, testStart)

        // update notes on client side
        clientNotes[0].text = 'Updated 1'
        clientNotes[1].text = 'Updated 2'

        let syncResult = await leanSync.sync(clientNotes)

        // db rows should be updated
        for(let ix = 0; ix < clientNotes.length; ix++) {
            expect(db.rows[ix].text).toBe(clientNotes[ix].text)
            expect(db.rows[ix].syncedAt.getTime()).toBeGreaterThanOrEqual(clientNotes[ix].syncedAt.getTime())
        }

        expect(db.rows[0].syncedAt).toEqual(db.rows[1].syncedAt)
        expect(syncResult.syncedEntities.length).toBe(2)
        expect(syncResult.syncStamp.getTime()).toBeGreaterThanOrEqual(testStart.getTime())
    })


    it('Does not update server entities and notifies client of updates when using takeServer resolution', async () => {
        let testStart = new Date()

        let [db, clientNotes, leanSync] = await createSyncState(2, testStart, 'takeServer')

        // update notes on the client
        clientNotes[0].text = 'Updated 1'
        clientNotes[1].text = 'Updated 2'

        let lastSync = new Date(2001, 1, 1)
        let syncResult = await leanSync.sync(clientNotes, lastSync)

        clientNotes.forEach((clientNote, ix) => {
            expect(db.rows[ix].text).not.toBe(clientNote.text)
        })

        expect(syncResult.conflictedEntities.length).toBe(0)
        expect(syncResult.syncStamp.getTime()).toBeGreaterThanOrEqual(testStart.getTime())

        // sync result should inform us that client needs to update its entities
        expect(syncResult.syncedEntities.length).toBe(2)
        expect(syncResult.syncedEntities[0].entity.text).toBe(db.rows[0].text)
        expect(syncResult.syncedEntities[1].entity.text).toBe(db.rows[1].text)
    })


    it('Does not update server entities and notifies client of conflicts when using askClient resolution', async () => {
        let testStart = new Date()

        let [db, clientNotes, leanSync] = await createSyncState(2, testStart, 'askClient')

        clientNotes[0].text = 'Updated 1'
        clientNotes[1].text = 'Updated 2'

        let lastSync = new Date(2001, 1, 1)
        let syncResult = await leanSync.sync(clientNotes, lastSync)

        clientNotes.forEach((clientNote, ix) => {
            expect(db.rows[ix].text).not.toBe(clientNote.text)
        })

        expect(syncResult.syncedEntities.length).toBe(0)
        expect(syncResult.syncStamp.getTime()).toBeGreaterThanOrEqual(testStart.getTime())

        // sync result should inform us that client needs to resolve conflicts
        expect(syncResult.conflictedEntities.length).toBe(2)
        expect(syncResult.conflictedEntities[0].text).toBe(db.rows[0].text)
        expect(syncResult.conflictedEntities[1].text).toBe(db.rows[1].text)
    })


    // Add test to ensure that custom function modifies the sync result
    it('Runs custom conflict resolution strategy if specified', async () => {
        let testStart = new Date()

        let customConflictResolver = jest.fn()
        let [db, clientNotes, leanSync] = await createSyncState(2, testStart, customConflictResolver)

        clientNotes[0].text = 'Updated 1'
        clientNotes[1].text = 'Updated 2'

        let lastSync = new Date(2001, 1, 1)
        let syncResult = await leanSync.sync(clientNotes, lastSync)

        clientNotes.forEach((clientNote, ix) => {
            expect(db.rows[ix].text).not.toBe(clientNote.text)
        })

        expect(syncResult.conflictedEntities.length).toBe(0)
        expect(syncResult.syncedEntities.length).toBe(0)
        expect(syncResult.syncStamp.getTime()).toBeGreaterThanOrEqual(testStart.getTime())

        expect(customConflictResolver.mock.calls.length).toBe(2)

        clientNotes.forEach((clientNote, ix) => {
            expect(customConflictResolver.mock.calls[ix][0]).toBe(clientNote)
            expect(customConflictResolver.mock.calls[ix][1]).toEqual(db.rows[ix])
            expect(customConflictResolver.mock.calls[ix][2].getTime()).toBeGreaterThanOrEqual(testStart.getTime())
            expect(customConflictResolver.mock.calls[ix][3]).toBe(syncResult)
        })
    })
})