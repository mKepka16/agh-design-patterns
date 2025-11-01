import { entityMetadata } from '../entity-store';
import type { EntityMetadata, RelationMetadata } from '../types';
import {
  DatabaseSchemaSnapshot,
  DatabaseTableSnapshot,
} from './types';

export function tableNeedsRebuild(
  metadata: EntityMetadata,
  schema: DatabaseSchemaSnapshot
): boolean {
  if (metadata.columns.length === 0) {
    return false;
  }

  const snapshot = schema.get(metadata.tableName);
  if (!snapshot) {
    console.log(
      `[pgorm] Schema change detected for ${metadata.tableName}: table does not exist`
    );
    return true;
  }

  const reasons: string[] = [];

  if (snapshot.columns.size !== metadata.columns.length) {
    reasons.push(
      `column count differs (expected ${metadata.columns.length}, actual ${snapshot.columns.size})`
    );
  }

  for (const column of metadata.columns) {
    const existing = snapshot.columns.get(column.name);
    if (!existing) {
      reasons.push(`missing column ${column.name}`);
      continue;
    }

    if (!columnTypeMatches(column.type, existing.dataType)) {
      reasons.push(
        `type mismatch on ${column.name} (expected ${column.type}, actual ${existing.dataType})`
      );
    }

    if (column.nullable !== existing.nullable) {
      reasons.push(
        `nullability mismatch on ${column.name} (expected ${column.nullable}, actual ${existing.nullable})`
      );
    }

    const expectedPrimary = column.primary ?? false;
    const expectedUnique = expectedPrimary ? true : column.unique ?? false;
    if (expectedPrimary !== !!existing.primary) {
      reasons.push(
        `primary flag mismatch on ${column.name} (expected ${expectedPrimary}, actual ${existing.primary})`
      );
    }

    if (expectedUnique !== !!existing.unique) {
      reasons.push(
        `unique flag mismatch on ${column.name} (expected ${expectedUnique}, actual ${existing.unique})`
      );
    }
  }

  for (const existingName of snapshot.columns.keys()) {
    if (!metadata.columns.some((column) => column.name === existingName)) {
      reasons.push(`extra column ${existingName}`);
    }
  }

  if (reasons.length > 0) {
    console.log(
      `[pgorm] Schema change detected for ${metadata.tableName}: ${reasons.join(
        '; '
      )}`
    );
    return true;
  }

  return false;
}

export function foreignKeyExists(
  metadata: EntityMetadata,
  relation: RelationMetadata,
  schema: DatabaseSchemaSnapshot
): boolean {
  const snapshot = schema.get(metadata.tableName);
  const targetMetadata = entityMetadata.get(relation.target);
  if (!snapshot || !targetMetadata) {
    return false;
  }

  return snapshot.foreignKeys.some(
    (fk) =>
      fk.column === relation.joinColumn?.name &&
      fk.referencedTable === targetMetadata.tableName &&
      fk.referencedColumn === relation.joinColumn?.referencedColumn
  );
}

function columnTypeMatches(expected: string, actual: string): boolean {
  return expected.toUpperCase() === actual.toUpperCase();
}
