import { Pool } from 'pg';
import { quoteIdentifier, buildWhereClause } from '../sql-utils';

export type FindAllOptions = {
    select?: Record<string, boolean>; // np. { id: true, name: true }
    where?: Record<string, any>;      // np. { color: 'red' }
};

export class SelectOperation {
    constructor(private readonly pool: Pool, private readonly tableName: string) {}

    async findAll(options: FindAllOptions = {}): Promise<any[]> {
        const quotedTableName = quoteIdentifier(this.tableName);

        // Obsługa SELECT (wybór kolumn lub *)
        let columnsList = '*';
        if (options.select && Object.keys(options.select).length > 0) {
            columnsList = Object.keys(options.select)
                .filter((key) => options.select![key]) // wybieramy tylko te z 'true'
                .map(quoteIdentifier)
                .join(', ');
        }

        // Obsługa WHERE
        const { clause, values } = buildWhereClause(options.where || {});

        const sql = `SELECT ${columnsList} FROM ${quotedTableName} ${clause};`;

        const result = await this.pool.query(sql, values);
        return result.rows;
    }
}