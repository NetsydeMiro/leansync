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
        let note = newNote('Note 1')

        await leanSync.sync([note])

        // create a new entity 
        let mockCreate = config.createServerEntity as jest.Mock
        expect(mockCreate.mock.calls.length).toBe(1)
    })

})