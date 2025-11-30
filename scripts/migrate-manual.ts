import postgres from 'postgres';
import 'dotenv/config';

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing');
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL);

  try {
    console.log('Running manual migrations...');
    
    // Add tags column
    console.log('Adding tags column...');
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS tags text[]`;
    
    // Add attachments column (JSONB for flexible metadata)
    console.log('Adding attachments column...');
    // We use text for simplicity in this setup as Drizzle generic JSON support varies by driver
    // But specific postgres driver supports jsonb. Let's use jsonb.
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb`;

    console.log('Done!');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await sql.end();
  }
}

run();

