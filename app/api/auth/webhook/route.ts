import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { db } from '@/server/db';
import { users, doctors, patients } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  // Get the webhook secret from environment variables
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET is not set');
    return new Response('Webhook secret not configured', { status: 500 });
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Missing svix headers', { status: 400 });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  // Handle the webhook event
  const eventType = evt.type;

  try {
    switch (eventType) {
      case 'user.created':
        await handleUserCreated(evt.data);
        break;
      case 'user.updated':
        await handleUserUpdated(evt.data);
        break;
      case 'user.deleted':
        await handleUserDeleted(evt.data);
        break;
      default:
        console.log(`Unhandled webhook event type: ${eventType}`);
    }

    return new Response('Webhook processed successfully', { status: 200 });
  } catch (error) {
    console.error(`Error processing webhook ${eventType}:`, error);
    return new Response('Error processing webhook', { status: 500 });
  }
}


// Handle user.created event
// Note: This creates a basic user record. Full onboarding (role selection) happens via the onboarding page.
async function handleUserCreated(data: WebhookEvent['data'] & { id: string }) {
  const { id, email_addresses, first_name, last_name, image_url } = data as {
    id: string;
    email_addresses: Array<{ email_address: string }>;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  };

  const primaryEmail = email_addresses?.[0]?.email_address;

  if (!primaryEmail) {
    console.error('No email address found for user:', id);
    return;
  }

  // Check if user already exists (might have been created via onboarding)
  const existingUser = await db.query.users.findFirst({
    where: eq(users.clerkId, id),
  });

  if (existingUser) {
    console.log('User already exists in database:', id);
    return;
  }

  // Create a basic user record with patient role as default
  // The actual role will be set during onboarding
  await db.insert(users).values({
    clerkId: id,
    email: primaryEmail,
    firstName: first_name,
    lastName: last_name,
    imageUrl: image_url,
    primaryRole: 'patient', // Default role, will be updated during onboarding
    isActive: true,
  });

  console.log('User created via webhook:', id);
}

// Handle user.updated event
async function handleUserUpdated(data: WebhookEvent['data'] & { id: string }) {
  const { id, email_addresses, first_name, last_name, image_url } = data as {
    id: string;
    email_addresses: Array<{ email_address: string }>;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  };

  const primaryEmail = email_addresses?.[0]?.email_address;

  // Find the user in our database
  const existingUser = await db.query.users.findFirst({
    where: eq(users.clerkId, id),
  });

  if (!existingUser) {
    console.log('User not found in database for update:', id);
    // User might not have completed onboarding yet, create them
    if (primaryEmail) {
      await db.insert(users).values({
        clerkId: id,
        email: primaryEmail,
        firstName: first_name,
        lastName: last_name,
        imageUrl: image_url,
        primaryRole: 'patient',
        isActive: true,
      });
      console.log('User created during update webhook:', id);
    }
    return;
  }

  // Update user data
  await db.update(users)
    .set({
      email: primaryEmail || existingUser.email,
      firstName: first_name,
      lastName: last_name,
      imageUrl: image_url,
      updatedAt: new Date(),
    })
    .where(eq(users.clerkId, id));

  console.log('User updated via webhook:', id);
}

// Handle user.deleted event
async function handleUserDeleted(data: WebhookEvent['data'] & { id?: string }) {
  const { id } = data;

  if (!id) {
    console.error('No user ID provided for deletion');
    return;
  }

  // Find the user
  const existingUser = await db.query.users.findFirst({
    where: eq(users.clerkId, id),
  });

  if (!existingUser) {
    console.log('User not found in database for deletion:', id);
    return;
  }

  // Soft delete: mark user as inactive instead of hard delete
  // This preserves data integrity for related records (appointments, messages, etc.)
  await db.update(users)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(users.clerkId, id));

  console.log('User soft-deleted via webhook:', id);
}
