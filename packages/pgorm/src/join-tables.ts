import { EntityMetadata, GenericConstructor } from './types';
import {
  addOrUpdateRelation,
  entityMetadata,
  resolvePendingRelations,
  upsertColumn,
} from './entity-store';

export function collectJoinTableMetadata(): EntityMetadata[] {
  resolvePendingRelations();

  const joinTables = new Map<string, EntityMetadata>();

  for (const metadata of entityMetadata.values()) {
    if (metadata.isMappedSuperclass) {
      continue;
    }
    for (const relation of metadata.relations) {
      if (relation.kind !== 'many-to-many' || !relation.owner) {
        continue;
      }
      if (!relation.joinTable) {
        continue;
      }

      const joinMetadata = ensureJoinTableEntry(
        joinTables,
        relation.joinTable.name
      );

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
