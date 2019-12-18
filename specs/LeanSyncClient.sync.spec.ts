import { SyncResponse, ModifiedEntity, isFunction } from '../src/shared'
import { Note, newNote } from '../support/Note'
import { LeanSyncClientConfig, LeanSyncClient, ConnectivityError } from '../src/LeanSyncClient'

function mockConfig(configParams?: Partial<LeanSyncClientConfig<Note>>): LeanSyncClientConfig<Note> {
    let config: LeanSyncClientConfig<Note> =
        Object.assign({
            keySelector: (note: Note) => note.id,
            getClientEntitiesRequiringSync: jest.fn(),
            getClientEntities: jest.fn(),
            getLastSyncStamp: jest.fn(),
            markSyncStamp: jest.fn(),
            updateEntity: jest.fn(),
            createEntity: jest.fn(),
            syncWithServer: jest.fn(),
        }, configParams)

    return config
}

function mockSyncResult(syncParams?: Partial<SyncResponse<Note>>): SyncResponse<Note> {
    let result: SyncResponse<Note> =
        Object.assign({
            newEntities: [],
            syncedEntities: [],
            conflictedEntities: [],
            syncStamp: new Date()
        }, syncParams)

    return result
}

describe('LeanSyncClient', () => {

    describe('#sync()', () => {

        it('Sends entities requiring sync to server', async () => {
            let syncStamp = new Date()
            let getLastSyncStamp = jest.fn().mockReturnValue(syncStamp)

            let note = newNote('A Note')
            let getClientEntitiesRequiringSync = jest.fn().mockReturnValue([note])

            let syncWithServer = jest.fn()

            let config = mockConfig({ getLastSyncStamp, getClientEntitiesRequiringSync, syncWithServer })

            let leanSyncClient = new LeanSyncClient(config)
            leanSyncClient.processSyncResponse = jest.fn()

            await leanSyncClient.sync()

            expect(syncWithServer).toHaveBeenCalledWith([note], syncStamp)
        })

        it("Processes server's response", async () => {
            let syncStamp = new Date()
            let getLastSyncStamp = jest.fn().mockReturnValue(syncStamp)

            let note = newNote('A Note')
            let getClientEntitiesRequiringSync = jest.fn().mockReturnValue([note])

            let syncResult = mockSyncResult()
            let syncWithServer = jest.fn().mockReturnValue(syncResult)

            let config = mockConfig({ getLastSyncStamp, getClientEntitiesRequiringSync, syncWithServer })

            let leanSyncClient = new LeanSyncClient(config)
            let processSyncResult = jest.fn()
            leanSyncClient.processSyncResponse = processSyncResult

            await leanSyncClient.sync()

            expect(processSyncResult).toHaveBeenCalledWith(syncResult)
        })

        it("Bombs if there is a generic error", async () => {
            let error = new Error()
            let getLastSyncStamp = jest.fn().mockRejectedValue(error)

            let config = mockConfig({ getLastSyncStamp })

            let leanSyncClient = new LeanSyncClient(config)

            expect(leanSyncClient.sync()).rejects.toEqual(error)
        })

        // a future sync when we're connected will succeed
        it("Resolves silently if there is a connectivity error", async () => {
            let error = new ConnectivityError()
            let getLastSyncStamp = jest.fn().mockRejectedValue(error)

            let config = mockConfig({ getLastSyncStamp })

            let leanSyncClient = new LeanSyncClient(config)

            expect(leanSyncClient.sync()).resolves.toBeUndefined()
        })
    })

    describe('#processSyncResult()', () => {

        it('Creates new entities', async () => {
            let createEntity = jest.fn()
            let config = mockConfig({ createEntity })

            let leanSyncClient = new LeanSyncClient(config)

            let newEntities = [newNote('Note1'), newNote('Note2')]
            let syncResult = mockSyncResult({ newEntities })

            await leanSyncClient.processSyncResponse(syncResult)

            expect(createEntity).toHaveBeenCalledTimes(newEntities.length)
            for (let ix = 0; ix < newEntities.length; ix++) {
                expect(createEntity).toHaveBeenNthCalledWith(ix + 1, newEntities[ix], syncResult.syncStamp)
            }
        })

        it('Updates synced entities', async () => {
            let updateEntity = jest.fn()
            let config = mockConfig({ updateEntity })

            let leanSyncClient = new LeanSyncClient(config)

            let syncedEntities: Array<ModifiedEntity<Note>> = [{ entity: newNote('Note1'), clientKey: 'a' }, { entity: newNote('Note2') }]
            let syncResult = mockSyncResult({ syncedEntities })

            await leanSyncClient.processSyncResponse(syncResult)

            expect(updateEntity).toHaveBeenCalledTimes(syncedEntities.length)
            for (let ix = 0; ix < syncedEntities.length; ix++) {
                expect(updateEntity).toHaveBeenNthCalledWith(ix + 1, syncedEntities[ix].entity, syncResult.syncStamp, syncedEntities[ix].clientKey)
            }
        })

        it('Marks conflicted entities', async () => {
            let markRequiringConflictResolution = jest.fn()
            let config = mockConfig({ markRequiringConflictResolution })

            let leanSyncClient = new LeanSyncClient(config)

            let conflictedEntities: Array<Note> = [newNote('Note1'), newNote('Note2')]
            let syncResult = mockSyncResult({ conflictedEntities })

            await leanSyncClient.processSyncResponse(syncResult)

            expect(markRequiringConflictResolution).toHaveBeenCalledTimes(conflictedEntities.length)
            for (let ix = 0; ix < conflictedEntities.length; ix++) {
                expect(markRequiringConflictResolution).toHaveBeenNthCalledWith(ix + 1, conflictedEntities[ix], syncResult.syncStamp)
            }
        })

        it('Marks latest sync', async () => {
            let markSyncStamp = jest.fn()
            let config = mockConfig({ markSyncStamp })

            let leanSyncClient = new LeanSyncClient(config)

            let syncResult = mockSyncResult()

            await leanSyncClient.processSyncResponse(syncResult)

            expect(markSyncStamp).toHaveBeenCalledWith(syncResult.syncStamp)
        })
    })
})