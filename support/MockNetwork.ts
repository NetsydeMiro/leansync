import { Note, NotesDatabase, newNote } from './Note'
import { BasicConflictResolutionStrategy, LeanSyncServer, LeanSyncServerConfig } from '../src/LeanSyncServer'
import { LeanSyncClient, LeanSyncClientConfig } from '../src/LeanSyncClient'
import { assertNever } from '../src/shared'

export interface MockServer {
    notes:  Array<Note>
    resolutionStrategy: BasicConflictResolutionStrategy
}

export interface MockClient {
    notes: Array<Note>
    lastSync?: Date
    isOffline?: boolean
}

export interface MockNetwork {
    server: MockServer
    clients: Array<MockClient>
}

export const initialNetwork: MockNetwork = {
    server: { notes: [], resolutionStrategy: 'takeClient' },
    clients: [],
}

interface SetResolutionStrategyAction {
    type: 'setResolutionStrategy'
    strategy: BasicConflictResolutionStrategy
}

function setResolutionStrategy(network: MockNetwork, resolutionStrategy: BasicConflictResolutionStrategy): MockNetwork {
    let nw = { ...network }

    nw.server = { ...network.server, resolutionStrategy }

    return nw
}

interface AddClientAction {
    type: 'addClient'
}

function addClient(network: MockNetwork): MockNetwork {
    let nw = { ...network }

    nw.clients = network.clients.slice()
    nw.clients.push({ notes: [] })

    return nw
}

interface RemoveClientAction {
    type: 'removeClient'
    clientIndex: number
}

function removeClient(network: MockNetwork, clientIndex: number): MockNetwork {
    let nw = { ...network }

    nw.clients = network.clients.slice()
    nw.clients.splice(clientIndex, 1)

    return nw
}

interface SetClientOfflineAction {
    type: 'setClientOffline'
    clientIndex: number
    isOffline: boolean
}

function setClientOffline(network: MockNetwork, clientIndex: number, isOffline: boolean): MockNetwork {
    let nw = { ...network }

    nw.clients = network.clients.slice()
    nw.clients[clientIndex] = { ...network.clients[clientIndex], isOffline }

    return nw
}

/*

interface AddNoteAction {
    type: 'addNote'
    clientIndex: number
}

function addNote(network: MockNetwork, clientIndex: number): MockNetwork {
    let nw = { ...network }

    nw.clients = network.clients.slice()

    let newClient = { ...network.clients[clientIndex] }

    let db = new NotesDatabase(newClient.notes)
    db.add(newNote(''))

    newClient.notes = db.rows
    nw.clients[clientIndex] = newClient

    return nw
}

interface UpdateNoteAction {
    type: 'updateNote'
    clientIndex: number
    note: Note
}

function updateNote(network: MockNetwork, clientIndex: number, note: Note): MockNetwork {
    let nw = { ...network }

    nw.clients = network.clients.slice()

    let newClient = { ...network.clients[clientIndex] }

    let db = new NotesDatabase(newClient.notes)
    db.update(note, note.syncedAt)

    newClient.notes = db.rows
    nw.clients[clientIndex] = newClient

    return nw
}
*/

interface SyncAction {
    type: 'sync'
    clientIndex: number
    clientNotes: Array<Note>
}

async function sync(network: MockNetwork, clientIndex: number, clientNotes: Array<Note>): Promise<MockNetwork> {
    let nw = { ...network }

    nw.clients = network.clients.slice()

    let newServer = { ...network.server }
    let serverDb = new NotesDatabase(newServer.notes)

    let newClient = { ...network.clients[clientIndex] }
    let clientDb = new NotesDatabase(clientNotes)

    let serverConfig: LeanSyncServerConfig<Note> = {
        entityKey: (note) => note.id,
        entityLastUpdated: (note) => note.updatedAt, 
        areEntitiesEqual: (note1, note2) => note1.text == note2.text, 
        getServerEntities: (keys) => serverDb.getByKey(keys), 
        getServerEntitiesSyncedSince: (syncStamp) => serverDb.getSyncedSince(syncStamp), 
        updateServerEntity: (clientEntity, syncStamp) => serverDb.update(clientEntity, syncStamp), 
        createServerEntity: (clientEntity, syncStamp) => serverDb.add(clientEntity, syncStamp), 
        conflictResolutionStrategy: newServer.resolutionStrategy
    }

    let leanServer = new LeanSyncServer(serverConfig)

    let clientConfig: LeanSyncClientConfig<Note> = {
        keySelector: (note) => note.id,
        getClientEntitiesRequiringSync: clientDb.getRequiringSync,
        getClientEntities: clientDb.getByKey,
        getLastSyncStamp: async () => newClient.lastSync,
        markSyncStamp: async (lastSync) => { newClient.lastSync = lastSync },
        updateEntity: async (note, syncStamp, originalKey) => { clientDb.update(note, syncStamp, originalKey) },
        createEntity: async (note) => { clientDb.add(note) },
        syncWithServer: async (entities, lastSync) => {
            return leanServer.sync(entities, lastSync)
        },
    }

    let leanClient = new LeanSyncClient(clientConfig)

    await leanClient.sync()

    newServer.notes = serverDb.rows
    newClient.notes = clientDb.rows

    nw.server = newServer
    nw.clients[clientIndex] = newClient

    return nw
}

export type ActionType = 
    SetResolutionStrategyAction | 
    AddClientAction | 
    RemoveClientAction | 
    SetClientOfflineAction | 
    /*
    AddNoteAction | 
    UpdateNoteAction | 
    */
    SyncAction

export function mockNetworkReducer(network: MockNetwork, action: ActionType ): MockNetwork {
    let modifiedNetwork: MockNetwork

    switch(action.type) {
        case 'setResolutionStrategy': setResolutionStrategy(network, action.strategy); break
        case 'addClient': addClient(network); break
        case 'removeClient': removeClient(network, action.clientIndex); break
        case 'setClientOffline': setClientOffline(network, action.clientIndex, action.isOffline); break
        /*
        case 'addNote': addNote(network, action.clientIndex); break
        case 'updateNote': updateNote(network, action.clientIndex, action.note); break
        */
        case 'sync': sync(network, action.clientIndex, action.clientNotes); break
        default: assertNever(action)
    }

    return modifiedNetwork
}