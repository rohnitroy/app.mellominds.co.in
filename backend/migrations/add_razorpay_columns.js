import pool from '../config/database.js';

async function addRazorpayColumns() {
    const client = await pool.connect();
    try {
        console.log('Adding razorpay_order_id and razorpay_payment_id columns to Appointments table...');
        
        // Check if columns already exist
        const checkRes = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'Appointments' 
            AND column_name IN ('razorpay_order_id', 'razorpay_payment_id')
        `);
        
        if (checkRes.rows.length === 2) {
            console.log('✓ Columns already exist. No migration needed.');
            return;
        }
        
        // Add razorpay_order_id if missing
        if (!checkRes.rows.find(r => r.column_name === 'razorpay_order_id')) {
            await client.query(`
                ALTER TABLE Appointments 
                ADD COLUMN razorpay_order_id VARCHAR(255) DEFAULT NULL
            `);
            console.log('✓ Added razorpay_order_id column');
        }
        
        // Add razorpay_payment_id if missing
        if (!checkRes.rows.find(r => r.column_name === 'razorpay_payment_id')) {
            await client.query(`
                ALTER TABLE Appointments 
                ADD COLUMN razorpay_payment_id VARCHAR(255) DEFAULT NULL
            `);
            console.log('✓ Added razorpay_payment_id column');
        }
        
        console.log('✓ Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Run migration
addRazorpayColumns()
    .then(() => {
        console.log('All migrations completed.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
