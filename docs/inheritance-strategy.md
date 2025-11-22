# Inheritance Mapping Strategy

Object-Relational Mapping (ORM) libraries typically support three main strategies for mapping inheritance hierarchies to database tables:

1.  **Single Table Inheritance**: All classes in the hierarchy are mapped to a single table. A discriminator column identifies the specific subclass for each row.
2.  **Class Table Inheritance** (or Joined Table): Each class in the hierarchy is mapped to its own table. Subclass tables contain only their specific columns and a foreign key to the parent table.
3.  **Concrete Table Inheritance**: Each concrete class in the hierarchy is mapped to its own independent table, containing all columns (including inherited ones).

## Our Approach: Table Per Concrete Class

In `@agh-design-patterns/pgorm`, we have implemented a simplified version of the **Table Per Class** strategy (also known as **Concrete Table Inheritance**).

### How it Works

-   Each class decorated with `@Entity` maps directly to a single database table.
-   The table contains columns for all properties decorated with `@Column` in that specific class.
-   **Limitation**: Currently, the ORM does not automatically traverse the prototype chain to collect columns from parent classes. Each entity is treated as an independent definition. Support for this is planned (see Roadmap).

### Why this Strategy?

We chose this approach for its **simplicity and clarity**:

-   **Direct Mapping**: There is a 1:1 correspondence between an entity class and a database table, making the schema easy to understand and debug.
-   **Performance**: Queries for a specific entity type are simple `SELECT * FROM table` statements without needing complex `JOIN`s (as in Joined Table) or filtering by discriminator (as in Single Table).
-   **Decoupling**: Changes to one entity's schema do not affect the tables of other entities, even if they are conceptually related in the application code.

### Comparison with Other Strategies

| Strategy | Description | Pros | Cons |
| :--- | :--- | :--- | :--- |
| **Concrete Table Inheritance** (Ours) | One table per concrete entity class. | Simple queries, explicit schema. | No polymorphic relationships, potential data duplication if not careful. |
| **Single Table** | One table for the entire hierarchy. | Fast reads (no joins), simple schema. | Sparse tables (many NULLs), potential integrity issues. |
| **Class Table Inheritance** | Separate tables for parent and child, linked by FK. | Normalized data, clean schema. | Slow writes/reads due to JOINs, complex complexity. |
