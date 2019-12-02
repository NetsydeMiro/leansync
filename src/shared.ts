export interface ModifiedEntity<Entity> {
    entity: Entity
    newKey?: any
}

export interface KeySelector<Entity> {
    (entity: Entity): any
}

export function findEntity<Entity>(serverEntities: Array<Entity>, mobileEntity: Entity, keySelector: KeySelector<Entity>): Entity {
    return serverEntities.find(serverEntity => keySelector(serverEntity) == keySelector(mobileEntity))
}

export function assertNever(x: never): never {
    throw new Error("Unexpected object: " + x);
}

export function isFunction(obj): obj is Function {
    return obj && {}.toString.call(obj) === '[object Function]';
}

export interface SyncResult<Entity> {
    entitiesRequiringCreation: Array<Entity>
    entitiesRequiringModification: Array<ModifiedEntity<Entity>>
    entitiesRequiringConflictResolution: Array<Entity>
    keysRequiringNoClientAction: Array<Entity>
    syncStamp: Date
}

export interface ConflictResolutionResult<Entity> {
    stillRequiringConflictResolution?: Entity
    syncStamp: Date
}
