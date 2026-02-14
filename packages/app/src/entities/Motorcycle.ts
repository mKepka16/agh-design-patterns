import { Entity, Column, DiscriminatorValue } from '@agh-design-patterns/pgorm';
import { Vehicle } from './Vehicle';

@Entity()
@DiscriminatorValue('motorcycle')
export class Motorcycle extends Vehicle {
    @Column({ columnType: 'BOOLEAN' })
    hasSidecar: boolean = false;
}
