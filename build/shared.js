export function isModifiedEntity(obj) {
    return !!obj['entity'];
}
export function findCorrespondingEntity(entities, entity, keySelector) {
    return entities.find(serverEntity => keySelector(serverEntity) == keySelector(entity));
}
export function assertNever(x) {
    throw new Error("Unexpected object: " + x);
}
export function isFunction(obj) {
    return obj && {}.toString.call(obj) === '[object Function]';
}
