import 'reflect-metadata';

const columnDbEngineTypes = [
  'DOUBLE PRECISION',
  'INTEGER',
  'BOOLEAN',
  'TEXT',
] as const;
export type ColumnDbEngineType = (typeof columnDbEngineTypes)[number];

const pendingRelationInitializers: Array<() => void> = [];

export type ColumnMetadata = {
  name: string;
  type: ColumnDbEngineType;
  nullable: boolean;
  primary?: boolean;
  unique?: boolean;
};

export type EntityMetadata = {
  tableName: string;
  columns: ColumnMetadata[];
  relations: RelationMetadata[];
  ctor: GenericConstructor;
};

type RelationKind =
  | 'one-to-one'
  | 'one-to-many'
  | 'many-to-one'
  | 'many-to-many';

type RelationJoinColumn = {
  name: string;
  referencedColumn: string;
  type: ColumnDbEngineType;
  nullable: boolean;
  unique?: boolean;
};

type RelationJoinTable = {
  name: string;
  joinColumn: RelationJoinColumn;
  inverseJoinColumn: RelationJoinColumn;
};

type GenericConstructor = { new (...args: unknown[]): object };

export type RelationMetadata = {
  kind: RelationKind;
  propertyName: string | symbol;
  target: GenericConstructor;
  owner: boolean;
  joinColumn?: RelationJoinColumn;
  joinTable?: RelationJoinTable;
  inverseProperty?: string | symbol;
};

const typescriptColumnTypes = ['number', 'boolean', 'string'] as const;
type TypescriptColumnType = (typeof typescriptColumnTypes)[number];

const typescriptToDbEngineColumnType: Record<
  TypescriptColumnType,
  Set<ColumnDbEngineType>
> = {
  number: new Set(['DOUBLE PRECISION', 'INTEGER']),
  boolean: new Set(['BOOLEAN']),
  string: new Set(['TEXT']),
};

const typescriptToDefaultDbEngineColumnType: Record<
  TypescriptColumnType,
  ColumnDbEngineType
> = {
  number: 'DOUBLE PRECISION',
  boolean: 'BOOLEAN',
  string: 'TEXT',
};

// Store metadata about all entities
export const entityMetadata = new Map<GenericConstructor, EntityMetadata>();

function ensureEntityMetadata(
  constructor: GenericConstructor
): EntityMetadata {
  let metadata = entityMetadata.get(constructor);
  if (!metadata) {
    metadata = {
      tableName: constructor.name.toLowerCase(),
      columns: [],
      relations: [],
      ctor: constructor,
    };
    entityMetadata.set(constructor, metadata);
  }
  metadata.ctor = constructor;
  if (!metadata.columns) {
    metadata.columns = [];
  }
  if (!metadata.relations) {
    metadata.relations = [];
  }
  return metadata;
}

function upsertColumn(
  metadata: EntityMetadata,
  column: ColumnMetadata
): void {
  const existing = metadata.columns.find((c) => c.name === column.name);
  if (existing) {
    existing.type = column.type;
    existing.nullable = column.nullable;
    if (column.primary !== undefined) {
      existing.primary = column.primary;
    }
    if (column.unique !== undefined) {
      existing.unique = column.unique;
    }
    if (existing.primary) {
      existing.unique = true;
    }
  } else {
    const record = { ...column };
    if (record.primary) {
      record.unique = true;
    }
    metadata.columns.push(record);
  }
}

function addOrUpdateRelation(
  metadata: EntityMetadata,
  relation: RelationMetadata
): void {
  const index = metadata.relations.findIndex(
    (existing) =>
      existing.kind === relation.kind &&
      existing.owner === relation.owner &&
      existing.propertyName === relation.propertyName
  );
  if (index >= 0) {
    metadata.relations[index] = relation;
  } else {
    metadata.relations.push(relation);
  }
}

function scheduleRelationInitialization(initializer: () => void): void {
  pendingRelationInitializers.push(initializer);
}

