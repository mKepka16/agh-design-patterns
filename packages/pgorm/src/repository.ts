import { Pool } from 'pg';
import { EntityMetadata, GenericConstructor, InheritanceType } from './types';
import { ensureEntityMetadata, entityMetadata } from './entity-store';
import { SelectOperation } from './entity-manager/select';
import { InsertOperation } from './entity-manager/insert';
import { DeleteOperation } from './entity-manager/delete';
import { UpdateOperation } from './entity-manager/update';

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
  ? Array<DeepPartial<U>>
  : T[P] extends object
  ? DeepPartial<T[P]>
  : T[P];
};

export type QueryDeepPartialEntity<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
  ? Array<DeepPartial<U>>
  : T[P] extends object
  ? DeepPartial<T[P]>
  : T[P];
};

export interface FindOptionsWhere<T> {
  [key: string]: any;
}

export interface FindOneOptions<T> {
  where?: FindOptionsWhere<T> | FindOptionsWhere<T>[];
  relations?: string[];
  select?: (keyof T)[];
  order?: { [P in keyof T]?: 'ASC' | 'DESC' };
}

export interface FindManyOptions<T> extends FindOneOptions<T> {
  skip?: number;
  take?: number;
}

export interface InsertResult {
  identifiers: { [key: string]: any }[];
  generatedMaps: { [key: string]: any }[];
  raw: any;
}

export interface UpdateResult {
  generatedMaps: { [key: string]: any }[];
  raw: any;
  affected?: number;
}

export interface DeleteResult {
  raw: any;
  affected?: number | null;
}

export class Repository<T extends object> {
  private metadata: EntityMetadata;
  private allColumns: EntityMetadata['columns'];
  private selectOp: SelectOperation;
  private insertOp: InsertOperation;
  private deleteOp: DeleteOperation;
  private updateOp: UpdateOperation;
  private discriminatorColumn?: string;
  private discriminatorValue?: string;

  constructor(
    readonly pool: Pool,
    private readonly target: GenericConstructor<T>,
    metadata?: EntityMetadata
  ) {
    this.metadata = metadata || ensureEntityMetadata(target);

    // For STI children, use the root table and merge root + own columns
    const isStiChild = !!this.metadata.stiRootTableName;
    let effectiveTableName = this.metadata.tableName;

    if (isStiChild) {
      effectiveTableName = this.metadata.stiRootTableName!;
      this.discriminatorColumn = this.metadata.discriminatorColumn;
      this.discriminatorValue = this.metadata.discriminatorValue;

      // Merge root columns + own columns for mapping
      const rootMeta = this.findStiRootMetadata(effectiveTableName);
      this.allColumns = [
        ...(rootMeta ? rootMeta.columns : []),
        ...this.metadata.columns,
      ];
    } else if (
      this.metadata.inheritanceStrategy === InheritanceType.SINGLE_TABLE &&
      this.metadata.discriminatorColumn
    ) {
      // This IS the STI root — querying via root repo returns all rows (no filter)
      effectiveTableName = this.metadata.tableName;
      this.allColumns = this.metadata.columns;
    } else {
      this.allColumns = this.metadata.columns;
    }

    this.selectOp = new SelectOperation(pool, effectiveTableName);
    this.insertOp = new InsertOperation(pool, effectiveTableName);
    this.deleteOp = new DeleteOperation(pool, effectiveTableName);
    this.updateOp = new UpdateOperation(pool, effectiveTableName);
  }

  private findStiRootMetadata(rootTableName: string): EntityMetadata | undefined {
    for (const [, meta] of entityMetadata) {
      if (
        meta.tableName === rootTableName &&
        meta.inheritanceStrategy === InheritanceType.SINGLE_TABLE &&
        !meta.stiRootTableName
      ) {
        return meta;
      }
    }
    return undefined;
  }

  /** Inject discriminator column+value into a DB object before INSERT */
  private stiInjectDiscriminator(dbObject: Record<string, any>): Record<string, any> {
    if (this.discriminatorColumn && this.discriminatorValue) {
      dbObject[this.discriminatorColumn] = this.discriminatorValue;
    }
    return dbObject;
  }

