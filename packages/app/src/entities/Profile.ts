import { Entity, Column } from '@agh-design-patterns/pgorm';

@Entity()
export class Profile {
  @Column({ columnType: 'TEXT', primary: true, autoIncrement: false }) // Primary key needed for entity
  id: string = crypto.randomUUID();

  @Column({ columnType: 'TEXT' })
  bio: string = '';

  @Column({ columnType: 'TEXT' })
  themeColor: string = 'blue';
}
