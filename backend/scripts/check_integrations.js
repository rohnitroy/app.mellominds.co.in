import pool from '../config/database.js';

async function checkIntegrations() {
    try {
        const res = await pool.query(`SELECT * FROM UserIntegrations`);
        console.log('Integrations:', res.rows);

        const users = await pool.query(`SELECT id, email FROM Users`);
        console.log('Users:', users.rows);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkIntegrations();
