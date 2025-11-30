import postgres from 'postgres';
import 'dotenv/config';

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing');
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL);

  try {
    console.log('Adding tags column...');
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS tags text[]`;
    console.log('Done!');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await sql.end();
  }
}

run();

