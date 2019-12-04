export interface ModifiedEntity<Entity> {
    entity: Entity
    newKey?: any
}

export function isModifiedEntity<Entity>(obj: Entity | ModifiedEntity<Entity>): obj is ModifiedEntity<Entity> {
    return !!obj['entity']
}

export interface KeySelector<Entity> {
    (entity: Entity): any
}

/*
export function findCorrespondingEntity<Entity>(entities: Array<Entity>, entity: Entity, keySelector: KeySelector<Entity>): Entity 

export function findCorrespondingEntity<Entity>(entities: Array<ModifiedEntity<Entity>>, entity: Entity, keySelector: KeySelector<Entity>): Entity 

export function findCorrespondingEntity<Entity>(entities: Array<Entity | ModifiedEntity<Entity>>, entity: Entity, keySelector: KeySelector<Entity>): Entity {
    let ents = entities.map(e => isModifiedEntity(e) ? e.entity : e)
    return ents.find(serverEntity => keySelector(serverEntity) == keySelector(entity))
}
*/

export function findCorrespondingEntity<Entity>(entities: Array<Entity>, entity: Entity, keySelector: KeySelector<Entity>): Entity {
    return entities.find(serverEntity => keySelector(serverEntity) == keySelector(entity))
}

export function assertNever(x: never): never {
    throw new Error("Unexpected object: " + x);
}

export function isFunction(obj): obj is Function {
    return obj && {}.toString.call(obj) === '[object Function]';
}

export interface SyncResult<Entity> {
    syncedEntities: Array<ModifiedEntity<Entity>>
    newEntities: Array<Entity>
    conflictedEntities: Array<Entity>
    syncStamp: Date
}

export interface ConflictResolutionResult<Entity> {
    stillRequiringConflictResolution?: Entity
    syncStamp: Date
}
