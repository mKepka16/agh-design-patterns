import {
  ColumnDbEngineType,
  EntityMetadata,
  GenericConstructor,
  RelationJoinColumn,
} from '../types';
import {
  addOrUpdateRelation,
  ensureEntityMetadata,
  entityMetadata,
  scheduleRelationInitialization,
  upsertColumn,
} from '../entity-store';

type JoinColumnConfig = {
  name: string;
  referencedColumn: string;
  type: ColumnDbEngineType;
  nullable?: boolean;
  unique?: boolean;
};

type OneToOneOptions = {
  joinColumn: JoinColumnConfig;
  inverseProperty?: string | symbol;
};

type OneToManyOptions = {
  joinColumn: JoinColumnConfig;
  inverseProperty?: string | symbol;
};

type ManyToOneOptions = {
  joinColumn: JoinColumnConfig;
  inverseProperty?: string | symbol;
};

type ManyToManyJoinColumnOptions = {
  name: string;
  referencedColumn: string;
  type: ColumnDbEngineType;
  nullable?: boolean;
  unique?: boolean;
};

export type ManyToManyOptions = {
  joinTable?: {
    name: string;
    joinColumn: ManyToManyJoinColumnOptions;
    inverseJoinColumn: ManyToManyJoinColumnOptions;
  };
  inverseProperty?: string | symbol;
};

export function OneToOne(
  targetFactory: () => GenericConstructor,
  options: OneToOneOptions
) {
  return function (target: object, propertyKey: string | symbol): void {
    const sourceConstructor = target.constructor as GenericConstructor;

    scheduleRelationInitialization(() => {
      const targetConstructor = targetFactory();

      const sourceMetadata = ensureEntityMetadata(sourceConstructor);
      const targetMetadata = ensureEntityMetadata(targetConstructor);

      const ownerJoinColumn = normalizeRelationJoinColumn(options.joinColumn);
      const nullable = ownerJoinColumn.nullable;

      upsertColumn(sourceMetadata, {
        name: ownerJoinColumn.name,
        type: ownerJoinColumn.type,
        nullable,
        unique: true,
      });

      validateReferencedColumn(
        targetMetadata,
        ownerJoinColumn,
        `${sourceConstructor.name}.${String(propertyKey)}`
      );

      addOrUpdateRelation(sourceMetadata, {
        kind: 'one-to-one',
        propertyName: propertyKey,
        target: targetConstructor,
        owner: true,
        joinColumn: { ...ownerJoinColumn, unique: true },
        inverseProperty: options.inverseProperty,
      });

      addOrUpdateRelation(targetMetadata, {
        kind: 'one-to-one',
        propertyName: options.inverseProperty ?? propertyKey,
        target: sourceConstructor,
        owner: false,
        inverseProperty: propertyKey,
      });

      entityMetadata.set(sourceConstructor, sourceMetadata);
      entityMetadata.set(targetConstructor, targetMetadata);
    });
  };
}

export function OneToMany(
  targetFactory: () => GenericConstructor,
  options: OneToManyOptions
) {
  return function (target: object, propertyKey: string | symbol): void {
    const sourceConstructor = target.constructor as GenericConstructor;

    scheduleRelationInitialization(() => {
      const targetConstructor = targetFactory();

      const sourceMetadata = ensureEntityMetadata(sourceConstructor);
      const targetMetadata = ensureEntityMetadata(targetConstructor);

      validateReferencedColumn(
        sourceMetadata,
        normalizeRelationJoinColumn(options.joinColumn),
        `${sourceConstructor.name}.${String(propertyKey)}`
      );

      addOrUpdateRelation(sourceMetadata, {
        kind: 'one-to-many',
        propertyName: propertyKey,
        target: targetConstructor,
        owner: false,
        inverseProperty: options.inverseProperty,
      });

      const targetJoinColumn = normalizeRelationJoinColumn(options.joinColumn);
      const nullable = targetJoinColumn.nullable;

      upsertColumn(targetMetadata, {
        name: targetJoinColumn.name,
        type: targetJoinColumn.type,
        nullable,
      });

      addOrUpdateRelation(targetMetadata, {
        kind: 'many-to-one',
        propertyName: options.inverseProperty ?? propertyKey,
        target: sourceConstructor,
        owner: true,
        joinColumn: targetJoinColumn,
        inverseProperty: propertyKey,
      });

      entityMetadata.set(sourceConstructor, sourceMetadata);
      entityMetadata.set(targetConstructor, targetMetadata);
    });
  };
}

