import { ensureEntityMetadata, entityMetadata } from '../entity-store';
import type { GenericConstructor } from '../types';

export function DiscriminatorValue(value: string) {
    return function <T extends GenericConstructor>(constructor: T): void {
        const metadata = ensureEntityMetadata(constructor);
        metadata.discriminatorValue = value;
        entityMetadata.set(constructor, metadata);
    };
}