  /** Add discriminator filter to WHERE clause for SELECT/UPDATE/DELETE */
  private stiAddDiscriminatorFilter(where: Record<string, any>): Record<string, any> {
    if (this.discriminatorColumn && this.discriminatorValue) {
      return { ...where, [this.discriminatorColumn]: this.discriminatorValue };
    }
    return where;
  }

  private resolveColumnName(key: string): string | undefined {
    const colByProp = this.allColumns.find(c => c.propertyName === key);
    if (colByProp) return colByProp.name;

    const colByName = this.allColumns.find(c => c.name === key);
    if (colByName) return colByName.name;

    return undefined;
  }

  private resolveValue(columnName: string, val: any): any {
    const col = this.allColumns.find(c => c.name === columnName);
    if (!col) return val;

    const relation = this.metadata.relations.find(r => r.propertyName === col.propertyName);

    if (relation && typeof val === 'object' && val !== null) {
      const targetMetadata = ensureEntityMetadata(relation.target);
      const pk = targetMetadata.columns.find(c => c.primary);

      if (pk && (val as any)[pk.propertyName] !== undefined) {
        return (val as any)[pk.propertyName];
      } else {
        if (val instanceof Date) return val;
        return val;
      }
    }
    return val;
  }

  private mapToDbObject(entityLike: any): any {
    const dbObject: any = {};
    for (const col of this.allColumns) {
      let val = entityLike[col.propertyName];
      if (val === undefined) {
        val = entityLike[col.name];
      }

      if (val !== undefined) {
        dbObject[col.name] = this.resolveValue(col.name, val);
      }
    }
    return dbObject;
  }

  private mapWhereToDb(where: any): any {
    const dbWhere: any = {};
    for (const key of Object.keys(where)) {
      const colName = this.resolveColumnName(key);
      if (colName) {
        dbWhere[colName] = this.resolveValue(colName, where[key]);
      }
    }
    return dbWhere;
  }

  private mapSelectToDb(select: (keyof T)[]): Record<string, boolean> {
    const selectMap: Record<string, boolean> = {};
    for (const key of select) {
      const colName = this.resolveColumnName(key as string);
      if (colName) {
        selectMap[colName] = true;
      }
    }
    return selectMap;
  }

  private mapOrderToDb(order: any): any {
    const dbOrder: any = {};
    for (const key of Object.keys(order)) {
      const colName = this.resolveColumnName(key);
      if (colName) {
        dbOrder[colName] = order[key];
      }
    }
    return dbOrder;
  }

  // Inverse mapping: DB row -> Entity
  create(plainObjectLike?: DeepPartial<T>): T {
    if (!plainObjectLike) {
      return new this.target() as T;
    }
    const entity = new this.target() as T;

    for (const col of this.allColumns) {
      if (Object.prototype.hasOwnProperty.call(plainObjectLike, col.name)) {
        (entity as any)[col.propertyName] = (plainObjectLike as any)[col.name];
      } else if (Object.prototype.hasOwnProperty.call(plainObjectLike, col.propertyName)) {
        (entity as any)[col.propertyName] = (plainObjectLike as any)[col.propertyName];
      }
    }
    return entity;
  }

  async save(entity: T): Promise<T>;
  async save(entities: T[]): Promise<T[]>;
  async save(entityOrEntities: T | T[]): Promise<T | T[]> {
    if (Array.isArray(entityOrEntities)) {
      return Promise.all(entityOrEntities.map(e => this.save(e)));
    }

    const pk = this.allColumns.find(c => c.primary);
    const pkProp = pk?.propertyName;
    const hasId = pkProp && (entityOrEntities as any)[pkProp] != null;

    if (hasId) {
      const where: any = {};
      where[pkProp!] = (entityOrEntities as any)[pkProp!];

      const mappedWhere = this.stiAddDiscriminatorFilter(this.mapWhereToDb(where));
      const mappedData = this.stiInjectDiscriminator(this.mapToDbObject(entityOrEntities));

      const res = await this.updateOp.execute({ where: mappedWhere, data: mappedData });
      if (res.length > 0) {
        return this.create(res[0]);
      }
    }

    const mappedData = this.stiInjectDiscriminator(this.mapToDbObject(entityOrEntities));
    const result = await this.insertOp.execute(mappedData);
    return this.create(result);
  }

