# agh-design-patterns

TypeScript monorepo for AGH design-pattern. It contains:
- `@agh-design-patterns/pgorm`: reusable library code published as an internal package.
- `@agh-design-patterns/app`: console application that consumes the library.

## Prerequisites
- Node.js 22 or newer (LTS recommended)
- npm 10+ (bundled with recent Node.js releases)

## Installation
```bash
npm install
```
The repository uses npm workspaces, so a single install from the root bootstraps every package under `packages/`.

## Build
```bash
npm run build
```
This runs `tsc --build` with project references, emitting compiled JavaScript and declarations into each package's `dist/` folder.

## Run the Application
```bash
npm start
```
`npm start` runs the built artifact from `@agh-design-patterns/app`. Make sure you build first so that `packages/app/dist/index.js` exists.

## Project Layout
```
packages/
  app/
    src/            Source for the runnable example app
    dist/           Build output (generated)
  pgorm/
    src/            Library source files
    dist/           Build output (generated)
tsconfig.json       Entry point for the TypeScript project references
tsconfig.base.json  Shared compiler options
```


## `@agh-design-patterns/pgorm`

### Overview
`@agh-design-patterns/pgorm` is a lightweight decorator-based ORM helper tailored for PostgreSQL. It provides:

- `@Entity()` / `@Column()` decorators that populate a shared metadata map via `reflect-metadata`.
- An exported `entityMetadata` map you can inspect or extend.
- `PgOrmFacade` that connects to PostgreSQL, drops existing tables, and recreates them from metadata (delete-create synchronisation).
- A minimal `PostgresDriver` wrapper around `pg.Pool` for executing SQL and closing the pool cleanly.

### Supported column types
- `DOUBLE PRECISION`
- `INTEGER`
- `BOOLEAN`
- `TEXT`

Columns are non-nullable by default. Provide `nullable: true` in `@Column()` options to allow `NULL`.

Because `design:type` metadata can only expose a single constructor, union-typed properties such as `number | null` appear as `Object`. When you decorate a union or nullable property, specify `columnType` explicitly so pgorm knows which database type to use.

### Column options
```ts
type ColumnOptions = {
  columnName?: string;              // defaults to the property name
  columnType?: ColumnDbEngineType;  // inferred when possible, required for unions
  primary?: boolean;                // marks the column as PRIMARY KEY
  nullable?: boolean;               // defaults to false
  unique?: boolean;                 // convenience helper for UNIQUE constraints
  autoIncrement?: boolean;          // INTEGER primary key -> SERIAL in Postgres
};
```

Example:
```ts
@Entity('drivers')
class Driver {
  @Column({ columnName: 'driver_id', columnType: 'INTEGER', primary: true })
  id!: number;

  @Column({ columnName: 'rating', columnType: 'DOUBLE PRECISION', nullable: true })
  rating!: number | null;
}

@Entity('customers')
class Customer {
  @Column({ columnName: 'customer_id', columnType: 'INTEGER', primary: true, autoIncrement: true })
  id!: number; // becomes SERIAL under the hood

  @Column({ columnName: 'customer_name', columnType: 'TEXT' })
  name!: string;
}

// autoIncrement only works for INTEGER primary keys and forces NOT NULL + UNIQUE.
```

> ℹ️ `autoIncrement: true` is limited to integer primary keys. pgorm maps it to Postgres `SERIAL`, so the database creates the sequence and enforces `NOT NULL` automatically.

### Relations
- `@OneToOne(() => TargetEntity, { joinColumn: { name, referencedColumn, type, nullable? }, inverseProperty? })` creates a foreign key on the decorated entity and enforces uniqueness for 1:1 mappings.
- `@ManyToOne(() => TargetEntity, { joinColumn: { name, referencedColumn, type, nullable? }, inverseProperty? })` places the foreign key on the decorated entity and automatically links the inverse one-to-many side.
- `@OneToMany(() => TargetEntity, { joinColumn: { name, referencedColumn, type, nullable? }, inverseProperty? })` attaches a foreign key column to the target entity so multiple rows can reference the source.
- `@ManyToMany(() => TargetEntity, { joinTable: { name, joinColumn, inverseJoinColumn }, inverseProperty })` builds a join table that references both entities. Only the owning side provides `joinTable`; the inverse side references the owning property via `inverseProperty`.

