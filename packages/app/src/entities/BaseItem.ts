import { Column, MappedSuperclass } from '@agh-design-patterns/pgorm';

@MappedSuperclass()
export class BaseItem {
  @Column({ columnType: 'TEXT', primary: true })
  id: string = crypto.randomUUID();

  @Column({ columnType: 'TEXT' })
  name: string = '';

  @Column({ columnType: 'INTEGER' })
  price: number = 0;

  @Column({ columnType: 'TEXT' })
  description: string = '';
}
