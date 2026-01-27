import { Entity, Column } from '@agh-design-patterns/pgorm';
import { BaseItem } from './BaseItem';

@Entity()
export class Product extends BaseItem {
  @Column({ columnType: 'INTEGER' })
  incomePerClick: number = 0;

  @Column({ columnType: 'INTEGER' })
  incomePerSecond: number = 0;
}
