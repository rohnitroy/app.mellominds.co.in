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
  password: 'Mello@dbadmin'
});

const schemaPath = path.join(__dirname, 'database', 'schema_chatbot.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

pool.query(schema)
  .then(() => {
    console.log('✅ Chat schema migration completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  });
