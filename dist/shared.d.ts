export interface ModifiedEntity<Entity> {
    entity: Entity;
    newKey?: any;
}
export declare function isModifiedEntity<Entity>(obj: Entity | ModifiedEntity<Entity>): obj is ModifiedEntity<Entity>;
export interface KeySelector<Entity> {
    (entity: Entity): any;
}
export interface LastUpdatedSelector<Entity> {
    (entity: Entity): Date;
}
export declare function findCorrespondingEntity<Entity>(entities: Array<Entity>, entity: Entity, keySelector: KeySelector<Entity>): Entity | undefined;
export declare function assertNever(x: never): never;
export declare function isFunction(obj: any): obj is Function;
export interface SyncResult<Entity> {
    syncedEntities: Array<ModifiedEntity<Entity>>;
    newEntities: Array<Entity>;
    conflictedEntities: Array<Entity>;
    syncStamp: Date;
}
export interface ConflictResolutionResult<Entity> {
    stillRequiringConflictResolution?: Entity;
    syncStamp: Date;
}
