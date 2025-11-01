import { entityMetadata } from '../entity-store';
import { quoteIdentifier, buildConstraintName } from '../sql-utils';
import type { EntityMetadata, RelationMetadata } from '../types';

export function buildAddForeignKeyStatement(
  sourceMetadata: EntityMetadata,
  relation: RelationMetadata
): string {
  if (!relation.joinColumn) {
    throw new Error('Relation is missing joinColumn metadata.');
  }

  const targetMetadata = entityMetadata.get(relation.target);
  if (!targetMetadata) {
    throw new Error(
      `Missing metadata for relation target ${relation.target.name}`
    );
  }

  const referencedColumn = relation.joinColumn.referencedColumn;
  const targetColumn = targetMetadata.columns.find(
    (column) => column.name === referencedColumn
  );
  if (!targetColumn) {
    throw new Error(
      `Relation referencing ${targetMetadata.tableName}.${referencedColumn} cannot be created because the column does not exist.`
    );
  }

  if (!targetColumn.primary && !targetColumn.unique) {
    throw new Error(
      `Foreign key from ${sourceMetadata.tableName}.${relation.joinColumn.name} requires ${targetMetadata.tableName}.${referencedColumn} to be unique or primary. Mark the column with { primary: true } or { unique: true }.`
    );
  }

  const constraintName = buildConstraintName(
    sourceMetadata.tableName,
    relation.joinColumn.name
  );
  const tableName = quoteIdentifier(sourceMetadata.tableName);
  const columnName = quoteIdentifier(relation.joinColumn.name);
  const referencedTableName = quoteIdentifier(targetMetadata.tableName);
  const referencedColumnName = quoteIdentifier(referencedColumn);

  return `ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} FOREIGN KEY (${columnName}) REFERENCES ${referencedTableName} (${referencedColumnName});`;
}
