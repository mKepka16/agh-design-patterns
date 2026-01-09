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
    password: process.env.PGPASSWORD ?? 'password',
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

    console.log('\n--- 2. DEMO ENTITY MANAGER ---');

    // Ważne: W Twoim pliku vehicle.ts pole 'id' NIE ma autoIncrement: true.
    // Dlatego musimy podać ID ręcznie.
    const carId = Math.floor(Math.random() * 10000);

    // A. INSERT
    console.log(`[INSERT] Dodaję samochód o ID: ${carId}...`);
    const newCar = await orm.entityManager.table('cars').insert({
      id: carId,
      model: 'Test Tesla Model S',
      price: 150000,
      is_available: true,
      discount: 10
    });
    console.log('✅ Dodano rekord:', newCar);

    // B. SELECT (FindAll)
    console.log('\n[SELECT] Szukam dodanego samochodu...');
    const foundCars = await orm.entityManager.table('cars').findAll({
      select: { model: true, price: true }, // Pobieramy tylko model i cenę
      where: { id: carId }
    });
    console.log('✅ Znaleziono:', foundCars);

    // C. DELETE
    console.log(`\n[DELETE] Usuwam samochód o ID: ${carId}...`);
    const deletedCount = await orm.entityManager.table('cars').deleteMany({
      where: { id: carId }
    });
    console.log(`✅ Usunięto rekordów: ${deletedCount}`);

    // Weryfikacja usunięcia
    const verify = await orm.entityManager.table('cars').findAll({ where: { id: carId } });
    if (verify.length === 0) {
      console.log('✅ Weryfikacja pomyślna: samochodu już nie ma w bazie.');
    } else {
      console.error('❌ Błąd: Samochód nadal istnieje!');
    }


  } finally {
    await orm.close();
  }
}

bootstrap().catch((error) => {
  console.error('Failed to synchronize schema:', error);
  process.exitCode = 1;
});
