
import { Entity, Column, ManyToOne } from '@agh-design-patterns/pgorm';
import { User } from './User';
import { Upgrade } from './Upgrade';
import * as crypto from 'crypto';

@Entity()
export class UserUpgrade {
  @Column({ columnType: 'TEXT', primary: true })
  id: string = crypto.randomUUID();

  @ManyToOne(() => User, {
      joinColumn: { name: 'user_id', referencedColumn: 'id', type: 'TEXT' }
  })
  user!: User;

  @ManyToOne(() => Upgrade, {
       joinColumn: { name: 'upgrade_id', referencedColumn: 'id', type: 'TEXT' }
  })
  upgrade!: Upgrade;
}
