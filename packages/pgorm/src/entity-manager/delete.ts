import { Pool } from 'pg';
import { quoteIdentifier, buildWhereClause } from '../sql-utils';

export type DeleteOptions = {
    where: Record<string, any>;
};

export class DeleteOperation {
    constructor(private readonly pool: Pool, private readonly tableName: string) {}

    async deleteMany(options: DeleteOptions): Promise<number> {
        const quotedTableName = quoteIdentifier(this.tableName);

        const { clause, values } = buildWhereClause(options.where);

        if (!clause) {
            throw new Error('Delete operation requires a WHERE clause to avoid deleting all records.');
        }

        const sql = `DELETE FROM ${quotedTableName} ${clause};`;

        const result = await this.pool.query(sql, values);
        return result.rowCount ?? 0;
    }
}