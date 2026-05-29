import pool from '../config/database.js';

async function diagnose() {
    const client = await pool.connect();
    try {
        const resUser = await client.query('SELECT current_user');
        console.log('Current DB User:', resUser.rows[0].current_user);

        const resTable = await client.query("SELECT tableowner FROM pg_tables WHERE tablename = 'users'");
        console.log('Users Table Owner:', resTable.rows[0]?.tableowner);

        // Try a simple create table to see if we have CREATE privilege
        await client.query('CREATE TABLE IF NOT EXISTS test_perm_check (id serial primary key)');
        console.log('✅ CREATE TABLE successful');
        await client.query('DROP TABLE test_perm_check');

    } catch (err) {
        console.error('❌ Diagnosis failed:', err.message);
    } finally {
        client.release();
        pool.end();
    }
}

diagnose();
