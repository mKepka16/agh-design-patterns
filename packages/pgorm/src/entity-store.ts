import {
  ColumnMetadata,
  EntityMetadata,
  GenericConstructor,
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

    metadata = {
      tableName: constructor.name.toLowerCase(),
      columns: parentMetadata ? parentMetadata.columns.map((c) => ({ ...c })) : [],
      relations: parentMetadata
        ? parentMetadata.relations.map((r) => ({ ...r }))
        : [],
      ctor: constructor,
    };
    entityMetadata.set(constructor, metadata);
  }

  return metadata;
}

export function upsertColumn(
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
