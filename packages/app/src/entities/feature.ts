import { Column, Entity, ManyToMany } from '@agh-design-patterns/pgorm';
import { Car } from './car';

@Entity('features')
export class Feature {
  @Column({ columnName: 'feature_id', columnType: 'INTEGER', primary: true })
  id!: number;

  @Column()
  name!: string;

  @ManyToMany(() => Car, { inverseProperty: 'features' })
  cars!: Car[];
}
