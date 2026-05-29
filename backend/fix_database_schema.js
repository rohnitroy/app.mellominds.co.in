import pool from './config/database.js';

async function fixSchema() {
  try {
    console.log('🔧 Starting Database Schema Migration...\n');

    // 1. Add missing columns to Users table
    console.log('1️⃣ Adding missing columns to Users table...');
    
    const addColumnsSQL = `
      -- Add google_id if not exists
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
      
      -- Add auth_provider if not exists
      ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'email';
      
      -- Add dob if not exists
      ALTER TABLE users ADD COLUMN IF NOT EXISTS dob DATE;
      
      -- Add gender if not exists
      ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
      
      -- Add language_spoken if not exists
      ALTER TABLE users ADD COLUMN IF NOT EXISTS language_spoken TEXT[];
      
      -- Add plan_name if not exists
      ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_name VARCHAR(50) DEFAULT 'free';
      
      -- Add country, state, city, pincode, clinic_address if not exists
      ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS clinic_address TEXT;
      
      -- Rename password_hash to password if needed
      ALTER TABLE users RENAME COLUMN password_hash TO password;
      
      -- Make password nullable for OAuth users
      ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
    `;

    const statements = addColumnsSQL.split(';').map(s => s.trim()).filter(s => s);
    for (const stmt of statements) {
      try {
        console.log('  Executing:', stmt.substring(0, 60) + '...');
        await pool.query(stmt);
      } catch (err) {
        if (err.code === '42701') { // column already exists
          console.log('  ✓ Column already exists (skipped)');
        } else if (err.code === '42P16') { // column name already exists
          console.log('  ✓ Column already exists (skipped)');
        } else {
          console.error('  ❌ Error:', err.message);
        }
      }
    }

    // 2. Fix chat_messages table schema
    console.log('\n2️⃣ Fixing chat_messages table schema...');
    
    try {
      // Check if we need to migrate chat_messages
      const checkResult = await pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'chat_messages' AND column_name = 'conversation_id'
      `);
      
      if (checkResult.rows.length === 0) {
        console.log('  Adding conversation_id column...');
        await pool.query(`
          ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS conversation_id INTEGER;
        `);
        
        console.log('  Adding message_type column...');
        await pool.query(`
          ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(50);
        `);
        
        console.log('  Adding content column...');
        await pool.query(`
          ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS content TEXT;
        `);
        
        console.log('  Adding metadata column...');
        await pool.query(`
          ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS metadata JSONB;
        `);
        
        // Migrate data from old columns to new columns
        console.log('  Migrating data from old columns...');
        await pool.query(`
          UPDATE chat_messages 
          SET 
            conversation_id = session_id,
            message_type = sender_type,
            content = message
          WHERE conversation_id IS NULL;
        `);
      } else {
        console.log('  ✓ chat_messages schema already updated');
      }
    } catch (err) {
      console.error('  ❌ Error:', err.message);
    }

    // 3. Verify enterprise_leads table
    console.log('\n3️⃣ Verifying enterprise_leads table...');
    try {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'enterprise_leads'
        )
      `);
      
      if (result.rows[0].exists) {
        console.log('  ✓ enterprise_leads table exists');
      } else {
        console.log('  Creating enterprise_leads table...');
        await pool.query(`
          CREATE TABLE enterprise_leads (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            phone VARCHAR(20) NOT NULL,
            email VARCHAR(255) NOT NULL,
            company_name VARCHAR(255),
            company_website VARCHAR(255),
            message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
      }
    } catch (err) {
      console.error('  ❌ Error:', err.message);
    }

    // 4. Fix auth_provider constraint
    console.log('\n4️⃣ Adding auth_provider constraint...');
    try {
      await pool.query(`
        ALTER TABLE users 
        ADD CONSTRAINT check_auth_provider 
        CHECK (auth_provider IN ('email', 'google'))
      `);
      console.log('  ✓ Constraint added');
    } catch (err) {
      if (err.code === '42710') { // constraint already exists
        console.log('  ✓ Constraint already exists');
      } else {
        console.error('  ❌ Error:', err.message);
      }
    }

    console.log('\n✅ Database schema migration completed!');
    console.log('\n📋 Summary:');
    console.log('  ✓ Added missing columns to Users table');
    console.log('  ✓ Fixed chat_messages schema');
    console.log('  ✓ Verified enterprise_leads table');
    console.log('  ✓ Added auth_provider constraint');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

fixSchema();
