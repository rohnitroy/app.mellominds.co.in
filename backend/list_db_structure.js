import dotenv from 'dotenv';
import pool from './config/database.js';

dotenv.config();

const listDatabaseStructure = async () => {
  const client = await pool.connect();
  try {
    // Get all tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('=== ALL TABLES ===');
    for (const row of tables.rows) {
      console.log('- ' + row.table_name);
    }
    
    // Get sample data from each table
    for (const row of tables.rows) {
      const tableName = row.table_name;
      console.log(`\n=== ${tableName.toUpperCase()} TABLE ===`);
      
      const result = await client.query(`SELECT * FROM ${tableName} LIMIT 1`);
      if (result.rows.length > 0) {
        console.log(JSON.stringify(result.rows[0], null, 2));
      } else {
        console.log('(No data)');
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    pool.end();
  }
};

listDatabaseStructure();
