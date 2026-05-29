import pool from '../config/database.js';

async function fixSchemaDiscrepancies() {
    const client = await pool.connect();
    try {
        console.log('🔧 Starting schema discrepancy fixes...\n');

        // ============================================================================
        // FIX #1: Availability Table - Rename is_available to is_enabled
        // ============================================================================
        console.log('📋 Fix #1: Availability table column name...');
        
        const availabilityCheck = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'availability' 
            AND column_name IN ('is_available', 'is_enabled')
        `);
        
        const hasIsAvailable = availabilityCheck.rows.some(r => r.column_name === 'is_available');
        const hasIsEnabled = availabilityCheck.rows.some(r => r.column_name === 'is_enabled');
        
        if (hasIsAvailable && !hasIsEnabled) {
            console.log('  ⚠️  Found is_available column, renaming to is_enabled...');
            await client.query(`
                ALTER TABLE Availability 
                RENAME COLUMN is_available TO is_enabled
            `);
            console.log('  ✅ Renamed is_available → is_enabled');
        } else if (hasIsEnabled) {
            console.log('  ✅ is_enabled column already exists');
        } else if (!hasIsAvailable && !hasIsEnabled) {
            console.log('  ⚠️  Neither column found, adding is_enabled...');
            await client.query(`
                ALTER TABLE Availability 
                ADD COLUMN is_enabled BOOLEAN DEFAULT true
            `);
            console.log('  ✅ Added is_enabled column');
        }

        // ============================================================================
        // FIX #2: ClientTransfers - Ensure transfer_options exists
        // ============================================================================
        console.log('\n📋 Fix #2: ClientTransfers table transfer_options column...');
        
        const transferCheck = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'clienttransfers' 
            AND column_name = 'transfer_options'
        `);
        
        if (transferCheck.rows.length === 0) {
            console.log('  ⚠️  transfer_options column missing, adding...');
            await client.query(`
                ALTER TABLE ClientTransfers 
                ADD COLUMN transfer_options JSONB DEFAULT '{}'::jsonb
            `);
            console.log('  ✅ Added transfer_options column');
        } else {
            console.log('  ✅ transfer_options column already exists');
        }

        // ============================================================================
        // FIX #3: Appointments - Ensure all required columns exist
        // ============================================================================
        console.log('\n📋 Fix #3: Appointments table columns...');
        
        const appointmentColumns = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'appointments'
        `);
        
        const appointmentColumnNames = appointmentColumns.rows.map(r => r.column_name);
        const requiredColumns = [
            'appointment_date',
            'razorpay_order_id',
            'razorpay_payment_id',
            'duration_minutes',
            'therapist_email'
        ];
        
        for (const col of requiredColumns) {
            if (!appointmentColumnNames.includes(col)) {
                console.log(`  ⚠️  Missing column: ${col}, adding...`);
                
                if (col === 'appointment_date') {
                    await client.query(`
                        ALTER TABLE Appointments 
                        ADD COLUMN appointment_date DATE
                    `);
                    // Populate with start_time date for existing records
                    await client.query(`
                        UPDATE Appointments 
                        SET appointment_date = DATE(start_time) 
                        WHERE appointment_date IS NULL
                    `);
                    // Make it NOT NULL
                    await client.query(`
                        ALTER TABLE Appointments 
                        ALTER COLUMN appointment_date SET NOT NULL
                    `);
                } else if (col === 'razorpay_order_id' || col === 'razorpay_payment_id') {
                    await client.query(`
                        ALTER TABLE Appointments 
                        ADD COLUMN ${col} VARCHAR(255) DEFAULT NULL
                    `);
                } else if (col === 'duration_minutes') {
                    await client.query(`
                        ALTER TABLE Appointments 
                        ADD COLUMN duration_minutes INT DEFAULT 60
                    `);
                } else if (col === 'therapist_email') {
                    await client.query(`
                        ALTER TABLE Appointments 
                        ADD COLUMN therapist_email VARCHAR(150) DEFAULT NULL
                    `);
                }
                
                console.log(`  ✅ Added ${col} column`);
            }
        }

        // ============================================================================
        // FIX #4: Verify Clients table encrypted columns
        // ============================================================================
        console.log('\n📋 Fix #4: Clients table encrypted columns...');
        
        const clientColumns = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'clients'
        `);
        
        const clientColumnNames = clientColumns.rows.map(r => r.column_name);
        const encryptedColumns = [
            'emergency_name_encrypted',
            'emergency_phone_encrypted',
            'emergency_relation_encrypted'
        ];
        
        for (const col of encryptedColumns) {
            if (!clientColumnNames.includes(col)) {
                console.log(`  ⚠️  Missing column: ${col}, adding...`);
                await client.query(`
                    ALTER TABLE Clients 
                    ADD COLUMN ${col} TEXT DEFAULT NULL
                `);
                console.log(`  ✅ Added ${col} column`);
            }
        }

        // ============================================================================
        // FIX #5: Verify UserIntegrations table
        // ============================================================================
        console.log('\n📋 Fix #5: UserIntegrations table...');
        
        const integrationColumns = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'userintegrations'
        `);
        
        const integrationColumnNames = integrationColumns.rows.map(r => r.column_name);
        const integrationRequiredColumns = [
            'access_token',
            'refresh_token',
            'calendar_id',
            'expiry_date'
        ];
        
        for (const col of integrationRequiredColumns) {
            if (!integrationColumnNames.includes(col)) {
                console.log(`  ⚠️  Missing column: ${col}, adding...`);
                
                if (col === 'expiry_date') {
                    await client.query(`
                        ALTER TABLE UserIntegrations 
                        ADD COLUMN ${col} TIMESTAMP DEFAULT NULL
                    `);
                } else {
                    await client.query(`
                        ALTER TABLE UserIntegrations 
                        ADD COLUMN ${col} TEXT DEFAULT NULL
                    `);
                }
                
                console.log(`  ✅ Added ${col} column`);
            }
        }

        // ============================================================================
        // FIX #6: Verify Calendars table
        // ============================================================================
        console.log('\n📋 Fix #6: Calendars table...');
        
        const calendarColumns = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'calendars'
        `);
        
        const calendarColumnNames = calendarColumns.rows.map(r => r.column_name);
        const calendarRequiredColumns = [
            'form_data',
            'payment_enabled',
            'prices',
            'cancellation_policy',
            'reschedule_policy',
            'locations',
            'schedule_settings'
        ];
        
        for (const col of calendarRequiredColumns) {
            if (!calendarColumnNames.includes(col)) {
                console.log(`  ⚠️  Missing column: ${col}, adding...`);
                await client.query(`
                    ALTER TABLE Calendars 
                    ADD COLUMN ${col} JSONB DEFAULT '{}'::jsonb
                `);
                console.log(`  ✅ Added ${col} column`);
            }
        }

        // ============================================================================
        // FIX #7: Create indexes for performance
        // ============================================================================
        console.log('\n📋 Fix #7: Creating performance indexes...');
        
        const indexQueries = [
            `CREATE INDEX IF NOT EXISTS idx_appointments_therapist_id ON Appointments(therapist_id)`,
            `CREATE INDEX IF NOT EXISTS idx_appointments_calendar_id ON Appointments(calendar_id)`,
            `CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON Appointments(start_time)`,
            `CREATE INDEX IF NOT EXISTS idx_appointments_status ON Appointments(status)`,
            `CREATE INDEX IF NOT EXISTS idx_calendars_user_id ON Calendars(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_calendars_slug ON Calendars(slug)`,
            `CREATE INDEX IF NOT EXISTS idx_availability_user_id ON Availability(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_availability_day_of_week ON Availability(day_of_week)`,
        ];
        
        for (const query of indexQueries) {
            await client.query(query);
        }
        console.log('  ✅ Indexes created/verified');

        console.log('\n✅ All schema discrepancies fixed successfully!\n');
        console.log('📊 Summary:');
        console.log('  ✓ Availability.is_enabled column verified');
        console.log('  ✓ ClientTransfers.transfer_options column verified');
        console.log('  ✓ Appointments table columns verified');
        console.log('  ✓ Clients encrypted columns verified');
        console.log('  ✓ UserIntegrations columns verified');
        console.log('  ✓ Calendars JSONB columns verified');
        console.log('  ✓ Performance indexes created\n');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Run migration
fixSchemaDiscrepancies()
    .then(() => {
        console.log('🎉 Schema fix completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
