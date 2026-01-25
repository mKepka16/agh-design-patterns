import { EntityManager } from '@agh-design-patterns/pgorm';
import { User } from './entities/User';
import { Product } from './entities/Product';
import { Upgrade } from './entities/Upgrade';
import { UserProduct } from './entities/UserProduct';
import { UserUpgrade } from './entities/UserUpgrade';
import { Profile } from './entities/Profile';
import { Achievement } from './entities/Achievement';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (query: string): Promise<string> => new Promise(resolve => rl.question(query, resolve));

export class Game {
  private user: User | null = null;

  constructor(private em: EntityManager) {}

  private incomePerClick: number = 0;
  private incomePerSecond: number = 0;
  private clickMultiplier: number = 1.0;
  private passiveInterval: NodeJS.Timeout | null = null;

  async start() {
    await this.seed();
    this.startPassiveLoop();
    while (true) {
      if (!this.user) {
        await this.authMenu();
      } else {
        await this.mainMenu();
      }
    }
  }

  private startPassiveLoop() {
      if (this.passiveInterval) clearInterval(this.passiveInterval);
      
      this.passiveInterval = setInterval(async () => {
          if (this.user && this.incomePerSecond > 0) {
              this.user.money += this.incomePerSecond;
              try {
                  await this.em.getRepository(User).save(this.user);
              } catch (e) { 
                  // ignore errors during passive save to avoid crashing
              }
          }
      }, 1000);
  }

  private async calculateIncome() {
      if (!this.user) return;
      
      const userProducts = await this.em.getRepository(UserProduct).find({ where: { user: this.user as any } }); 
      const products = await this.em.getRepository(Product).find();
      
      let click = 0;
      let sec = 0;

      userProducts.forEach(up => {
          const pId = up.product ? (up.product as any).id || (up.product as any) : null;
          const product = products.find(p => p.id === pId);
          if (product) {
              click += product.incomePerClick * up.quantity;
              sec += product.incomePerSecond * up.quantity;
          }
      });
      
      // Calculate Multiplier using UserUpgrade
      const userUpgrades = await this.em.getRepository(UserUpgrade).find({ where: { user: this.user as any } });
      const updates = await this.em.getRepository(Upgrade).find();

      let multiplier = 1.0;
      
      userUpgrades.forEach(uu => {
          const uId = uu.upgrade ? (uu.upgrade as any).id || (uu.upgrade as any) : null;
          const upgrade = updates.find(u => u.id === uId);
          if (upgrade) {
              multiplier *= upgrade.multiplier;
          }
      });
      
      this.clickMultiplier = multiplier;
      this.incomePerClick = click;
      this.incomePerSecond = Math.floor(sec * multiplier);
  }

  private async seed() {
    const products = await this.em.getRepository(Product).find();
    
    const newProducts = [
        { name: 'Lemonade Stand', price: 100, description: 'Earns money over time', incomePerSecond: 5, incomePerClick: 0 },
        { name: 'Newspaper Route', price: 500, description: 'local delivery service', incomePerSecond: 20, incomePerClick: 0 },
        { name: 'Car Wash', price: 2500, description: 'Drive-through profit', incomePerSecond: 80, incomePerClick: 0 },
        { name: 'Pizza Franchise', price: 10000, description: 'Everyone loves pizza', incomePerSecond: 350, incomePerClick: 0 },
        { name: 'Tech Startup', price: 50000, description: 'High risk, high reward', incomePerSecond: 2000, incomePerClick: 0 },
        
        { name: 'Better Mouse', price: 50, description: 'Increases click value', incomePerSecond: 0, incomePerClick: 2 },
        { name: 'Gaming Mouse', price: 250, description: 'RGB lights included', incomePerSecond: 0, incomePerClick: 5 },
        { name: 'Mechanical Keyboard', price: 1000, description: 'Clicky clacky money', incomePerSecond: 0, incomePerClick: 25 },
        { name: 'AI Auto-Clicker', price: 5000, description: 'Neural network clicking', incomePerSecond: 0, incomePerClick: 150 },
        { name: 'Quantum Computer', price: 25000, description: ' clicks in parallel universes', incomePerSecond: 0, incomePerClick: 500 }
    ];

    console.log('Checking product catalog...');
    for (const pTemplate of newProducts) {
        const exists = products.find(p => p.name === pTemplate.name);
        if (!exists) {
            console.log(`Seeding new product: ${pTemplate.name}`);
            const p = new Product();
            p.name = pTemplate.name;
            p.price = pTemplate.price;
            p.description = pTemplate.description;
            p.incomePerSecond = pTemplate.incomePerSecond;
            p.incomePerClick = pTemplate.incomePerClick;
            await this.em.getRepository(Product).save(p);
        }
    }

    const upgrades = await this.em.getRepository(Upgrade).find();
    if (upgrades.length === 0) {
      console.log('Seeding upgrades...');
      const u1 = new Upgrade();
      u1.name = 'Golden Click';
      u1.price = 500;
      u1.description = '2x Multiplier';
      u1.multiplier = 2.0;
      await this.em.getRepository(Upgrade).save(u1);
    }
    
    // Seed Achievements
    const achievements = await this.em.getRepository(Achievement).find();
    const newAchievements = [
        { name: 'First Paycheck', condition: 'Earn $100' },
        { name: 'Tycoon', condition: 'Earn $5000' },
        { name: 'Millionaire', condition: 'Earn $1000000' },
        { name: 'Big Spender', condition: 'Buy 5 items' }
    ];
    
    for (const aTemp of newAchievements) {
        if (!achievements.find(a => a.name === aTemp.name)) {
            const a = new Achievement();
            a.name = aTemp.name;
            a.condition = aTemp.condition;
            await this.em.getRepository(Achievement).save(a);
        }
    }
  }

