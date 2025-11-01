import {
  Column,
  Entity,
  PgOrmFacade,
  PostgresDriver,
  type PostgresDriverConfig,
} from '@agh-design-patterns/pgorm';
import 'dotenv/config';
import 'reflect-metadata';

@Entity('cars')
class Car {
  @Column({ columnName: 'car_id', columnType: 'INTEGER' })
  id!: number;

  @Column({ columnName: 'model_name' })
  model!: string;

  @Column({ columnName: 'list_price', columnType: 'DOUBLE PRECISION' })
  price!: number;

  @Column({ columnName: 'is_available' })
  available!: boolean;

  @Column({
    columnName: 'optional_discount',
    columnType: 'DOUBLE PRECISION',
    nullable: true,
  })
  discount!: number | null;
}

@Entity('drivers')
class Driver {
  @Column({ columnName: 'driver_id', columnType: 'INTEGER' })
  id!: number;

  @Column({ columnName: 'full_name' })
  fullName!: string;

  @Column({ columnName: 'experience_years', columnType: 'INTEGER' })
  yearsOfExperience!: number;

  @Column({ columnName: 'driver_rating', columnType: 'DOUBLE PRECISION' })
  rating!: number;

  @Column({ columnName: 'is_active' })
  active!: boolean;

  @Column({
    columnName: 'last_ride_rating',
    columnType: 'DOUBLE PRECISION',
    nullable: true,
  })
  lastRideRating!: number | null;
}

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
      [['cars', 'drivers']]
    );

    console.log('column types in database:');
    for (const row of result.rows) {
      console.log(
        `- ${row.table_name}.${row.column_name}: ${row.data_type} (${row.is_nullable})`
      );
    }
  } finally {
    await driver.end();
  }
}