  async insert(entity: QueryDeepPartialEntity<T> | QueryDeepPartialEntity<T>[]): Promise<InsertResult> {
    const entities = Array.isArray(entity) ? entity : [entity];

    const identifiers: any[] = [];
    const generatedMaps: any[] = [];
    const rows: any[] = [];

    for (const e of entities) {
      const mappedData = this.stiInjectDiscriminator(this.mapToDbObject(e));
      const res = await this.insertOp.execute(mappedData);
      rows.push(res);

      const pk = this.allColumns.find(c => c.primary);
      if (pk) {
        const id = res[pk.name];
        identifiers.push({ [pk.propertyName]: id });
        generatedMaps.push({ [pk.propertyName]: id });
      }
    }

    return {
      identifiers,
      generatedMaps,
      raw: rows
    };
  }

  async update(criteria: FindOptionsWhere<T>, partialEntity: QueryDeepPartialEntity<T>): Promise<UpdateResult> {
    const mappedWhere = this.stiAddDiscriminatorFilter(this.mapWhereToDb(criteria));
    const mappedData = this.mapToDbObject(partialEntity);

    const rows = await this.updateOp.execute({ where: mappedWhere, data: mappedData });
    return {
      generatedMaps: [],
      raw: rows,
      affected: rows.length
    };
  }

  async delete(criteria: FindOptionsWhere<T> | string | number): Promise<DeleteResult> {
    let where: any = {};

    if (typeof criteria === 'string' || typeof criteria === 'number') {
      const pk = this.allColumns.find(c => c.primary);
      if (!pk) throw new Error("No primary key found for entity");
      where[pk.name] = criteria;
    } else {
      where = this.mapWhereToDb(criteria);
    }

    where = this.stiAddDiscriminatorFilter(where);
    const deletedCount = await this.deleteOp.deleteMany({ where });
    return { raw: [], affected: deletedCount };
  }

  async remove(entity: T): Promise<T> {
    const pk = this.allColumns.find(c => c.primary);
    if (!pk) throw new Error("No primary key found for entity");
    const id = (entity as any)[pk.propertyName];
    await this.delete(id);
    return entity;
  }

  async count(options?: FindManyOptions<T>): Promise<number> {
    const results = await this.find(options);
    return results.length;
  }

  async clear(): Promise<void> {
    await this.deleteOp.deleteMany({ where: {}, allowAll: true });
  }

  async findOne(options: FindOneOptions<T>): Promise<T | null> {
    const results = await this.find({ ...options, take: 1 });
    return results.length > 0 ? results[0] : null;
  }

  async find(options?: FindManyOptions<T>): Promise<T[]> {
    const mappedOptions: any = {};
    if (options?.where) {
      mappedOptions.where = this.stiAddDiscriminatorFilter(this.mapWhereToDb(options.where));
    } else {
      // Even without user-provided WHERE, add discriminator filter
      mappedOptions.where = this.stiAddDiscriminatorFilter({});
    }
    // Remove empty where if no discriminator filter was added
    if (Object.keys(mappedOptions.where).length === 0) {
      delete mappedOptions.where;
    }
    if (options?.take) mappedOptions.limit = options.take;
    if (options?.skip) mappedOptions.offset = options.skip;
    if (options?.order) mappedOptions.orderBy = this.mapOrderToDb(options.order);
    if (options?.select) {
      mappedOptions.select = this.mapSelectToDb(options.select);
    }

    const results = await this.selectOp.findAll(mappedOptions);
    return results.map(r => this.create(r));
  }

}
