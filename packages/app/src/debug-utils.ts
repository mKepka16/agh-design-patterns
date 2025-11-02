import {
  type PostgresDriverConfig,
  PostgresDriver,
} from '@agh-design-patterns/pgorm';

export async function logTableDefinitions(
  config: PostgresDriverConfig,
  tableNames: string[]
): Promise<void> {
  const driver = new PostgresDriver(config);

  try {
    const result = await driver.query<{
      table_name: string;
      column_name: string;
      data_type: string;
      is_nullable: 'YES' | 'NO';
    }>(
      `
        SELECT table_name, column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])
        ORDER BY table_name, ordinal_position;
      `,
      [tableNames]
    );

    console.log('column types in database:');
    for (const row of result.rows) {
      console.log(
        `- ${row.table_name}.${row.column_name}: ${row.data_type} (${row.is_nullable})`
      );
    }

    const foreignKeys = await driver.query<{
      table_name: string;
      column_name: string;
      foreign_table_name: string;
      foreign_column_name: string;
    }>(
      `
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = ANY($1::text[])
        ORDER BY tc.table_name, kcu.column_name;
      `,
      [tableNames]
    );

    if (foreignKeys.rows.length) {
      console.log('foreign keys:');
      for (const row of foreignKeys.rows) {
        console.log(
          `- ${row.table_name}.${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name}`
        );
      }
    }

    const uniqueConstraints = await driver.query<{
      table_name: string;
      column_name: string;
    }>(
      `
        SELECT
          tc.table_name,
          kcu.column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'UNIQUE'
          AND tc.table_schema = 'public'
          AND tc.table_name = ANY($1::text[])
        ORDER BY tc.table_name, kcu.column_name;
      `,
      [tableNames]
    );

    if (uniqueConstraints.rows.length) {
      console.log('unique constraints:');
      for (const row of uniqueConstraints.rows) {
        console.log(`- ${row.table_name}.${row.column_name}`);
      }
    }
  } finally {
    await driver.end();
  }
}
