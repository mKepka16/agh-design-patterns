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
};

export type EntityMetadata = {
  tableName: string;
  columns: ColumnMetadata[];
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

type GenericConstructor = { new (...args: unknown[]): object };

// Store metadata about all entities
export const entityMetadata = new Map<Function, EntityMetadata>();

/**
 * Marks a class as an entity (database table)
 */
export function Entity(tableName?: string) {
  return function <T extends GenericConstructor>(constructor: T): void {
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
} & (
  | {
      columnType?: ColumnDbEngineType;
      nullable?: undefined;
    }
  | {
      columnType: ColumnDbEngineType;
      nullable: true;
    }
);

/**
 * Marks a field as a column (database column)
 */
export function Column(options?: ColumnOptions) {
  return function (target: object, propertyKey: string | symbol): void {
    const constructor = target.constructor;

    const entity = entityMetadata.get(constructor) ?? {
      tableName: constructor.name.toLowerCase(),
      columns: [],
    };

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
    entity.columns.push({
      name: columnName,
      type: columnType,
      nullable: options?.nullable ?? false,
    });
    entityMetadata.set(constructor, entity);
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
