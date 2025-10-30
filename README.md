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
