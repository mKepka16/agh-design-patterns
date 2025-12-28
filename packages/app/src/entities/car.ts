import { Column, Entity, OneToMany, OneToOne, ManyToMany } from '@agh-design-patterns/pgorm';
import { Driver } from './driver';
import { Feature } from './feature';
import { Vehicle } from './vehicle';

@Entity('cars')
export class Car extends Vehicle {
  @Column({
    columnName: 'discount',
    columnType: 'DOUBLE PRECISION',
    nullable: true,
  })
  discount!: number | null;

  @OneToMany(() => Driver, {
    joinColumn: {
      name: 'driver_car_id',
      referencedColumn: 'id',
      type: 'INTEGER',
    },
    inverseProperty: 'car',
  })
  drivers!: Driver[];

  @OneToOne(() => Driver, {
    joinColumn: {
      name: 'primary_driver_id',
      referencedColumn: 'driver_id',
      type: 'INTEGER',
      nullable: true,
    },
    inverseProperty: 'primaryCar',
  })
  primaryDriver!: Driver | null;

  @ManyToMany(() => Feature, {
    joinTable: {
      name: 'car_features',
      joinColumn: {
        name: 'join_table_car_id',
        referencedColumn: 'id',
        type: 'INTEGER',
      },
      inverseJoinColumn: {
        name: 'join_table_feature_id',
        referencedColumn: 'feature_id',
        type: 'INTEGER',
      },
    },
    inverseProperty: 'cars',
  })
  features!: Feature[];
}
