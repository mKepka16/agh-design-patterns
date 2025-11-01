import 'reflect-metadata';

import { ColumnDbEngineType, GenericConstructor } from '../types';
import {
  ensureEntityMetadata,
  entityMetadata,
  upsertColumn,
} from '../entity-store';

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

export type ColumnOptions = {
  columnName?: string;
  columnType?: ColumnDbEngineType;
  nullable?: boolean;
  primary?: boolean;
  unique?: boolean;
};

export function Column(options?: ColumnOptions) {
  return function (target: object, propertyKey: string | symbol): void {
    const constructor = target.constructor as GenericConstructor;

    const entity = ensureEntityMetadata(constructor);

    const designType = Reflect.getMetadata('design:type', target, propertyKey);
    const typescriptColumnType =
      typeof designType?.name === 'string'
        ? (designType.name.toLowerCase() as string | undefined)
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
