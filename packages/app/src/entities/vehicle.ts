import { Column, MappedSuperclass } from '@agh-design-patterns/pgorm';

@MappedSuperclass()
export class Vehicle {
  @Column({ columnName: 'id', columnType: 'INTEGER', primary: true })
  id!: number;

  @Column({ columnName: 'model' })
  model!: string;

  @Column({ columnName: 'price', columnType: 'DOUBLE PRECISION' })
  price!: number;

  @Column({ columnName: 'is_available' })
  isAvailable!: boolean;
}