export function resolvePendingRelations(): void {
  if (pendingRelationInitializers.length === 0) {
    return;
  }

  const maxIterations = pendingRelationInitializers.length * 5 + 10;
  let iterations = 0;

  while (pendingRelationInitializers.length > 0) {
    if (iterations > maxIterations) {
      throw new Error(
        'pgorm: Unable to resolve relation metadata. Ensure related entities are defined before synchronization.'
      );
    }

    iterations += 1;
    const initializer = pendingRelationInitializers.shift()!;
    try {
      initializer();
    } catch (error) {
      if (error instanceof ReferenceError) {
        pendingRelationInitializers.push(initializer);
      } else {
        throw error;
      }
    }
  }
}

/**
 * Marks a class as an entity (database table)
 */
export function Entity(tableName?: string) {
  return function <T extends GenericConstructor>(constructor: T): void {
    const metadata = ensureEntityMetadata(constructor);
    metadata.tableName = tableName ?? constructor.name.toLowerCase();
    entityMetadata.set(constructor, metadata);
  };
}

type ColumnOptions = {
  columnName?: string;
  columnType?: ColumnDbEngineType;
  nullable?: boolean;
  primary?: boolean;
  unique?: boolean;
};

type ManyToManyJoinColumnOptions = {
  name: string;
  referencedColumn: string;
  type: ColumnDbEngineType;
  nullable?: boolean;
  unique?: boolean;
};

type ManyToManyOptions = {
  joinTable?: {
    name: string;
    joinColumn: ManyToManyJoinColumnOptions;
    inverseJoinColumn: ManyToManyJoinColumnOptions;
  };
  inverseProperty?: string | symbol;
};

/**
 * Marks a field as a column (database column)
 */
export function Column(options?: ColumnOptions) {
  return function (target: object, propertyKey: string | symbol): void {
    const constructor = target.constructor as GenericConstructor;

    const entity = ensureEntityMetadata(constructor);

    const designType = Reflect.getMetadata('design:type', target, propertyKey);
    const typescriptColumnType =
      typeof designType?.name === 'string'
        ? designType.name.toLowerCase()
        : undefined;
    const columnType = getColumnDbEngineType(
      typescriptColumnType,
      options?.columnType
    );
    if (!columnType) {
      if (typescriptColumnType === 'object' && !options?.columnType) {
        console.warn(
          `Property ${String(propertyKey)} on ${
            constructor.name
          } uses a union type. Specify columnType explicitly when using nullable fields.`
        );
      } else {
        console.warn(
          `Unsupported column type for property ${String(propertyKey)} on ${
            constructor.name
          }`
        );
      }
      return;
    }
    const columnName = options?.columnName ?? String(propertyKey);
    const primary = options?.primary ?? false;
    const nullable = primary ? false : options?.nullable ?? false;
    const unique = options?.unique ?? primary;
    upsertColumn(entity, {
      name: columnName,
      type: columnType,
      nullable,
      primary,
      unique,
    });
    entityMetadata.set(constructor, entity);
  };
}

type OneToOneOptions = {
  joinColumn: {
    name: string;
    referencedColumn: string;
    type: ColumnDbEngineType;
    nullable?: boolean;
  };
  inverseProperty?: string | symbol;
};

