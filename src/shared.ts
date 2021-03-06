export interface ModifiedEntity<Entity> {
    entity: Entity
    clientKey?: any
}

export function isModifiedEntity<Entity>(obj: Entity | ModifiedEntity<Entity>): obj is ModifiedEntity<Entity> {
    return !!(obj as ModifiedEntity<Entity>)['entity']
}

export interface KeySelector<Entity> {
    (entity: Entity): any
}

export interface LastUpdatedSelector<Entity> {
    (entity: Entity): Date
}

export function findCorrespondingEntity<Entity>(entities: Array<Entity>, entity: Entity, keySelector: KeySelector<Entity>): Entity | undefined {
    return entities.find(serverEntity => keySelector(serverEntity) == keySelector(entity))
}

export function assertNever(x: never): never {
    throw new Error("Unexpected object: " + x);
}

export function isFunction(obj: any): obj is Function {
    return obj && {}.toString.call(obj) === '[object Function]';
}

export interface SyncResponse<Entity> {
    syncedEntities: Array<ModifiedEntity<Entity>>
    newEntities: Array<Entity>
    conflictedEntities: Array<Entity>
    syncStamp: Date
}

export interface ConflictResolutionResponse<Entity> {
    stillRequiringConflictResolution?: Entity
    syncStamp: Date
}
