import { Pool } from 'pg';
import { quoteIdentifier } from '../sql-utils';

export class InsertOperation {
    constructor(private readonly pool: Pool, private readonly tableName: string) {}

    async execute(data: Record<string, any> | Record<string, any>[]): Promise<any | any[]> {
        // 1. Normalizacja: zawsze pracujemy na tablicy
        const records = Array.isArray(data) ? data : [data];

        if (records.length === 0) {
            throw new Error('No data provided for insert');
        }

        // 2. Pobranie nazw kolumn z pierwszego obiektu (zakładamy, że wszystkie mają te same klucze)
        const columns = Object.keys(records[0]);
        const quotedTableName = quoteIdentifier(this.tableName);
        const quotedColumns = columns.map(quoteIdentifier).join(', ');

        // 3. Budowanie VALUES ($1, $2), ($3, $4)...
        const values: any[] = [];
        const rowPlaceholders: string[] = [];
        let paramIndex = 1;

        for (const record of records) {
            const recordValues: string[] = [];

            for (const column of columns) {
                // Dodajemy wartość do płaskiej tablicy values
                values.push(record[column]);
                // Dodajemy placeholder z odpowiednim numerem
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

        // 4. Jeśli wprowadziliśmy jeden obiekt, zwracamy jeden obiekt. Jeśli tablicę - tablicę.
        return Array.isArray(data) ? result.rows : result.rows[0];
    }
}