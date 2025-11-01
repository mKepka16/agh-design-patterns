import { ensureEntityMetadata, entityMetadata } from '../entity-store';
import type { GenericConstructor } from '../types';

export function Entity(tableName?: string) {
  return function <T extends GenericConstructor>(constructor: T): void {
    const metadata = ensureEntityMetadata(constructor);
    metadata.tableName = tableName ?? constructor.name.toLowerCase();
    entityMetadata.set(constructor, metadata);
  };
}
