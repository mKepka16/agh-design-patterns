import { ensureEntityMetadata, entityMetadata } from '../entity-store';
import type { GenericConstructor } from '../types';

export function MappedSuperclass() {
  return function <T extends GenericConstructor>(constructor: T): void {
    const metadata = ensureEntityMetadata(constructor);
    metadata.isMappedSuperclass = true;
    entityMetadata.set(constructor, metadata);
  };
}
