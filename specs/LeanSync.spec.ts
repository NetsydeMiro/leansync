import { LeanSyncServer, LeanSyncServerConfig } from '../src/LeanSyncServer'
import { MockSyncedTable } from '../support/MockSyncedTable'
import { v1 } from 'uuid'

interface Note {
    key: string
    text: string
    syncedAt?: Date
}

class NotesDatabase extends MockSyncedTable<Note> {}

function PopulateNotesDb(numberOfNotes: number, syncedAt: Date) : NotesDatabase {
    let db = new NotesDatabase()

    for(let ix = 1; ix <= numberOfNotes; ix++) {
        db.add({ key: v1().toString(), text: `Note ${ix}` }, syncedAt)
    }
    return db
}

function createConfig(db: NotesDatabase): LeanSyncServerConfig<Note> {
    let config: LeanSyncServerConfig<Note> = {
        keySelector: (note) => note.key,
        isNewEntity: (note) => !note.syncedAt,
        areEqual: (note1, note2) => note1.text == note2.text, 
        getServerEntities: (keys) => db.byKey(keys), 
        getServerEntitiesSyncedSince: (syncStamp) => db.syncedSince(syncStamp), 
        updateEntity: (clientEntity, syncStamp) => db.update(clientEntity, syncStamp), 
        createEntity: (clientEntity, syncStamp) => db.add(clientEntity, syncStamp), 
        conflictResolutionStrategy: "takeClient"
    }

    return config
}

