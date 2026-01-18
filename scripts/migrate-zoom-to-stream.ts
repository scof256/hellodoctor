/**
 * Migration Script: Zoom to Stream Video Integration
 * 
 * This script migrates existing appointments with Zoom meeting data to Stream Video format.
 * It preserves all existing appointment relationships and metadata while transforming
 * Zoom-specific fields to Stream equivalents.
 * 
 * Requirements: 6.4, 6.5
 * - Maintains all existing appointment metadata and database relationships
 * - Handles data transformation from Zoom to Stream format
 * 
 * Usage: npx tsx scripts/migrate-zoom-to-stream.ts [--dry-run] [--verbose]
 * 
 * Options:
 *   --dry-run   Preview changes without modifying the database
 *   --verbose   Show detailed logging for each appointment
 */

import postgres from "postgres";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL!;

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

interface ZoomAppointment {
  id: string;
  connection_id: string;
  scheduled_at: Date;
  duration: number;
  is_online: boolean;
  zoom_meeting_id: string | null;
  zoom_join_url: string | null;
  zoom_start_url: string | null;
  zoom_created_at: Date | null;
  stream_call_id: string | null;
  stream_join_url: string | null;
  stream_created_at: Date | null;
  stream_metadata: Record<string, unknown> | null;
  status: string;
}

interface MigrationResult {
  appointmentId: string;
  zoomMeetingId: string | null;
  streamCallId: string;
  streamJoinUrl: string;
  success: boolean;
  error?: string;
}

interface MigrationSummary {
  totalAppointments: number;
  appointmentsWithZoom: number;
  appointmentsAlreadyMigrated: number;
  appointmentsMigrated: number;
  appointmentsFailed: number;
  results: MigrationResult[];
}

/**
 * Generates a Stream call ID from an appointment ID
 * Follows the same pattern used in stream.ts service
 */
function generateStreamCallId(appointmentId: string): string {
  return `appointment_${appointmentId}`;
}

/**
 * Generates a Stream join URL from an appointment ID
 * Uses the same URL pattern as the Stream service
 */
