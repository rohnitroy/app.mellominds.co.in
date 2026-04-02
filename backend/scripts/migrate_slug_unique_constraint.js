import pool from '../config/database.js';

async function migrateSlugConstraint() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Drop the existing global UNIQUE constraint on slug
        // The constraint name may vary — find it first
        const constraintRes = await client.query(`
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'calendars'::regclass
              AND contype = 'u'
              AND array_length(conkey, 1) = 1
              AND conkey[1] = (
                  SELECT attnum FROM pg_attribute
                  WHERE attrelid = 'calendars'::regclass AND attname = 'slug'
              )
        `);

        if (constraintRes.rows.length > 0) {
            const constraintName = constraintRes.rows[0].conname;
            console.log(`Dropping existing constraint: ${constraintName}`);
            await client.query(`ALTER TABLE Calendars DROP CONSTRAINT "${constraintName}"`);
        } else {
            console.log('No single-column slug unique constraint found — may already be composite or missing.');
        }

        // Add composite unique constraint: slug must be unique per user
        await client.query(`
            ALTER TABLE Calendars
            ADD CONSTRAINT calendars_user_id_slug_unique UNIQUE (user_id, slug)
        `);

        await client.query('COMMIT');
        console.log('✅ Migration complete: slug is now unique per user (user_id, slug)');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        process.exit(0);
    }
}

migrateSlugConstraint();
