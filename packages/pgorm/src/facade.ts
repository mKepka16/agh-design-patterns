import { collectJoinTableMetadata } from './join-tables';
import { entityMetadata, resolvePendingRelations } from './entity-store';
import type { EntityMetadata, RelationMetadata } from './types';
import { Pool, PoolConfig } from 'pg';
import { loadCurrentSchema } from './schema/snapshot';
import { DatabaseSchemaSnapshot } from './schema/types';
import { tableNeedsRebuild, foreignKeyExists } from './schema/diff';
import { buildAddForeignKeyStatement } from './schema/foreign-keys';
import { mapColumnType, quoteIdentifier } from './sql-utils';

export class PgOrmFacade {
  constructor(private readonly pool: Pool) {}

  static fromConfig(config: PoolConfig): PgOrmFacade {
    return new PgOrmFacade(new Pool(config));
  }

  async synchronize(): Promise<void> {
    resolvePendingRelations();

    const entityMetadataEntries = Array.from(entityMetadata.values());
    const joinTableMetadataEntries = collectJoinTableMetadata();
    const metadataEntries = [
      ...entityMetadataEntries,
      ...joinTableMetadataEntries,
    ];

    const currentSchema = await loadCurrentSchema(this.pool);
    const tablesToRebuild = metadataEntries.filter((metadata) =>
      tableNeedsRebuild(metadata, currentSchema)
    );
    const tablesUnchanged = metadataEntries.filter(
      (metadata) => !tablesToRebuild.includes(metadata)
    );

    for (const metadata of tablesUnchanged) {
      console.log(
        `[pgorm] Keeping table ${metadata.tableName} (no structural changes detected)`
      );
    }

    await this.dropTables(tablesToRebuild);
    await this.createTables(tablesToRebuild);

    const schemaAfterTables = await loadCurrentSchema(this.pool);
    await this.ensureForeignKeys(metadataEntries, schemaAfterTables);
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

      const columnDefinitions = metadata.columns.map((column) => {
        const columnType = mapColumnType(column.type, column.autoIncrement);
        const nullability = column.nullable ? '' : ' NOT NULL';
        const primary = column.primary ? ' PRIMARY KEY' : '';
        const uniqueness = !column.primary && column.unique ? ' UNIQUE' : '';
        return `${quoteIdentifier(column.name)} ${columnType}${nullability}${primary}${uniqueness}`;
      });

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
