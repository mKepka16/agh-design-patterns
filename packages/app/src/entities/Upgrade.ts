import { Entity, Column } from '@agh-design-patterns/pgorm';
import { BaseItem } from './BaseItem';

@Entity()
export class Upgrade extends BaseItem {
  @Column({ columnType: 'DOUBLE PRECISION' })
  multiplier: number = 1.0;
}
