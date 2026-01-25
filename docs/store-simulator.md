# Store Simulator Application Guide

The `packages/app` project is a comprehensive example application built using `@agh-design-patterns/pgorm`. It demonstrates how to build a real-world (console-based) application with complex relationships, inheritance, and game logic.

## Overview

The application is a "Tycoon" style game where the user:
1.  **Registers/Logins** (Authentication).
2.  **Works** (Clicks) to earn initial money.
3.  **Buys Items** to automate income (Passive Income).
4.  **Unlocks Achievements** based on progress.
5.  **Purchases Upgrades** to multiply income.
6.  **Customizes Profile** with persistent bio.

## Data Model Implementation

The app showcases all major ORM features:

### 1. Inheritance (`@MappedSuperclass`)
We defined a `BaseItem` class for common properties like `name`, `price`, and `description`. Both `Product` (consumable/income items) and `Upgrade` (permanent multipliers) inherit from this to avoid code duplication.

```typescript
// entities/BaseItem.ts
@MappedSuperclass()
export abstract class BaseItem {
    @Column({ columnType: 'TEXT' })
    name: string = '';
    // ...
}

// entities/Product.ts
@Entity()
export class Product extends BaseItem { ... }
```

### 2. Relationships

-   **One-to-One**: `User` <-> `Profile`.
    -   Each user has exactly one profile.
    -   Demonstrates explicit joining and lazy loading handling.
-   **One-to-Many**: `User` -> `UserProduct` / `UserUpgrade`.
    -   We use an explicit join entity (`UserProduct`) to track *quantity* of items owned.
    -   We use `UserUpgrade` to robustly track unlocked upgrades.
-   **Many-to-Many**: `User` <-> `Achievement`.
    -   Achievements are shared definitions linked to many users.

## Game Loop & Logic

The application uses a `Game` class which acts as a **Facade** for the entire game logic. It handles:
-   **State Management**: Holds the current `User` and income stats.
-   **Game Loop**: A `setInterval` loop handles passive income generation in the background.
-   **Command Loop**: Uses `readline` to accept user input for menus (Shop, Work, Profile).

### Key Mechanics

-   **Income Calculation**: 
    The `calculateIncome()` method aggregates:
    -   *Click Income*: Base 10 + (Sum of Inventory Item Click Values).
    -   *Passive Income*: Sum of Inventory Item Passive Values.
    -   *Multipliers*: Applies `UserUpgrades` (e.g., 2x) to the *total* income (Base + Items).

-   **Persistence**:
    Every major action (Work, Buy) triggers a save to the database via `EntityManager`.
    ```typescript
    await this.em.getRepository(User).save(this.user);
    ```

## Running the App

1.  Ensure PostgreSQL is running (e.g., via `docker compose up -d`).
2.  Build the project:
    ```bash
    npm run build
    ```
3.  Start the app:
    ```bash
    npm start
    ```
