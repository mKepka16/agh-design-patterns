# Defining Entities

Entities are classes that map to database tables. You define them using the `@Entity` decorator.

## The `@Entity` Decorator

The `@Entity` decorator marks a class as an entity. You can optionally specify the table name. If omitted, the table name defaults to the class name in lowercase.

```typescript
import { Entity } from '@agh-design-patterns/pgorm';

@Entity('my_table_name')
export class MyEntity {
  // ...
}
```

## The `@Column` Decorator

The `@Column` decorator marks a property as a database column.

### Options

The `@Column` decorator accepts an options object:

-   `columnName` (string): The name of the column in the database. Defaults to the property name.
-   `columnType` (string): The database type. Supported types:
    -   `INTEGER`
    -   `DOUBLE PRECISION`
    -   `BOOLEAN`
    -   `TEXT`
-   `primary` (boolean): Marks the column as a primary key.
-   `nullable` (boolean): Allows the column to be `NULL`. Defaults to `false`.
-   `unique` (boolean): Adds a unique constraint.
-   `autoIncrement` (boolean): For `INTEGER` primary keys, makes them `SERIAL`.

### Type Inference

The ORM attempts to infer the database type from the TypeScript type metadata:

-   `number` -> `DOUBLE PRECISION` (default) or `INTEGER`
-   `boolean` -> `BOOLEAN`
-   `string` -> `TEXT`

**Note**: For union types (e.g., `number | null`), TypeScript emits `Object` as the type. In these cases, you **must** explicitly specify `columnType`.

### Examples

```typescript
@Entity('products')
class Product {
  @Column({ columnName: 'product_id', columnType: 'INTEGER', primary: true, autoIncrement: true })
  id!: number;

  @Column() // Infers TEXT
  name!: string;

  @Column({ nullable: true, columnType: 'DOUBLE PRECISION' })
  price!: number | null;
  
  @Column({ unique: true })
  sku!: string;
}
```