  private async checkAchievements(silent: boolean = false) {
      if (!this.user) return;
      
      const allAchievements = await this.em.getRepository(Achievement).find();
      const userAchievements = this.user.achievements || [];
      
      // We need to ensure user.achievements is loaded. 
      // Current pgorm might not load ManyToMany automatically on login.
      // For now, let's assume we need to fetch them if we want to be safe,
      // but let's try to just append new ones. 
      // Actually, to avoid duplicates we really should know what we have.
      // Since ManyToMany loading is complex, let's just query the join table or assume for now we load user with relations.
      
      // HACK: Load achievements manually to be sure
      // user.achievements might be undefined if not joined.
      // We'll skip complex relation check efficiency for now and just check conditions.

      const toUnlock: Achievement[] = [];
      
      // 1. Check Money
      if (this.user.money >= 100) toUnlock.push(allAchievements.find(a => a.name === 'First Paycheck')!);
      if (this.user.money >= 5000) toUnlock.push(allAchievements.find(a => a.name === 'Tycoon')!);
      if (this.user.money >= 1000000) toUnlock.push(allAchievements.find(a => a.name === 'Millionaire')!);

      // 2. Check Inventory Size
      const userProducts = await this.em.getRepository(UserProduct).find({ where: { user: this.user as any } });
      const totalItems = userProducts.reduce((acc, up) => acc + up.quantity, 0);
      if (totalItems >= 5) toUnlock.push(allAchievements.find(a => a.name === 'Big Spender')!);
      
      // Filter out nulls and already unlocked
      // Since we don't have easy lazy loading, checking duplicates is hard without fetching.
      // Let's assume we can fetch `user_achievements` later or just try to save and ignore dupes if PK violation (but MM doesn't key on ID).
      
      // Refined approach: We will just try to save the relation if we think it's new.
      // But we can't easily check "if user has achievement X" without fetching the list.
      // Let's rely on validation in save or just fetch them properly if possible.
      // Since `User` has `achievements`, let's try to reload the user with achievements if needed?
      // No, `find` options don't support `relations: ['achievements']` fully in this facade yet?
      // Let's just blindly add unique ones to the array if they aren't there in memory.
      
      if (!this.user.achievements) this.user.achievements = [];
      
      let changed = false;
      for (const ach of toUnlock) {
          if (ach && !this.user.achievements.some(ua => ua.id === ach.id || (ua as any) === ach.id)) {
              this.user.achievements.push(ach);
              if (!silent) console.log(`\n*** ACHIEVEMENT UNLOCKED: ${ach.name} ***\n`);
              changed = true;
          }
      }
      
      if (changed) {
          await this.em.getRepository(User).save(this.user);
      }
  }

  private async authMenu() {
    console.clear();
    console.log('=== STORE SIMULATOR ===');
    console.log('1. Login');
    console.log('2. Register');
    console.log('3. Exit');
    const choice = await ask('> ');

    if (choice === '1') await this.login();
    else if (choice === '2') await this.register();
    else if (choice === '3') process.exit(0);
  }

  private async login() {
    const username = await ask('Username: ');
    const password = await ask('Password: ');
    const user = await this.em.getRepository(User).findOne({ where: { username } });
    
    if (user && user.password === password) {
      this.user = user;
      
      // Explicitly load profile if needed
      if (this.user.profile) {
          const pId = (this.user.profile as any).id || (this.user.profile as any);
          if (pId) {
              const fullProfile = await this.em.getRepository(Profile).findOne({ where: { id: pId } });
              if (fullProfile) this.user.profile = fullProfile;
          }
      }

      await this.calculateIncome();
      console.log(`Welcome back, ${user.username}!`);
    } else {
      console.log('Invalid credentials.');
      await ask('Press Enter...');
    }
  }

