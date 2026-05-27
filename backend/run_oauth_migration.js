import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

const pool = new Pool({
  host: '187.127.140.201',
  port: 5432,
  database: 'mello_db',
  user: 'mello_admin',
  password: 'Mello@dbadmin',
});

async function runMigration() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, '../database/migrate_oauth.sql'), 'utf8');
    
    // Split by semicolon and filter empty statements, also remove psql-specific commands
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('\\') && !s.startsWith('--'))
      .map(s => s.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim());
    
    for (const statement of statements) {
      if (statement) {
        console.log('Executing:', statement.substring(0, 50) + '...');
        await pool.query(statement);
      }
    }
    
    console.log('✅ Migration completed successfully!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
