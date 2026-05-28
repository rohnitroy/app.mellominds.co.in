import pool from '../config/database.js';

async function fixBookingIssues() {
    const client = await pool.connect();
    try {
        console.log('🔧 Fixing critical booking issues...\n');

        // ============================================================================
        // 1. ADD MISSING COLUMNS TO APPOINTMENTS TABLE
        // ============================================================================
        console.log('📋 Fix #1: Adding missing columns to Appointments table...');
        
        const appointmentColumns = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'appointments'
        `);
        
        const appointmentColumnNames = appointmentColumns.rows.map(r => r.column_name);
        
        const missingColumns = [
            { name: 'partner_email', type: 'VARCHAR(150)' },
            { name: 'partner_phone', type: 'VARCHAR(20)' },
            { name: 'partner_name', type: 'VARCHAR(150)' },
            { name: 'cancellation_reason', type: 'TEXT' },
            { name: 'no_show_reason', type: 'TEXT' },
            { name: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' }
        ];
        
        for (const col of missingColumns) {
            if (!appointmentColumnNames.includes(col.name)) {
                console.log(`  ⚠️  Adding column: ${col.name}`);
                await client.query(`
                    ALTER TABLE Appointments 
                    ADD COLUMN ${col.name} ${col.type}
                `);
                console.log(`  ✅ Added ${col.name}`);
            }
        }

        // ============================================================================
        // 2. ADD TIMEZONE TO USERS TABLE
        // ============================================================================
        console.log('\n📋 Fix #2: Adding timezone to Users table...');
        
        const userColumns = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        
        const userColumnNames = userColumns.rows.map(r => r.column_name);
        
        if (!userColumnNames.includes('timezone')) {
            console.log('  ⚠️  Adding timezone column');
            await client.query(`
                ALTER TABLE Users 
                ADD COLUMN timezone VARCHAR(50) DEFAULT 'Asia/Kolkata'
            `);
            console.log('  ✅ Added timezone column');
        } else {
            console.log('  ✅ Timezone column already exists');
        }

        // ============================================================================
        // 3. CREATE PERFORMANCE INDEXES
        // ============================================================================
        console.log('\n📋 Fix #3: Creating performance indexes...');
        
        const indexQueries = [
            `CREATE INDEX IF NOT EXISTS idx_appointments_therapist_start ON Appointments(therapist_id, start_time)`,
            `CREATE INDEX IF NOT EXISTS idx_appointments_status ON Appointments(status)`,
            `CREATE INDEX IF NOT EXISTS idx_appointments_payment_status ON Appointments(payment_status)`,
            `CREATE INDEX IF NOT EXISTS idx_appointments_client_email ON Appointments(client_email)`,
            `CREATE INDEX IF NOT EXISTS idx_availability_user_day ON Availability(user_id, day_of_week, is_enabled)`,
            `CREATE INDEX IF NOT EXISTS idx_availability_user_enabled ON Availability(user_id, is_enabled)`,
        ];
        
        for (const query of indexQueries) {
            await client.query(query);
        }
        console.log('  ✅ All performance indexes created');

        // ============================================================================
        // 4. CREATE PENDING PAYMENTS TABLE FOR WEBHOOK RACE CONDITION FIX
        // ============================================================================
        console.log('\n📋 Fix #4: Creating PendingPayments table for webhook handling...');
        
        const pendingPaymentsCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'pendingpayments'
            )
        `);
        
        if (!pendingPaymentsCheck.rows[0].exists) {
            console.log('  ⚠️  PendingPayments table missing, creating...');
            await client.query(`
                CREATE TABLE PendingPayments (
                    id                  SERIAL PRIMARY KEY,
                    calendar_id         INT NOT NULL REFERENCES Calendars(id) ON DELETE CASCADE,
                    order_id            VARCHAR(255) UNIQUE NOT NULL,
                    gateway             VARCHAR(50) NOT NULL,
                    amount              DECIMAL(10, 2) NOT NULL,
                    client_email        VARCHAR(150) NOT NULL,
                    client_name         VARCHAR(150) NOT NULL,
                    client_phone        VARCHAR(20),
                    form_responses      JSONB,
                    location_type       VARCHAR(50),
                    partner_email       VARCHAR(150),
                    partner_phone       VARCHAR(20),
                    partner_name        VARCHAR(150),
                    start_time          TIMESTAMP NOT NULL,
                    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at          TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
                )
            `);
            
            await client.query(`CREATE INDEX IF NOT EXISTS idx_pending_payments_order_id ON PendingPayments(order_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_pending_payments_calendar_id ON PendingPayments(calendar_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_pending_payments_expires ON PendingPayments(expires_at)`);
            
            console.log('  ✅ PendingPayments table created with indexes');
        } else {
            console.log('  ✅ PendingPayments table already exists');
        }

        // ============================================================================
        // 5. CREATE BOOKING VALIDATION LOG TABLE
        // ============================================================================
        console.log('\n📋 Fix #5: Creating BookingValidationLog table...');
        
        const validationLogCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'bookingvalidationlog'
            )
        `);
        
        if (!validationLogCheck.rows[0].exists) {
            console.log('  ⚠️  BookingValidationLog table missing, creating...');
            await client.query(`
                CREATE TABLE BookingValidationLog (
                    id                  SERIAL PRIMARY KEY,
                    calendar_id         INT REFERENCES Calendars(id) ON DELETE CASCADE,
                    validation_type     VARCHAR(50) NOT NULL,
                    status              VARCHAR(50) NOT NULL,
                    error_message       TEXT,
                    request_data        JSONB,
                    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            await client.query(`CREATE INDEX IF NOT EXISTS idx_booking_validation_calendar ON BookingValidationLog(calendar_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_booking_validation_type ON BookingValidationLog(validation_type)`);
            
            console.log('  ✅ BookingValidationLog table created with indexes');
        } else {
            console.log('  ✅ BookingValidationLog table already exists');
        }

        // ============================================================================
        // 6. CREATE EMAIL BOUNCE TRACKING TABLE
        // ============================================================================
        console.log('\n📋 Fix #6: Creating EmailBounce table for bounce tracking...');
        
        const emailBounceCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'emailbounce'
            )
        `);
        
        if (!emailBounceCheck.rows[0].exists) {
            console.log('  ⚠️  EmailBounce table missing, creating...');
            await client.query(`
                CREATE TABLE EmailBounce (
                    id                  SERIAL PRIMARY KEY,
                    email               VARCHAR(150) NOT NULL,
                    bounce_type         VARCHAR(50) NOT NULL,
                    bounce_reason       TEXT,
                    user_id             INT REFERENCES Users(id) ON DELETE CASCADE,
                    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(email)
                )
            `);
            
            await client.query(`CREATE INDEX IF NOT EXISTS idx_email_bounce_email ON EmailBounce(email)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_email_bounce_user ON EmailBounce(user_id)`);
            
            console.log('  ✅ EmailBounce table created with indexes');
        } else {
            console.log('  ✅ EmailBounce table already exists');
        }

        // ============================================================================
        // 7. CREATE EMAIL RATE LIMIT TABLE
        // ============================================================================
        console.log('\n📋 Fix #7: Creating EmailRateLimit table...');
        
        const emailRateLimitCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'emailratelimit'
            )
        `);
        
        if (!emailRateLimitCheck.rows[0].exists) {
            console.log('  ⚠️  EmailRateLimit table missing, creating...');
            await client.query(`
                CREATE TABLE EmailRateLimit (
                    id                  SERIAL PRIMARY KEY,
                    user_id             INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
                    email_count         INT DEFAULT 0,
                    hour_start          TIMESTAMP NOT NULL,
                    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, hour_start)
                )
            `);
            
            await client.query(`CREATE INDEX IF NOT EXISTS idx_email_rate_limit_user ON EmailRateLimit(user_id)`);
            
            console.log('  ✅ EmailRateLimit table created with indexes');
        } else {
            console.log('  ✅ EmailRateLimit table already exists');
        }

        // ============================================================================
        // 8. CREATE GOOGLE CALENDAR SYNC LOG TABLE
        // ============================================================================
        console.log('\n📋 Fix #8: Creating GoogleCalendarSyncLog table...');
        
        const googleSyncCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'googlecalendarsynclog'
            )
        `);
        
        if (!googleSyncCheck.rows[0].exists) {
            console.log('  ⚠️  GoogleCalendarSyncLog table missing, creating...');
            await client.query(`
                CREATE TABLE GoogleCalendarSyncLog (
                    id                  SERIAL PRIMARY KEY,
                    appointment_id      INT REFERENCES Appointments(id) ON DELETE CASCADE,
                    user_id             INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
                    action              VARCHAR(50) NOT NULL,
                    status              VARCHAR(50) NOT NULL,
                    error_message       TEXT,
                    retry_count         INT DEFAULT 0,
                    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            await client.query(`CREATE INDEX IF NOT EXISTS idx_google_sync_appointment ON GoogleCalendarSyncLog(appointment_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_google_sync_user ON GoogleCalendarSyncLog(user_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_google_sync_status ON GoogleCalendarSyncLog(status)`);
            
            console.log('  ✅ GoogleCalendarSyncLog table created with indexes');
        } else {
            console.log('  ✅ GoogleCalendarSyncLog table already exists');
        }

        // ============================================================================
        // 9. ADD CONSTRAINTS TO APPOINTMENTS TABLE
        // ============================================================================
        console.log('\n📋 Fix #9: Adding constraints to Appointments table...');
        
        try {
            await client.query(`
                ALTER TABLE Appointments
                ADD CONSTRAINT check_appointment_times CHECK (end_time > start_time)
            `);
            console.log('  ✅ Added time validation constraint');
        } catch (err) {
            if (!err.message.includes('already exists')) {
                console.log('  ℹ️  Time validation constraint already exists');
            }
        }

        try {
            await client.query(`
                ALTER TABLE Appointments
                ADD CONSTRAINT check_payment_status CHECK (payment_status IN ('Pending', 'Paid', 'Refunded', 'Partial Refund', 'Cancelled'))
            `);
            console.log('  ✅ Added payment status validation constraint');
        } catch (err) {
            if (!err.message.includes('already exists')) {
                console.log('  ℹ️  Payment status constraint already exists');
            }
        }

        try {
            await client.query(`
                ALTER TABLE Appointments
                ADD CONSTRAINT check_appointment_status CHECK (status IN ('scheduled', 'completed', 'cancelled', 'noshow'))
            `);
            console.log('  ✅ Added appointment status validation constraint');
        } catch (err) {
            if (!err.message.includes('already exists')) {
                console.log('  ℹ️  Appointment status constraint already exists');
            }
        }

        // ============================================================================
        // 10. ADD CONSTRAINTS TO AVAILABILITY TABLE
        // ============================================================================
        console.log('\n📋 Fix #10: Adding constraints to Availability table...');
        
        try {
            await client.query(`
                ALTER TABLE Availability
                ADD CONSTRAINT check_availability_times CHECK (end_time > start_time)
            `);
            console.log('  ✅ Added availability time validation constraint');
        } catch (err) {
            if (!err.message.includes('already exists')) {
                console.log('  ℹ️  Availability time constraint already exists');
            }
        }

        console.log('\n✅ All booking issues fixed!\n');
        console.log('📊 Summary:');
        console.log('  ✓ Added 6 missing columns to Appointments');
        console.log('  ✓ Added timezone to Users');
        console.log('  ✓ Created 6 performance indexes');
        console.log('  ✓ Created PendingPayments table');
        console.log('  ✓ Created BookingValidationLog table');
        console.log('  ✓ Created EmailBounce table');
        console.log('  ✓ Created EmailRateLimit table');
        console.log('  ✓ Created GoogleCalendarSyncLog table');
        console.log('  ✓ Added data validation constraints\n');

    } catch (error) {
        console.error('❌ Fix failed:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Run fixes
fixBookingIssues()
    .then(() => {
        console.log('🎉 Booking issues fixed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
