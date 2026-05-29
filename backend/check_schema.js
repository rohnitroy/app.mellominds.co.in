import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: '187.127.140.201',
  port: 5432,
  database: 'mello_db',
  user: 'mello_admin',
  password: 'Mello@dbadmin'
});

// Check chat_conversations columns
const convQuery = `
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'chat_conversations'
ORDER BY ordinal_position
`;

// Check chat_sessions columns
const sessQuery = `
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'chat_sessions'
ORDER BY ordinal_position
`;

// Check chat_messages columns
const msgQuery = `
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'chat_messages'
ORDER BY ordinal_position
`;

Promise.all([
  pool.query(convQuery),
  pool.query(sessQuery),
  pool.query(msgQuery)
]).then(([convRes, sessRes, msgRes]) => {
  console.log('\n=== chat_conversations columns ===');
  convRes.rows.forEach(row => console.log(`  ${row.column_name}: ${row.data_type}`));
  
  console.log('\n=== chat_sessions columns ===');
  sessRes.rows.forEach(row => console.log(`  ${row.column_name}: ${row.data_type}`));
  
  console.log('\n=== chat_messages columns ===');
  msgRes.rows.forEach(row => console.log(`  ${row.column_name}: ${row.data_type}`));
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
