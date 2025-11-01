import { entityMetadata } from './metadata-store';
import { PostgresDriver, type PostgresDriverConfig } from './postgres-driver';

export class PgOrmFacade {
  constructor(private readonly driver: PostgresDriver) {}

  static fromConfig(config: PostgresDriverConfig): PgOrmFacade {
    return new PgOrmFacade(new PostgresDriver(config));
  }

  async synchronize(): Promise<void> {
    for (const [, metadata] of entityMetadata) {
      if (metadata.columns.length === 0) {
        // Column decorators were not discovered for this entity yet; skip for now.
        continue;
      }

      const tableName = this.quoteIdentifier(metadata.tableName);
      await this.driver.execute(`DROP TABLE IF EXISTS ${tableName} CASCADE;`);

      const columnsSql = metadata.columns
        .map((column) => {
          const nullability = column.nullable ? '' : ' NOT NULL';
          return `${this.quoteIdentifier(column.name)} ${column.type}${nullability}`;
        })
        .join(', ');

      if (!columnsSql) {
        continue;
      }

      const createStatement = `CREATE TABLE ${tableName} (${columnsSql});`;
      await this.driver.execute(createStatement);
    }
  }

  async close(): Promise<void> {
    await this.driver.end();
  }

  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }
}
