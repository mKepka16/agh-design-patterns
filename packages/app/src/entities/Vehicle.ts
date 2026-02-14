import { Entity, Column, Inheritance, InheritanceType } from '@agh-design-patterns/pgorm';

@Entity('vehicles')
@Inheritance({ strategy: InheritanceType.SINGLE_TABLE, discriminatorColumn: 'vehicle_type' })
export class Vehicle {
    @Column({ columnType: 'TEXT', primary: true })
    id: string = crypto.randomUUID();

    @Column({ columnType: 'TEXT' })
    brand: string = '';

    @Column({ columnType: 'INTEGER' })
    year: number = 2024;
}
