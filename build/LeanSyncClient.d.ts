import { SyncResponse, ConflictResolutionResponse, KeySelector } from './shared';
export declare class ConnectivityError extends Error {
}
export interface LeanSyncClientConfig<Entity> {
    keySelector: KeySelector<Entity>;
    getClientEntitiesRequiringSync: () => Promise<Array<Entity>>;
    getClientEntities: (keys: Array<any>) => Promise<Array<Entity>>;
    getLastSyncStamp: () => Promise<Date | undefined>;
    markSyncStamp: (syncStamp: Date) => Promise<void>;
    updateEntity: (entity: Entity, syncStamp: Date, originalKey?: any) => Promise<void>;
    createEntity: (entity: Entity, syncStamp: Date) => Promise<void>;
    markRequiringConflictResolution?: (entity: Entity, syncStamp: Date) => Promise<void>;
    syncWithServer: (entities: Array<Entity>, lastSync?: Date) => Promise<SyncResponse<Entity>>;
    resolveConflictWithServer?: (entity: Entity) => Promise<ConflictResolutionResponse<Entity>>;
}
export declare class LeanSyncClient<Entity> {
    private config;
    constructor(config: LeanSyncClientConfig<Entity>);
    sync(): Promise<void>;
    processSyncResponse(syncResult: SyncResponse<Entity>): Promise<void>;
}
export default LeanSyncClient;
