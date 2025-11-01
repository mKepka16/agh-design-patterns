import {
  collectJoinTableMetadata,
  entityMetadata,
  resolvePendingRelations,
  type EntityMetadata,
  type RelationMetadata,
} from './metadata-store';
import { PostgresDriver, type PostgresDriverConfig } from './postgres-driver';

export class PgOrmFacade {
  constructor(private readonly driver: PostgresDriver) {}

  static fromConfig(config: PostgresDriverConfig): PgOrmFacade {
    return new PgOrmFacade(new PostgresDriver(config));
  }

  async synchronize(): Promise<void> {
    resolvePendingRelations();
    const entityMetadataEntries = Array.from(entityMetadata.values());
    const joinTableMetadataEntries = collectJoinTableMetadata();
    const metadataEntries = [
      ...entityMetadataEntries,
      ...joinTableMetadataEntries,
    ];

    const currentSchema = await this.loadCurrentSchema();

    const tablesToRebuild: EntityMetadata[] = [];
    const tablesUnchanged: EntityMetadata[] = [];

    for (const metadata of metadataEntries) {
      if (this.tableNeedsRebuild(metadata, currentSchema)) {
        tablesToRebuild.push(metadata);
      } else {
        tablesUnchanged.push(metadata);
      }
    }

    for (const unchanged of tablesUnchanged) {
      console.log(
        `[pgorm] Keeping table ${unchanged.tableName} (no structural changes detected)`
      );
    }

    for (const metadata of tablesToRebuild) {
      const tableName = this.quoteIdentifier(metadata.tableName);
      await this.driver.execute(`DROP TABLE IF EXISTS ${tableName} CASCADE;`);
    }

    for (const metadata of tablesToRebuild) {
      const tableName = this.quoteIdentifier(metadata.tableName);

      const columnDefinitions = metadata.columns.map((column) => {
        const nullability = column.nullable ? '' : ' NOT NULL';
        const primary = column.primary ? ' PRIMARY KEY' : '';
        const uniqueness = !column.primary && column.unique ? ' UNIQUE' : '';
        return `${this.quoteIdentifier(column.name)} ${column.type}${nullability}${primary}${uniqueness}`;
      });

      if (columnDefinitions.length === 0) {
        continue;
      }

      const createStatement = `CREATE TABLE ${tableName} (${columnDefinitions.join(
        ', '
      )});`;
      await this.driver.execute(createStatement);
      console.log(`[pgorm] Recreated table ${metadata.tableName}`);
    }

    const schemaAfterTables = await this.loadCurrentSchema();

    for (const metadata of metadataEntries) {
      if (metadata.relations.length === 0) {
        continue;
      }

      for (const relation of metadata.relations) {
        if (!relation.owner || !relation.joinColumn) {
          continue;
        }

        if (
          this.foreignKeyExists(
            metadata,
            relation,
            schemaAfterTables
          )
        ) {
          continue;
        }

        const statement = this.buildAddForeignKeyStatement(metadata, relation);
        await this.driver.execute(statement);
        console.log(
          `[pgorm] Added foreign key ${metadata.tableName}.${relation.joinColumn.name} -> ${entityMetadata.get(relation.target)?.tableName ?? relation.target.name.toLowerCase()}.${relation.joinColumn.referencedColumn}`
        );

        const tableSnapshot = schemaAfterTables.get(metadata.tableName);
        const targetMetadata = entityMetadata.get(relation.target);
        if (tableSnapshot && targetMetadata && relation.joinColumn) {
          tableSnapshot.foreignKeys.push({
            column: relation.joinColumn.name,
            referencedTable: targetMetadata.tableName,
            referencedColumn: relation.joinColumn.referencedColumn,
          });
        }
      }
    }
  }

  async close(): Promise<void> {
    await this.driver.end();
  }

  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  private buildAddForeignKeyStatement(
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

    const constraintName = this.buildConstraintName(
      sourceMetadata.tableName,
      relation.joinColumn.name
    );
    const tableName = this.quoteIdentifier(sourceMetadata.tableName);
    const columnName = this.quoteIdentifier(relation.joinColumn.name);
    const referencedTableName = this.quoteIdentifier(targetMetadata.tableName);
    const referencedColumnName = this.quoteIdentifier(referencedColumn);

    return `ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} FOREIGN KEY (${columnName}) REFERENCES ${referencedTableName} (${referencedColumnName});`;
  }

  private buildConstraintName(table: string, column: string): string {
    const base = `${table}_${column}_fkey`.replace(/[^a-zA-Z0-9_]/g, '_');
    return this.quoteIdentifier(base);
  }

