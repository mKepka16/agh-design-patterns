# Getting Started

## Prerequisites

-   Node.js 22 or newer (LTS recommended)
-   npm 10+
-   PostgreSQL database

## Installation

This project is a monorepo. To install dependencies for all packages:

```bash
npm install
```

## Configuration

The ORM requires a PostgreSQL connection configuration. You can provide this configuration when initializing the `PgOrmFacade`.

```typescript
import { PgOrmFacade, type PostgresDriverConfig } from '@agh-design-patterns/pgorm';

const config: PostgresDriverConfig = {
  host: process.env.PGHOST ?? 'localhost',
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER ?? 'postgres',
  password: process.env.PGPASSWORD ?? '',
  database: process.env.PGDATABASE ?? 'postgres',
};

const orm = PgOrmFacade.fromConfig(config);
```

## Basic Usage

1.  **Define Entities**: Create classes decorated with `@Entity` and `@Column`.
2.  **Register Entities**: Import your entity files so the decorators are executed.
3.  **Synchronize**: Call `orm.synchronize()` to update the database schema.

```typescript
// src/entities/user.ts
import { Entity, Column } from '@agh-design-patterns/pgorm';

@Entity('users')
export class User {
  @Column({ type: 'INTEGER', primary: true, autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT' })
  username!: string;
}

// src/index.ts
import './entities/user'; // Important: Import to register metadata
import { PgOrmFacade } from '@agh-design-patterns/pgorm';

async function main() {
  const orm = PgOrmFacade.fromConfig({ /* ... config ... */ });
  
  await orm.synchronize(); // Creates the 'users' table
  
  await orm.close();
}

main();
```
