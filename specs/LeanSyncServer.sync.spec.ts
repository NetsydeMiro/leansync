import { LeanSyncServer, LeanSyncServerConfig, ConflictResolutionStrategy, CustomConflictResolver } from '../src/LeanSyncServer'
import { Note, newNote } from '../support/Note'

function mockConfig(conflictResolutionStrategy: ConflictResolutionStrategy<Note> = 'takeClient'): LeanSyncServerConfig<Note> {
    let config: LeanSyncServerConfig<Note> = {
        entityKey: (note) => note.id,
        entityLastUpdated: (note) => note.updatedAt,
        areEntitiesEqual: (note1, note2) => note1.id == note2.id && note1.text == note2.text,
        getServerEntities: jest.fn().mockReturnValue([]),
        getServerEntitiesSyncedSince: jest.fn().mockReturnValue([]),
        updateServerEntity: jest.fn(),
        createServerEntity: jest.fn(),
        conflictResolutionStrategy
    }
    return config
}

describe('LeanSyncServer', () => {

    describe('#sync()', () => {

        it('Creates new entity', async () => {
            let config: LeanSyncServerConfig<Note> = mockConfig()

            let leanSync = new LeanSyncServer(config)
            let clientNote = newNote('Note 1')

            let mockCreate = jest.fn().mockReturnValue(Object.assign({}, clientNote))
            config.createServerEntity = mockCreate

            let syncResult = await leanSync.sync([clientNote])

            // new entity is created on server side
            expect(mockCreate.mock.calls.length).toBe(1)
            expect(mockCreate.mock.calls[0][0]).toBe(clientNote)

            // client is informed of sync
            expect(syncResult.syncedEntities.length).toBe(1)
            expect(syncResult.syncedEntities[0].entity).toEqual(clientNote)
            expect(syncResult.syncedEntities[0].clientKey).toBeUndefined()
        })

        it('Creates new entity and informs of key conflict', async () => {
            let config: LeanSyncServerConfig<Note> = mockConfig()

            let leanSync = new LeanSyncServer(config)
            let clientNote = newNote('Note 1')

            let serverNote = Object.assign({}, clientNote)
            serverNote.id = 'NEW-GUID-VALUE'

            let mockCreate = jest.fn().mockReturnValue(serverNote)
            config.createServerEntity = mockCreate

            let syncResult = await leanSync.sync([clientNote])

            // new entity is created on server side
            expect(mockCreate.mock.calls.length).toBe(1)
            expect(mockCreate.mock.calls[0][0]).toBe(clientNote)

            // client is informed of sync
            expect(syncResult.syncedEntities.length).toBe(1)
            expect(syncResult.syncedEntities[0].entity).toBe(serverNote)
            expect(syncResult.syncedEntities[0].clientKey).toBe(clientNote.id)
        })

        it('Updates an existing server entity', async () => {
            let config: LeanSyncServerConfig<Note> = mockConfig('takeClient')

            let leanSync = new LeanSyncServer(config)
            let serverNote = newNote('Note 1')
            serverNote.syncedAt = new Date()

            let clientNote = Object.assign({}, serverNote)
            clientNote.text = 'Updated Note'
            clientNote.updatedAt = new Date()

            let mockGet = jest.fn().mockReturnValue([serverNote])
            config.getServerEntities = mockGet

            let mockUpdate = jest.fn().mockReturnValue(Object.assign({}, clientNote))
            config.updateServerEntity = mockUpdate

            let syncResult = await leanSync.sync([clientNote])

            // existing entity is updated on server side
            expect(mockUpdate.mock.calls.length).toBe(1)
            expect(mockUpdate.mock.calls[0][0]).toBe(clientNote)

            // client is informed of sync
            expect(syncResult.syncedEntities.length).toBe(1)
            expect(syncResult.syncedEntities[0].entity).toEqual(clientNote)
            expect(syncResult.syncedEntities[0].clientKey).toBeUndefined()
        })

        it('Updates a conflicted server entity under takeClient resolution strategy', async () => {
            let config: LeanSyncServerConfig<Note> = mockConfig('takeClient')

            let leanSync = new LeanSyncServer(config)
            let serverNote = newNote('Note 1')
            serverNote.syncedAt = new Date()

            let clientNote = Object.assign({}, serverNote)
            clientNote.text = 'Updated Note'
            clientNote.updatedAt = new Date()

            let mockGet = jest.fn().mockReturnValue([serverNote])
            config.getServerEntities = mockGet
            config.getServerEntitiesSyncedSince = mockGet

            let mockUpdate = jest.fn().mockReturnValue(Object.assign({}, clientNote))
            config.updateServerEntity = mockUpdate

            let syncResult = await leanSync.sync([clientNote])

            // existing entity is updated on server side
            expect(mockUpdate.mock.calls.length).toBe(1)
            expect(mockUpdate.mock.calls[0][0]).toBe(clientNote)

            // client is informed of sync
            expect(syncResult.syncedEntities.length).toBe(1)
            expect(syncResult.syncedEntities[0].entity).toEqual(clientNote)
            expect(syncResult.syncedEntities[0].clientKey).toBeUndefined()
        })

        it('Updates a conflicted server entity under lastUpdated resolution strategy', async () => {
            let config: LeanSyncServerConfig<Note> = mockConfig('lastUpdated')

            let leanSync = new LeanSyncServer(config)
            let serverNote = newNote('Note 1')
            serverNote.syncedAt = new Date()

            let clientNote = Object.assign({}, serverNote)
            clientNote.text = 'Updated Note'
            clientNote.updatedAt = new Date(serverNote.updatedAt.getTime() + 1)

            let mockGet = jest.fn().mockReturnValue([serverNote])
            config.getServerEntities = mockGet
            config.getServerEntitiesSyncedSince = mockGet

            let mockUpdate = jest.fn().mockReturnValue(Object.assign({}, clientNote))
            config.updateServerEntity = mockUpdate

            let syncResult = await leanSync.sync([clientNote])

            // existing entity is updated on server side
            expect(mockUpdate.mock.calls.length).toBe(1)
            expect(mockUpdate.mock.calls[0][0]).toBe(clientNote)

            // client is informed of sync
            expect(syncResult.syncedEntities.length).toBe(1)
            expect(syncResult.syncedEntities[0].entity).toEqual(clientNote)
            expect(syncResult.syncedEntities[0].clientKey).toBeUndefined()
        })

        it('Informs client of required update under lastUpdated resolution strategy', async () => {
            let config: LeanSyncServerConfig<Note> = mockConfig('lastUpdated')

            let leanSync = new LeanSyncServer(config)
            let serverNote = newNote('Note 1')
            serverNote.syncedAt = new Date()

            let clientNote = Object.assign({}, serverNote)
            clientNote.text = 'Updated Note'
            clientNote.updatedAt = new Date(serverNote.updatedAt.getTime() - 1)

            let mockGet = jest.fn().mockReturnValue([serverNote])
            config.getServerEntities = mockGet
            config.getServerEntitiesSyncedSince = mockGet

            let syncResult = await leanSync.sync([clientNote])

            // existing entity is NOT updated on server side
            let mockUpdate = config.updateServerEntity as jest.Mock
            expect(mockUpdate.mock.calls.length).toBe(0)

            // client is informed of sync
            expect(syncResult.syncedEntities.length).toBe(1)
            expect(syncResult.syncedEntities[0].entity).toBe(serverNote)
            expect(syncResult.syncedEntities[0].clientKey).toBeUndefined()
        })

        it('Informs client of required update under takeServer resolution strategy', async () => {
            let config: LeanSyncServerConfig<Note> = mockConfig('takeServer')

            let leanSync = new LeanSyncServer(config)
            let serverNote = newNote('Note 1')
            serverNote.syncedAt = new Date()

            let clientNote = Object.assign({}, serverNote)
            clientNote.text = 'Updated Note'
            clientNote.updatedAt = new Date()

            let mockGet = jest.fn().mockReturnValue([serverNote])
            config.getServerEntities = mockGet
            config.getServerEntitiesSyncedSince = mockGet

            let syncResult = await leanSync.sync([clientNote])

            // existing entity is NOT updated on server side
            let mockUpdate = config.updateServerEntity as jest.Mock
            expect(mockUpdate.mock.calls.length).toBe(0)

            // client is informed of sync
            expect(syncResult.syncedEntities.length).toBe(1)
            expect(syncResult.syncedEntities[0].entity).toBe(serverNote)
            expect(syncResult.syncedEntities[0].clientKey).toBeUndefined()
        })


        it('Runs supplied function under custom resolution strategy', async () => {
            let testStart = new Date()

            let customResolver: CustomConflictResolver<Note> = (clientNote, serverNote, syncStamp, syncResult) => { }
            let mockCustomResolver = jest.fn(customResolver)

            let config: LeanSyncServerConfig<Note> = mockConfig(mockCustomResolver)

            let leanSync = new LeanSyncServer(config)
            let serverNote = newNote('Note 1')
            serverNote.syncedAt = new Date()

            let clientNote = Object.assign({}, serverNote)
            clientNote.text = 'Updated Note'
            clientNote.updatedAt = new Date()

            let mockGet = jest.fn().mockReturnValue([serverNote])
            config.getServerEntities = mockGet
            config.getServerEntitiesSyncedSince = mockGet

            let syncResult = await leanSync.sync([clientNote])

            expect(mockCustomResolver.mock.calls.length).toBe(1)
            expect(mockCustomResolver.mock.instances[0]).toBe(config)
            expect(mockCustomResolver.mock.calls[0][0]).toBe(clientNote)
            expect(mockCustomResolver.mock.calls[0][1]).toBe(serverNote)
            expect(mockCustomResolver.mock.calls[0][2]).toBeInstanceOf(Date)
            expect(mockCustomResolver.mock.calls[0][2].getTime()).toBeGreaterThanOrEqual(testStart.getTime())
            expect(mockCustomResolver.mock.calls[0][3]).toBe(syncResult)
        })

        it('Informs client of conflict under askClient resolution strategy', async () => {
            let config: LeanSyncServerConfig<Note> = mockConfig('askClient')

            let leanSync = new LeanSyncServer(config)
            let serverNote = newNote('Note 1')
            serverNote.syncedAt = new Date()

            let clientNote = Object.assign({}, serverNote)
            clientNote.text = 'Updated Note'
            clientNote.updatedAt = new Date()

            let mockGet = jest.fn().mockReturnValue([serverNote])
            config.getServerEntities = mockGet
            config.getServerEntitiesSyncedSince = mockGet

            let syncResult = await leanSync.sync([clientNote])

            // existing entity is NOT updated on server side
            let mockUpdate = config.updateServerEntity as jest.Mock
            expect(mockUpdate.mock.calls.length).toBe(0)

            // client is informed of conflict
            expect(syncResult.syncedEntities.length).toBe(0)
            expect(syncResult.conflictedEntities[0]).toBe(serverNote)
        })

        it('Rolls back transaction if an error is thrown', async () => {
            expect.assertions(2)

            let config: LeanSyncServerConfig<Note> = mockConfig()

            let leanSync = new LeanSyncServer(config)
            let clientNote = newNote('Note 1')

            let error = new Error()
            let mockCreate = jest.fn().mockRejectedValue(error)
            config.createServerEntity = mockCreate

            let mockRollBack = jest.fn()
            config.rollBackTransaction = mockRollBack

            try {
                await leanSync.sync([clientNote])
            }
            catch (e) {
                expect(e).toBe(error)
                // transaction should be rolled back
                expect(mockRollBack.mock.calls.length).toBe(1)
            }
        })
    })
})