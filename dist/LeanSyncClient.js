export class ConnectivityError extends Error {
}
export class LeanSyncClient {
    constructor(config) {
        this.config = config;
    }
    async sync() {
        try {
            let [lastSync, clientEntities] = await Promise.all([
                this.config.getLastSyncStamp(),
                this.config.getClientEntitiesRequiringSync()
            ]);
            let syncResult = await this.config.syncWithServer(clientEntities, lastSync);
            await this.processSyncResult(syncResult);
        }
        catch (ex) {
            // we do nothing if we can't connect at the moment, and allow the next sync to handle it
            // of all other errors we want to be made aware 
            if (!(ex instanceof ConnectivityError))
                throw ex;
        }
    }
    async processSyncResult(syncResult) {
        var _a, _b;
        for (let newEntity of syncResult.newEntities) {
            await this.config.createEntity(newEntity, syncResult.syncStamp);
        }
        for (let modifiedEntity of syncResult.syncedEntities) {
            await this.config.updateEntity(modifiedEntity.entity, syncResult.syncStamp, modifiedEntity.newKey);
        }
        for (let conflictedEntity of syncResult.conflictedEntities) {
            await ((_b = (_a = this.config).markRequiringConflictResolution) === null || _b === void 0 ? void 0 : _b.call(_a, conflictedEntity, syncResult.syncStamp));
        }
    }
}
export default LeanSyncClient;
