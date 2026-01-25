import { Pool } from 'pg';
import { quoteIdentifier } from '../sql-utils';

export interface UpdateOptions {
    where: Record<string, any>;
    data: Record<string, any>;
}

export class UpdateOperation {
  constructor(private readonly pool: Pool, private readonly tableName: string) {}

  async execute(options: UpdateOptions): Promise<any[]> {
    const { where, data } = options;
    if (Object.keys(data).length === 0) {
        return [];
    }

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
        setClauses.push(`${quoteIdentifier(key)} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
    }

    const whereClauses: string[] = [];
    for (const [key, value] of Object.entries(where)) {
        whereClauses.push(`${quoteIdentifier(key)} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const sql = `UPDATE ${quoteIdentifier(this.tableName)} SET ${setClauses.join(', ')} ${whereSql} RETURNING *;`;

    const result = await this.pool.query(sql, values);
    return result.rows;
  }
}
