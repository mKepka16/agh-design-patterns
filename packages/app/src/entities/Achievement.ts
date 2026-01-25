import { Entity, Column } from '@agh-design-patterns/pgorm';

@Entity()
export class Achievement {
  @Column({ columnType: 'TEXT', primary: true }) // Need ID
  id: string = crypto.randomUUID();

  @Column({ columnType: 'TEXT' })
  name: string = '';

  @Column({ columnType: 'TEXT' })
  condition: string = '';
}
