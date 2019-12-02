import { SyncResult, ConflictResolutionResult, ModifiedEntity } from './shared'

export class ConnectivityError extends Error { }

export interface LeanSyncClientConfig<Entity> {
    // pulling from client store
    getClientEntitiesRequiringSync: () => Promise<Array<Entity>>
    getLastSyncStamp: () => Promise<Date>

    // writing to client store
    createClientEntities: (entities: Array<Entity>, syncStamp: Date) => Promise<void>
    updateClientEntities: (entities: Array<ModifiedEntity<Entity>>, syncStamp: Date) => Promise<void>
    markSyncedSuccessfully: (keys: Array<any>, syncStamp: Date) => Promise<void>
    markRequiringConflictResolution: (conflicts: Array<any>, syncStamp: Date) => Promise<void>

    // communicating with server store
    syncWithServer: (entities: Array<Entity>, lastSync: Date) => Promise<SyncResult<Entity>>
    resolveConflictWithServer: (entity: Entity) => Promise<ConflictResolutionResult<Entity>>
}

export class LeanSyncClient<Entity> {
    constructor(private config: LeanSyncClientConfig<Entity>) {
    }

    async sync() {
        try {
            let [
                lastSync, 
                clientEntities
            ] = await Promise.all([
                this.config.getLastSyncStamp(), 
                this.config.getClientEntitiesRequiringSync()
            ])

            let syncResult = await this.config.syncWithServer(clientEntities, lastSync)

        }
        catch(ex) {
            // we do nothing if we can't connect at the moment, and allow the next sync to handle it

            // of all other errors we want to be made aware 
            if (!(ex instanceof ConnectivityError)) throw ex
        }
    }
}

export default LeanSyncClient