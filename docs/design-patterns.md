# Design Patterns

This project implements several standard software design patterns to ensure modularity, readability, and extensibility. Below is a list of the key patterns used.

## 1. Facade Pattern

**Usage**: `PgOrmFacade`

The **Facade** pattern provides a simplified interface to a complex subsystem. In our ORM, `PgOrmFacade` serves as the main entry point for the user. It hides the complexities of:
-   Initializing the database driver.
-   Collecting metadata.
-   Comparing the current database schema with the entity definitions.
-   Executing the necessary DDL statements to synchronize the schema.

```typescript
// packages/pgorm/src/facade.ts
export class PgOrmFacade {
  // Hides the complexity of the driver and internal subsystems
  constructor(private readonly driver: PostgresDriver) {}

  // Simple method for the user that triggers complex logic internally
  async synchronize(): Promise<void> {
    // ... resolves relations, collects metadata, diffs schema, drops/creates tables ...
  }
}
```

## 2. Decorator Pattern

**Usage**: `@Entity`, `@Column`, `@OneToOne`, etc.

The **Decorator** pattern allows behavior or metadata to be added to individual objects, classes, or properties dynamically. We use TypeScript decorators to attach metadata (table names, column types, relationships) to class definitions without altering their actual code logic.

```typescript
// packages/pgorm/src/decorators/entity-decorator.ts
export function Entity(tableName?: string) {
  return function <T extends GenericConstructor>(constructor: T): void {
    // Adds metadata to the class
    const metadata = ensureEntityMetadata(constructor);
    metadata.tableName = tableName ?? constructor.name.toLowerCase();
    entityMetadata.set(constructor, metadata);
  };
}

// Usage
@Entity('users')
class User {
    @Column()
    name: string;
}
```

## 3. Singleton Pattern

**Usage**: `entityMetadata` Store

The **Singleton** pattern ensures a class has only one instance and provides a global point of access to it. While not implemented as a class with a `getInstance` method, the `entityMetadata` map in `entity-store.ts` acts as a module-level singleton. It ensures that all decorators across the application register their metadata in the same central registry.

```typescript
// packages/pgorm/src/entity-store.ts
// Exported instance acts as a Singleton registry
export const entityMetadata = new Map<GenericConstructor, EntityMetadata>();
```

## 4. Factory Method Pattern

**Usage**: `PgOrmFacade.fromConfig`

The **Factory Method** pattern provides an interface for creating objects. `PgOrmFacade.fromConfig` is a static factory method that encapsulates the logic of creating a `PgOrmFacade` instance along with its dependency (`PostgresDriver`), making client code cleaner.

```typescript
// packages/pgorm/src/facade.ts
static fromConfig(config: PostgresDriverConfig): PgOrmFacade {
  // Encapsulates creation logic
  return new PgOrmFacade(new PostgresDriver(config));
}
```

## 5. Adapter Pattern

**Usage**: `PostgresDriver`

The **Adapter** pattern allows incompatible interfaces to work together. `PostgresDriver` wraps the external `pg` (node-postgres) library. It adapts the `pg.Pool` interface to a simpler, domain-specific interface (`execute`, `query`, `end`) required by our ORM. This also decouples the ORM core from the specific database driver library.

```typescript
// packages/pgorm/src/postgres-driver.ts
export class PostgresDriver {
  private readonly pool: Pool;

  constructor(config: PostgresDriverConfig) {
    this.pool = new Pool(config); // Adapts 'pg' Pool
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    await this.pool.query(sql, params);
  }
}
```
