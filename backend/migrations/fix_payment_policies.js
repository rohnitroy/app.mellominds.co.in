import pool from '../config/database.js';

async function fixPaymentPolicies() {
    const client = await pool.connect();
    try {
        console.log('🔧 Fixing payment, cancellation, and reschedule policies...\n');

        // ============================================================================
        // 1. ADD MISSING COLUMNS FOR REFUND AND FEE TRACKING
        // ============================================================================
        console.log('📋 Fix #1: Adding refund and fee tracking columns...');
        
        const appointmentColumns = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'appointments'
        `);
        
        const appointmentColumnNames = appointmentColumns.rows.map(r => r.column_name);
        
        const missingColumns = [
            { name: 'refund_amount', type: 'DECIMAL(10, 2) DEFAULT 0.00' },
            { name: 'reschedule_fee_charged', type: 'DECIMAL(10, 2) DEFAULT 0.00' },
            { name: 'refund_reason', type: 'VARCHAR(255)' }
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
        // 2. CREATE POLICY VALIDATION TABLE
        // ============================================================================
        console.log('\n📋 Fix #2: Creating PolicyValidation table...');
        
        const policyValidationCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'policyvalidation'
            )
        `);
        
        if (!policyValidationCheck.rows[0].exists) {
            console.log('  ⚠️  PolicyValidation table missing, creating...');
            await client.query(`
                CREATE TABLE PolicyValidation (
                    id                  SERIAL PRIMARY KEY,
                    calendar_id         INT NOT NULL REFERENCES Calendars(id) ON DELETE CASCADE,
                    policy_type         VARCHAR(50) NOT NULL,
                    is_valid            BOOLEAN DEFAULT false,
                    error_message       TEXT,
                    validated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            await client.query(`CREATE INDEX IF NOT EXISTS idx_policy_validation_calendar ON PolicyValidation(calendar_id)`);
            
            console.log('  ✅ PolicyValidation table created');
        } else {
            console.log('  ✅ PolicyValidation table already exists');
        }

        // ============================================================================
        // 3. CREATE PAYMENT VERIFICATION TABLE
        // ============================================================================
        console.log('\n📋 Fix #3: Creating PaymentVerification table...');
        
        const paymentVerificationCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'paymentverification'
            )
        `);
        
        if (!paymentVerificationCheck.rows[0].exists) {
            console.log('  ⚠️  PaymentVerification table missing, creating...');
            await client.query(`
                CREATE TABLE PaymentVerification (
                    id                  SERIAL PRIMARY KEY,
                    appointment_id      INT NOT NULL REFERENCES Appointments(id) ON DELETE CASCADE,
                    verification_type   VARCHAR(50) NOT NULL,
                    status              VARCHAR(50) NOT NULL,
                    verified_at         TIMESTAMP,
                    verified_by         INT REFERENCES Users(id) ON DELETE SET NULL,
                    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            await client.query(`CREATE INDEX IF NOT EXISTS idx_payment_verification_appointment ON PaymentVerification(appointment_id)`);
            
            console.log('  ✅ PaymentVerification table created');
        } else {
            console.log('  ✅ PaymentVerification table already exists');
        }

        // ============================================================================
        // 4. CREATE REFUND TRACKING TABLE
        // ============================================================================
        console.log('\n📋 Fix #4: Creating RefundTracking table...');
        
        const refundTrackingCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'refundtracking'
            )
        `);
        
        if (!refundTrackingCheck.rows[0].exists) {
            console.log('  ⚠️  RefundTracking table missing, creating...');
            await client.query(`
                CREATE TABLE RefundTracking (
                    id                  SERIAL PRIMARY KEY,
                    appointment_id      INT NOT NULL REFERENCES Appointments(id) ON DELETE CASCADE,
                    original_amount     DECIMAL(10, 2) NOT NULL,
                    refund_amount       DECIMAL(10, 2) NOT NULL,
                    refund_percentage   DECIMAL(5, 2) DEFAULT 100.00,
                    refund_reason       VARCHAR(255),
                    refund_status       VARCHAR(50) NOT NULL,
                    processed_at        TIMESTAMP,
                    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            await client.query(`CREATE INDEX IF NOT EXISTS idx_refund_tracking_appointment ON RefundTracking(appointment_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_refund_tracking_status ON RefundTracking(refund_status)`);
            
            console.log('  ✅ RefundTracking table created');
        } else {
            console.log('  ✅ RefundTracking table already exists');
        }

        // ============================================================================
        // 5. CREATE FEE TRACKING TABLE
        // ============================================================================
        console.log('\n📋 Fix #5: Creating FeeTracking table...');
        
        const feeTrackingCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'feetracking'
            )
        `);
        
        if (!feeTrackingCheck.rows[0].exists) {
            console.log('  ⚠️  FeeTracking table missing, creating...');
            await client.query(`
                CREATE TABLE FeeTracking (
                    id                  SERIAL PRIMARY KEY,
                    appointment_id      INT NOT NULL REFERENCES Appointments(id) ON DELETE CASCADE,
                    fee_type            VARCHAR(50) NOT NULL,
                    fee_amount          DECIMAL(10, 2) NOT NULL,
                    fee_status          VARCHAR(50) NOT NULL,
                    collected_at        TIMESTAMP,
                    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            await client.query(`CREATE INDEX IF NOT EXISTS idx_fee_tracking_appointment ON FeeTracking(appointment_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_fee_tracking_type ON FeeTracking(fee_type)`);
            
            console.log('  ✅ FeeTracking table created');
        } else {
            console.log('  ✅ FeeTracking table already exists');
        }

        // ============================================================================
        // 6. ADD CONSTRAINTS FOR DATA VALIDATION
        // ============================================================================
        console.log('\n📋 Fix #6: Adding data validation constraints...');
        
        try {
            await client.query(`
                ALTER TABLE Appointments
                ADD CONSTRAINT check_refund_amount CHECK (refund_amount >= 0 AND refund_amount <= payment_amount)
            `);
            console.log('  ✅ Added refund amount validation constraint');
        } catch (err) {
            if (!err.message.includes('already exists')) {
                console.log('  ℹ️  Refund amount constraint already exists');
            }
        }

        try {
            await client.query(`
                ALTER TABLE Appointments
                ADD CONSTRAINT check_reschedule_fee CHECK (reschedule_fee_charged >= 0)
            `);
            console.log('  ✅ Added reschedule fee validation constraint');
        } catch (err) {
            if (!err.message.includes('already exists')) {
                console.log('  ℹ️  Reschedule fee constraint already exists');
            }
        }

        // ============================================================================
        // 7. CREATE POLICY VALIDATION FUNCTION
        // ============================================================================
        console.log('\n📋 Fix #7: Creating policy validation function...');
        
        await client.query(`
            CREATE OR REPLACE FUNCTION validate_cancellation_policy(policy JSONB)
            RETURNS BOOLEAN AS $$
            BEGIN
                IF policy IS NULL THEN
                    RETURN TRUE;
                END IF;
                
                IF (policy->>'enabled')::BOOLEAN THEN
                    -- Validate window
                    IF (policy->>'window') IS NULL OR (policy->>'window')::INTEGER <= 0 THEN
                        RAISE EXCEPTION 'Cancellation window must be a positive number';
                    END IF;
                    
                    -- Validate unit
                    IF (policy->>'unit') NOT IN ('minutes', 'hours', 'days') THEN
                        RAISE EXCEPTION 'Invalid unit. Must be minutes, hours, or days';
                    END IF;
                    
                    -- Validate refund type
                    IF (policy->>'refundType') NOT IN ('full', 'partial', 'none') THEN
                        RAISE EXCEPTION 'Invalid refund type';
                    END IF;
                    
                    -- Validate refund percentage if partial
                    IF (policy->>'refundType') = 'partial' THEN
                        IF (policy->>'refundPercentage')::DECIMAL < 0 OR (policy->>'refundPercentage')::DECIMAL > 100 THEN
                            RAISE EXCEPTION 'Refund percentage must be between 0 and 100';
                        END IF;
                    END IF;
                END IF;
                
                RETURN TRUE;
            END;
            $$ LANGUAGE plpgsql;
        `);
        console.log('  ✅ Created cancellation policy validation function');

        await client.query(`
            CREATE OR REPLACE FUNCTION validate_reschedule_policy(policy JSONB)
            RETURNS BOOLEAN AS $$
            BEGIN
                IF policy IS NULL THEN
                    RETURN TRUE;
                END IF;
                
                IF (policy->>'enabled')::BOOLEAN THEN
                    -- Validate window
                    IF (policy->>'window') IS NULL OR (policy->>'window')::INTEGER <= 0 THEN
                        RAISE EXCEPTION 'Reschedule window must be a positive number';
                    END IF;
                    
                    -- Validate unit
                    IF (policy->>'unit') NOT IN ('minutes', 'hours', 'days') THEN
                        RAISE EXCEPTION 'Invalid unit. Must be minutes, hours, or days';
                    END IF;
                    
                    -- Validate fee type
                    IF (policy->>'type') NOT IN ('free', 'paid') THEN
                        RAISE EXCEPTION 'Invalid fee type';
                    END IF;
                    
                    -- Validate fee if paid
                    IF (policy->>'type') = 'paid' THEN
                        IF (policy->>'fee')::DECIMAL < 0 THEN
                            RAISE EXCEPTION 'Fee cannot be negative';
                        END IF;
                    END IF;
                END IF;
                
                RETURN TRUE;
            END;
            $$ LANGUAGE plpgsql;
        `);
        console.log('  ✅ Created reschedule policy validation function');

        // ============================================================================
        // 8. CREATE TRIGGER FOR POLICY VALIDATION
        // ============================================================================
        console.log('\n📋 Fix #8: Creating policy validation trigger...');
        
        await client.query(`
            CREATE OR REPLACE FUNCTION validate_calendar_policies()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Validate cancellation policy
                IF NEW.cancellation_policy IS NOT NULL THEN
                    PERFORM validate_cancellation_policy(NEW.cancellation_policy);
                END IF;
                
                -- Validate reschedule policy
                IF NEW.reschedule_policy IS NOT NULL THEN
                    PERFORM validate_reschedule_policy(NEW.reschedule_policy);
                END IF;
                
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);
        
        await client.query(`
            DROP TRIGGER IF EXISTS trg_validate_calendar_policies ON Calendars;
            CREATE TRIGGER trg_validate_calendar_policies
            BEFORE INSERT OR UPDATE ON Calendars
            FOR EACH ROW EXECUTE FUNCTION validate_calendar_policies();
        `);
        console.log('  ✅ Created policy validation trigger');

        // ============================================================================
        // 9. CREATE INDEXES FOR PERFORMANCE
        // ============================================================================
        console.log('\n📋 Fix #9: Creating performance indexes...');
        
        const indexQueries = [
            `CREATE INDEX IF NOT EXISTS idx_appointments_payment_status ON Appointments(payment_status)`,
            `CREATE INDEX IF NOT EXISTS idx_appointments_refund_amount ON Appointments(refund_amount)`,
            `CREATE INDEX IF NOT EXISTS idx_refund_tracking_appointment ON RefundTracking(appointment_id)`,
            `CREATE INDEX IF NOT EXISTS idx_fee_tracking_appointment ON FeeTracking(appointment_id)`,
        ];
        
        for (const query of indexQueries) {
            await client.query(query);
        }
        console.log('  ✅ All performance indexes created');

        console.log('\n✅ All payment policy fixes applied!\n');
        console.log('📊 Summary:');
        console.log('  ✓ Added refund and fee tracking columns');
        console.log('  ✓ Created PolicyValidation table');
        console.log('  ✓ Created PaymentVerification table');
        console.log('  ✓ Created RefundTracking table');
        console.log('  ✓ Created FeeTracking table');
        console.log('  ✓ Added data validation constraints');
        console.log('  ✓ Created policy validation functions');
        console.log('  ✓ Created policy validation trigger');
        console.log('  ✓ Created performance indexes\n');

    } catch (error) {
        console.error('❌ Fix failed:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Run fixes
fixPaymentPolicies()
    .then(() => {
        console.log('🎉 Payment policy fixes completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
