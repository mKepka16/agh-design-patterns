import { Pool } from 'pg';
import { quoteIdentifier, buildWhereClause } from '../sql-utils';

export type FindAllOptions = {
    select?: Record<string, boolean>;
    where?: Record<string, any>;
    limit?: number;
    offset?: number;
    orderBy?: Record<string, 'ASC' | 'DESC'>;
};

export class SelectOperation {
    constructor(private readonly pool: Pool, private readonly tableName: string) {}

    async findAll(options: FindAllOptions = {}): Promise<any[]> {
        const quotedTableName = quoteIdentifier(this.tableName);

        let columnsList = '*';
        if (options.select && Object.keys(options.select).length > 0) {
            columnsList = Object.keys(options.select)
                .filter((key) => options.select![key])
                .map(quoteIdentifier)
                .join(', ');
        }

        const { clause, values } = buildWhereClause(options.where || {});

        let sql = `SELECT ${columnsList} FROM ${quotedTableName} ${clause}`;

        // ORDER BY
        if (options.orderBy && Object.keys(options.orderBy).length > 0) {
            const orderClauses = Object.entries(options.orderBy).map(([col, dir]) => {
                return `${quoteIdentifier(col)} ${dir}`;
            });
            sql += ` ORDER BY ${orderClauses.join(', ')}`;
        }

        // LIMIT
        if (options.limit !== undefined) {
             values.push(options.limit);
             sql += ` LIMIT $${values.length}`;
        }

        // OFFSET
        if (options.offset !== undefined) {
             values.push(options.offset);
             sql += ` OFFSET $${values.length}`;
        }
        
        sql += ';';

        const result = await this.pool.query(sql, values);
        return result.rows;
    }
}