import { Column, Entity, ManyToOne, OneToOne } from '@agh-design-patterns/pgorm';
import { Car } from './car';

@Entity('drivers')
export class Driver {
  @Column({ columnName: 'driver_id', columnType: 'INTEGER', primary: true })
  id!: number;

  @Column()
  fullName!: string;

  @Column({ columnName: 'experience_years', columnType: 'INTEGER' })
  yearsOfExperience!: number;

  @Column({ columnType: 'DOUBLE PRECISION' })
  rating!: number;

  @Column({ columnName: 'is_active' })
  isActive!: boolean;

  @Column({
    columnName: 'last_ride_rating',
    columnType: 'DOUBLE PRECISION',
    nullable: true,
  })
  lastRideRating!: number | null;

  @ManyToOne(() => Car, {
    joinColumn: {
      name: 'driver_car_id',
      referencedColumn: 'car_id',
      type: 'INTEGER',
    },
    inverseProperty: 'drivers',
  })
  car!: Car;

  @OneToOne(() => Car, {
    inverseProperty: 'primaryDriver',
  })
  primaryCar!: Car | null;
}
