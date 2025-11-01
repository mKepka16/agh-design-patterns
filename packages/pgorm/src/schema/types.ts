export type DatabaseForeignKeySnapshot = {
  column: string;
  referencedTable: string;
  referencedColumn: string;
};

export type DatabaseColumnSnapshot = {
  dataType: string;
  nullable: boolean;
  unique: boolean;
  primary: boolean;
};

export type DatabaseTableSnapshot = {
  columns: Map<string, DatabaseColumnSnapshot>;
  foreignKeys: DatabaseForeignKeySnapshot[];
};

export type DatabaseSchemaSnapshot = Map<string, DatabaseTableSnapshot>;
