import { Column, Entity, OneToMany, OneToOne, ManyToMany } from '@agh-design-patterns/pgorm';
import { Driver } from './driver';
import { Feature } from './feature';

@Entity('cars')
export class Car {
  @Column({ columnName: 'car_id', columnType: 'INTEGER', primary: true })
  id!: number;

  @Column({ columnName: 'model' })
  model!: string;

  @Column({ columnName: 'price', columnType: 'DOUBLE PRECISION' })
  price!: number;

  @Column({ columnName: 'is_available' })
  isAvailable!: boolean;

  @Column({
    columnName: 'discount',
    columnType: 'DOUBLE PRECISION',
    nullable: true,
  })
  discount!: number | null;

  @OneToMany(() => Driver, {
    joinColumn: {
      name: 'driver_car_id',
      referencedColumn: 'car_id',
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
        referencedColumn: 'car_id',
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
