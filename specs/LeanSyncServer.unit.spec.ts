import { LeanSyncServer, LeanSyncServerConfig, ConflictResolutionStrategy } from '../src/LeanSyncServer'
import { Note, newNote } from '../support/Note'

function mockConfig(): LeanSyncServerConfig<Note> {
    let config: LeanSyncServerConfig<Note> = {
        entityKey: (note) => note.id,
        entityLastUpdated: (note) => note.updatedAt,
        isNewEntity: (note) => !note.syncedAt,
        areEntitiesEqual: (note1, note2) => note1.id == note2.id && note1.text == note2.text,
        getServerEntities: jest.fn().mockReturnValue([]),
        getServerEntitiesSyncedSince: jest.fn().mockReturnValue([]),
        updateServerEntity: jest.fn(),
        createServerEntity: jest.fn(),
        conflictResolutionStrategy: 'lastUpdated'
    }
    return config
}

describe('LeanSyncServer', () => {

    it('Creates new entity', async () => {
        let config: LeanSyncServerConfig<Note> = mockConfig()

        let leanSync = new LeanSyncServer(config)
        let clientNote = newNote('Note 1')

        let syncResult = await leanSync.sync([clientNote])
        let mockCreate = config.createServerEntity as jest.Mock

        // new entity is created on server side
        expect(mockCreate.mock.calls.length).toBe(1)
        expect(mockCreate.mock.calls[0][0]).toBe(clientNote)

        // client is informed of sync
        expect(syncResult.syncedEntities.length).toBe(1)
        expect(syncResult.syncedEntities[0].entity).toBe(clientNote)
        expect(syncResult.syncedEntities[0].newKey).toBeUndefined()
    })

    it('Creates new entity and informs of key conflict', async () => {
        let config: LeanSyncServerConfig<Note> = mockConfig()

        let leanSync = new LeanSyncServer(config)
        let clientNote = newNote('Note 1')

        let newGuidId = 'NEW-GUID-VALUE'
        let mockCreate = jest.fn().mockReturnValue('NEW-GUID-VALUE')
        config.createServerEntity = mockCreate

        let syncResult = await leanSync.sync([clientNote])

        // new entity is created on server side
        expect(mockCreate.mock.calls.length).toBe(1)
        expect(mockCreate.mock.calls[0][0]).toBe(clientNote)

        // client is informed of sync
        expect(syncResult.syncedEntities.length).toBe(1)
        expect(syncResult.syncedEntities[0].entity).toBe(clientNote)
        expect(syncResult.syncedEntities[0].newKey).toBe(newGuidId)
    })

    it.skip('Updates an existing entity', async () => {
        let config: LeanSyncServerConfig<Note> = mockConfig()

        let leanSync = new LeanSyncServer(config)
        let clientNote = newNote('Note 1')

        let serverNote = Object.assign({}, clientNote)
        serverNote.syncedAt = new Date()

        let mockGet = jest.fn().mockReturnValue([serverNote])
        config.getServerEntities = mockGet

        let syncResult = await leanSync.sync([clientNote])

        let mockUpdate = config.updateServerEntity as jest.Mock

        // existing entity is updated on server side
        expect(mockUpdate.mock.calls.length).toBe(1)
        expect(mockUpdate.mock.calls[0][0]).toBe(clientNote)

        // client is informed of sync
        expect(syncResult.syncedEntities.length).toBe(1)
        expect(syncResult.syncedEntities[0].entity).toBe(clientNote)
        expect(syncResult.syncedEntities[0].newKey).toBeUndefined()
    })
})