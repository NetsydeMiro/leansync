import { SyncResult, ConflictResolutionResult, KeySelector, LastUpdatedSelector } from "./shared";
export declare type BasicConflictResolutionStrategy = "takeServer" | "takeClient" | "lastUpdated" | "askClient";
export interface CustomConflictResolver<Entity> {
    (this: LeanSyncServerConfig<Entity>, clientEntity: Entity, serverEntity: Entity, syncStamp: Date, result: SyncResult<Entity>): void;
}
export declare type ConflictResolutionStrategy<Entity> = BasicConflictResolutionStrategy | CustomConflictResolver<Entity>;
export interface LeanSyncServerConfig<Entity> {
    entityKey: KeySelector<Entity>;
    entityLastUpdated: LastUpdatedSelector<Entity>;
    isNewEntity: (entity: Entity) => boolean;
    areEntitiesEqual: (entity1: Entity, entity2: Entity) => boolean;
    startTransaction?: () => void;
    commitTransaction?: () => void;
    rollBackTransaction?: () => void;
    getServerEntities: (keys: Array<any>) => Promise<Array<Entity>>;
    getServerEntitiesSyncedSince: (syncStamp?: Date) => Promise<Array<Entity>>;
    updateServerEntity: (entity: Entity, syncStamp: Date) => Promise<void>;
    createServerEntity: (entity: Entity, syncStamp: Date) => Promise<any>;
    conflictResolutionStrategy: ConflictResolutionStrategy<Entity>;
}
export declare class LeanSyncServer<Entity> {
    private config;
    constructor(config: LeanSyncServerConfig<Entity>);
    sync(clientEntities: Array<Entity>, lastSynced?: Date): Promise<SyncResult<Entity>>;
    resolveConflict(resolvedEntity: Entity, lastSynced: Date): Promise<ConflictResolutionResult<Entity>>;
    private handleCreate;
}
export default LeanSyncServer;
