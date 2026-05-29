import pool from '../config/database.js';

async function completeFeatureSetup() {
    const client = await pool.connect();
    try {
        console.log('🔧 Setting up complete feature infrastructure...\n');

        // ============================================================================
        // 1. INVOICES TABLE - Critical for invoice management
        // ============================================================================
        console.log('📋 Setting up Invoices table...');
        
        const invoiceTableCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'invoices'
            )
        `);
        
        if (!invoiceTableCheck.rows[0].exists) {
            console.log('  ⚠️  Invoices table missing, creating...');
            await client.query(`
                CREATE TABLE Invoices (
                    id                  SERIAL PRIMARY KEY,
                    appointment_id      INT NOT NULL REFERENCES Appointments(id) ON DELETE CASCADE,
                    therapist_id        INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
                    invoice_number      VARCHAR(50) UNIQUE NOT NULL,
                    amount              DECIMAL(10, 2) NOT NULL,
                    status              VARCHAR(50) DEFAULT 'draft',
                    pdf_url             TEXT,
                    sent_at             TIMESTAMP,
                    paid_at             TIMESTAMP,
                    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Create indexes
            await client.query(`CREATE INDEX IF NOT EXISTS idx_invoices_appointment_id ON Invoices(appointment_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_invoices_therapist_id ON Invoices(therapist_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_invoices_status ON Invoices(status)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON Invoices(created_at)`);
            
            console.log('  ✅ Invoices table created with indexes');
        } else {
            console.log('  ✅ Invoices table already exists');
        }

        // ============================================================================
        // 2. APPOINTMENTS TABLE - Add missing columns
        // ============================================================================
        console.log('\n📋 Verifying Appointments table columns...');
        
        const appointmentColumns = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'appointments'
        `);
        
        const appointmentColumnNames = appointmentColumns.rows.map(r => r.column_name);
        
        const appointmentMissingColumns = [
            { name: 'duration_minutes', type: 'INT DEFAULT 60' },
            { name: 'therapist_email', type: 'VARCHAR(150)' },
            { name: 'notes', type: 'TEXT' },
            { name: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' }
        ];
        
        for (const col of appointmentMissingColumns) {
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
        // 3. PAYMENT TRANSACTION LOG TABLE - For audit trail
        // ============================================================================
        console.log('\n📋 Setting up PaymentTransactions table...');
        
        const paymentTableCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'paymenttransactions'
            )
        `);
        
        if (!paymentTableCheck.rows[0].exists) {
            console.log('  ⚠️  PaymentTransactions table missing, creating...');
            await client.query(`
                CREATE TABLE PaymentTransactions (
                    id                  SERIAL PRIMARY KEY,
                    appointment_id      INT NOT NULL REFERENCES Appointments(id) ON DELETE CASCADE,
                    therapist_id        INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
                    gateway             VARCHAR(50) NOT NULL,
                    order_id            VARCHAR(255),
                    payment_id          VARCHAR(255),
                    amount              DECIMAL(10, 2) NOT NULL,
                    currency            VARCHAR(10) DEFAULT 'INR',
                    status              VARCHAR(50),
                    response_data       JSONB,
                    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            await client.query(`CREATE INDEX IF NOT EXISTS idx_payment_transactions_appointment_id ON PaymentTransactions(appointment_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_payment_transactions_therapist_id ON PaymentTransactions(therapist_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_payment_transactions_gateway ON PaymentTransactions(gateway)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON PaymentTransactions(status)`);
            
            console.log('  ✅ PaymentTransactions table created with indexes');
        } else {
            console.log('  ✅ PaymentTransactions table already exists');
        }

        // ============================================================================
        // 4. BOOKING SLOTS TABLE - For availability checking
        // ============================================================================
        console.log('\n📋 Setting up BookingSlots table...');
        
        const slotsTableCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'bookingslots'
            )
        `);
        
        if (!slotsTableCheck.rows[0].exists) {
            console.log('  ⚠️  BookingSlots table missing, creating...');
            await client.query(`
                CREATE TABLE BookingSlots (
                    id                  SERIAL PRIMARY KEY,
                    calendar_id         INT NOT NULL REFERENCES Calendars(id) ON DELETE CASCADE,
                    therapist_id        INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
                    slot_date           DATE NOT NULL,
                    start_time          TIME NOT NULL,
                    end_time            TIME NOT NULL,
                    is_available        BOOLEAN DEFAULT true,
                    appointment_id      INT REFERENCES Appointments(id) ON DELETE SET NULL,
                    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            await client.query(`CREATE INDEX IF NOT EXISTS idx_booking_slots_calendar_id ON BookingSlots(calendar_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_booking_slots_therapist_id ON BookingSlots(therapist_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_booking_slots_date ON BookingSlots(slot_date)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_booking_slots_available ON BookingSlots(is_available)`);
            
            console.log('  ✅ BookingSlots table created with indexes');
        } else {
            console.log('  ✅ BookingSlots table already exists');
        }

        // ============================================================================
        // 5. ACTIVITY REMINDERS - Verify ClientActivities columns
        // ============================================================================
        console.log('\n📋 Verifying ClientActivities table...');
        
        const activitiesColumns = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'clientactivities'
        `);
        
        const activitiesColumnNames = activitiesColumns.rows.map(r => r.column_name);
        
        const activitiesMissingColumns = [
            { name: 'frequency', type: 'VARCHAR(50)' },
            { name: 'reminder_interval_days', type: 'INT DEFAULT 1' },
            { name: 'reminder_count', type: 'INT DEFAULT 1' },
            { name: 'reminders_sent', type: 'INT DEFAULT 0' },
            { name: 'next_reminder_at', type: 'TIMESTAMP' },
            { name: 'notify_client', type: 'BOOLEAN DEFAULT false' }
        ];
        
        for (const col of activitiesMissingColumns) {
            if (!activitiesColumnNames.includes(col.name)) {
                console.log(`  ⚠️  Adding column: ${col.name}`);
                await client.query(`
                    ALTER TABLE ClientActivities 
                    ADD COLUMN ${col.name} ${col.type}
                `);
                console.log(`  ✅ Added ${col.name}`);
            }
        }

        // ============================================================================
        // 6. USER INTEGRATIONS - Verify payment gateway columns
        // ============================================================================
        console.log('\n📋 Verifying UserIntegrations table...');
        
        const integrationsColumns = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'userintegrations'
        `);
        
        const integrationsColumnNames = integrationsColumns.rows.map(r => r.column_name);
        
        const integrationsMissingColumns = [
            { name: 'app_id', type: 'VARCHAR(255)' },
            { name: 'secret_key', type: 'VARCHAR(512)' },
            { name: 'environment', type: 'VARCHAR(20) DEFAULT \'sandbox\'' }
        ];
        
        for (const col of integrationsMissingColumns) {
            if (!integrationsColumnNames.includes(col.name)) {
                console.log(`  ⚠️  Adding column: ${col.name}`);
                await client.query(`
                    ALTER TABLE UserIntegrations 
                    ADD COLUMN ${col.name} ${col.type}
                `);
                console.log(`  ✅ Added ${col.name}`);
            }
        }

        // ============================================================================
        // 7. CALENDARS - Verify all configuration columns
        // ============================================================================
        console.log('\n📋 Verifying Calendars table...');
        
        const calendarsColumns = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'calendars'
        `);
        
        const calendarsColumnNames = calendarsColumns.rows.map(r => r.column_name);
        
        const calendarsMissingColumns = [
            { name: 'therapist_name', type: 'VARCHAR(150)' },
            { name: 'is_public', type: 'BOOLEAN DEFAULT true' },
            { name: 'buffer_time_before', type: 'INT DEFAULT 0' },
            { name: 'buffer_time_after', type: 'INT DEFAULT 0' }
        ];
        
        for (const col of calendarsMissingColumns) {
            if (!calendarsColumnNames.includes(col.name)) {
                console.log(`  ⚠️  Adding column: ${col.name}`);
                await client.query(`
                    ALTER TABLE Calendars 
                    ADD COLUMN ${col.name} ${col.type}
                `);
                console.log(`  ✅ Added ${col.name}`);
            }
        }

        // ============================================================================
        // 8. PERFORMANCE INDEXES - Add missing indexes
        // ============================================================================
        console.log('\n📋 Creating performance indexes...');
        
        const indexQueries = [
            `CREATE INDEX IF NOT EXISTS idx_appointments_payment_status ON Appointments(payment_status)`,
            `CREATE INDEX IF NOT EXISTS idx_appointments_appointment_date ON Appointments(appointment_date)`,
            `CREATE INDEX IF NOT EXISTS idx_appointments_client_email ON Appointments(client_email)`,
            `CREATE INDEX IF NOT EXISTS idx_calendars_is_active ON Calendars(is_active)`,
            `CREATE INDEX IF NOT EXISTS idx_calendars_is_public ON Calendars(is_public)`,
            `CREATE INDEX IF NOT EXISTS idx_clients_email ON Clients(email)`,
            `CREATE INDEX IF NOT EXISTS idx_user_integrations_provider ON UserIntegrations(provider)`,
        ];
        
        for (const query of indexQueries) {
            await client.query(query);
        }
        console.log('  ✅ All performance indexes created');

        console.log('\n✅ Complete feature setup finished!\n');
        console.log('📊 Summary:');
        console.log('  ✓ Invoices table created');
        console.log('  ✓ PaymentTransactions table created');
        console.log('  ✓ BookingSlots table created');
        console.log('  ✓ Appointments columns verified');
        console.log('  ✓ ClientActivities columns verified');
        console.log('  ✓ UserIntegrations columns verified');
        console.log('  ✓ Calendars columns verified');
        console.log('  ✓ Performance indexes created\n');

    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Run setup
completeFeatureSetup()
    .then(() => {
        console.log('🎉 Feature setup completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
