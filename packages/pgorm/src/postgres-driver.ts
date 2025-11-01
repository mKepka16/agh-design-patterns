import { Pool, PoolConfig } from 'pg';

export type PostgresDriverConfig = PoolConfig;

export class PostgresDriver {
  private readonly pool: Pool;

  constructor(config: PostgresDriverConfig) {
    this.pool = new Pool(config);
  }

  async execute(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  async end(): Promise<void> {
    await this.pool.end();
  }
}
