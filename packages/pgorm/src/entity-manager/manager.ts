import { Pool } from 'pg';
import { InsertOperation } from './insert';
import { SelectOperation, FindAllOptions } from './select';
import { DeleteOperation, DeleteOptions } from './delete';

export class TableQueryBuilder {
    private readonly insertOp: InsertOperation;
    private readonly selectOp: SelectOperation;
    private readonly deleteOp: DeleteOperation;

    constructor(pool: Pool, tableName: string) {
        this.insertOp = new InsertOperation(pool, tableName);
        this.selectOp = new SelectOperation(pool, tableName);
        this.deleteOp = new DeleteOperation(pool, tableName);
    }

    async insert(data: Record<string, any>) {
        return this.insertOp.execute(data);
    }

    async findAll(options?: FindAllOptions) {
        return this.selectOp.findAll(options);
    }

    async deleteMany(options: DeleteOptions) {
        return this.deleteOp.deleteMany(options);
    }
}

export class EntityManager {
    constructor(private readonly pool: Pool) {}

    table(tableName: string): TableQueryBuilder {
        return new TableQueryBuilder(this.pool, tableName);
    }
}