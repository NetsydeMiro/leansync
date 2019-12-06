// TODO: Handle client needs to create entities
import { SyncResult, isFunction, assertNever, ConflictResolutionResult, KeySelector, findCorrespondingEntity, LastUpdatedSelector } from "./shared"

export type BasicConflictResolutionStrategy = "takeServer" | "takeClient" | "lastUpdated" | "askClient"

export interface CustomConflictResolver<Entity> {
    (this: LeanSyncServerConfig<Entity>, clientEntity: Entity, serverEntity: Entity, syncStamp: Date, result: SyncResult<Entity>): void
}

export type ConflictResolutionStrategy<Entity> = BasicConflictResolutionStrategy | CustomConflictResolver<Entity>

export interface LeanSyncServerConfig<Entity> {
    // returns Enitity's unique key
    entityKey: KeySelector<Entity>
    // returns datetime of Entity's last update
    entityLastUpdated: LastUpdatedSelector<Entity>
    // informs server that a client entity is one that was newly created (not yet synced)
    isNewEntity: (entity: Entity) => boolean
    // informs server that entities are the same (no update required)
    areEqual: (entity1: Entity, entity2: Entity) => boolean
    // transaction handling
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
    // specifies preset or custom conflict resolution strategy
    conflictResolutionStrategy: ConflictResolutionStrategy<Entity>
}

export class LeanSyncServer<Entity> {
    constructor(private config: LeanSyncServerConfig<Entity>) { }

    // handles sync requests made by client
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
                // get stored versions of entities submitted by client
                // as well as any entities created or modified since the client's last sync
                let [
                    correspondingServerEntities,
                    serverEntitiesUpdatedSinceLastSync
                ] = await Promise.all([
                    this.config.getServerEntities(clientEntities.map(this.config.entityKey)),
                    this.config.getServerEntitiesSyncedSince(lastSynced)
                ])

                for (var clientEntity of clientEntities) {

                    if (this.config.isNewEntity(clientEntity)) {
                        // create new entities
                        await this.handleCreate(clientEntity, syncStamp, syncResult)
                        handledKeys[this.config.entityKey(clientEntity)] = true
                    }
                    else {
                        let conflictedServerEntity = findCorrespondingEntity(serverEntitiesUpdatedSinceLastSync, clientEntity, this.config.entityKey)

                        if (conflictedServerEntity) {
                            if (this.config.areEqual(clientEntity, conflictedServerEntity)) {
                                // we have an entity that's been updated by another client sync, but has same value
                                syncResult.syncedEntities.push({ entity: clientEntity })
                                handledKeys[this.config.entityKey(clientEntity)] = true
                            }
                            else {
                                if (isFunction(this.config.conflictResolutionStrategy)) {
                                    // user has specified their own custom conflict resolution strategy
                                    this.config.conflictResolutionStrategy(clientEntity, conflictedServerEntity, syncStamp, syncResult)
                                    handledKeys[this.config.entityKey(clientEntity)] = true
                                }
                                else {
                                    switch (this.config.conflictResolutionStrategy) {

                                        case 'takeClient':
                                            // client update overrides server
                                            await this.config.updateEntity(clientEntity, syncStamp)
                                            syncResult.syncedEntities.push({ entity: clientEntity })
                                            break

                                        case 'takeServer':
                                            // server update overrides client
                                            syncResult.syncedEntities.push({ entity: conflictedServerEntity })
                                            break

                                        case 'lastUpdated':
                                            if (this.config.entityLastUpdated(clientEntity) > this.config.entityLastUpdated(conflictedServerEntity)) {
                                                // client update was last, so we override server
                                                await this.config.updateEntity(clientEntity, syncStamp)
                                                syncResult.syncedEntities.push({ entity: clientEntity })
                                            }
                                            else {
                                                // server update was last, so we override client
                                                syncResult.syncedEntities.push({ entity: conflictedServerEntity })
                                            }
                                            break

                                        case 'askClient':
                                            // we need confirmation from client about what to do with this conflict
                                            syncResult.conflictedEntities.push(conflictedServerEntity)
                                            break

                                        // Typescript exhaustiveness check pattern
                                        default: assertNever(this.config.conflictResolutionStrategy)
                                    }

                                    handledKeys[this.config.entityKey(clientEntity)] = true
                                }
                            }

                        }
                        else {
                            // we don't have a conflicted state, so we update the server entity
                            let serverEntity = findCorrespondingEntity(correspondingServerEntities, clientEntity, this.config.entityKey)

                            if (serverEntity) {
                                await this.config.updateEntity(clientEntity, syncStamp)
                                syncResult.syncedEntities.push({ entity: clientEntity })
                            }
                            else {
                                // this case shouldn't really happen, since new entities are handled above 
                                // but we handle it anyway
                                await this.handleCreate(clientEntity, syncStamp, syncResult)
                            }

                            handledKeys[this.config.entityKey(clientEntity)] = true
                        }
                    }
                }

                // any server entity that was updated since last sync
                for (let serverEntity of serverEntitiesUpdatedSinceLastSync) {
                    // that hasn't been handled by a create or update operation
                    if (!handledKeys[this.config.entityKey(serverEntity)]) {
                        // is one that doesn't have a corresponding entry on the client
                        // so should be created there
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
                    this.config.entityKey(serverEntity) == this.config.entityKey(resolvedEntity)
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
        if (newKey && newKey != this.config.entityKey(mobileEntity)) {
            syncResult.syncedEntities.push({ entity: mobileEntity, newKey })
        }
        else syncResult.syncedEntities.push({ entity: mobileEntity })
    }

}

export default LeanSyncServer