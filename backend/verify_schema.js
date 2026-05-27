import pool from './config/database.js';

async function verifySchema() {
  try {
    console.log('🔍 Verifying Database Schema...\n');

    // Check Users table columns
    console.log('📋 Users Table Columns:');
    const usersResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    console.table(usersResult.rows);

    // Check chat_messages table columns
    console.log('\n📋 chat_messages Table Columns:');
    const chatResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'chat_messages'
      ORDER BY ordinal_position
    `);
    console.table(chatResult.rows);

    // Check if enterprise_leads table exists
    console.log('\n📋 Checking for enterprise_leads table:');
    const enterpriseResult = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'enterprise_leads'
      )
    `);
    console.log('enterprise_leads exists:', enterpriseResult.rows[0].exists);

    // List all tables
    console.log('\n📋 All Tables in Database:');
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.table(tablesResult.rows);

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifySchema();
