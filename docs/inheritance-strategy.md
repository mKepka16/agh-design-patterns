# Inheritance Mapping Strategy

Object-Relational Mapping (ORM) libraries typically support three main strategies for mapping inheritance hierarchies to database tables:

1.  **Single Table Inheritance**: All classes in the hierarchy are mapped to a single table. A discriminator column identifies the specific subclass for each row.
2.  **Class Table Inheritance** (or Joined Table): Each class in the hierarchy is mapped to its own table. Subclass tables contain only their specific columns and a foreign key to the parent table.
3.  **Concrete Table Inheritance**: Each concrete class in the hierarchy is mapped to its own independent table, containing all columns (including inherited ones).

## Our Approach: Concrete Table Inheritance (CTI) & Mapped Superclasses

In `@agh-design-patterns/pgorm`, we support **Concrete Table Inheritance** coupled with **Mapped Superclasses**.

### How it Works

1.  **Metadata Inheritance**: When an `@Entity` extends another class (either another `@Entity` or a `@MappedSuperclass`), it automatically inherits all columns and relations defined in the parent class.
2.  **Table Generation**:
    *   **Parent is `@Entity`**: The parent gets its own table. The child gets a *separate*, independent table that contains all of its own columns plus copies of all columns from the parent. There is no foreign key linking them; they are completely separate tables.
    *   **Parent is `@MappedSuperclass`**: The parent *does not* get a table. It is purely a template for properties. The child gets a table containing its own columns and all columns from the mapped superclass.

### `@MappedSuperclass` Decorator

Use the `@MappedSuperclass()` decorator for abstract base classes that should not share a table but should provide common properties to child entities.

```typescript
@MappedSuperclass()
class BaseEntity {
  @Column({ primary: true, autoIncrement: true })
  id!: number;

  @Column()
  createdAt!: string;
}

@Entity()
class User extends BaseEntity {
  @Column()
  username!: string;
}
// Result: 'user' table has 'id', 'created_at', and 'username'. No 'base_entity' table is created.
```

### `@Entity` Inheritance (Table Per Concrete Class)

If you extend an existing `@Entity`, both will have corresponding tables.

```typescript
@Entity('vehicles')
class Vehicle {
  @Column()
  speed!: number;
}

@Entity('cars')
class Car extends Vehicle {
  @Column()
  wheels!: number;
}
// Result:
// 'vehicles' table has 'speed'.
// 'cars' table has 'speed' AND 'wheels'.
```

### Comparison with Other Strategies

| Strategy | Description | Pros | Cons |
| :--- | :--- | :--- | :--- |
| **Concrete Table Inheritance** (Ours) | One table per concrete entity class. | Simple queries (no joins), robust decoupling. | No polymorphic relationships, schema duplication across tables. |
| **Single Table** | One table for the entire hierarchy. | Fast reads (no joins), simple schema. | Sparse tables (many NULLs), potential integrity issues. |
| **Class Table Inheritance** | Separate tables for parent and child, linked by FK. | Normalized data, clean schema. | Slow writes/reads due to JOINs. |
