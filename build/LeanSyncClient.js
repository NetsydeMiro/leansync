export class ConnectivityError extends Error {
}
export class LeanSyncClient {
    constructor(config) {
        this.config = config;
    }
    async sync() {
        try {
            let syncResult = await this.sendSyncRequest();
            await this.processSyncResponse(syncResult);
        }
        catch (ex) {
            // we do nothing if we can't connect at the moment, and allow the next sync to handle it
            // of all other errors we want to be made aware 
            if (!(ex instanceof ConnectivityError))
                throw ex;
        }
    }
    async sendSyncRequest() {
        let [clientEntities, lastSync] = await Promise.all([
            this.config.getClientEntitiesRequiringSync(),
            this.config.getLastSyncStamp(),
        ]);
        // This shouldn't be necessary... not sure why clientEntities is being unioned with undefined just because lastSync is
        // TODO: look into this
        clientEntities = (clientEntities !== null && clientEntities !== void 0 ? clientEntities : []);
        return this.config.syncWithServer(clientEntities, lastSync);
    }
    // TODO: add transaction support?
    // TODO: investigate push discrepancies... 
    // Do we need to handle the case where a push might be received when we've updated our version?  
    // Mark it as requiring conflict?  I think just ignore it, and wait until next sync in that case
    async processSyncResponse(syncResult) {
        var _a, _b;
        for (let newEntity of syncResult.newEntities) {
            await this.config.createEntity(newEntity, syncResult.syncStamp);
        }
        for (let modifiedEntity of syncResult.syncedEntities) {
            await this.config.updateEntity(modifiedEntity.entity, syncResult.syncStamp, modifiedEntity.clientKey);
        }
        for (let conflictedEntity of syncResult.conflictedEntities) {
            await ((_b = (_a = this.config).markRequiringConflictResolution) === null || _b === void 0 ? void 0 : _b.call(_a, conflictedEntity, syncResult.syncStamp));
        }
        await this.config.markSyncStamp(syncResult.syncStamp);
    }
}
export default LeanSyncClient;