describe('LeanSyncServer', () => {

    it('Creates new entities', async () => {
        let testStart = new Date()

        let db = new NotesDatabase()
        let config = createConfig(db)

        let leanSync = new LeanSyncServer(config)

        let clientNotes: Array<Note> = [
            { key: v1().toString(), text: 'Note 1' },
            { key: v1().toString(), text: 'Note 2' },
        ]

        let syncResult = await leanSync.sync(clientNotes)

        expect(db.rows.length).toBe(clientNotes.length)

        clientNotes.forEach((clientNote, ix) => {
            expect(db.rows[ix].text).toBe(clientNote.text)
            expect(db.rows[ix].key).toBe(clientNote.key)
            expect(db.rows[ix].syncedAt.getTime()).toBeGreaterThanOrEqual(testStart.getTime())
        })

        expect(db.rows[0].syncedAt).toEqual(db.rows[1].syncedAt)

        expect(syncResult.entitiesRequiringCreation.length).toBe(0)
        expect(syncResult.entitiesRequiringModification.length).toBe(0)
        expect(syncResult.entitiesRequiringConflictResolution.length).toBe(0)
        expect(syncResult.syncStamp.getTime()).toBeGreaterThanOrEqual(testStart.getTime())
    })

    it('Creates new entities and notifies client of key updates in case of conflict', async () => {
        let testStart = new Date()

        let db = PopulateNotesDb(2, testStart)
        let config = createConfig(db)

        let leanSync = new LeanSyncServer(config)

        let clientNotes = await db.syncedSince()
        clientNotes[0].syncedAt = null
        clientNotes[0].text = 'Note 3'
        clientNotes[1].syncedAt = null
        clientNotes[1].text = 'Note 4'

        let syncResult = await leanSync.sync(clientNotes)

        expect(db.rows.length).toBe(4)

        expect(db.rows[2].text).toBe(clientNotes[0].text)
        expect(db.rows[3].text).toBe(clientNotes[1].text)

        expect(syncResult.entitiesRequiringCreation.length).toBe(0)
        expect(syncResult.entitiesRequiringConflictResolution.length).toBe(0)
        expect(syncResult.syncStamp.getTime()).toBeGreaterThanOrEqual(testStart.getTime())

        expect(syncResult.entitiesRequiringModification.length).toBe(2)
        expect(syncResult.entitiesRequiringModification[0].entity.key).toBe(clientNotes[0].key)
        expect(syncResult.entitiesRequiringModification[0].newKey).toBe(db.rows[2].key)
        expect(syncResult.entitiesRequiringModification[1].entity.key).toBe(clientNotes[1].key)
        expect(syncResult.entitiesRequiringModification[1].newKey).toBe(db.rows[3].key)
    })


    it('Updates server entities when using takeClient resolution', async () => {
        let testStart = new Date()

        let db = PopulateNotesDb(2, testStart)
        let config = createConfig(db)

        let leanSync = new LeanSyncServer(config)

        let clientNotes = await db.syncedSince()

        clientNotes[0].text = 'Updated 1'
        clientNotes[1].text = 'Updated 2'

        let syncResult = await leanSync.sync(clientNotes)

        clientNotes.forEach((clientNote, ix) => {
            expect(db.rows[ix].text).toBe(clientNote.text)
            expect(db.rows[ix].syncedAt.getTime()).toBeGreaterThanOrEqual(clientNote.syncedAt.getTime())
        })

        expect(db.rows[0].syncedAt).toEqual(db.rows[1].syncedAt)

        expect(syncResult.entitiesRequiringCreation.length).toBe(0)
        expect(syncResult.entitiesRequiringModification.length).toBe(0)
        expect(syncResult.entitiesRequiringConflictResolution.length).toBe(0)
        expect(syncResult.syncStamp.getTime()).toBeGreaterThanOrEqual(testStart.getTime())
    })


    it('Does not update server entities and notifies client of updates when using takeServer resolution', async () => {
        let testStart = new Date()

        let db = PopulateNotesDb(2, testStart)
        let config = createConfig(db)
        config.conflictResolutionStrategy = 'takeServer'

        let leanSync = new LeanSyncServer(config)

        let clientNotes = await db.syncedSince()

        clientNotes[0].text = 'Updated 1'
        clientNotes[1].text = 'Updated 2'

        let lastSync = new Date(2001, 1, 1)
        let syncResult = await leanSync.sync(clientNotes, lastSync)

        clientNotes.forEach((clientNote, ix) => {
            expect(db.rows[ix].text).not.toBe(clientNote.text)
        })

        expect(syncResult.entitiesRequiringCreation.length).toBe(0)
        expect(syncResult.entitiesRequiringConflictResolution.length).toBe(0)
        expect(syncResult.syncStamp.getTime()).toBeGreaterThanOrEqual(testStart.getTime())

        // sync result should inform us that client needs to update its entities
        expect(syncResult.entitiesRequiringModification.length).toBe(2)
        expect(syncResult.entitiesRequiringModification[0].entity.text).toBe(db.rows[0].text)
        expect(syncResult.entitiesRequiringModification[1].entity.text).toBe(db.rows[1].text)
    })


    it('Does not update server entities and notifies client of conflicts when using askClient resolution', async () => {
        let testStart = new Date()

        let db = PopulateNotesDb(2, testStart)
        let config = createConfig(db)
        config.conflictResolutionStrategy = 'askClient'

        let leanSync = new LeanSyncServer(config)

        let clientNotes = await db.syncedSince()

        clientNotes[0].text = 'Updated 1'
        clientNotes[1].text = 'Updated 2'

        let lastSync = new Date(2001, 1, 1)
        let syncResult = await leanSync.sync(clientNotes, lastSync)

        clientNotes.forEach((clientNote, ix) => {
            expect(db.rows[ix].text).not.toBe(clientNote.text)
        })

        expect(syncResult.entitiesRequiringCreation.length).toBe(0)
        expect(syncResult.entitiesRequiringModification.length).toBe(0)
        expect(syncResult.syncStamp.getTime()).toBeGreaterThanOrEqual(testStart.getTime())

        // sync result should inform us that client needs to resolve conflicts
        expect(syncResult.entitiesRequiringConflictResolution.length).toBe(2)
        expect(syncResult.entitiesRequiringConflictResolution[0].text).toBe(db.rows[0].text)
        expect(syncResult.entitiesRequiringConflictResolution[1].text).toBe(db.rows[1].text)
    })


    it('Runs custom conflict resolution strategy if specified', async () => {
        let testStart = new Date()

        let db = PopulateNotesDb(2, testStart)
        let config = createConfig(db)

        let customConflictResolver = jest.fn()

        config.conflictResolutionStrategy = customConflictResolver

        let leanSync = new LeanSyncServer(config)

        let clientNotes = await db.syncedSince()

        clientNotes[0].text = 'Updated 1'
        clientNotes[1].text = 'Updated 2'

        let lastSync = new Date(2001, 1, 1)
        let syncResult = await leanSync.sync(clientNotes, lastSync)

        clientNotes.forEach((clientNote, ix) => {
            expect(db.rows[ix].text).not.toBe(clientNote.text)
        })

        expect(syncResult.entitiesRequiringCreation.length).toBe(0)
        expect(syncResult.entitiesRequiringConflictResolution.length).toBe(0)
        expect(syncResult.entitiesRequiringModification.length).toBe(0)
        expect(syncResult.syncStamp.getTime()).toBeGreaterThanOrEqual(testStart.getTime())

        expect(customConflictResolver.mock.calls.length).toBe(2)

        clientNotes.forEach((clientNote, ix) => {
            expect(customConflictResolver.mock.instances[ix]).toBe(config)
            expect(customConflictResolver.mock.calls[ix][0]).toBe(clientNote)
            expect(customConflictResolver.mock.calls[ix][1]).toEqual(db.rows[ix])
            expect(customConflictResolver.mock.calls[ix][2].getTime()).toBeGreaterThanOrEqual(testStart.getTime())
            expect(customConflictResolver.mock.calls[ix][3]).toBe(syncResult)
        })
    })
})