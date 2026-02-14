import 'reflect-metadata';
import { PgOrmFacade } from '@agh-design-patterns/pgorm';
import * as dotenv from 'dotenv';

// Import STI entities — decorators register them automatically
import { Vehicle } from './entities/Vehicle';
import { Car } from './entities/Car';
import { Motorcycle } from './entities/Motorcycle';

dotenv.config();

async function testSTI() {
    console.log('=== Single Table Inheritance Test ===\n');

    const db = PgOrmFacade.fromConfig({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        // 1. Synchronize schema
        console.log('--- Step 1: Synchronize schema ---');
        await db.synchronize();
        console.log('Schema synchronized.\n');

        // 2. Clear old test data
        console.log('--- Step 2: Clear old data ---');
        const vehicleRepo = db.entityManager.getRepository(Vehicle);
        await vehicleRepo.clear();
        console.log('Cleared vehicles table.\n');

        // 3. Insert Cars
        console.log('--- Step 3: Insert Cars ---');
        const carRepo = db.entityManager.getRepository(Car);

        const car1 = new Car();
        car1.brand = 'Toyota';
        car1.year = 2023;
        car1.numberOfDoors = 4;
        car1.hasAC = true;
        await carRepo.save(car1);
        console.log(`Inserted car: ${car1.brand} (${car1.year})`);

        const car2 = new Car();
        car2.brand = 'BMW';
        car2.year = 2024;
        car2.numberOfDoors = 2;
        car2.hasAC = true;
        await carRepo.save(car2);
        console.log(`Inserted car: ${car2.brand} (${car2.year})\n`);

        // 4. Insert Motorcycles
        console.log('--- Step 4: Insert Motorcycles ---');
        const motoRepo = db.entityManager.getRepository(Motorcycle);

        const moto1 = new Motorcycle();
        moto1.brand = 'Harley-Davidson';
        moto1.year = 2022;
        moto1.hasSidecar = true;
        await motoRepo.save(moto1);
        console.log(`Inserted motorcycle: ${moto1.brand} (${moto1.year})`);

        const moto2 = new Motorcycle();
        moto2.brand = 'Yamaha';
        moto2.year = 2025;
        moto2.hasSidecar = false;
        await motoRepo.save(moto2);
        console.log(`Inserted motorcycle: ${moto2.brand} (${moto2.year})\n`);

        // 5. Query only Cars (should filter by discriminator)
        console.log('--- Step 5: Query Cars only ---');
        const allCars = await carRepo.find();
        console.log(`Found ${allCars.length} cars:`);
        allCars.forEach((c) => {
            console.log(`  - ${c.brand} (${c.year}), doors: ${c.numberOfDoors}, AC: ${c.hasAC}`);
        });
        console.log();

        // 6. Query only Motorcycles (should filter by discriminator)
        console.log('--- Step 6: Query Motorcycles only ---');
        const allMotos = await motoRepo.find();
        console.log(`Found ${allMotos.length} motorcycles:`);
        allMotos.forEach((m) => {
            console.log(`  - ${m.brand} (${m.year}), sidecar: ${m.hasSidecar}`);
        });
        console.log();

        // 7. Query ALL Vehicles via root repository (should return everything)
        console.log('--- Step 7: Query ALL Vehicles (via root) ---');
        const allVehicles = await vehicleRepo.find();
        console.log(`Found ${allVehicles.length} vehicles total:`);
        allVehicles.forEach((v) => {
            console.log(`  - ${v.brand} (${v.year})`);
        });
        console.log();

        // 8. Verification summary
        console.log('=== RESULTS ===');
        const pass = allCars.length === 2 && allMotos.length === 2 && allVehicles.length === 4;
        console.log(`Cars: ${allCars.length} (expected 2) ${allCars.length === 2 ? '✅' : '❌'}`);
        console.log(`Motorcycles: ${allMotos.length} (expected 2) ${allMotos.length === 2 ? '✅' : '❌'}`);
        console.log(`All Vehicles: ${allVehicles.length} (expected 4) ${allVehicles.length === 4 ? '✅' : '❌'}`);
        console.log(`\nOverall: ${pass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

    } catch (error) {
        console.error('Error during STI test:', error);
    } finally {
        await db.close();
    }
}

testSTI();