Join columns are required because pgorm does not infer foreign-key column names or types. The referenced column must already exist on the target entity (typically defined with `@Column`).

Example:
```ts
@Entity('features')
class Feature {
  @Column({ columnName: 'feature_id', columnType: 'INTEGER', primary: true })
  id!: number;

  @ManyToMany(() => Car, { inverseProperty: 'features' })
  cars!: Car[];
}

@Entity('cars')
class Car {
  @OneToMany(() => Driver, {
    joinColumn: { name: 'car_id', referencedColumn: 'car_id', type: 'INTEGER' },
    inverseProperty: 'car',
  })
  drivers!: Driver[];

  @ManyToMany(() => Feature, {
    joinTable: {
      name: 'car_features',
      joinColumn: { name: 'car_id', referencedColumn: 'car_id', type: 'INTEGER' },
      inverseJoinColumn: {
        name: 'feature_id',
        referencedColumn: 'feature_id',
        type: 'INTEGER',
      },
    },
    inverseProperty: 'cars',
  })
  features!: Feature[];
}

@Entity('drivers')
class Driver {
  @Column({ columnName: 'driver_id', columnType: 'INTEGER', primary: true })
  id!: number;

  @ManyToOne(() => Car, {
    joinColumn: { name: 'car_id', referencedColumn: 'car_id', type: 'INTEGER' },
    inverseProperty: 'drivers',
  })
  car!: Car;

  @ManyToMany(() => Feature, {
    joinTable: {
      name: 'car_features',
      joinColumn: { name: 'car_id', referencedColumn: 'car_id', type: 'INTEGER' },
      inverseJoinColumn: {
        name: 'feature_id',
        referencedColumn: 'feature_id',
        type: 'INTEGER',
      },
    },
    inverseProperty: 'cars',
  })
  features!: Feature[];
}
```

Example:
```ts
@Entity('cars')
class Car {
  @Column({ columnName: 'car_id', columnType: 'INTEGER', primary: true })
  id!: number;

  @OneToMany(() => Driver, {
    joinColumn: {
      name: 'car_id',
      referencedColumn: 'car_id',
      type: 'INTEGER',
    },
  })
  drivers!: Driver[];

  @OneToOne(() => Driver, {
    joinColumn: {
      name: 'primary_driver_id',
      referencedColumn: 'driver_id',
      type: 'INTEGER',
      nullable: true,
    },
  })
  primaryDriver!: Driver | null;
}
```

Foreign keys require the referenced column to be `PRIMARY KEY` or `UNIQUE`. Mark the relevant `@Column` with `primary: true` (or `unique: true`) before adding relationships.

### Synchronising schema
```ts
import { PgOrmFacade, type PostgresDriverConfig } from '@agh-design-patterns/pgorm';

const config: PostgresDriverConfig = {
  host: process.env.PGHOST ?? 'localhost',
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER ?? 'postgres',
  password: process.env.PGPASSWORD ?? '',
  database: process.env.PGDATABASE ?? 'postgres',
};

const orm = PgOrmFacade.fromConfig(config);
await orm.synchronize();   // drops & recreates tables discovered via decorators
await orm.close();
```

**Workflow tips**
- Import entity classes during application bootstrap so decorators can register metadata before `synchronize()` runs.
- Inspect the exported `entityMetadata` map or query `information_schema` (see the sample app) to verify generated columns and nullability.
- Nullable fields require both `columnType` and `nullable: true` when their TypeScript type is a union.

**Local tooling**
- `docker-compose.yml` launches PostgreSQL 15 plus pgAdmin 4 (`docker compose up -d`).
- Copy `packages/app/.env.example` to `packages/app/.env` and adjust credentials before running the sample app.
