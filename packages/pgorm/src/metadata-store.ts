import 'reflect-metadata';

const columnDbEngineTypes = ['DOUBLE PRECISION', 'TEXT'] as const;
export type ColumnDbEngineType = (typeof columnDbEngineTypes)[number];

export type ColumnMetadata = {
  name: string;
  type: ColumnDbEngineType;
};

export type EntityMetadata = {
  tableName: string;
  columns: ColumnMetadata[];
};

const typescriptColumnTypes = ['number', 'string'] as const;
type TypescriptColumnType = (typeof typescriptColumnTypes)[number];

const typescriptToDbEngineColumnType: Record<
  TypescriptColumnType,
  Set<ColumnDbEngineType>
> = {
  number: new Set(['DOUBLE PRECISION']),
  string: new Set(['TEXT']),
};

const typescriptToDefaultDbEngineColumnType: Record<
  TypescriptColumnType,
  ColumnDbEngineType
> = {
  number: 'DOUBLE PRECISION',
  string: 'TEXT',
};

type GenericConstructor = { new (...args: unknown[]): object };

// Store metadata about all entities
export const entityMetadata = new Map<Function, EntityMetadata>();

/**
 * Marks a class as an entity (database table)
 */
export function Entity(tableName?: string) {
  return function <T extends GenericConstructor>(constructor: T): void {
    console.log('Entity run')
    const name = tableName ?? constructor.name.toLowerCase();
    const existing = entityMetadata.get(constructor);
    if (existing) {
      // Preserve already discovered columns from property decorators
      entityMetadata.set(constructor, {
        ...existing,
        tableName: name,
      });
      return;
    }

    entityMetadata.set(constructor, { tableName: name, columns: [] });
  };
}

type ColumnOptions = {
  columnName?: string;
  columnType?: ColumnDbEngineType;
};

/**
 * Marks a field as a column (database column)
 */
export function Column(options?: ColumnOptions) {
  return function (target: object, propertyKey: string | symbol): void {
    console.log('Column run for', String(propertyKey));
    const constructor = target.constructor;

    const entity = entityMetadata.get(constructor) ?? {
      tableName: constructor.name.toLowerCase(),
      columns: [],
    };

    const typescriptColumnType = Reflect.getMetadata(
      'design:type',
      target,
      propertyKey
    );
    const columnType = getColumnDbEngineType(
      typescriptColumnType.name.toLowerCase(),
      options?.columnType
    );
    if (!columnType) {
      console.warn(
        `Unsupported column type for property ${String(propertyKey)} on ${
          constructor.name
        }`
      );
      return;
    }
    const columnName = options?.columnName ?? String(propertyKey);
    entity.columns.push({
      name: columnName,
      type: columnType,
    });
    entityMetadata.set(constructor, entity);
  };
}

function getColumnDbEngineType(
  typescriptType: TypescriptColumnType,
  specifiedType?: ColumnDbEngineType
): ColumnDbEngineType | null {
  if (!typescriptColumnTypes.includes(typescriptType)) {
    return null;
  }

  if (specifiedType) {
    const validTypes = typescriptToDbEngineColumnType[typescriptType];
    if (validTypes.has(specifiedType)) {
      return specifiedType;
    } else {
      return null;
    }
  }

  return typescriptToDefaultDbEngineColumnType[typescriptType];
}
