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

export function buildWhereClause(
    where: Record<string, any>,
    startParamIndex: number = 1
): { clause: string; values: any[]; nextParamIndex: number } {
  const conditions: string[] = [];
  const values: any[] = [];
  let paramIndex = startParamIndex;

  for (const [key, value] of Object.entries(where)) {
    conditions.push(`${quoteIdentifier(key)} = $${paramIndex}`);
    values.push(value);
    paramIndex++;
  }

  const clause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return {
    clause,
    values,
    nextParamIndex: paramIndex,
  };
}