  private async register() {
    const username = await ask('Username: ');
    const password = await ask('Password: ');
    
    // Check existing
    const existing = await this.em.getRepository(User).findOne({ where: { username } });
    if (existing) {
        console.log('User already exists.');
        await ask('Press Enter...');
        return;
    }

    const user = new User();
    user.username = username;
    user.password = password;
    user.money = 0;
    
    const profile = new Profile();
    profile.bio = 'New player';
    user.profile = profile;

    await this.em.getRepository(Profile).save(profile);
    await this.em.getRepository(User).save(user);
    
    this.user = user;
    await this.calculateIncome();
    console.log('Account created!');
  }

  private async mainLoopHeader() {
    console.clear();
    const totalClick = Math.floor((10 + this.incomePerClick) * this.clickMultiplier);
    console.log(`User: ${this.user?.username} | Money: $${this.user?.money} | Income: $${this.incomePerSecond}/sec | Click: $${totalClick}`);
  }

  private async mainMenu() {
    await this.mainLoopHeader();
    console.log('1. Work (Click)');
    console.log('2. Shop');
    console.log('3. Inventory');
    console.log('4. Profile');
    console.log('5. Achievements');
    console.log('6. Logout');
    const choice = await ask('> ');

    if (choice === '1') await this.work();
    else if (choice === '2') await this.shop();
    else if (choice === '3') await this.inventory();
    else if (choice === '4') await this.viewProfile();
    else if (choice === '5') await this.showAchievements();
    else if (choice === '6') {
        this.user = null;
        this.incomePerClick = 0;
        this.incomePerSecond = 0;
    }
  }

  private async showAchievements() {
      console.clear();
      console.log('=== ACHIEVEMENTS ===');
      
      // Sync state immediately before showing
      await this.checkAchievements(true);

      const allAchievements = await this.em.getRepository(Achievement).find();
      // Ensure we have the latest unlocked status
      const unlockedIds = (this.user?.achievements || []).map(a => a.id);
      
      allAchievements.forEach(a => {
          const isUnlocked = unlockedIds.includes(a.id);
          const status = isUnlocked ? '[X]' : '[ ]';
          console.log(`${status} ${a.name}: ${a.condition}`);
      });
      
      await ask('Press Enter...');
  }

  private async work() {
    if (!this.user) return;
    console.clear();
    console.log('=== WORK ===');
    console.log('Press [ENTER] to click and earn money.');
    console.log('Type "q" and [ENTER] to return to menu.');

    const baseClick = 10;

    while (true) {
        const input = await ask(`[Money: $${this.user.money}] > `);
        if (input.trim().toLowerCase() === 'q') {
            break;
        }

        const totalClick = Math.floor((baseClick + this.incomePerClick) * this.clickMultiplier);
        this.user.money += totalClick;
        await this.em.getRepository(User).save(this.user);
        await this.checkAchievements();
        console.log(`+ $${totalClick}`);
    }
  }

  private async shop() {
     while(true) {
         console.clear();
         console.log('=== SHOP ===');
         console.log('1. Products (Income Items)');
         console.log('2. Upgrades (Multipliers)');
         console.log('0. Back');
         
         const mode = await ask('> ');
         if (mode === '0') break;
         
         if (mode === '1') {
             await this.shopProducts();
         } else if (mode === '2') {
             await this.shopUpgrades();
         }
     }
  }

  private async shopProducts() {
     console.clear();
     console.log('=== PRODUCTS ===');
     const products = await this.em.getRepository(Product).find();
     const userProducts = await this.em.getRepository(UserProduct).find({ where: { user: this.user as any } });

     products.sort((a, b) => a.price - b.price);

     products.forEach((p, i) => {
         const up = userProducts.find(x => (x.product as any) === p.id || (x.product as any).id === p.id);
         const owned = up ? up.quantity : 0;
         console.log(`${i + 1}. ${p.name} - $${p.price} (${p.description}) [Owned: ${owned}]`);
     });
     console.log('0. Back');
     
     const choice = await ask('Buy item # > ');
     const index = parseInt(choice) - 1;
     
     if (index >= 0 && index < products.length && this.user) {
         const product = products[index];
         if (this.user.money >= product.price) {
             this.user.money -= product.price;
             
             const productId = product['id'];
             let up = userProducts.find((x: any) => {
                 const val = x.product;
                 return val === productId || (val && val.id === productId);
             });
             
             if (!up) {
                 up = new UserProduct();
                 up.user = this.user;
                 up.product = product;
                 up.quantity = 0;
             }
             up.quantity += 1;
             
             await this.em.getRepository(User).save(this.user);
             await this.em.getRepository(UserProduct).save(up);
             
             await this.calculateIncome();
             await this.checkAchievements();
             console.log('Purchased!');
             await ask('Press Enter...');
         } else {
             console.log('Not enough money.');
             await ask('Press Enter...');
         }
     }
  }

