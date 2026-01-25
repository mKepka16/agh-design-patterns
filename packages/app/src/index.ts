import 'reflect-metadata';
import { PgOrmFacade } from '@agh-design-patterns/pgorm';
import { Game } from './game';
import * as dotenv from 'dotenv';
import { User } from './entities/User';
import { Product } from './entities/Product';
import { Upgrade } from './entities/Upgrade';
import { Profile } from './entities/Profile';
import { Achievement } from './entities/Achievement';
import { UserProduct } from './entities/UserProduct';

dotenv.config();

async function main() {
  const db = PgOrmFacade.fromConfig({
      connectionString: process.env.DATABASE_URL,
      // entities: ... is NOT part of PoolConfig. 
      // Wait, PgOrmFacade.fromConfig() ONLY takes PoolConfig!
      // How do I pass entities to PgOrmFacade?
      // I checked PgOrmFacade code: "entities" don't seem to be passed to constructor in pgorm.
      // Wait, where are entities registered?
      // "import { entityMetadata } from './entity-store';"
      // Entities register themselves via decorators!
      // So I just need to import them, which I am doing.
      // So no need to pass entities array.
      // And simpler, I need to call synchronize() but "synchronize: true" option is not in PoolConfig.
  });

  try {
      await db.synchronize();
      console.log('Connected and synchronized database.');
      
      const game = new Game(db.entityManager);
      await game.start();
      
  } catch (error) {
      console.error('Error:', error);
  }
}

main();