  private async loadCurrentSchema(): Promise<DatabaseSchemaSnapshot> {
    const tables = new Map<string, DatabaseTableSnapshot>();

    const columnsResult = await this.driver.query<{
      table_name: string;
      column_name: string;
      data_type: string;
      is_nullable: 'YES' | 'NO';
    }>(
      `
        SELECT table_name, column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public';
      `
    );

    for (const row of columnsResult.rows) {
      const tableName = row.table_name;
      const columnName = row.column_name;
      const normalizedType = row.data_type.toUpperCase();
      const table = ensureTableSnapshot(tables, tableName);
      table.columns.set(columnName, {
        dataType: normalizedType,
        nullable: row.is_nullable === 'YES',
        unique: false,
        primary: false,
      });
    }

    const uniquenessResult = await this.driver.query<{
      table_name: string;
      column_name: string;
      contype: 'p' | 'u';
    }>(
      `
        SELECT
          c.relname AS table_name,
          a.attname AS column_name,
          con.contype AS contype
        FROM pg_constraint con
          JOIN pg_class c ON con.conrelid = c.oid
          JOIN pg_namespace n ON c.relnamespace = n.oid
          JOIN unnest(con.conkey) AS cols(attnum) ON TRUE
          JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = cols.attnum
        WHERE n.nspname = 'public' AND con.contype IN ('p', 'u');
      `
    );

    for (const row of uniquenessResult.rows) {
      const table = ensureTableSnapshot(tables, row.table_name);
      const column = table.columns.get(row.column_name);
      if (!column) {
        continue;
      }
      if (row.contype === 'p') {
        column.primary = true;
        column.unique = true;
      } else if (row.contype === 'u') {
        column.unique = true;
      }
    }

    const fkResult = await this.driver.query<{
      table_name: string;
      column_name: string;
      foreign_table_name: string;
      foreign_column_name: string;
    }>(
      `
        SELECT
          src.relname       AS table_name,
          src_col.attname   AS column_name,
          tgt.relname       AS foreign_table_name,
          tgt_col.attname   AS foreign_column_name
        FROM pg_constraint con
          JOIN pg_class src ON src.oid = con.conrelid
          JOIN pg_class tgt ON tgt.oid = con.confrelid
          JOIN pg_namespace n ON n.oid = src.relnamespace
          JOIN unnest(con.conkey) WITH ORDINALITY AS src_att(attnum, ord) ON TRUE
          JOIN unnest(con.confkey) WITH ORDINALITY AS tgt_att(attnum, ord) ON src_att.ord = tgt_att.ord
          JOIN pg_attribute src_col ON src_col.attrelid = src.oid AND src_col.attnum = src_att.attnum
          JOIN pg_attribute tgt_col ON tgt_col.attrelid = tgt.oid AND tgt_col.attnum = tgt_att.attnum
        WHERE con.contype = 'f' AND n.nspname = 'public';
      `
    );

    for (const row of fkResult.rows) {
      const table = ensureTableSnapshot(tables, row.table_name);
      table.foreignKeys.push({
        column: row.column_name,
        referencedTable: row.foreign_table_name,
        referencedColumn: row.foreign_column_name,
      });
    }

    return tables;
  }

  private tableNeedsRebuild(
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

      if (!this.columnTypeMatches(column.type, existing.dataType)) {
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

  private columnTypeMatches(expected: string, actual: string): boolean {
    return expected.toUpperCase() === actual.toUpperCase();
  }

  private foreignKeyExists(
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
}

type DatabaseSchemaSnapshot = Map<string, DatabaseTableSnapshot>;

type DatabaseTableSnapshot = {
  columns: Map<string, DatabaseColumnSnapshot>;
  foreignKeys: DatabaseForeignKeySnapshot[];
};

type DatabaseColumnSnapshot = {
  dataType: string;
  nullable: boolean;
  unique: boolean;
  primary: boolean;
};

type DatabaseForeignKeySnapshot = {
  column: string;
  referencedTable: string;
  referencedColumn: string;
};

function ensureTableSnapshot(
  tables: DatabaseSchemaSnapshot,
  tableName: string
): DatabaseTableSnapshot {
  let snapshot = tables.get(tableName);
  if (!snapshot) {
    snapshot = {
      columns: new Map<string, DatabaseColumnSnapshot>(),
      foreignKeys: [],
    };
    tables.set(tableName, snapshot);
  }
  return snapshot;
}
