import { Pool } from 'pg';
import {
  DatabaseColumnSnapshot,
  DatabaseSchemaSnapshot,
  DatabaseTableSnapshot,
} from './types';

export async function loadCurrentSchema(
  pool: Pool
): Promise<DatabaseSchemaSnapshot> {
  const tables = new Map<string, DatabaseTableSnapshot>();

  const columnsResult = await pool.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: 'YES' | 'NO';
    column_default: string | null;
  }>(
    `
      SELECT table_name, column_name, data_type, is_nullable, column_default
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
      autoIncrement:
        row.column_default !== null && /nextval\('/i.test(row.column_default),
    });
  }

  const uniquenessResult = await pool.query<{
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

  const fkResult = await pool.query<{
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

export function ensureTableSnapshot(
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
