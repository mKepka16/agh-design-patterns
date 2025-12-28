import 'dotenv/config';
import 'reflect-metadata';
import {
  entityMetadata,
  PgOrmFacade,
  type PostgresDriverConfig,
} from '@agh-design-patterns/pgorm';

import './entities/car';
import './entities/driver';
import './entities/feature';
import './entities/customer';
import './entities/order';
import { logTableDefinitions } from './debug-utils';

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
    await logTableDefinitions(config, [
      'cars',
      'drivers',
      'features',
      'car_features',
      'orders',
      'customers',
    ]);
    const snapshot = Array.from(entityMetadata.entries()).map(
      ([ctor, meta]) => ({
        name: ctor.name,
        table: meta.tableName,
        columns: meta.columns,
        relations: meta.relations,
      })
    );
    console.dir(snapshot, { depth: null });
  } finally {
    await orm.close();
  }
}

bootstrap().catch((error) => {
  console.error('Failed to synchronize schema:', error);
  process.exitCode = 1;
});
