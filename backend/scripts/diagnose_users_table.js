import pool from '../config/database.js';

const checkSchema = async () => {
    try {
        const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'; // PostgreSQL table names are lowercase in information_schema unless quoted
    `);

        // If empty result, try 'Users' (case sensitive if created with quotes, unlikely but possible)
        if (res.rows.length === 0) {
            const res2 = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'Users';
        `);
            console.table(res2.rows);
        } else {
            console.table(res.rows);
        }
    } catch (err) {
        console.error('Error checking schema:', err);
    } finally {
        pool.end();
    }
};

checkSchema();
