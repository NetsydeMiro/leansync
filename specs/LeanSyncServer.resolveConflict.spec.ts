import { LeanSyncServer, LeanSyncServerConfig, ConflictResolutionStrategy } from '../src/LeanSyncServer'
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

    describe('#resolveConflict()', () => {

        it("Resolves conflict if server hasn't been updated", async () => {
            let testStart = new Date()
            let config: LeanSyncServerConfig<Note> = mockConfig('askClient')

            let leanSync = new LeanSyncServer(config)
            let serverNote = newNote('Note 1')
            serverNote.syncedAt = testStart

            let clientNote = Object.assign({}, serverNote)
            clientNote.text = 'Updated Note'
            clientNote.updatedAt = new Date()

            let resolveConflictResult = await leanSync.resolveConflict(clientNote, testStart)

            // existing entity is updated on server side
            let mockUpdate = config.updateServerEntity as jest.Mock
            expect(mockUpdate.mock.calls.length).toBe(1)
            expect(mockUpdate.mock.calls[0][0]).toBe(clientNote)

            // client is informed of successful conflict resolution
            expect(resolveConflictResult.stillRequiringConflictResolution).toBeUndefined()
            expect(resolveConflictResult.syncStamp.getTime()).toBeGreaterThanOrEqual(testStart.getTime())
        })

        it('Informs client of still existing conflict if server note has been updated since last sync', async () => {
            let testStart = new Date()
            let config: LeanSyncServerConfig<Note> = mockConfig('askClient')

            let leanSync = new LeanSyncServer(config)
            let serverNote = newNote('Note 1')
            serverNote.syncedAt = new Date()

            let clientNote = Object.assign({}, serverNote)
            clientNote.text = 'Updated Note'
            clientNote.syncedAt = new Date(testStart.getTime() - 1)

            let mockGet = jest.fn().mockReturnValue([serverNote])
            config.getServerEntities = mockGet
            config.getServerEntitiesSyncedSince = mockGet

            let resolveConflictResult = await leanSync.resolveConflict(clientNote, testStart)

            // existing entity is NOT updated on server side
            let mockUpdate = config.updateServerEntity as jest.Mock
            expect(mockUpdate.mock.calls.length).toBe(0)

            // client is informed of UNsuccessful conflict resolution
            expect(resolveConflictResult.stillRequiringConflictResolution).toBe(serverNote)
            expect(resolveConflictResult.syncStamp.getTime()).toBeGreaterThanOrEqual(testStart.getTime())
        })

        it('Rolls back transaction if an error is thrown', async () => {
            expect.assertions(2)

            let testStart = new Date()
            let config: LeanSyncServerConfig<Note> = mockConfig('askClient')

            let leanSync = new LeanSyncServer(config)
            let clientNote = newNote('Note 1') 

            let error = new Error()
            let mockGet = jest.fn().mockRejectedValue(error)
            config.getServerEntitiesSyncedSince = mockGet

            let mockRollBack = jest.fn()
            config.rollBackTransaction = mockRollBack
           
            try {
                await leanSync.resolveConflict(clientNote, testStart)
            }
            catch (e) {
                expect(e).toBe(error)
                expect(mockRollBack.mock.calls.length).toBe(1)
            }
        })
    })
})