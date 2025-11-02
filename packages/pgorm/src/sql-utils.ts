export function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function buildConstraintName(table: string, column: string): string {
  const base = `${table}_${column}_fkey`.replace(/[^a-zA-Z0-9_]/g, '_');
  return quoteIdentifier(base);
}

export function mapColumnType(
  type: string,
  autoIncrement?: boolean
): string {
  if (!autoIncrement) {
    return type;
  }

  if (type.toUpperCase() !== 'INTEGER') {
    throw new Error(
      `Auto-increment is only supported for INTEGER columns. Received ${type}.`
    );
  }

  return 'SERIAL';
}

export function normalizeDatabaseType(type: string): string {
  return type.toUpperCase();
}
