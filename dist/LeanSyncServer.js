// TODO: Handle client needs to create entities
import { isFunction, assertNever, findCorrespondingEntity } from "./shared";
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
            // let handledKeys: { [key: string]: Boolean } = {}
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
                let [correspondingServerEntities, serverEntitiesUpdatedSinceLastSync] = await Promise.all([
                    this.config.getServerEntities(clientEntities.map(this.config.entityKey)),
                    this.config.getServerEntitiesSyncedSince(lastSynced)
                ]);
                for (var clientEntity of clientEntities) {
                    if (this.config.isNewEntity(clientEntity)) {
                        // create new entities
                        await this.handleCreate(clientEntity, syncStamp, syncResult);
                        handledKeys[this.config.entityKey(clientEntity)] = true;
                    }
                    else {
                        let conflictedServerEntity = findCorrespondingEntity(serverEntitiesUpdatedSinceLastSync, clientEntity, this.config.entityKey);
                        if (conflictedServerEntity) {
                            if (this.config.areEntitiesEqual(clientEntity, conflictedServerEntity)) {
                                // we have an entity that's been updated by another client sync, but has same value
                                syncResult.syncedEntities.push({ entity: clientEntity });
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
                                            await this.config.updateServerEntity(clientEntity, syncStamp);
                                            syncResult.syncedEntities.push({ entity: clientEntity });
                                            break;
                                        case 'takeServer':
                                            // server update overrides client
                                            syncResult.syncedEntities.push({ entity: conflictedServerEntity });
                                            break;
                                        case 'lastUpdated':
                                            if (this.config.entityLastUpdated(clientEntity) > this.config.entityLastUpdated(conflictedServerEntity)) {
                                                // client update was last, so we override server
                                                await this.config.updateServerEntity(clientEntity, syncStamp);
                                                syncResult.syncedEntities.push({ entity: clientEntity });
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
                            let serverEntity = findCorrespondingEntity(correspondingServerEntities, clientEntity, this.config.entityKey);
                            if (serverEntity) {
                                await this.config.updateServerEntity(clientEntity, syncStamp);
                                syncResult.syncedEntities.push({ entity: clientEntity });
                            }
                            else {
                                // this case shouldn't really happen, since new entities are handled above 
                                // but we handle it anyway
                                await this.handleCreate(clientEntity, syncStamp, syncResult);
                            }
                            handledKeys[this.config.entityKey(clientEntity)] = true;
                        }
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
            (_b = (_a = this.config).startTransaction) === null || _b === void 0 ? void 0 : _b.call(_a);
            let syncStamp = new Date();
            let result = { syncStamp };
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
    async handleCreate(mobileEntity, syncStamp, syncResult) {
        let newKey = await this.config.createServerEntity(mobileEntity, syncStamp);
        // we inform the user that a new key has been assigned 
        // due to a collision, or because temp keys are used at client 
        // and permanent keys assigned at server
        if (newKey && newKey != this.config.entityKey(mobileEntity)) {
            syncResult.syncedEntities.push({ entity: mobileEntity, newKey });
        }
        else
            syncResult.syncedEntities.push({ entity: mobileEntity });
    }
}
export default LeanSyncServer;
