import { Entity } from './packages/pgorm/src/decorators/entity-decorator';
import { Column } from './packages/pgorm/src/decorators/column-decorator';
import { PgOrmFacade } from './packages/pgorm/src/facade';

@Entity()
class User {
    @Column({ columnType: 'INTEGER', primary: true, autoIncrement: true })
    id!: number;

    @Column({ columnType: 'TEXT' })
    name!: string;

    @Column({ columnType: 'INTEGER' })
    age!: number;
}

async function main() {
    const facade = PgOrmFacade.fromConfig({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
    });

    try {
        await facade.synchronize();
        console.log('Synchronized database');

        const userRepo = facade.entityManager.getRepository(User);

        // CREATE
        const user = userRepo.create({ name: 'Alice', age: 30 });
        const savedUser = await userRepo.save(user);
        console.log('Saved User:', savedUser);

        // READ
        const foundUser = await userRepo.findOne({ where: { id: savedUser.id } });
        console.log('Found User:', foundUser);

        // UPDATE
        foundUser!.age = 31;
        const updatedUser = await userRepo.save(foundUser!);
        console.log('Updated User:', updatedUser);
        
        // COUNT
        const count = await userRepo.count();
        console.log('Count:', count);

        // DELETE
        await userRepo.delete(updatedUser.id);
        console.log('Deleted User');
        
        const afterDelete = await userRepo.findOne({ where: { id: updatedUser.id } });
        console.log('Find after delete (should be null):', afterDelete);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await facade.close();
    }
}

main();
