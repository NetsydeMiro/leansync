import { SyncResponse, isFunction, assertNever, ConflictResolutionResponse, KeySelector, findCorrespondingEntity, LastUpdatedSelector } from "./shared"

export type BasicConflictResolutionStrategy = "takeServer" | "takeClient" | "lastUpdated" | "askClient"

export const BASIC_CONFLICT_RESOLUTION_STRATEGIES: Array<BasicConflictResolutionStrategy> =
    ["takeServer", "takeClient", "lastUpdated", "askClient"]

export interface CustomConflictResolver<Entity> {
    (this: LeanSyncServerConfig<Entity>, clientEntity: Entity, serverEntity: Entity, syncStamp: Date, result: SyncResponse<Entity>): void
}

export type ConflictResolutionStrategy<Entity> = BasicConflictResolutionStrategy | CustomConflictResolver<Entity>

// TODO: perhaps refactor db operations into a factory interface?
export interface LeanSyncServerConfig<Entity> {
    // returns Enitity's unique key
    entityKey: KeySelector<Entity>
    // returns datetime of Entity's last update
    entityLastUpdated: LastUpdatedSelector<Entity>
    // informs server that a client entity is one that was newly created (not yet synced)
    areEntitiesEqual: (entity1: Entity, entity2: Entity) => boolean
    // transaction handling
    startTransaction?: () => void
    commitTransaction?: () => void
    rollBackTransaction?: () => void
    // gets entities corresponding to the supplied keys
    getServerEntities: (keys: Array<any>) => Promise<Array<Entity>>
    // gets entities that have been updated by another client since this client's last sync
    getServerEntitiesSyncedSince: (syncStamp?: Date) => Promise<Array<Entity>>
    // updates the Entity
    updateServerEntity: (entity: Entity, syncStamp: Date) => Promise<Entity>
    // returns the key of the created entity
    createServerEntity: (entity: Entity, syncStamp: Date) => Promise<Entity>
    // specifies preset or custom conflict resolution strategy
    conflictResolutionStrategy: ConflictResolutionStrategy<Entity>
}

export class LeanSyncServer<Entity> {
    constructor(private config: LeanSyncServerConfig<Entity>) { }

    // handles sync requests made by client
    async sync(clientEntities: Array<Entity>, lastSynced?: Date): Promise<SyncResponse<Entity>> {
        return new Promise<SyncResponse<Entity>>(async (resolve, reject) => {
            this.config.startTransaction?.()

            let syncStamp = new Date()
            let handledKeys: { [key: string]: boolean } = {}
            let syncResult: SyncResponse<Entity> = {
                syncedEntities: [],
                newEntities: [],
                conflictedEntities: [],
                syncStamp
            }

            try {
                // get stored versions of entities submitted by client
                // as well as any entities created or modified since the client's last sync
                let [
                    serverEntities,
                    serverEntitiesUpdatedSinceLastSync
                ] = await Promise.all([
                    this.config.getServerEntities(clientEntities.map(this.config.entityKey)),
                    this.config.getServerEntitiesSyncedSince(lastSynced)
                ])

                for (var clientEntity of clientEntities) {

                    let conflictedServerEntity = findCorrespondingEntity(serverEntitiesUpdatedSinceLastSync, clientEntity, this.config.entityKey)

                    if (conflictedServerEntity) {
                        if (this.config.areEntitiesEqual(clientEntity, conflictedServerEntity)) {
                            // we have an entity that's been updated by another client sync, but has same value
                            syncResult.syncedEntities.push({ entity: conflictedServerEntity })
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
                                        let updatedEntity = await this.config.updateServerEntity(clientEntity, syncStamp)
                                        syncResult.syncedEntities.push({ entity: updatedEntity })
                                        break

                                    case 'takeServer':
                                        // server update overrides client
                                        syncResult.syncedEntities.push({ entity: conflictedServerEntity })
                                        break

                                    case 'lastUpdated':
                                        if (this.config.entityLastUpdated(clientEntity) > this.config.entityLastUpdated(conflictedServerEntity)) {
                                            // client update was last, so we override server
                                            let updatedEntity = await this.config.updateServerEntity(clientEntity, syncStamp)
                                            syncResult.syncedEntities.push({ entity: updatedEntity })
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
                        let serverEntity = findCorrespondingEntity(serverEntities, clientEntity, this.config.entityKey)

                        if (serverEntity) {
                            let updatedEntity = await this.config.updateServerEntity(clientEntity, syncStamp)
                            syncResult.syncedEntities.push({ entity: updatedEntity })
                        }
                        else {
                            // create new entities
                            let createdEntity = await this.config.createServerEntity(clientEntity, syncStamp)

                            let clientKey = this.config.entityKey(clientEntity)
                            if (this.config.entityKey(createdEntity) != clientKey) {
                                // due to a collision, or because temp keys are used at client 
                                // we inform the user that a new key has been assigned 
                                syncResult.syncedEntities.push({ entity: createdEntity, clientKey })
                            }
                            else syncResult.syncedEntities.push({ entity: createdEntity })
                        }

                        handledKeys[this.config.entityKey(clientEntity)] = true
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

    async resolveConflict(resolvedEntity: Entity, lastSynced: Date): Promise<ConflictResolutionResponse<Entity>> {

        return new Promise<ConflictResolutionResponse<Entity>>(async (resolve, reject) => {
            let syncStamp = new Date()
            let result: ConflictResolutionResponse<Entity> = { syncStamp }

            this.config.startTransaction?.()
            try {
                let serverEntitiesUpdatedSinceLastSync =
                    await this.config.getServerEntitiesSyncedSince(lastSynced)

                let conflictedAgain = serverEntitiesUpdatedSinceLastSync.find(serverEntity =>
                    this.config.entityKey(serverEntity) == this.config.entityKey(resolvedEntity)
                )

                if (conflictedAgain) {
                    if (!this.config.areEntitiesEqual(resolvedEntity, conflictedAgain)) {
                        result.stillRequiringConflictResolution = conflictedAgain
                    }
                }
                else await this.config.updateServerEntity(resolvedEntity, syncStamp)

                this.config.commitTransaction?.()
                resolve(result)
            }
            catch (ex) {
                this.config.rollBackTransaction?.()
                reject(ex)
            }
        })
    }
}

export default LeanSyncServer