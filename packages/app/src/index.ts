import { Column, Entity, PgOrmFacade } from '@agh-design-patterns/pgorm';
import 'dotenv/config';
import 'reflect-metadata';
require('dotenv').config();

@Entity()
class Car {
  @Column({ columnName: 'car_id', columnType: 'DOUBLE PRECISION' })
  id!: number;

  @Column({ columnName: 'car_name', columnType: 'TEXT' })
  name!: string;
}

async function bootstrap(): Promise<void> {
  const orm = PgOrmFacade.fromConfig({
    host: process.env.PGHOST ?? 'localhost',
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER ?? 'postgres',
    password: process.env.PGPASSWORD ?? '',
    database: process.env.PGDATABASE ?? 'postgres',
  });

  try {
    await orm.synchronize();
  } finally {
    await orm.close();
  }
}

bootstrap().catch((error) => {
  console.error('Failed to synchronize schema:', error);
  process.exitCode = 1;
});
