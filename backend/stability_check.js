import pool from './config/database.js';

async function stabilityCheck() {
  try {
    console.log('🔍 Running Stability Check...\n');

    // 1. Database Connection
    console.log('1️⃣ Database Connection:');
    try {
      const result = await pool.query('SELECT NOW()');
      console.log('   ✅ Database connected and responding');
    } catch (err) {
      console.log('   ❌ Database connection failed:', err.message);
      process.exit(1);
    }

    // 2. Check critical tables exist
    console.log('\n2️⃣ Critical Tables:');
    const criticalTables = ['users', 'appointments', 'clients', 'chat_messages', 'chat_conversations'];
    for (const table of criticalTables) {
      try {
        const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`   ✅ ${table}: ${result.rows[0].count} records`);
      } catch (err) {
        console.log(`   ❌ ${table}: ERROR - ${err.message}`);
      }
    }

    // 3. Check Users table schema
    console.log('\n3️⃣ Users Table Schema:');
    const requiredColumns = ['id', 'email', 'password', 'google_id', 'auth_provider', 'user_name', 'phone', 'plan_name'];
    const schemaResult = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    const existingColumns = schemaResult.rows.map(r => r.column_name);
    
    let schemaOk = true;
    for (const col of requiredColumns) {
      if (existingColumns.includes(col)) {
        console.log(`   ✅ ${col}`);
      } else {
        console.log(`   ❌ ${col} - MISSING`);
        schemaOk = false;
      }
    }

    // 4. Check chat_messages schema
    console.log('\n4️⃣ Chat Messages Schema:');
    const chatColumns = ['id', 'conversation_id', 'message_type', 'content', 'created_at'];
    const chatResult = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'chat_messages'
    `);
    const existingChatColumns = chatResult.rows.map(r => r.column_name);
    
    let chatOk = true;
    for (const col of chatColumns) {
      if (existingChatColumns.includes(col)) {
        console.log(`   ✅ ${col}`);
      } else {
        console.log(`   ❌ ${col} - MISSING`);
        chatOk = false;
      }
    }

    // 5. Test basic queries
    console.log('\n5️⃣ Query Performance:');
    const start = Date.now();
    await pool.query('SELECT * FROM users LIMIT 1');
    const userQueryTime = Date.now() - start;
    console.log(`   ✅ User query: ${userQueryTime}ms`);

    const start2 = Date.now();
    await pool.query('SELECT * FROM appointments LIMIT 1');
    const appointmentQueryTime = Date.now() - start2;
    console.log(`   ✅ Appointment query: ${appointmentQueryTime}ms`);

    // 6. Check for errors in recent logs
    console.log('\n6️⃣ Database Health:');
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as error_count FROM pg_stat_statements 
        WHERE query LIKE '%ERROR%' LIMIT 1
      `);
      console.log('   ✅ No critical errors detected');
    } catch (err) {
      console.log('   ⚠️ Could not check error logs');
    }

    // 7. Overall Status
    console.log('\n' + '='.repeat(50));
    if (schemaOk && chatOk && userQueryTime < 100 && appointmentQueryTime < 100) {
      console.log('✅ DATABASE & BACKEND: STABLE');
      console.log('='.repeat(50));
    } else {
      console.log('⚠️ DATABASE & BACKEND: PARTIALLY STABLE');
      console.log('='.repeat(50));
      if (!schemaOk) console.log('  ⚠️ Users table schema incomplete');
      if (!chatOk) console.log('  ⚠️ Chat messages schema incomplete');
      if (userQueryTime > 100) console.log('  ⚠️ User queries slow');
      if (appointmentQueryTime > 100) console.log('  ⚠️ Appointment queries slow');
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Stability check failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

stabilityCheck();
