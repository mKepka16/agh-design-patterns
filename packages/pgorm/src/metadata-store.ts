import 'reflect-metadata';

const columnDbEngineTypes = [
  'DOUBLE PRECISION',
  'INTEGER',
  'BOOLEAN',
  'TEXT',
] as const;
export type ColumnDbEngineType = (typeof columnDbEngineTypes)[number];

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
};

type RelationKind = 'one-to-one' | 'one-to-many' | 'many-to-one';

type RelationJoinColumn = {
  name: string;
  referencedColumn: string;
  type: ColumnDbEngineType;
  nullable: boolean;
  unique?: boolean;
};

type GenericConstructor = { new (...args: unknown[]): object };

export type RelationMetadata = {
  kind: RelationKind;
  propertyName: string | symbol;
  target: GenericConstructor;
  owner: boolean;
  joinColumn?: RelationJoinColumn;
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
    };
    entityMetadata.set(constructor, metadata);
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
    const nullable = options?.nullable ?? false;
    const primary = options?.primary ?? false;
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
