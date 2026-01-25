import { Pool } from 'pg';
import { quoteIdentifier } from '../sql-utils';

export class InsertOperation {
    constructor(private readonly pool: Pool, private readonly tableName: string) {}

    async execute(data: Record<string, any> | Record<string, any>[]): Promise<any | any[]> {
        const records = Array.isArray(data) ? data : [data];

        if (records.length === 0) {
            throw new Error('No data provided for insert');
        }

        const columns = Object.keys(records[0]);
        const quotedTableName = quoteIdentifier(this.tableName);
        const quotedColumns = columns.map(quoteIdentifier).join(', ');

        const values: any[] = [];
        const rowPlaceholders: string[] = [];
        let paramIndex = 1;

        for (const record of records) {
            const recordValues: string[] = [];

            for (const column of columns) {
                values.push(record[column]);
                recordValues.push(`$${paramIndex++}`);
            }

            rowPlaceholders.push(`(${recordValues.join(', ')})`);
        }

        const sql = `
      INSERT INTO ${quotedTableName} (${quotedColumns})
      VALUES ${rowPlaceholders.join(', ')}
      RETURNING *;
    `;

        const result = await this.pool.query(sql, values);

        return Array.isArray(data) ? result.rows : result.rows[0];
    }
}