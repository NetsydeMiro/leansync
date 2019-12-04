import { v1 } from 'uuid'

export interface SyncedEntity {
    key: any
    syncedAt?: Date
}

export interface KeyGenerator {
    (): any
}

export class MockSyncedTable<EntityType extends SyncedEntity> {

    constructor(
        public rows: Array<EntityType> = [], 
        public newKey: KeyGenerator = () => v1().toString()) 
    { }

    private clone = (rows: Array<EntityType>) => rows.map(r => Object.assign({}, r))

    async byKey(keys: Array<any>): Promise<Array<EntityType>> {
        let rows = this.rows.filter(r => keys.includes(r.key))
        return this.clone(rows)
    }

    async syncedSince(syncStamp?: Date): Promise<Array<EntityType>> {
        let rows = this.rows.filter(r => !syncStamp || r.syncedAt > syncStamp)
        return this.clone(rows)
    }

    async update(entity: EntityType, syncStamp: Date): Promise<void> {
        let row = this.rows.find(r => r.key == entity.key)

        for(let key of Object.keys(entity)) {
            row[key] = entity[key]
        }

        row.syncedAt = syncStamp
    }

    async add(entity: EntityType, syncStamp?: Date): Promise<any> {
        let row = Object.assign({}, entity)
        row.syncedAt = syncStamp

        while (this.rows.some(r => r.key == row.key)) {
            row.key = this.newKey()
        }

        this.rows.push(row)

        return row.key
    }
}