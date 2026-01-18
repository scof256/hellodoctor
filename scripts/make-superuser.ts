import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from '../src/server/db/schema';
import { eq } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL!;
console.log('Connecting to:', connectionString.substring(0, 30) + '...');
const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

const CLERK_ID = process.env.SUPERUSER_CLERK_ID || 'user_32qPDaWBoDU7Ygy8uF4DWut1c8z';

async function makeSuperuser() {
  console.log(`Looking for user with Clerk ID: ${CLERK_ID}`);
  
  const result = await db.select().from(users).where(eq(users.clerkId, CLERK_ID));
  const user = result[0];

  if (!user) {
    console.error('User not found in database. They may need to sign in first.');
    await client.end();
    process.exit(1);
  }

  console.log(`Found user: ${user.email} (current role: ${user.primaryRole})`);

  await db.update(users)
    .set({ primaryRole: 'super_admin' })
    .where(eq(users.id, user.id));

  console.log(`✅ User ${user.email} is now a super_admin!`);
  await client.end();
  process.exit(0);
}

makeSuperuser().catch(async (err) => {
  console.error('Error:', err);
  await client.end();
  process.exit(1);
});
