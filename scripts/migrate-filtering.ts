import postgres from 'postgres';
import 'dotenv/config';

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing');
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL);

  try {
    console.log('Running filtering feature migrations...');
    
    // Add parent_project_id to projects table
    console.log('Adding parent_project_id column to projects...');
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS parent_project_id text`;
    
    // Add emoji and icon to tags table
    console.log('Adding emoji and icon columns to tags...');
    await sql`ALTER TABLE tags ADD COLUMN IF NOT EXISTS emoji text`;
    await sql`ALTER TABLE tags ADD COLUMN IF NOT EXISTS icon text`;
    
    // Create project_groups table
    console.log('Creating project_groups table...');
    await sql`
      CREATE TABLE IF NOT EXISTS project_groups (
        id text PRIMARY KEY,
        name text NOT NULL,
        color text NOT NULL DEFAULT '#64748b',
        emoji text,
        icon text,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `;
    
    // Add filter preferences to settings table
    console.log('Adding filter preferences to settings...');
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS visible_projects text[] DEFAULT '{}'`;
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS visible_tags text[] DEFAULT '{}'`;
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS hidden_projects text[] DEFAULT '{}'`;
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS hidden_tags text[] DEFAULT '{}'`;

    console.log('Done! ✅');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await sql.end();
  }
}

run();

