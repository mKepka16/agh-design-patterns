import { ensureEntityMetadata, entityMetadata } from '../entity-store';
import type { GenericConstructor, InheritanceOptions } from '../types';
import { InheritanceType } from '../types';

export function Inheritance(options: InheritanceOptions = { strategy: InheritanceType.TABLE_PER_CLASS }) {
    return function <T extends GenericConstructor>(constructor: T): void {
        const metadata = ensureEntityMetadata(constructor);
        metadata.inheritanceStrategy = options.strategy;

        if (options.strategy === InheritanceType.SINGLE_TABLE) {
            metadata.discriminatorColumn = options.discriminatorColumn ?? 'type';
            metadata.stiChildColumns = [];
        }

        entityMetadata.set(constructor, metadata);
    };
}
