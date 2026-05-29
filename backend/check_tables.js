import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: '187.127.140.201',
  port: 5432,
  database: 'mello_db',
  user: 'mello_admin',
  password: 'Mello@dbadmin'
});

// Check if tables exist
const query = `
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'chat%'
`;

pool.query(query)
  .then(res => {
    console.log('Chat tables found:', res.rows);
    if (res.rows.length > 0) {
      // Get columns for each table
      res.rows.forEach(async (row) => {
        const colQuery = `
        SELECT column_name, data_type FROM information_schema.columns 
        WHERE table_name = $1
        `;
        const colRes = await pool.query(colQuery, [row.table_name]);
        console.log(`\nColumns in ${row.table_name}:`, colRes.rows);
      });
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
