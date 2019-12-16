import { SyncResponse, ConflictResolutionResponse, KeySelector } from './shared'

export class ConnectivityError extends Error { }

export interface LeanSyncClientConfig<Entity> {
    keySelector: KeySelector<Entity>
    // pulling from client store
    getClientEntitiesRequiringSync: () => Promise<Array<Entity>>
    getClientEntities: (keys: Array<any>) => Promise<Array<Entity>>
    getLastSyncStamp: () => Promise<Date>
    markSyncStamp: (syncStamp: Date) => Promise<void>

    // writing to client store
    updateEntity: (entity: Entity, syncStamp: Date, originalKey?: any) => Promise<void>
    createEntity: (entity: Entity, syncStamp: Date) => Promise<void>
    markRequiringConflictResolution?: (entity: Entity, syncStamp: Date) => Promise<void>

    // communicating with server store
    syncWithServer: (entities: Array<Entity>, lastSync: Date) => Promise<SyncResponse<Entity>>
    resolveConflictWithServer?: (entity: Entity) => Promise<ConflictResolutionResponse<Entity>>
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

            await this.processSyncResponse(syncResult)
        }
        catch(ex) {
            // we do nothing if we can't connect at the moment, and allow the next sync to handle it

            // of all other errors we want to be made aware 
            if (!(ex instanceof ConnectivityError)) throw ex
        }
    }

    // TODO: add transaction support?
    // TODO: investigate push discrepancies... 
    // Do we need to handle the case where a push might be received when we've updated our version?  
    // Mark it as requiring conflict?  I think just ignore it, and wait until next sync in that case
    async processSyncResponse(syncResult: SyncResponse<Entity>) {
        for (let newEntity of syncResult.newEntities) {
            await this.config.createEntity(newEntity, syncResult.syncStamp)
        }

        for (let modifiedEntity of syncResult.syncedEntities) {
            await this.config.updateEntity(modifiedEntity.entity, syncResult.syncStamp, modifiedEntity.clientKey)
        }

        for (let conflictedEntity of syncResult.conflictedEntities) {
            await this.config.markRequiringConflictResolution?.(conflictedEntity, syncResult.syncStamp)
        }

        await this.config.markSyncStamp(syncResult.syncStamp)
    }
}

export default LeanSyncClient