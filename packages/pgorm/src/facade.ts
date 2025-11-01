import {
  entityMetadata,
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
    const metadataEntries = Array.from(entityMetadata.values());

    for (const metadata of metadataEntries) {
      if (metadata.columns.length === 0) {
        continue;
      }
      const tableName = this.quoteIdentifier(metadata.tableName);
      await this.driver.execute(`DROP TABLE IF EXISTS ${tableName} CASCADE;`);
    }

    for (const metadata of metadataEntries) {
      if (metadata.columns.length === 0) {
        continue;
      }

      const tableName = this.quoteIdentifier(metadata.tableName);

      const columnDefinitions = metadata.columns.map((column) => {
        const nullability = column.nullable ? '' : ' NOT NULL';
        const uniqueness = column.unique ? ' UNIQUE' : '';
        return `${this.quoteIdentifier(column.name)} ${column.type}${nullability}${uniqueness}`;
      });

      if (columnDefinitions.length === 0) {
        continue;
      }

      const createStatement = `CREATE TABLE ${tableName} (${columnDefinitions.join(
        ', '
      )});`;
      await this.driver.execute(createStatement);
    }

    for (const metadata of metadataEntries) {
      if (metadata.relations.length === 0) {
        continue;
      }

      for (const relation of metadata.relations) {
        if (!relation.owner || !relation.joinColumn) {
          continue;
        }

        const statement = this.buildAddForeignKeyStatement(metadata, relation);
        await this.driver.execute(statement);
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
}
