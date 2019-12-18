import { SyncResponse, ConflictResolutionResponse, KeySelector, LastUpdatedSelector } from "./shared";
export declare type BasicConflictResolutionStrategy = "takeServer" | "takeClient" | "lastUpdated" | "askClient";
export declare const BASIC_CONFLICT_RESOLUTION_STRATEGIES: Array<BasicConflictResolutionStrategy>;
export interface CustomConflictResolver<Entity> {
    (this: LeanSyncServerConfig<Entity>, clientEntity: Entity, serverEntity: Entity, syncStamp: Date, result: SyncResponse<Entity>): void;
}
export declare type ConflictResolutionStrategy<Entity> = BasicConflictResolutionStrategy | CustomConflictResolver<Entity>;
export interface LeanSyncServerConfig<Entity> {
    entityKey: KeySelector<Entity>;
    entityLastUpdated: LastUpdatedSelector<Entity>;
    areEntitiesEqual: (entity1: Entity, entity2: Entity) => boolean;
    startTransaction?: () => void;
    commitTransaction?: () => void;
    rollBackTransaction?: () => void;
    getServerEntities: (keys: Array<any>) => Promise<Array<Entity>>;
    getServerEntitiesSyncedSince: (syncStamp?: Date) => Promise<Array<Entity>>;
    updateServerEntity: (entity: Entity, syncStamp: Date) => Promise<Entity>;
    createServerEntity: (entity: Entity, syncStamp: Date) => Promise<Entity>;
    conflictResolutionStrategy: ConflictResolutionStrategy<Entity>;
}
export declare class LeanSyncServer<Entity> {
    private config;
    constructor(config: LeanSyncServerConfig<Entity>);
    sync(clientEntities: Array<Entity>, lastSynced?: Date): Promise<SyncResponse<Entity>>;
    resolveConflict(resolvedEntity: Entity, lastSynced: Date): Promise<ConflictResolutionResponse<Entity>>;
}
export default LeanSyncServer;
