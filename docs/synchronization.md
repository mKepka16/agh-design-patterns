# Schema Synchronization

The `PgOrmFacade.synchronize()` method is responsible for aligning the database schema with your entity definitions.

## How it Works

1.  **Metadata Collection**: The ORM collects all metadata registered via decorators.
2.  **Schema Inspection**: It queries the current database schema (tables, columns, foreign keys).
3.  **Diffing**: It compares the entity metadata with the current schema.
4.  **Execution**:
    -   **Drop**: Tables that need to be rebuilt (due to changes) are dropped.
    -   **Create**: Tables are recreated with the new definitions.
    -   **Foreign Keys**: Foreign keys are added after table creation.

## Usage

```typescript
await orm.synchronize();
```

## Behavior

-   **Destructive**: Currently, the synchronization strategy is "drop-and-recreate" for changed tables. **Data in modified tables will be lost.**
-   **Unchanged Tables**: Tables that have not changed are preserved.
-   **Cascading**: `DROP TABLE ... CASCADE` is used, so dependent objects may also be dropped.
