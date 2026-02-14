import { collectJoinTableMetadata } from './join-tables';
import { entityMetadata, resolvePendingRelations, registerStiChildColumns } from './entity-store';
import type { EntityMetadata, RelationMetadata } from './types';
import { InheritanceType } from './types';
import { Pool, PoolConfig } from 'pg';
import { loadCurrentSchema } from './schema/snapshot';
import { DatabaseSchemaSnapshot } from './schema/types';
import { tableNeedsRebuild, foreignKeyExists } from './schema/diff';
import { buildAddForeignKeyStatement } from './schema/foreign-keys';
import { mapColumnType, quoteIdentifier } from './sql-utils';
import { EntityManager } from './entity-manager/manager';

export class PgOrmFacade {
  public readonly entityManager: EntityManager;

  constructor(private readonly pool: Pool) {
    this.entityManager = new EntityManager(pool);
  }

  static fromConfig(config: PoolConfig): PgOrmFacade {
    return new PgOrmFacade(new Pool(config));
  }

  async synchronize(): Promise<void> {
    resolvePendingRelations();
    registerStiChildColumns();

    const allEntityMetadata = Array.from(entityMetadata.values());
    const concreteEntityMetadata = allEntityMetadata.filter(
      (m) => !m.isMappedSuperclass
    );
    const mappedSuperclassMetadata = allEntityMetadata.filter(
      (m) => m.isMappedSuperclass
    );

    // STI children don't get their own tables
    const stiChildMetadata = concreteEntityMetadata.filter(
      (m) => !!m.stiRootTableName
    );
    const nonStiChildMetadata = concreteEntityMetadata.filter(
      (m) => !m.stiRootTableName
    );

    const joinTableMetadataEntries = collectJoinTableMetadata();
    const activeMetadataEntries = [
      ...nonStiChildMetadata,
      ...joinTableMetadataEntries,
    ];

    const currentSchema = await loadCurrentSchema(this.pool);

    // Identify tables that exist but are now MappedSuperclasses (should be dropped)
    // We check for both exact matches and pluralized versions since users might have inconsistent naming
    const tablesToDropFromMappedSuperclass = mappedSuperclassMetadata.flatMap(
      (m) => {
        const candidates = [m.tableName, m.tableName + 's'];
        return candidates.filter(name => currentSchema.has(name)).map(name => ({ ...m, tableName: name }));
      }
    );

    const tablesToRebuild = activeMetadataEntries.filter((metadata) =>
      tableNeedsRebuild(metadata, currentSchema)
    );

    const tablesUnchanged = activeMetadataEntries.filter(
      (metadata) => !tablesToRebuild.includes(metadata)
    );

    for (const metadata of tablesUnchanged) {
      console.log(
        `[pgorm] Keeping table ${metadata.tableName} (no structural changes detected)`
      );
    }

    const tablesToDrop = [...tablesToRebuild, ...tablesToDropFromMappedSuperclass];
    await this.dropTables(tablesToDrop);

    // Only create tables for concrete entities and join tables
    await this.createTables(tablesToRebuild);

    const schemaAfterTables = await loadCurrentSchema(this.pool);
    await this.ensureForeignKeys(activeMetadataEntries, schemaAfterTables);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async dropTables(metadatas: EntityMetadata[]): Promise<void> {
    for (const metadata of metadatas) {
      const tableName = quoteIdentifier(metadata.tableName);
      await this.pool.query(`DROP TABLE IF EXISTS ${tableName} CASCADE;`);
    }
  }

  private async createTables(metadatas: EntityMetadata[]): Promise<void> {
    for (const metadata of metadatas) {
      const tableName = quoteIdentifier(metadata.tableName);

      const formatColumn = (column: typeof metadata.columns[0]) => {
        const columnType = mapColumnType(column.type, column.autoIncrement);
        const nullability = column.nullable ? '' : ' NOT NULL';
        const primary = column.primary ? ' PRIMARY KEY' : '';
        const uniqueness = !column.primary && column.unique ? ' UNIQUE' : '';
        return `${quoteIdentifier(column.name)} ${columnType}${nullability}${primary}${uniqueness}`;
      };

      const columnDefinitions = metadata.columns.map(formatColumn);

      // For STI root entities, add discriminator column + child columns
      if (
        metadata.inheritanceStrategy === InheritanceType.SINGLE_TABLE &&
        !metadata.stiRootTableName
      ) {
        const discrimCol = metadata.discriminatorColumn ?? 'type';
        columnDefinitions.push(
          `${quoteIdentifier(discrimCol)} TEXT NOT NULL`
        );

        if (metadata.stiChildColumns) {
          for (const childCol of metadata.stiChildColumns) {
            columnDefinitions.push(formatColumn(childCol));
          }
        }
      }

      if (columnDefinitions.length === 0) {
        continue;
      }

      const statement = `CREATE TABLE ${tableName} (${columnDefinitions.join(
        ', '
      )});`;
      await this.pool.query(statement);
      console.log(`[pgorm] Recreated table ${metadata.tableName}`);
    }
  }

  private async ensureForeignKeys(
    metadatas: EntityMetadata[],
    schema: DatabaseSchemaSnapshot
  ): Promise<void> {
    for (const metadata of metadatas) {
      if (metadata.relations.length === 0) {
        continue;
      }

      for (const relation of metadata.relations) {
        if (!relation.owner || !relation.joinColumn) {
          continue;
        }

        if (foreignKeyExists(metadata, relation, schema)) {
          continue;
        }

        const statement = buildAddForeignKeyStatement(metadata, relation);
        await this.pool.query(statement);

        const targetMetadata = entityMetadata.get(relation.target);
        console.log(
          `[pgorm] Added foreign key ${metadata.tableName}.${relation.joinColumn.name} -> ${targetMetadata?.tableName ?? relation.target.name.toLowerCase()}.${relation.joinColumn.referencedColumn}`
        );

        updateSnapshot(schema, metadata.tableName, relation);
      }
    }
  }
}

function updateSnapshot(
  schema: DatabaseSchemaSnapshot,
  tableName: string,
  relation: RelationMetadata
): void {
  const tableSnapshot = schema.get(tableName);
  const targetMetadata = entityMetadata.get(relation.target);
  if (!tableSnapshot || !targetMetadata || !relation.joinColumn) {
    return;
  }

  tableSnapshot.foreignKeys.push({
    column: relation.joinColumn.name,
    referencedTable: targetMetadata.tableName,
    referencedColumn: relation.joinColumn.referencedColumn,
  });
}
