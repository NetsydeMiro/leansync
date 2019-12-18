import { isFunction, assertNever, findCorrespondingEntity } from "./shared";
export const BASIC_CONFLICT_RESOLUTION_STRATEGIES = ["takeServer", "takeClient", "lastUpdated", "askClient"];
export class LeanSyncServer {
    constructor(config) {
        this.config = config;
    }
    // handles sync requests made by client
    async sync(clientEntities, lastSynced) {
        return new Promise(async (resolve, reject) => {
            var _a, _b, _c, _d, _e, _f;
            (_b = (_a = this.config).startTransaction) === null || _b === void 0 ? void 0 : _b.call(_a);
            let syncStamp = new Date();
            let handledKeys = {};
            let syncResult = {
                syncedEntities: [],
                newEntities: [],
                conflictedEntities: [],
                syncStamp
            };
            try {
                // get stored versions of entities submitted by client
                // as well as any entities created or modified since the client's last sync
                let [serverEntities, serverEntitiesUpdatedSinceLastSync] = await Promise.all([
                    this.config.getServerEntities(clientEntities.map(this.config.entityKey)),
                    this.config.getServerEntitiesSyncedSince(lastSynced)
                ]);
                for (var clientEntity of clientEntities) {
                    let conflictedServerEntity = findCorrespondingEntity(serverEntitiesUpdatedSinceLastSync, clientEntity, this.config.entityKey);
                    if (conflictedServerEntity) {
                        if (this.config.areEntitiesEqual(clientEntity, conflictedServerEntity)) {
                            // we have an entity that's been updated by another client sync, but has same value
                            syncResult.syncedEntities.push({ entity: conflictedServerEntity });
                            handledKeys[this.config.entityKey(clientEntity)] = true;
                        }
                        else {
                            if (isFunction(this.config.conflictResolutionStrategy)) {
                                // user has specified their own custom conflict resolution strategy
                                this.config.conflictResolutionStrategy(clientEntity, conflictedServerEntity, syncStamp, syncResult);
                                handledKeys[this.config.entityKey(clientEntity)] = true;
                            }
                            else {
                                switch (this.config.conflictResolutionStrategy) {
                                    case 'takeClient':
                                        // client update overrides server
                                        let updatedEntity = await this.config.updateServerEntity(clientEntity, syncStamp);
                                        syncResult.syncedEntities.push({ entity: updatedEntity });
                                        break;
                                    case 'takeServer':
                                        // server update overrides client
                                        syncResult.syncedEntities.push({ entity: conflictedServerEntity });
                                        break;
                                    case 'lastUpdated':
                                        if (this.config.entityLastUpdated(clientEntity) > this.config.entityLastUpdated(conflictedServerEntity)) {
                                            // client update was last, so we override server
                                            let updatedEntity = await this.config.updateServerEntity(clientEntity, syncStamp);
                                            syncResult.syncedEntities.push({ entity: updatedEntity });
                                        }
                                        else {
                                            // server update was last, so we override client
                                            syncResult.syncedEntities.push({ entity: conflictedServerEntity });
                                        }
                                        break;
                                    case 'askClient':
                                        // we need confirmation from client about what to do with this conflict
                                        syncResult.conflictedEntities.push(conflictedServerEntity);
                                        break;
                                    // Typescript exhaustiveness check pattern
                                    default: assertNever(this.config.conflictResolutionStrategy);
                                }
                                handledKeys[this.config.entityKey(clientEntity)] = true;
                            }
                        }
                    }
                    else {
                        // we don't have a conflicted state, so we update the server entity
                        let serverEntity = findCorrespondingEntity(serverEntities, clientEntity, this.config.entityKey);
                        if (serverEntity) {
                            let updatedEntity = await this.config.updateServerEntity(clientEntity, syncStamp);
                            syncResult.syncedEntities.push({ entity: updatedEntity });
                        }
                        else {
                            // create new entities
                            let createdEntity = await this.config.createServerEntity(clientEntity, syncStamp);
                            let clientKey = this.config.entityKey(clientEntity);
                            if (this.config.entityKey(createdEntity) != clientKey) {
                                // due to a collision, or because temp keys are used at client 
                                // we inform the user that a new key has been assigned 
                                syncResult.syncedEntities.push({ entity: createdEntity, clientKey });
                            }
                            else
                                syncResult.syncedEntities.push({ entity: createdEntity });
                        }
                        handledKeys[this.config.entityKey(clientEntity)] = true;
                    }
                }
                // any server entity that was updated since last sync
                for (let serverEntity of serverEntitiesUpdatedSinceLastSync) {
                    // that hasn't been handled by a create or update operation
                    if (!handledKeys[this.config.entityKey(serverEntity)]) {
                        // is one that doesn't have a corresponding entry on the client
                        // so should be created there
                        syncResult.newEntities.push(serverEntity);
                    }
                }
                (_d = (_c = this.config).commitTransaction) === null || _d === void 0 ? void 0 : _d.call(_c);
                resolve(syncResult);
            }
            catch (ex) {
                (_f = (_e = this.config).rollBackTransaction) === null || _f === void 0 ? void 0 : _f.call(_e);
                reject(ex);
            }
        });
    }
    async resolveConflict(resolvedEntity, lastSynced) {
        return new Promise(async (resolve, reject) => {
            var _a, _b, _c, _d, _e, _f;
            let syncStamp = new Date();
            let result = { syncStamp };
            (_b = (_a = this.config).startTransaction) === null || _b === void 0 ? void 0 : _b.call(_a);
            try {
                let serverEntitiesUpdatedSinceLastSync = await this.config.getServerEntitiesSyncedSince(lastSynced);
                let conflictedAgain = serverEntitiesUpdatedSinceLastSync.find(serverEntity => this.config.entityKey(serverEntity) == this.config.entityKey(resolvedEntity));
                if (conflictedAgain) {
                    if (!this.config.areEntitiesEqual(resolvedEntity, conflictedAgain)) {
                        result.stillRequiringConflictResolution = conflictedAgain;
                    }
                }
                else
                    await this.config.updateServerEntity(resolvedEntity, syncStamp);
                (_d = (_c = this.config).commitTransaction) === null || _d === void 0 ? void 0 : _d.call(_c);
                resolve(result);
            }
            catch (ex) {
                (_f = (_e = this.config).rollBackTransaction) === null || _f === void 0 ? void 0 : _f.call(_e);
                reject(ex);
            }
        });
    }
}
export default LeanSyncServer;