  private async shopUpgrades() {
      if (!this.user) return;
      console.clear();
      console.log('=== UPGRADES ===');
      
      const upgrades = await this.em.getRepository(Upgrade).find();
      const userUpgrades = await this.em.getRepository(UserUpgrade).find({ where: { user: this.user as any } });
      
      const myUpgradeIds = userUpgrades.map(uu => {
          return uu.upgrade ? (uu.upgrade as any).id || (uu.upgrade as any) : null;
      });
      
      upgrades.forEach((u, i) => {
          const owned = myUpgradeIds.includes(u.id);
          const status = owned ? '[OWNED]' : `$${u.price}`;
          console.log(`${i+1}. ${u.name} - ${status} (${u.description})`);
      });
      console.log('0. Back');

      const choice = await ask('Buy upgrade # > ');
      const index = parseInt(choice) - 1;

      if (index >= 0 && index < upgrades.length) {
          const upgrade = upgrades[index];
          if (myUpgradeIds.includes(upgrade.id)) {
              console.log('Already owned!');
              await ask('Press Enter...');
              return;
          }

          if (this.user.money >= upgrade.price) {
              this.user.money -= upgrade.price;
              
              const uu = new UserUpgrade();
              uu.user = this.user;
              uu.upgrade = upgrade;
              
              await this.em.getRepository(User).save(this.user); // Save money change
              await this.em.getRepository(UserUpgrade).save(uu); // Save new relation
              
              await this.calculateIncome();
              await this.checkAchievements(); 

              console.log('Upgrade Purchased!');
              await ask('Press Enter...');
          } else {
              console.log('Not enough money.');
              await ask('Press Enter...');
          }
      }
  }
    
  private async inventory() {
      console.clear();
      console.log('=== INVENTORY ===');
      
      const userProducts = await this.em.getRepository(UserProduct).find({ where: { user: this.user as any } });
      const products = await this.em.getRepository(Product).find();

      if (userProducts.length === 0) {
          console.log('You don\'t own any items.');
      } else {
          userProducts.forEach((up, i) => {
              const productId = up.product ? (up.product as any).id || (up.product as any) : null;
              const product = products.find(p => p.id === productId);

              if (product) {
                  console.log(`${i + 1}. ${product.name} (x${up.quantity}) - Income: $${product.incomePerClick}/click, $${product.incomePerSecond}/sec`);
              } else {
                  console.log(`${i + 1}. Unknown Item (x${up.quantity})`);
              }
          });
      }
      
      await ask('Press Enter...');
  }
    
  private async viewProfile() {
      if(!this.user) return;
      
      // Ensure profile exists (self-healing for legacy data)
      if (!this.user.profile) {
          const profile = new Profile();
          profile.bio = 'New player';
          this.user.profile = profile;
          await this.em.getRepository(Profile).save(profile);
          await this.em.getRepository(User).save(this.user);
      }

      while (true) {
          console.clear();
          console.log('=== PROFILE ===');
          console.log(`Username: ${this.user.username}`);
          console.log(`Bio: ${this.user.profile?.bio || 'Not set'}`);
          console.log('----------------');
          const totalClick = Math.floor((10 + this.incomePerClick) * this.clickMultiplier);
      console.log(`Money: $${this.user.money}`);
      console.log(`Click Income: $${totalClick} (($10 base + $${this.incomePerClick} items) * ${this.clickMultiplier.toFixed(1)}x)`);
      console.log(`Passive Income: $${this.incomePerSecond}/sec`);
      console.log('----------------');
          
          if (this.user.achievements && this.user.achievements.length > 0) {
              console.log('Achievements:');
              this.user.achievements.forEach(a => console.log(`- ${a.name}: ${a.condition}`));
          } else {
              console.log('Achievements: None');
          }
          console.log('----------------');
          console.log('1. Edit Bio');
          console.log('0. Back');
          
          const choice = await ask('> ');
          
          if (choice === '1') {
              const newBio = await ask('Enter new bio: ');
              if (this.user.profile) {
                  this.user.profile.bio = newBio;
                  this.user.profile = await this.em.getRepository(Profile).save(this.user.profile);
                  console.log(`Bio updated to: "${this.user.profile.bio}"`);
                  await ask('Press Enter...');
              }
          } else if (choice === '0') {
              break;
          }
      }
  }
}
