import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: '187.127.140.201',
  port: 5432,
  database: 'mello_db',
  user: 'mello_admin',
  password: 'Mello@dbadmin'
});

const query = `
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'chat_messages'
ORDER BY ordinal_position
`;

pool.query(query)
  .then(res => {
    console.log('Columns in chat_messages:');
    res.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
