# Roadmap

The following features are planned for future releases:

## Data Manipulation (CRUD)

We plan to implement a comprehensive API for inserting, updating, and deleting entities.

### Other Planned Features

-   **Support for Concrete Table Inheritance - parent traversal**: Automatically inherit columns and relations from parent entities.
-   **Migrations**: A proper migration system to handle schema changes without data loss.

### Planned API

> **Note**: `em` stands for **Entity Manager**, which will be the main entry point for CRUD operations.


```typescript
// Insert
const user = new User();
user.name = 'Alice';
await orm.em.persist(user);

// Find
const foundUser = await orm.em.findOne(User, { where: { id: 1 } });

// Update
foundUser.name = 'Alice Cooper';
await orm.em.persist(foundUser); // or orm.em.flush() depending on design

// Delete
await orm.em.remove(foundUser);
```

