export const columnDbEngineTypes = [
  'DOUBLE PRECISION',
  'INTEGER',
  'BOOLEAN',
  'TEXT',
] as const;
export type ColumnDbEngineType = (typeof columnDbEngineTypes)[number];

export type GenericConstructor<T = object> = { new(...args: unknown[]): T };

export type ColumnMetadata = {
  name: string;
  propertyName: string;
  type: ColumnDbEngineType;
  nullable: boolean;
  primary?: boolean;
  unique?: boolean;
  autoIncrement?: boolean;
};

export type RelationKind =
  | 'one-to-one'
  | 'one-to-many'
  | 'many-to-one'
  | 'many-to-many';

export type RelationJoinColumn = {
  name: string; // Column name in the source entity
  referencedColumn: string; // Column name in the target entity
  type: ColumnDbEngineType; // Type of FK column
  nullable: boolean; // Whether the FK column is nullable
  unique?: boolean; // Whether the FK column is unique
};

export type RelationJoinTable = {
  name: string;
  joinColumn: RelationJoinColumn;
  inverseJoinColumn: RelationJoinColumn;
};

export type RelationMetadata = {
  kind: RelationKind;
  propertyName: string | symbol; // TS name of the property in source entity
  target: GenericConstructor;
  owner: boolean; // Whether this side owns the relationship - has the FK or join table
  joinColumn?: RelationJoinColumn;
  joinTable?: RelationJoinTable;
  inverseProperty?: string | symbol;
};

export enum InheritanceType {
  TABLE_PER_CLASS = 'TABLE_PER_CLASS',
  SINGLE_TABLE = 'SINGLE_TABLE',
  // JOINED = 'JOINED',                 // Future
}

export type InheritanceOptions = {
  strategy: InheritanceType;
  discriminatorColumn?: string;
};

export type EntityMetadata = {
  tableName: string;
  columns: ColumnMetadata[];
  relations: RelationMetadata[];
  ctor: GenericConstructor;
  isMappedSuperclass?: boolean;
  inheritanceStrategy?: InheritanceType;
  discriminatorColumn?: string;
  discriminatorValue?: string;
  stiRootTableName?: string;
  stiChildColumns?: ColumnMetadata[];
};
