import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';

export type PostgresDriverConfig = PoolConfig;

export interface DatabaseDriver {
  execute(sql: string, params?: unknown[]): Promise<void>;
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
  end(): Promise<void>;
}

export class PostgresDriver implements DatabaseDriver {
  private readonly pool: Pool;

  constructor(config: PostgresDriverConfig) {
    this.pool = new Pool(config);
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    await this.pool.query(sql, params);
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: unknown[] = []
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, params);
  }

  async end(): Promise<void> {
    await this.pool.end();
  }
}
