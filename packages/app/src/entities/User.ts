import { Entity, Column, OneToOne, OneToMany, ManyToMany } from '@agh-design-patterns/pgorm';
import { Profile } from './Profile';
import { UserProduct } from './UserProduct';
import { Achievement } from './Achievement';
import { Upgrade } from './Upgrade';
import { UserUpgrade } from './UserUpgrade';

@Entity()
export class User {
  @Column({ columnType: 'TEXT', primary: true })
  id: string = crypto.randomUUID();

  @Column({ columnType: 'TEXT' })
  username: string = '';

  @Column({ columnType: 'TEXT' })
  password: string = '';

  @Column({ columnType: 'INTEGER' })
  money: number = 0;

  @OneToOne(() => Profile, {
      joinColumn: { name: 'profile_id', referencedColumn: 'id', type: 'TEXT' }
  })
  profile!: Profile;

  @OneToMany(() => UserProduct, {
      joinColumn: { name: 'user_id', referencedColumn: 'id', type: 'TEXT' },
      inverseProperty: 'user'
  })
  inventory!: UserProduct[];

  @ManyToMany(() => Achievement, {
      joinTable: {
          name: 'user_achievements',
          joinColumn: { name: 'user_id', referencedColumn: 'id', type: 'TEXT' },
          inverseJoinColumn: { name: 'achievement_id', referencedColumn: 'id', type: 'TEXT' }
      }
  })
  achievements!: Achievement[];

  @OneToMany(() => UserUpgrade, {
      joinColumn: { name: 'user_id', referencedColumn: 'id', type: 'TEXT' },
      inverseProperty: 'user'
  })
  userUpgrades!: UserUpgrade[];
}
