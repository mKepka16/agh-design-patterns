import 'dotenv/config';
import 'reflect-metadata';
import {
  PgOrmFacade,
  type PostgresDriverConfig,
} from '@agh-design-patterns/pgorm';

import { Car } from './entities/car';
import { Driver } from './entities/driver';
import { Feature } from './entities/feature';
import { Customer } from './entities/customer';
import { Order } from './entities/order';

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
    console.log('✅ Database synchronized');

    const carRepo = orm.entityManager.getRepository(Car);
    const driverRepo = orm.entityManager.getRepository(Driver);
    const featureRepo = orm.entityManager.getRepository(Feature);
    const customerRepo = orm.entityManager.getRepository(Customer);
    const orderRepo = orm.entityManager.getRepository(Order);

    // --- 1. Basic CRUD with Car ---
    console.log('\n--- 1. CAR CRUD ---');
    const carId = Math.floor(Math.random() * 10000);
    const car = carRepo.create({
        id: carId,
        model: 'Tesla Model 3',
        price: 45000,
        isAvailable: true,
        discount: 0
    });
    await carRepo.save(car);
    console.log('Saved Car:', car);

    // --- 2. OneToMany / ManyToOne: Drivers ---
    console.log('\n--- 2. Drivers (ManyToOne) ---');
    const driver1 = driverRepo.create({
        id: Math.floor(Math.random() * 10000),
        fullName: 'John Doe',
        yearsOfExperience: 5,
        rating: 4.8,
        isActive: true,
        car: car
    });

    
    await driverRepo.save(driver1);
    console.log('Saved Driver 1:', driver1);

    const driver2 = driverRepo.create({
        id: Math.floor(Math.random() * 10000),
        fullName: 'Jane Smith',
        yearsOfExperience: 2,
        rating: 4.5,
        isActive: true,
        car: car,
    });
    await driverRepo.save(driver2);
    console.log('Saved Driver 2:', driver2);

    // --- 3. ManyToMany: Features ---
    console.log('\n--- 3. Features (ManyToMany) ---');
    const feature1 = featureRepo.create({ id: 1, name: 'Autopilot' }); // simple ID
    const feature2 = featureRepo.create({ id: 2, name: 'Heated Seats' });
    
    // Note: ManyToMany relations saving (updating join table) is not automatically handled by save() yet.
    // Use specialized methods or manual join table management if needed.
    // Here we just save the entities.
    try {
        await featureRepo.save(feature1);
        console.log('Saved Feature 1');
    } catch (e) { console.log('Feature 1 might exist'); }
    try {
         await featureRepo.save(feature2);
         console.log('Saved Feature 2');
    } catch (e) { console.log('Feature 2 might exist'); }

    // --- 4. OneToMany: Customer & Orders ---
    console.log('\n--- 4. Customer & Orders ---');
    const customer = customerRepo.create({ name: 'Alice Corp' });
    const savedCustomer = await customerRepo.save(customer); // ID auto-generated
    console.log('Saved Customer:', savedCustomer);

    const order1 = orderRepo.create({ description: 'Order #1', customer: savedCustomer });
    const savedOrder = await orderRepo.save(order1);
    console.log('Saved Order 1 (auto ID):', savedOrder);

    // --- 5. Find & Insert/Save Verification ---
    console.log('\n--- 5. Find & Save verification ---');
    
    // A. Find One
    const foundCar = await carRepo.findOne({ where: { id: carId } });
    console.log('findOne result:', foundCar);

    // B. Find with Options (Where, Select, Order, Take, Skip)
    // Create more cars for pagination
    await carRepo.save([
        carRepo.create({ id: 2001, model: 'Ford B', price: 20000, isAvailable: true }),
        carRepo.create({ id: 2002, model: 'Ford A', price: 25000, isAvailable: false }),
        carRepo.create({ id: 2003, model: 'Ford C', price: 15000, isAvailable: true })
    ]);
    
    const pagedCars = await carRepo.find({
        where: { isAvailable: true },
        order: { price: 'DESC' },
        take: 2,
        skip: 0,
        select: ['model', 'price']
    });
    console.log('find with options (available, desc price, take 2):', pagedCars);

    // C. Count
    const count = await carRepo.count();
    console.log('Total cars count:', count);
    
    const countAvailable = await carRepo.count({ where: { isAvailable: true } });
    console.log('Available cars count:', countAvailable);

    // --- 6. Update vs Save ---
    console.log('\n--- 6. Update vs Save ---');
    // Using Save for update
    savedCustomer.name = 'Alice Corp Updated via Save';
    await customerRepo.save(savedCustomer);
    console.log('Updated via save:', await customerRepo.findOne({ where: { id: savedCustomer.id } }));

    // Using Update method explicitly
    await customerRepo.update({ id: savedCustomer.id }, { name: 'Alice Corp Updated via Update' });
    console.log('Updated via update:', await customerRepo.findOne({ where: { id: savedCustomer.id } }));
    
    // Using Insert method explicitly (fail if exists usually, or new ID)
    const newOrder = orderRepo.create({ description: 'Inserted Order', customer: savedCustomer });
    // insert returns InsertResult, not entity
    const insertResult = await orderRepo.insert(newOrder); 
    console.log('Insert result identifiers:', insertResult.identifiers);

    // --- 7. Delete & Remove ---
    console.log('\n--- 7. Delete & Remove ---');
    
    // Delete by ID
    const deleteRes = await orderRepo.delete(savedOrder.id);
    console.log('Delete Order by ID result:', deleteRes);

    // Remove entity
    // Re-fetch customer to get full object for remove
    const schemaCustomer = await customerRepo.findOne({ where: { id: savedCustomer.id } });
    if (schemaCustomer) {
        // First delete all orders for this customer to avoid FK violation
        // We can find them first.
        const orders = await orderRepo.find({ where: { customer: schemaCustomer.id } });
        for (const o of orders) {
             await orderRepo.delete(o.id);
        }

        await customerRepo.remove(schemaCustomer);
        console.log('Removed Customer entity');
    }
    
    // --- 8. Clear ---
    console.log('\n--- 8. Clear ---');
    // Be careful clearing tables with FK constraints (orders/drivers depend on others).
    // carRepo.clear() might fail if drivers exist.
    // Let's clear drivers first.
    await driverRepo.clear();
    console.log('Cleared Drivers');
    
    // Verify clear
    const driversCount = await driverRepo.count();
    console.log('Drivers count after clear:', driversCount);


  } finally {
    await orm.close();
  }
}

bootstrap().catch((error) => {
  console.error('Failed:', error);
  process.exitCode = 1;
});
