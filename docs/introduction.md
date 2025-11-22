# Introduction

`@agh-design-patterns/pgorm` is a lightweight, decorator-based Object-Relational Mapping (ORM) library tailored for PostgreSQL. It is designed to simplify database interactions by allowing developers to define their database schema using TypeScript classes and decorators.

## Key Features

-   **Decorator-Based Definition**: Define entities, columns, and relationships using TypeScript decorators (`@Entity`, `@Column`, `@OneToOne`, etc.).
-   **Automatic Schema Synchronization**: The `PgOrmFacade` can automatically drop and recreate database tables based on your entity definitions, ensuring your database schema matches your code.
-   **Relationship Management**: Supports One-to-One, One-to-Many, Many-to-One, and Many-to-Many relationships.
-   **Type Safety**: Leverages TypeScript's type system and `reflect-metadata` to infer column types where possible.

## Current Status

The project is currently in an early development stage. The primary focus has been on:
-   Metadata collection via decorators.
-   Database connection management.
-   Schema synchronization (DDL generation).

Future updates will include data manipulation capabilities (CRUD operations).
