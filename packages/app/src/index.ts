import 'dotenv/config';
import 'reflect-metadata';
import {
  PgOrmFacade,
  PostgresDriver,
  type PostgresDriverConfig,
} from '@agh-design-patterns/pgorm';

import './entities/car';
import './entities/driver';
import './entities/feature';

async function bootstrap(): Promise<void> {
  const config: PostgresDriverConfig = {
    host: process.env.PGHOST ?? 'localhost',
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER ?? 'postgres',
    password: process.env.PGPASSWORD ?? '',
    database: process.env.PGDATABASE ?? 'postgres',
  };

  const orm = PgOrmFacade.fromConfig(config);

  try {
    await orm.synchronize();
    await logTableDefinitions(config);
  } finally {
    await orm.close();
  }
}

bootstrap().catch((error) => {
  console.error('Failed to synchronize schema:', error);
  process.exitCode = 1;
});

async function logTableDefinitions(
  config: PostgresDriverConfig
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
      [['cars', 'drivers', 'car_features', 'features']]
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
      [['cars', 'drivers', 'car_features', 'features']]
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
      [['cars', 'drivers', 'car_features', 'features']]
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
