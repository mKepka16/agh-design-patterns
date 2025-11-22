# Relationships

`pgorm` supports standard database relationships. All relationship decorators require a factory function that returns the target entity class (to handle circular dependencies).

## One-to-One

Use `@OneToOne` to define a one-to-one relationship. One side must be the owner (containing the foreign key).

```typescript
@Entity()
class Profile {
  @Column({ primary: true, columnType: 'INTEGER' })
  id!: number;

  @OneToOne(() => User, { inverseProperty: 'profile' })
  user!: User;
}

@Entity()
class User {
  @Column({ primary: true, columnType: 'INTEGER' })
  id!: number;

  @OneToOne(() => Profile, {
    joinColumn: { name: 'profile_id', referencedColumn: 'id', type: 'INTEGER' },
    inverseProperty: 'user'
  })
  profile!: Profile;
}
```

## One-to-Many / Many-to-One

Use `@OneToMany` and `@ManyToOne` together. The `@ManyToOne` side is always the owner (holds the foreign key).

```typescript
@Entity()
class Author {
  @Column({ primary: true, columnType: 'INTEGER' })
  id!: number;

  @OneToMany(() => Book, {
    joinColumn: { name: 'author_id', referencedColumn: 'id', type: 'INTEGER' },
    inverseProperty: 'author'
  })
  books!: Book[];
}

@Entity()
class Book {
  @Column({ primary: true, columnType: 'INTEGER' })
  id!: number;

  @ManyToOne(() => Author, {
    joinColumn: { name: 'author_id', referencedColumn: 'id', type: 'INTEGER' },
    inverseProperty: 'books'
  })
  author!: Author;
}
```

## Many-to-Many

Use `@ManyToMany`. One side must define the `joinTable` configuration. The ORM will automatically create the junction table.

```typescript
@Entity()
class Student {
  @Column({ primary: true, columnType: 'INTEGER' })
  id!: number;

  @ManyToMany(() => Course, {
    joinTable: {
      name: 'student_courses',
      joinColumn: { name: 'student_id', referencedColumn: 'id', type: 'INTEGER' },
      inverseJoinColumn: { name: 'course_id', referencedColumn: 'id', type: 'INTEGER' }
    },
    inverseProperty: 'students'
  })
  courses!: Course[];
}

@Entity()
class Course {
  @Column({ primary: true, columnType: 'INTEGER' })
  id!: number;

  @ManyToMany(() => Student, { inverseProperty: 'courses' })
  students!: Student[];
}
```

## Important Notes

-   **Join Columns**: You must explicitly define join columns (name, referenced column, type). The ORM does not currently infer these.
-   **Referenced Columns**: The referenced column in a relationship must be a Primary Key or Unique column.