export function ManyToOne(
  targetFactory: () => GenericConstructor,
  options: ManyToOneOptions
) {
  return function (target: object, propertyKey: string | symbol): void {
    const sourceConstructor = target.constructor as GenericConstructor;

    const sourceJoinColumn = normalizeRelationJoinColumn(options.joinColumn);

    upsertColumn(ensureEntityMetadata(sourceConstructor), {
      name: sourceJoinColumn.name,
      type: sourceJoinColumn.type,
      nullable: sourceJoinColumn.nullable,
    });

    scheduleRelationInitialization(() => {
      const targetConstructor = targetFactory();

      const sourceMetadata = ensureEntityMetadata(sourceConstructor);
      const targetMetadata = ensureEntityMetadata(targetConstructor);

      const nullable = sourceJoinColumn.nullable;

      addOrUpdateRelation(sourceMetadata, {
        kind: 'many-to-one',
        propertyName: propertyKey,
        target: targetConstructor,
        owner: true,
        joinColumn: sourceJoinColumn,
        inverseProperty: options.inverseProperty,
      });

      addOrUpdateRelation(targetMetadata, {
        kind: 'one-to-many',
        propertyName: options.inverseProperty ?? propertyKey,
        target: sourceConstructor,
        owner: false,
        inverseProperty: propertyKey,
      });

      entityMetadata.set(sourceConstructor, sourceMetadata);
      entityMetadata.set(targetConstructor, targetMetadata);
    });
  };
}

export function ManyToMany(
  targetFactory: () => GenericConstructor,
  options?: ManyToManyOptions
) {
  return function (target: object, propertyKey: string | symbol): void {
    const sourceConstructor = target.constructor as GenericConstructor;
    const inverseProperty = options?.inverseProperty;

    scheduleRelationInitialization(() => {
      const targetConstructor = targetFactory();

      const sourceMetadata = ensureEntityMetadata(sourceConstructor);
      const targetMetadata = ensureEntityMetadata(targetConstructor);

      const isOwner = Boolean(options?.joinTable);

      if (isOwner) {
        const joinTable = options!.joinTable!;

        const normalizedJoinColumn = normalizeRelationJoinColumn(
          joinTable.joinColumn
        );
        const normalizedInverseJoinColumn = normalizeRelationJoinColumn(
          joinTable.inverseJoinColumn
        );

        validateReferencedColumn(
          sourceMetadata,
          normalizedJoinColumn,
          `${sourceConstructor.name}.${String(propertyKey)}`
        );
        validateReferencedColumn(
          targetMetadata,
          normalizedInverseJoinColumn,
          `${sourceConstructor.name}.${String(propertyKey)}`
        );

        addOrUpdateRelation(sourceMetadata, {
          kind: 'many-to-many',
          propertyName: propertyKey,
          target: targetConstructor,
          owner: true,
          joinTable: {
            name: joinTable.name,
            joinColumn: normalizedJoinColumn,
            inverseJoinColumn: normalizedInverseJoinColumn,
          },
          inverseProperty,
        });

        const inversePropertyName = inverseProperty ?? propertyKey;
        addOrUpdateRelation(targetMetadata, {
          kind: 'many-to-many',
          propertyName: inversePropertyName,
          target: sourceConstructor,
          owner: false,
          inverseProperty: propertyKey,
        });
      } else {
        addOrUpdateRelation(sourceMetadata, {
          kind: 'many-to-many',
          propertyName: propertyKey,
          target: targetConstructor,
          owner: false,
          inverseProperty,
        });

        if (inverseProperty) {
          const ownerRelation = targetMetadata.relations.find(
            (relation) =>
              relation.kind === 'many-to-many' &&
              relation.propertyName === inverseProperty &&
              relation.owner
          );
          if (ownerRelation) {
            ownerRelation.inverseProperty = propertyKey;
          }
        }
      }

      entityMetadata.set(sourceConstructor, sourceMetadata);
      entityMetadata.set(targetConstructor, targetMetadata);
    });
  };
}

function normalizeRelationJoinColumn(
  config: ManyToManyJoinColumnOptions | JoinColumnConfig
): RelationJoinColumn {
  return {
    name: config.name,
    referencedColumn: config.referencedColumn,
    type: config.type,
    nullable: config.nullable ?? false,
    unique: config.unique,
  };
}

function validateReferencedColumn(
  metadata: EntityMetadata,
  joinColumn: RelationJoinColumn,
  relationDescription: string
): void {
  const referencedColumn = metadata.columns.find(
    (column) => column.name === joinColumn.referencedColumn
  );

  if (!referencedColumn) {
    console.warn(
      `${relationDescription} references missing column ${joinColumn.referencedColumn} on ${metadata.tableName}.`
    );
    return;
  }

  if (!referencedColumn.primary && !referencedColumn.unique) {
    console.warn(
      `${relationDescription} references ${metadata.tableName}.${joinColumn.referencedColumn} which is neither primary nor unique. Consider marking the column as unique to avoid duplicate relations.`
    );
  }
}
