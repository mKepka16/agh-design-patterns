export function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function buildConstraintName(table: string, column: string): string {
  const base = `${table}_${column}_fkey`.replace(/[^a-zA-Z0-9_]/g, '_');
  return quoteIdentifier(base);
}
