import { Column, Entity, OneToMany } from '@agh-design-patterns/pgorm';
import { Order } from './order';

@Entity('customers')
export class Customer {
  @Column({ columnName: 'customer_id', columnType: 'INTEGER', primary: true, autoIncrement: true })
  id!: number;

  @Column({ columnName: 'customer_name', columnType: 'TEXT' })
  name!: string;

  @OneToMany(() => Order, {
    joinColumn: { name: 'customer_id', referencedColumn: 'customer_id', type: 'INTEGER' },
    inverseProperty: 'customer',
  })
  orders!: Order[];
}
