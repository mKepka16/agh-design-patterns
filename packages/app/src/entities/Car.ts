import { Entity, Column, DiscriminatorValue } from '@agh-design-patterns/pgorm';
import { Vehicle } from './Vehicle';

@Entity()
@DiscriminatorValue('car')
export class Car extends Vehicle {
    @Column({ columnType: 'INTEGER' })
    numberOfDoors: number = 4;

    @Column({ columnType: 'BOOLEAN' })
    hasAC: boolean = true;
}