function generateStreamJoinUrl(appointmentId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/meeting/${appointmentId}`;
}

/**
 * Creates Stream metadata from existing appointment data
 * Preserves appointment type and duration information
 */
function createStreamMetadata(appointment: ZoomAppointment): Record<string, unknown> {
  return {
    appointmentType: 'consultation',
    duration: appointment.duration,
    migratedFromZoom: true,
    originalZoomMeetingId: appointment.zoom_meeting_id,
    migrationDate: new Date().toISOString(),
  };
}

/**
 * Checks if an appointment needs migration
 * Returns true if it has Zoom data but no Stream data
 */
function needsMigration(appointment: ZoomAppointment): boolean {
  // Has Zoom data
  const hasZoomData = appointment.zoom_meeting_id !== null || 
                      appointment.zoom_join_url !== null ||
                      appointment.is_online;
  
  // Doesn't have Stream data yet
  const hasStreamData = appointment.stream_call_id !== null;
  
  return hasZoomData && !hasStreamData;
}

/**
 * Checks if an appointment was already migrated
 */
function isAlreadyMigrated(appointment: ZoomAppointment): boolean {
  return appointment.stream_call_id !== null && 
         appointment.stream_metadata !== null &&
         (appointment.stream_metadata as Record<string, unknown>)?.migratedFromZoom === true;
}

async function migrateZoomToStream(): Promise<MigrationSummary> {
  const sql = postgres(connectionString, { prepare: false });
  
  console.log('='.repeat(60));
  console.log('Zoom to Stream Video Migration');
  console.log('='.repeat(60));
  
  if (isDryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made to the database\n');
  }
  
  const summary: MigrationSummary = {
    totalAppointments: 0,
    appointmentsWithZoom: 0,
    appointmentsAlreadyMigrated: 0,
    appointmentsMigrated: 0,
    appointmentsFailed: 0,
    results: [],
  };

  try {
    // Fetch all appointments with their current data
    console.log('Fetching appointments from database...');
    
    const appointments = await sql<ZoomAppointment[]>`
      SELECT 
        id,
        connection_id,
        scheduled_at,
        duration,
        is_online,
        zoom_meeting_id,
        zoom_join_url,
        zoom_start_url,
        zoom_created_at,
        stream_call_id,
        stream_join_url,
        stream_created_at,
        stream_metadata,
        status
      FROM appointments
      ORDER BY created_at DESC
    `;

    summary.totalAppointments = appointments.length;
    console.log(`Found ${appointments.length} total appointments`);

    // Filter appointments that need migration
    const appointmentsToMigrate: ZoomAppointment[] = [];
    
    for (const appointment of appointments) {
      if (isAlreadyMigrated(appointment)) {
        summary.appointmentsAlreadyMigrated++;
        if (isVerbose) {
          console.log(`  ⏭️  Skipping ${appointment.id} - already migrated`);
        }
      } else if (needsMigration(appointment)) {
        summary.appointmentsWithZoom++;
        appointmentsToMigrate.push(appointment);
        if (isVerbose) {
          console.log(`  📋 Will migrate ${appointment.id} (Zoom ID: ${appointment.zoom_meeting_id || 'N/A'})`);
        }
      }
    }

    console.log(`\nMigration candidates: ${appointmentsToMigrate.length}`);
    console.log(`Already migrated: ${summary.appointmentsAlreadyMigrated}`);
    console.log(`No Zoom data: ${summary.totalAppointments - summary.appointmentsWithZoom - summary.appointmentsAlreadyMigrated}`);

    if (appointmentsToMigrate.length === 0) {
      console.log('\n✅ No appointments need migration');
      await sql.end();
      return summary;
    }

    console.log('\n' + '-'.repeat(60));
    console.log('Starting migration...');
    console.log('-'.repeat(60) + '\n');

    // Migrate each appointment
    for (const appointment of appointmentsToMigrate) {
      const result: MigrationResult = {
        appointmentId: appointment.id,
        zoomMeetingId: appointment.zoom_meeting_id,
        streamCallId: generateStreamCallId(appointment.id),
        streamJoinUrl: generateStreamJoinUrl(appointment.id),
        success: false,
      };

      try {
        const streamMetadata = createStreamMetadata(appointment);

        if (isVerbose) {
          console.log(`\nMigrating appointment: ${appointment.id}`);
          console.log(`  Zoom Meeting ID: ${appointment.zoom_meeting_id || 'N/A'}`);
          console.log(`  Zoom Join URL: ${appointment.zoom_join_url || 'N/A'}`);
          console.log(`  → Stream Call ID: ${result.streamCallId}`);
          console.log(`  → Stream Join URL: ${result.streamJoinUrl}`);
        }

        if (!isDryRun) {
          // Update the appointment with Stream data
          await sql`
            UPDATE appointments
            SET 
              stream_call_id = ${result.streamCallId},
              stream_join_url = ${result.streamJoinUrl},
              stream_created_at = NOW(),
              stream_metadata = ${JSON.stringify(streamMetadata)}::jsonb,
              updated_at = NOW()
            WHERE id = ${appointment.id}::uuid
          `;
        }

        result.success = true;
        summary.appointmentsMigrated++;
        
        if (isVerbose) {
          console.log(`  ✅ ${isDryRun ? 'Would migrate' : 'Migrated'} successfully`);
        } else {
          process.stdout.write('.');
        }
      } catch (error) {
        result.success = false;
        result.error = error instanceof Error ? error.message : String(error);
        summary.appointmentsFailed++;
        
        console.error(`\n  ❌ Failed to migrate ${appointment.id}: ${result.error}`);
      }

      summary.results.push(result);
    }

    if (!isVerbose && appointmentsToMigrate.length > 0) {
      console.log('\n');
    }

  } catch (error) {
    console.error('\n❌ Migration failed with error:', error);
    throw error;
  } finally {
    await sql.end();
  }

  return summary;
}

function printSummary(summary: MigrationSummary): void {
  console.log('\n' + '='.repeat(60));
  console.log('Migration Summary');
  console.log('='.repeat(60));
  console.log(`Total appointments:        ${summary.totalAppointments}`);
  console.log(`With Zoom data:            ${summary.appointmentsWithZoom}`);
  console.log(`Already migrated:          ${summary.appointmentsAlreadyMigrated}`);
  console.log(`Successfully migrated:     ${summary.appointmentsMigrated}`);
  console.log(`Failed:                    ${summary.appointmentsFailed}`);
  console.log('='.repeat(60));

  if (summary.appointmentsFailed > 0) {
    console.log('\nFailed migrations:');
    for (const result of summary.results.filter(r => !r.success)) {
      console.log(`  - ${result.appointmentId}: ${result.error}`);
    }
  }

  if (isDryRun) {
    console.log('\n🔍 This was a dry run. Run without --dry-run to apply changes.');
  } else if (summary.appointmentsMigrated > 0) {
    console.log('\n✅ Migration completed successfully!');
  }
}

// Main execution
migrateZoomToStream()
  .then(printSummary)
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
