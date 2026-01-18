import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { doctors, users } from '../src/server/db/schema';
import { eq } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL!;
console.log('Connecting to database...');
const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

// Get slug from command line argument or use default
const DOCTOR_SLUG = process.argv[2] || 'luzige-kizito-to294zits';

async function verifyDoctor() {
  console.log(`Looking for doctor with slug: ${DOCTOR_SLUG}`);
  
  const doctor = await db.query.doctors.findFirst({
    where: eq(doctors.slug, DOCTOR_SLUG),
  });

  if (!doctor) {
    console.error('Doctor not found with that slug.');
    await client.end();
    process.exit(1);
  }

  // Get user info
  const user = await db.query.users.findFirst({
    where: eq(users.id, doctor.userId),
  });

  console.log(`Found doctor: ${user?.firstName} ${user?.lastName}`);
  console.log(`Current verification status: ${doctor.verificationStatus}`);

  if (doctor.verificationStatus === 'verified') {
    console.log('Doctor is already verified!');
    await client.end();
    process.exit(0);
  }

  // Update verification status
  await db.update(doctors)
    .set({ 
      verificationStatus: 'verified',
      verifiedAt: new Date(),
    })
    .where(eq(doctors.id, doctor.id));

  console.log(`✅ Doctor ${user?.firstName} ${user?.lastName} is now verified!`);
  console.log(`Patients can now connect via: /connect/${DOCTOR_SLUG}`);
  await client.end();
  process.exit(0);
}

verifyDoctor().catch(async (err) => {
  console.error('Error:', err);
  await client.end();
  process.exit(1);
});
