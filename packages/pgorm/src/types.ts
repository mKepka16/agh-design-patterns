export const columnDbEngineTypes = [
  'DOUBLE PRECISION',
  'INTEGER',
  'BOOLEAN',
  'TEXT',
] as const;
export type ColumnDbEngineType = (typeof columnDbEngineTypes)[number];

export type GenericConstructor = { new (...args: unknown[]): object };

export type ColumnMetadata = {
  name: string;
  type: ColumnDbEngineType;
  nullable: boolean;
  primary?: boolean;
  unique?: boolean;
};

export type RelationKind =
  | 'one-to-one'
  | 'one-to-many'
  | 'many-to-one'
  | 'many-to-many';

export type RelationJoinColumn = {
  name: string;
  referencedColumn: string;
  type: ColumnDbEngineType;
  nullable: boolean;
  unique?: boolean;
};

export type RelationJoinTable = {
  name: string;
  joinColumn: RelationJoinColumn;
  inverseJoinColumn: RelationJoinColumn;
};

export type RelationMetadata = {
  kind: RelationKind;
  propertyName: string | symbol;
  target: GenericConstructor;
  owner: boolean;
  joinColumn?: RelationJoinColumn;
  joinTable?: RelationJoinTable;
  inverseProperty?: string | symbol;
};

export type EntityMetadata = {
  tableName: string;
  columns: ColumnMetadata[];
  relations: RelationMetadata[];
  ctor: GenericConstructor;
};