export function OneToOne(
  targetFactory: () => GenericConstructor,
  options: OneToOneOptions
) {
  return function (target: object, propertyKey: string | symbol): void {
    const sourceConstructor = target.constructor as GenericConstructor;

    scheduleRelationInitialization(() => {
      const targetConstructor = targetFactory();

      const sourceMetadata = ensureEntityMetadata(sourceConstructor);
      const targetMetadata = ensureEntityMetadata(targetConstructor);

      const nullable = options.joinColumn.nullable ?? false;

      upsertColumn(sourceMetadata, {
        name: options.joinColumn.name,
        type: options.joinColumn.type,
        nullable,
        unique: true,
      });

      if (
        !targetMetadata.columns.some(
          (column) => column.name === options.joinColumn.referencedColumn
        )
      ) {
        console.warn(
          `OneToOne relation ${sourceConstructor.name}.${String(
            propertyKey
          )} references missing column ${options.joinColumn.referencedColumn} on ${targetConstructor.name}.`
        );
      }

      addOrUpdateRelation(sourceMetadata, {
        kind: 'one-to-one',
        propertyName: propertyKey,
        target: targetConstructor,
        owner: true,
        joinColumn: {
          name: options.joinColumn.name,
          referencedColumn: options.joinColumn.referencedColumn,
          type: options.joinColumn.type,
          nullable,
          unique: true,
        },
        inverseProperty: options.inverseProperty,
      });

      addOrUpdateRelation(targetMetadata, {
        kind: 'one-to-one',
        propertyName: options.inverseProperty ?? propertyKey,
        target: sourceConstructor,
        owner: false,
        inverseProperty: propertyKey,
      });

      entityMetadata.set(sourceConstructor, sourceMetadata);
      entityMetadata.set(targetConstructor, targetMetadata);
    });
  };
}

type OneToManyOptions = {
  joinColumn: {
    name: string;
    referencedColumn: string;
    type: ColumnDbEngineType;
    nullable?: boolean;
  };
  inverseProperty?: string | symbol;
};

export function OneToMany(
  targetFactory: () => GenericConstructor,
  options: OneToManyOptions
) {
  return function (target: object, propertyKey: string | symbol): void {
    const sourceConstructor = target.constructor as GenericConstructor;

    scheduleRelationInitialization(() => {
      const targetConstructor = targetFactory();

      const sourceMetadata = ensureEntityMetadata(sourceConstructor);
      const targetMetadata = ensureEntityMetadata(targetConstructor);

      if (
        !sourceMetadata.columns.some(
          (column) => column.name === options.joinColumn.referencedColumn
        )
      ) {
        console.warn(
          `OneToMany relation ${sourceConstructor.name}.${String(
            propertyKey
          )} references missing column ${options.joinColumn.referencedColumn}. Ensure the column is defined before synchronizing.`
        );
      }

      addOrUpdateRelation(sourceMetadata, {
        kind: 'one-to-many',
        propertyName: propertyKey,
        target: targetConstructor,
        owner: false,
        inverseProperty: options.inverseProperty,
      });

      const nullable = options.joinColumn.nullable ?? false;

      upsertColumn(targetMetadata, {
        name: options.joinColumn.name,
        type: options.joinColumn.type,
        nullable,
      });

      addOrUpdateRelation(targetMetadata, {
        kind: 'many-to-one',
        propertyName: options.inverseProperty ?? propertyKey,
        target: sourceConstructor,
        owner: true,
        joinColumn: {
          name: options.joinColumn.name,
          referencedColumn: options.joinColumn.referencedColumn,
          type: options.joinColumn.type,
          nullable,
        },
        inverseProperty: propertyKey,
      });

      entityMetadata.set(sourceConstructor, sourceMetadata);
      entityMetadata.set(targetConstructor, targetMetadata);
    });
  };
}

export function ManyToOne(
  targetFactory: () => GenericConstructor,
  options: Omit<OneToManyOptions, 'inverseProperty'> & {
    inverseProperty?: string | symbol;
  }
) {
  return function (target: object, propertyKey: string | symbol): void {
    const sourceConstructor = target.constructor as GenericConstructor;

    upsertColumn(ensureEntityMetadata(sourceConstructor), {
      name: options.joinColumn.name,
      type: options.joinColumn.type,
      nullable: options.joinColumn.nullable ?? false,
    });

    scheduleRelationInitialization(() => {
      const targetConstructor = targetFactory();

      const sourceMetadata = ensureEntityMetadata(sourceConstructor);
      const targetMetadata = ensureEntityMetadata(targetConstructor);

      const nullable = options.joinColumn.nullable ?? false;

      addOrUpdateRelation(sourceMetadata, {
        kind: 'many-to-one',
        propertyName: propertyKey,
        target: targetConstructor,
        owner: true,
        joinColumn: {
          name: options.joinColumn.name,
          referencedColumn: options.joinColumn.referencedColumn,
          type: options.joinColumn.type,
          nullable,
        },
        inverseProperty: options.inverseProperty,
      });

      addOrUpdateRelation(targetMetadata, {
        kind: 'one-to-many',
        propertyName: options.inverseProperty ?? propertyKey,
        target: sourceConstructor,
        owner: false,
        inverseProperty: propertyKey,
      });

      entityMetadata.set(sourceConstructor, sourceMetadata);
      entityMetadata.set(targetConstructor, targetMetadata);
    });
  };
}

