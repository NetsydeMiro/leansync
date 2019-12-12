import { SyncResult, ConflictResolutionResult, KeySelector } from './shared'

export class ConnectivityError extends Error { }

export interface LeanSyncClientConfig<Entity> {
    keySelector: KeySelector<Entity>
    // pulling from client store
    getClientEntitiesRequiringSync: () => Promise<Array<Entity>>
    getClientEntities: (keys: Array<any>) => Promise<Array<Entity>>
    getLastSyncStamp: () => Promise<Date>

    // writing to client store
    updateEntity: (entity: Entity, syncStamp: Date, newKey?: any) => Promise<void>
    createEntity: (entity: Entity, syncStamp: Date) => Promise<any>
    markRequiringConflictResolution?: (entity: Entity, syncStamp: Date) => Promise<void>

    // communicating with server store
    syncWithServer: (entities: Array<Entity>, lastSync: Date) => Promise<SyncResult<Entity>>
    resolveConflictWithServer?: (entity: Entity) => Promise<ConflictResolutionResult<Entity>>
}

export class LeanSyncClient<Entity> {
    constructor(private config: LeanSyncClientConfig<Entity>) { }

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

            await this.processSyncResult(syncResult)
        }
        catch(ex) {
            // we do nothing if we can't connect at the moment, and allow the next sync to handle it

            // of all other errors we want to be made aware 
            if (!(ex instanceof ConnectivityError)) throw ex
        }
    }

    async processSyncResult(syncResult: SyncResult<Entity>) {
        for (let newEntity of syncResult.newEntities) {
            await this.config.createEntity(newEntity, syncResult.syncStamp)
        }

        for (let modifiedEntity of syncResult.syncedEntities) {
            await this.config.updateEntity(modifiedEntity.entity, syncResult.syncStamp, modifiedEntity.clientKey)
        }

        for (let conflictedEntity of syncResult.conflictedEntities) {
            await this.config.markRequiringConflictResolution?.(conflictedEntity, syncResult.syncStamp)
        }
    }
}

export default LeanSyncClient