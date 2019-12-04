// TODO: Handle client needs to create entities
import { SyncResult, isFunction, assertNever, ConflictResolutionResult, KeySelector, findCorrespondingEntity } from "./shared"

export type BasicConflictResolutionStrategy = "takeServer" | "takeClient" | "askClient"

export interface CustomConflictResolver<Entity> {
    (this: LeanSyncServerConfig<Entity>, clientEntity: Entity, serverEntity: Entity, syncStamp: Date, result: SyncResult<Entity>): void
}

export type ConflictResolutionStrategy<Entity> = BasicConflictResolutionStrategy | CustomConflictResolver<Entity>

export interface LeanSyncServerConfig<Entity> {
    keySelector: KeySelector<Entity>
    isNewEntity: (entity: Entity) => boolean
    areEqual: (entity1: Entity, entity2: Entity) => boolean
    startTransaction?: () => void
    commitTransaction?: () => void
    rollBackTransaction?: () => void
    // gets entities corresponding to the supplied keys
    getServerEntities: (keys: Array<any>) => Promise<Array<Entity>>
    // gets entities that have been updated by another client since this client's last sync
    getServerEntitiesSyncedSince: (syncStamp?: Date) => Promise<Array<Entity>>
    // updates the Entity
    updateEntity: (entity: Entity, syncStamp: Date) => Promise<void>
    // returns the key of the created entity
    createEntity: (entity: Entity, syncStamp: Date) => Promise<any>
    // specifies prest or custom conflict resolution strategy
    conflictResolutionStrategy: ConflictResolutionStrategy<Entity>
}

export class LeanSyncServer<Entity> {
    constructor(private config: LeanSyncServerConfig<Entity>) {
    }

    async sync(clientEntities: Array<Entity>, lastSynced?: Date): Promise<SyncResult<Entity>> {
        return new Promise<SyncResult<Entity>>(async (resolve, reject) => {
            this.config.startTransaction?.()

            let syncStamp = new Date()
            let handledKeys = {}
            let syncResult: SyncResult<Entity> = {
                syncedEntities: [],
                newEntities: [],
                conflictedEntities: [],
                syncStamp
            }

            try {
                let [
                    correspondingServerEntities,
                    serverEntitiesUpdatedSinceLastSync
                ] = await Promise.all([
                    this.config.getServerEntities(clientEntities.map(this.config.keySelector)),
                    this.config.getServerEntitiesSyncedSince(lastSynced)
                ])

                for (var clientEntity of clientEntities) {

                    if (this.config.isNewEntity(clientEntity)) {
                        // create new entities
                        await this.handleCreate(clientEntity, syncStamp, syncResult)
                        handledKeys[this.config.keySelector(clientEntity)] = true
                    }
                    else {
                        let conflictedServerEntity = findCorrespondingEntity(serverEntitiesUpdatedSinceLastSync, clientEntity, this.config.keySelector)

                        if (conflictedServerEntity) {
                            if (this.config.areEqual(clientEntity, conflictedServerEntity)) {
                                syncResult.syncedEntities.push({ entity: clientEntity })
                                handledKeys[this.config.keySelector(clientEntity)] = true
                            }
                            else {
                                if (isFunction(this.config.conflictResolutionStrategy)) {
                                    this.config.conflictResolutionStrategy(clientEntity, conflictedServerEntity, syncStamp, syncResult)
                                    handledKeys[this.config.keySelector(clientEntity)] = true
                                }
                                else {
                                    switch (this.config.conflictResolutionStrategy) {

                                        case 'takeClient':
                                            await this.config.updateEntity(clientEntity, syncStamp)
                                            syncResult.syncedEntities.push({ entity: clientEntity })
                                            break

                                        case 'takeServer':
                                            syncResult.syncedEntities.push({ entity: conflictedServerEntity })
                                            break

                                        case 'askClient':
                                            syncResult.conflictedEntities.push(conflictedServerEntity)
                                            break

                                        default: assertNever(this.config.conflictResolutionStrategy)
                                    }

                                    handledKeys[this.config.keySelector(clientEntity)] = true
                                }
                            }

                        }
                        else {
                            let serverEntity = findCorrespondingEntity(correspondingServerEntities, clientEntity, this.config.keySelector)

                            if (serverEntity) {
                                await this.config.updateEntity(clientEntity, syncStamp)
                                syncResult.syncedEntities.push({ entity: clientEntity })
                            }
                            else {
                                // this case shouldn't really happen, but we handle it anyway
                                await this.handleCreate(clientEntity, syncStamp, syncResult)
                            }

                            handledKeys[this.config.keySelector(clientEntity)] = true
                        }
                    }
                }

                for (let serverEntity of serverEntitiesUpdatedSinceLastSync) {
                    if (!handledKeys[this.config.keySelector(serverEntity)]) {
                        syncResult.newEntities.push(serverEntity)
                    }
                }

                this.config.commitTransaction?.()
                resolve(syncResult)
            }
            catch (ex) {
                this.config.rollBackTransaction?.()
                reject(ex)
            }
        })
    }

    async resolveConflict(resolvedEntity: Entity, lastSynced: Date): Promise<ConflictResolutionResult<Entity>> {

        return new Promise<ConflictResolutionResult<Entity>>(async (resolve, reject) => {
            this.config.startTransaction()
            let syncStamp = new Date()
            let result: ConflictResolutionResult<Entity> = { syncStamp }

            try {
                let serverEntitiesUpdatedSinceLastSync =
                    await this.config.getServerEntitiesSyncedSince(lastSynced)

                let conflictedAgain = serverEntitiesUpdatedSinceLastSync.find(serverEntity =>
                    this.config.keySelector(serverEntity) == this.config.keySelector(resolvedEntity)
                )

                if (conflictedAgain) {
                    if (!this.config.areEqual(resolvedEntity, conflictedAgain)) {
                        result.stillRequiringConflictResolution = conflictedAgain
                    }
                }
                else await this.config.updateEntity(resolvedEntity, syncStamp)

                this.config.commitTransaction()
                resolve(result)
            }
            catch (ex) {
                this.config.rollBackTransaction()
                reject(ex)
            }
        })
    }

    private async handleCreate(mobileEntity: Entity, syncStamp: Date, syncResult: SyncResult<Entity>) {
        let newKey = await this.config.createEntity(mobileEntity, syncStamp)
        // we inform the user that a new key has been assigned 
        // due to a collision, or because temp keys are used at client 
        // and permanent keys assigned at server
        if (newKey && newKey != this.config.keySelector(mobileEntity)) {
            syncResult.syncedEntities.push({ entity: mobileEntity, newKey })
        }
        else syncResult.syncedEntities.push({ entity: mobileEntity })
    }

}

export default LeanSyncServer