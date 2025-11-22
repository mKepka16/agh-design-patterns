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



## Documentation

Detailed documentation is available in the `docs/` directory:

-   **[Introduction](docs/introduction.md)**: Overview of the library and its features.
-   **[Getting Started](docs/getting-started.md)**: Installation, configuration, and basic usage.
-   **[Defining Entities](docs/defining-entities.md)**: How to define entities and columns using decorators.
-   **[Relationships](docs/relationships.md)**: Guide to One-to-One, One-to-Many, Many-to-One, and Many-to-Many relationships.
-   **[Schema Synchronization](docs/synchronization.md)**: Understanding the schema synchronization process.
-   **[Design Patterns](docs/design-patterns.md)**: Explanation of the design patterns used in this project.
-   **[Inheritance Strategy](docs/inheritance-strategy.md)**: Explanation of the Table Per Concrete Class mapping strategy.
-   **[Roadmap](docs/roadmap.md)**: Planned features and future direction.

## `@agh-design-patterns/pgorm`

`@agh-design-patterns/pgorm` is a lightweight decorator-based ORM helper tailored for PostgreSQL.

For detailed usage instructions, please refer to the [Documentation](#documentation) section above.

**Local tooling**
- `docker-compose.yml` launches PostgreSQL 15 plus pgAdmin 4 (`docker compose up -d`).
- Copy `packages/app/.env.example` to `packages/app/.env` and adjust credentials before running the sample app.
