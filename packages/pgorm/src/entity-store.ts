import {
  ColumnMetadata,
  EntityMetadata,
  GenericConstructor,
  InheritanceType,
  RelationMetadata,
} from './types';

const pendingRelationInitializers: Array<() => void> = [];

export const entityMetadata = new Map<GenericConstructor, EntityMetadata>();

export function ensureEntityMetadata(
  constructor: GenericConstructor
): EntityMetadata {
  let metadata = entityMetadata.get(constructor);
  if (!metadata) {
    const parentConstructor = Object.getPrototypeOf(constructor);
    const parentMetadata = entityMetadata.get(parentConstructor);

    const isStiChild =
      parentMetadata?.inheritanceStrategy === InheritanceType.SINGLE_TABLE;

    if (isStiChild) {
      // STI child: don't copy parent columns — use the root's table
      metadata = {
        tableName: constructor.name.toLowerCase(),
        columns: [],
        relations: parentMetadata
          ? parentMetadata.relations.map((r) => ({ ...r }))
          : [],
        ctor: constructor,
        inheritanceStrategy: InheritanceType.SINGLE_TABLE,
        stiRootTableName: parentMetadata.stiRootTableName ?? parentMetadata.tableName,
        discriminatorColumn: parentMetadata.discriminatorColumn,
      };
    } else {
      // Default (TABLE_PER_CLASS) or no parent: copy parent columns
      metadata = {
        tableName: constructor.name.toLowerCase(),
        columns: parentMetadata ? parentMetadata.columns.map((c) => ({ ...c })) : [],
        relations: parentMetadata
          ? parentMetadata.relations.map((r) => ({ ...r }))
          : [],
        ctor: constructor,
        inheritanceStrategy: parentMetadata?.inheritanceStrategy,
      };
    }

    entityMetadata.set(constructor, metadata);
  }

  return metadata;
}

/**
 * After all decorators have run, register child columns into the STI root entity.
 * Called during `resolvePendingRelations` / `synchronize`.
 */
export function registerStiChildColumns(): void {
  for (const [, metadata] of entityMetadata) {
    if (!metadata.stiRootTableName) continue;

    // Find the root entity metadata
    const root = findStiRoot(metadata.stiRootTableName);
    if (!root || !root.stiChildColumns) continue;

    for (const col of metadata.columns) {
      const alreadyExists =
        root.stiChildColumns.some((c) => c.name === col.name) ||
        root.columns.some((c) => c.name === col.name);

      if (!alreadyExists) {
        root.stiChildColumns.push({
          ...col,
          nullable: true,   // STI child columns must be nullable
          primary: false,
          unique: false,
          autoIncrement: false,
        });
      }
    }
  }
}

function findStiRoot(tableName: string): EntityMetadata | undefined {
  for (const [, metadata] of entityMetadata) {
    if (
      metadata.tableName === tableName &&
      metadata.inheritanceStrategy === InheritanceType.SINGLE_TABLE &&
      !metadata.stiRootTableName // it IS the root (not a child)
    ) {
      return metadata;
    }
  }
  return undefined;
}

export function upsertColumn(
  metadata: EntityMetadata,
  column: ColumnMetadata
): void {
  const existing = metadata.columns.find((c) => c.name === column.name);
  if (existing) {
    existing.type = column.type;
    existing.propertyName = column.propertyName;
    existing.nullable = column.nullable;
    if (column.primary !== undefined) {
      existing.primary = column.primary;
    }
    if (column.unique !== undefined) {
      existing.unique = column.unique;
    }
    if (column.autoIncrement !== undefined) {
      existing.autoIncrement = column.autoIncrement;
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

export function addOrUpdateRelation(
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

export function scheduleRelationInitialization(initializer: () => void): void {
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
