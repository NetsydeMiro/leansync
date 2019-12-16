import { Note, NotesDatabase, newNote } from '../support/Note'
import { BasicConflictResolutionStrategy, LeanSyncServer, LeanSyncServerConfig } from '../src/LeanSyncServer'
import { LeanSyncClient, LeanSyncClientConfig } from '../src/LeanSyncClient'

interface Server {
    db:  NotesDatabase
    resolutionStrategy: BasicConflictResolutionStrategy
}

interface Client {
    db:  NotesDatabase
    isOffline?: boolean
}

interface MockNetwork {
    server: Server
    clients: Array<Client>
}

function initNetwork(): MockNetwork {
    return {
        server: { db: new NotesDatabase(), resolutionStrategy: 'takeClient' }, 
        clients: [], 
    }
}

interface SetResolutionStrategyAction {
    type: 'setResolutionStrategy'
    strategy: BasicConflictResolutionStrategy
}

function setResolutionStrategy(network: MockNetwork, resolutionStrategy): MockNetwork {
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
    nw.clients.push({ db: new NotesDatabase() })

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

interface CreateNoteAction {
    type: 'addNote'
    clientIndex: number
}

function CreateNote(network: MockNetwork, clientIndex: number): MockNetwork {
    let nw = { ...network }

    nw.clients = network.clients.slice()

    let oldClient = network.clients[clientIndex]
    let newClient = { ...oldClient }

    newClient.db = new NotesDatabase(oldClient.db.rows.slice())
    newClient.db.add(newNote(''))

    nw.clients[clientIndex] = newClient

    return nw
}

interface UpdateNoteAction {
    type: 'updateNote'
    clientIndex: number
    note: Note
}

function UpdateNote(network: MockNetwork, clientIndex: number, note: Note): MockNetwork {
    let nw = { ...network }

    nw.clients = network.clients.slice()

    let oldClient = network.clients[clientIndex]
    let newClient = { ...oldClient }

    newClient.db = new NotesDatabase(oldClient.db.rows.slice())
    newClient.db.update(note, note.syncedAt)

    nw.clients[clientIndex] = newClient

    return nw
}

interface SyncAction {
    type: 'sync'
    clientIndex: number
}

function Sync(network: MockNetwork, clientIndex: number, note: Note): MockNetwork {
    let nw = { ...network }

    nw.clients = network.clients.slice()

    let oldClient = network.clients[clientIndex]

    let newClient = { ...oldClient }
    newClient.db = new NotesDatabase(oldClient.db.rows.slice())

    let newServer = { ...network.server }
    newServer.db = new NotesDatabase(newServer.db.rows.slice())

    /*
    let serverConfig: LeanSyncServerConfig<Note> = {

    }

    let clientConfig: LeanSyncClientConfig<Note> = {

    }
    */

    nw.server = newServer
    nw.clients[clientIndex] = newClient

    return nw
}