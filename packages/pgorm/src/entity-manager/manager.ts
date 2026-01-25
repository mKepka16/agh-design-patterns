import { Pool } from 'pg';
import { Repository } from '../repository';
import { GenericConstructor } from '../types';

export class EntityManager {
    private repositories = new Map<GenericConstructor, Repository<any>>();

    constructor(private readonly pool: Pool) {}

    getRepository<T extends object>(target: GenericConstructor<T>): Repository<T> {
        let repository = this.repositories.get(target);
        if (!repository) {
            repository = new Repository<T>(this.pool, target);
            this.repositories.set(target, repository);
        }
        return repository;
    }
}