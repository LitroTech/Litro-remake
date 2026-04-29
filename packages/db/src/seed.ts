import { createDb } from './index.js';
import * as schema from './schema/index.js';
import { crypto } from 'node:crypto';

async function seed() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const db = createDb(dbUrl);

  console.log('🌱 Seeding database...');

  // 1. Create a Store
  const [store] = await db.insert(schema.stores).values({
    name: 'Litro Test Store',
    accessCode: 'LITRO123',
    ownerTokenHash: 'placeholder-owner-token-hash',
    recoveryCodeHash: 'placeholder-recovery-hash',
    subscriptionTier: 'basic',
  }).returning();

  console.log(`✅ Created store: ${store.name} (${store.id})`);

  // 2. Create Staff Members
  const [owner, staff1] = await db.insert(schema.staffMembers).values([
    {
      storeId: store.id,
      name: 'Store Owner',
    },
    {
      storeId: store.id,
      name: 'Juana Dela Cruz',
    },
  ]).returning();

  console.log(`✅ Created staff: ${owner.name}, ${staff1.name}`);

  // 3. Create Products
  await db.insert(schema.products).values([
    {
      storeId: store.id,
      name: 'Coke 1.5L',
      price: '85.00',
      stockMode: 'numerical',
      quantity: 12,
      initialQuantity: 12,
    },
    {
      storeId: store.id,
      name: 'Piattos Large',
      price: '35.00',
      stockMode: 'numerical',
      quantity: 20,
      initialQuantity: 20,
    },
    {
      storeId: store.id,
      name: 'Egg (Medium)',
      price: '8.00',
      stockMode: 'numerical',
      quantity: 30,
      initialQuantity: 30,
    },
    {
      storeId: store.id,
      name: 'Rice (Sinandomeng)',
      price: '55.00',
      stockMode: 'descriptive',
      stockLevel: 'high',
    },
  ]);

  console.log('✅ Created initial products');

  // 4. Create a Credit Customer
  const [customer] = await db.insert(schema.creditCustomers).values({
    storeId: store.id,
    name: 'Mang Kanor',
    phone: '09123456789',
  }).returning();

  console.log(`✅ Created credit customer: ${customer.name}`);

  console.log('🚀 Seeding completed successfully!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
