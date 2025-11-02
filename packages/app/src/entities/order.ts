import { Column, Entity, ManyToOne } from '@agh-design-patterns/pgorm';
import { Customer } from './customer';

@Entity('orders')
export class Order {
  @Column({ columnName: 'order_id', columnType: 'INTEGER', primary: true, autoIncrement: true })
  id!: number;

  @Column({ columnName: 'description', columnType: 'TEXT', nullable: true })
  description!: string | null;

  @ManyToOne(() => Customer, {
    joinColumn: { name: 'customer_id', referencedColumn: 'customer_id', type: 'INTEGER' },
    inverseProperty: 'orders',
  })
  customer!: Customer;
}
