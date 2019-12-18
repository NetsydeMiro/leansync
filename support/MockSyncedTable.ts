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

// TODO: refactor as dictionary instead of array of rows?
export class MockSyncedTable<EntityType extends Entity> {

    constructor(
        rows: Array<EntityType> = [],
        public newKey: KeyGenerator = () => v1().toString()) {
        this.rows = this.clone(rows)
    }

    rows: Array<EntityType>

    protected clone = (rows: Array<EntityType>) => rows.map(r => Object.assign({}, r))

    async getByKey(keys: Array<any>): Promise<Array<EntityType>> {
        let rows = this.rows.filter(r => keys.includes(r.id))
        return this.clone(rows)
    }

    async getSyncedSince(syncStamp?: Date): Promise<Array<EntityType>> {
        let rows = this.rows.filter(r => !syncStamp || r.syncedAt && (r.syncedAt > syncStamp))
        return this.clone(rows)
    }

    async update(entity: EntityType, syncStamp: Date, originalKey?: any): Promise<EntityType> {
        let row = this.rows.find(r => r.id == (originalKey || entity.id))

        if (!row) {
            row = {} as EntityType
            this.rows.push(row)
        }

        for(let key of Object.keys(entity) as Array<keyof EntityType>) {
            row[key] = entity[key]
        }

        row.syncedAt = syncStamp

        return Object.assign(row, {})
    }

    async add(entity: EntityType, syncStamp?: Date): Promise<EntityType> {
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
