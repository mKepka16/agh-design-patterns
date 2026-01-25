import { Entity, Column, ManyToOne } from '@agh-design-patterns/pgorm';
import { User } from './User';
import { Product } from './Product';

@Entity()
export class UserProduct {
  @Column({ columnType: 'TEXT', primary: true })
  id: string = crypto.randomUUID();

  @Column({ columnType: 'INTEGER' })
  quantity: number = 0;

  @ManyToOne(() => User, {
      joinColumn: { name: 'user_id', referencedColumn: 'id', type: 'TEXT' }
  })
  user!: User;

  @ManyToOne(() => Product, {
       joinColumn: { name: 'product_id', referencedColumn: 'id', type: 'TEXT' }
  })
  product!: Product;
}
