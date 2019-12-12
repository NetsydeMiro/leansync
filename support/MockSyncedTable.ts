import { v1 } from 'uuid'

export interface Entity {
    id: any
    updatedAt: Date
    syncedAt?: Date
    conflict?: string
}

export interface KeyGenerator {
    (): any
}

export class MockSyncedTable<EntityType extends Entity> {

    constructor(
        public rows: Array<EntityType> = [], 
        public newKey: KeyGenerator = () => v1().toString()) 
    { }

    protected clone = (rows: Array<EntityType>) => rows.map(r => Object.assign({}, r))

    async getByKey(keys: Array<any>): Promise<Array<EntityType>> {
        let rows = this.rows.filter(r => keys.includes(r.id))
        return this.clone(rows)
    }

    async getSyncedSince(syncStamp?: Date): Promise<Array<EntityType>> {
        let rows = this.rows.filter(r => !syncStamp || r.syncedAt > syncStamp)
        return this.clone(rows)
    }

    async update(entity: EntityType, syncStamp: Date, newKey?: any): Promise<EntityType> {
        let row = this.rows.find(r => r.id == entity.id)

        for(let key of Object.keys(entity)) {
            row[key] = entity[key]
        }

        if (newKey) row.id = newKey

        row.syncedAt = syncStamp

        return Object.assign(row, {})
    }

    async add(entity: EntityType, syncStamp: Date): Promise<EntityType> {
        let row = Object.assign({}, entity)
        row.syncedAt = syncStamp

        while (this.rows.some(r => r.id == row.id)) {
            row.id = this.newKey()
        }

        this.rows.push(row)

        return Object.assign({}, row)
    }

    // client function
    async getRequiringSync(): Promise<Array<EntityType>> {
        let rows = this.rows.filter(r => !r.syncedAt || r.updatedAt > r.syncedAt)
        return this.clone(rows)
    }

    // client function
    async MarkConflicted(serverEntity: EntityType): Promise<void> {
        let entity = this.rows.find(r => r.id == serverEntity.id)

        if (entity) entity.conflict = JSON.stringify(serverEntity)
    }
}
