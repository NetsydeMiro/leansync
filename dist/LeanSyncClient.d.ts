import { SyncResult, ConflictResolutionResult, KeySelector } from './shared';
export declare class ConnectivityError extends Error {
}
export interface LeanSyncClientConfig<Entity> {
    keySelector: KeySelector<Entity>;
    getClientEntitiesRequiringSync: () => Promise<Array<Entity>>;
    getClientEntities: (keys: Array<any>) => Promise<Array<Entity>>;
    getLastSyncStamp: () => Promise<Date>;
    updateEntity: (entity: Entity, syncStamp: Date, newKey?: any) => Promise<void>;
    createEntity: (entity: Entity, syncStamp: Date) => Promise<any>;
    markRequiringConflictResolution?: (entity: Entity, syncStamp: Date) => Promise<void>;
    syncWithServer: (entities: Array<Entity>, lastSync: Date) => Promise<SyncResult<Entity>>;
    resolveConflictWithServer?: (entity: Entity) => Promise<ConflictResolutionResult<Entity>>;
}
export declare class LeanSyncClient<Entity> {
    private config;
    constructor(config: LeanSyncClientConfig<Entity>);
    sync(): Promise<void>;
    processSyncResult(syncResult: SyncResult<Entity>): Promise<void>;
}
export default LeanSyncClient;
