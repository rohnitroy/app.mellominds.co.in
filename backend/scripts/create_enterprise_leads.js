import pool from '../config/database.js';

const run = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS enterprise_leads (
                id               SERIAL PRIMARY KEY,
                name             VARCHAR(150) NOT NULL,
                phone            VARCHAR(30)  NOT NULL,
                email            VARCHAR(150) NOT NULL,
                company_name     VARCHAR(200) NOT NULL,
                company_website  VARCHAR(300),
                message          TEXT,
                created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_enterprise_leads_email
            ON enterprise_leads(email);
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_enterprise_leads_created
            ON enterprise_leads(created_at DESC);
        `);

        console.log('✅ enterprise_leads table ready.');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        client.release();
        pool.end();
    }
};

run();
