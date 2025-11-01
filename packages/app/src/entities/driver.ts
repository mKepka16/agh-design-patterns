import { Column, Entity, ManyToOne } from '@agh-design-patterns/pgorm';
import { Car } from './car';

@Entity('drivers')
export class Driver {
  @Column({ columnName: 'driver_id2', columnType: 'INTEGER', primary: true })
  id!: number;

  @Column({ columnName: 'full_name' })
  fullName!: string;

  @Column({ columnName: 'experience_years', columnType: 'INTEGER' })
  yearsOfExperience!: number;

  @Column({ columnName: 'driver_rating', columnType: 'DOUBLE PRECISION' })
  rating!: number;

  @Column({ columnName: 'is_active' })
  active!: boolean;

  @Column({
    columnName: 'last_ride_rating',
    columnType: 'DOUBLE PRECISION',
    nullable: true,
  })
  lastRideRating!: number | null;

  @ManyToOne(() => Car, {
    joinColumn: {
      name: 'car_id',
      referencedColumn: 'car_id',
      type: 'INTEGER',
    },
    inverseProperty: 'drivers',
  })
  car!: Car;

  @ManyToOne(() => Car, {
    joinColumn: {
      name: 'primary_car_id',
      referencedColumn: 'car_id',
      type: 'INTEGER',
      nullable: true,
    },
    inverseProperty: 'primaryDriver',
  })
  primaryCar!: Car | null;
}