export function ManyToMany(
  targetFactory: () => GenericConstructor,
  options?: ManyToManyOptions
) {
  return function (target: object, propertyKey: string | symbol): void {
    const sourceConstructor = target.constructor as GenericConstructor;
    const inverseProperty = options?.inverseProperty;

    scheduleRelationInitialization(() => {
      const targetConstructor = targetFactory();

      const sourceMetadata = ensureEntityMetadata(sourceConstructor);
      const targetMetadata = ensureEntityMetadata(targetConstructor);

      const isOwner = Boolean(options?.joinTable);

      if (isOwner) {
        const joinTable = options!.joinTable!;

        const normalizedJoinColumn = normalizeRelationJoinColumn(
          joinTable.joinColumn
        );
        const normalizedInverseJoinColumn = normalizeRelationJoinColumn(
          joinTable.inverseJoinColumn
        );

        validateReferencedColumn(
          sourceMetadata,
          normalizedJoinColumn,
          `${sourceConstructor.name}.${String(propertyKey)}`
        );
        validateReferencedColumn(
          targetMetadata,
          normalizedInverseJoinColumn,
          `${sourceConstructor.name}.${String(propertyKey)}`
        );

        addOrUpdateRelation(sourceMetadata, {
          kind: 'many-to-many',
          propertyName: propertyKey,
          target: targetConstructor,
          owner: true,
          joinTable: {
            name: joinTable.name,
            joinColumn: normalizedJoinColumn,
            inverseJoinColumn: normalizedInverseJoinColumn,
          },
          inverseProperty,
        });

        const inversePropertyName = inverseProperty ?? propertyKey;
        addOrUpdateRelation(targetMetadata, {
          kind: 'many-to-many',
          propertyName: inversePropertyName,
          target: sourceConstructor,
          owner: false,
          inverseProperty: propertyKey,
        });
      } else {
        addOrUpdateRelation(sourceMetadata, {
          kind: 'many-to-many',
          propertyName: propertyKey,
          target: targetConstructor,
          owner: false,
          inverseProperty,
        });

        if (inverseProperty) {
          const ownerRelation = targetMetadata.relations.find(
            (relation) =>
              relation.kind === 'many-to-many' &&
              relation.propertyName === inverseProperty &&
              relation.owner
          );
          if (ownerRelation) {
            ownerRelation.inverseProperty = propertyKey;
          }
        }
      }

      entityMetadata.set(sourceConstructor, sourceMetadata);
      entityMetadata.set(targetConstructor, targetMetadata);
    });
  };
}

function getColumnDbEngineType(
  typescriptType: string | undefined,
  specifiedType?: ColumnDbEngineType
): ColumnDbEngineType | null {
  if (specifiedType) {
    if (!typescriptType || !isKnownTypescriptColumnType(typescriptType)) {
      return specifiedType;
    }

    const validTypes = typescriptToDbEngineColumnType[typescriptType];
    return validTypes.has(specifiedType) ? specifiedType : null;
  }

  if (!typescriptType || !isKnownTypescriptColumnType(typescriptType)) {
    return null;
  }

  return typescriptToDefaultDbEngineColumnType[typescriptType];
}

function isKnownTypescriptColumnType(
  value: string
): value is TypescriptColumnType {
  return (typescriptColumnTypes as readonly string[]).includes(value);
}

function normalizeRelationJoinColumn(
  config: ManyToManyJoinColumnOptions
): RelationJoinColumn {
  return {
    name: config.name,
    referencedColumn: config.referencedColumn,
    type: config.type,
    nullable: config.nullable ?? false,
    unique: config.unique,
  };
}

function validateReferencedColumn(
  metadata: EntityMetadata,
  joinColumn: RelationJoinColumn,
  relationDescription: string
): void {
  const referencedColumn = metadata.columns.find(
    (column) => column.name === joinColumn.referencedColumn
  );

  if (!referencedColumn) {
    console.warn(
      `${relationDescription} references missing column ${joinColumn.referencedColumn} on ${metadata.tableName}.`
    );
    return;
  }

  if (!referencedColumn.primary && !referencedColumn.unique) {
    console.warn(
      `${relationDescription} references ${metadata.tableName}.${joinColumn.referencedColumn} which is neither primary nor unique. Consider marking the column as unique to avoid duplicate relations.`
    );
  }
}

export function collectJoinTableMetadata(): EntityMetadata[] {
  resolvePendingRelations();
  const joinTables = new Map<string, EntityMetadata>();

  for (const metadata of entityMetadata.values()) {
    for (const relation of metadata.relations) {
      if (relation.kind !== 'many-to-many' || !relation.owner) {
        continue;
      }
      if (!relation.joinTable) {
        continue;
      }

      const joinMetadata = ensureJoinTableEntry(joinTables, relation.joinTable.name);

      upsertColumn(joinMetadata, {
        name: relation.joinTable.joinColumn.name,
        type: relation.joinTable.joinColumn.type,
        nullable: relation.joinTable.joinColumn.nullable,
        primary: false,
        unique: relation.joinTable.joinColumn.unique ?? false,
      });

      upsertColumn(joinMetadata, {
        name: relation.joinTable.inverseJoinColumn.name,
        type: relation.joinTable.inverseJoinColumn.type,
        nullable: relation.joinTable.inverseJoinColumn.nullable,
        primary: false,
        unique: relation.joinTable.inverseJoinColumn.unique ?? false,
      });

      addOrUpdateRelation(joinMetadata, {
        kind: 'many-to-many',
        propertyName: `${relation.joinTable.name}_${relation.joinTable.joinColumn.name}_fk`,
        target: metadata.ctor,
        owner: true,
        joinColumn: {
          name: relation.joinTable.joinColumn.name,
          referencedColumn: relation.joinTable.joinColumn.referencedColumn,
          type: relation.joinTable.joinColumn.type,
          nullable: relation.joinTable.joinColumn.nullable,
          unique: relation.joinTable.joinColumn.unique,
        },
      });

      addOrUpdateRelation(joinMetadata, {
        kind: 'many-to-many',
        propertyName: `${relation.joinTable.name}_${relation.joinTable.inverseJoinColumn.name}_fk`,
        target: relation.target,
        owner: true,
        joinColumn: {
          name: relation.joinTable.inverseJoinColumn.name,
          referencedColumn: relation.joinTable.inverseJoinColumn.referencedColumn,
          type: relation.joinTable.inverseJoinColumn.type,
          nullable: relation.joinTable.inverseJoinColumn.nullable,
          unique: relation.joinTable.inverseJoinColumn.unique,
        },
      });
    }
  }

  return Array.from(joinTables.values());
}

function ensureJoinTableEntry(
  joinTables: Map<string, EntityMetadata>,
  tableName: string
): EntityMetadata {
  let metadata = joinTables.get(tableName);
  if (!metadata) {
    const ctor = class JoinTableClass {} as unknown as GenericConstructor;
    metadata = {
      tableName,
      columns: [],
      relations: [],
      ctor,
    };
    joinTables.set(tableName, metadata);
  }
  return metadata;
}
