import pool from '../config/database.js';

async function setupCalendarFeatures() {
    const client = await pool.connect();
    try {
        console.log('🔧 Setting up complete calendar feature infrastructure...\n');

        // ============================================================================
        // 1. CALENDARS TABLE - Add missing columns
        // ============================================================================
        console.log('📋 Updating Calendars table...');
        
        const calendarColumns = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'calendars'
        `);
        
        const calendarColumnNames = calendarColumns.rows.map(r => r.column_name);
        
        const calendarMissingColumns = [
            { name: 'timezone', type: "VARCHAR(50) DEFAULT 'Asia/Kolkata'" },
            { name: 'status', type: "VARCHAR(50) DEFAULT 'active'" },
            { name: 'deleted_at', type: 'TIMESTAMP' },
            { name: 'min_notice_minutes', type: 'INT DEFAULT 0' },
            { name: 'date_range_type', type: "VARCHAR(50) DEFAULT 'indefinitely'" },
            { name: 'date_range_value', type: 'INT' },
            { name: 'date_range_start', type: 'DATE' },
            { name: 'date_range_end', type: 'DATE' }
        ];
        
        for (const col of calendarMissingColumns) {
            if (!calendarColumnNames.includes(col.name)) {
                console.log(`  ⚠️  Adding column: ${col.name}`);
                await client.query(`
                    ALTER TABLE Calendars 
                    ADD COLUMN ${col.name} ${col.type}
                `);
                console.log(`  ✅ Added ${col.name}`);
            }
        }

        // Add CHECK constraint for type
        try {
            await client.query(`
                ALTER TABLE Calendars
                ADD CONSTRAINT check_calendar_type CHECK (type IN ('one_on_one', 'group'))
            `);
            console.log('  ✅ Added type CHECK constraint');
        } catch (err) {
            if (!err.message.includes('already exists')) {
                console.log('  ℹ️  Type CHECK constraint already exists');
            }
        }

        // ============================================================================
        // 2. CALENDAR TEMPLATES TABLE
        // ============================================================================
        console.log('\n📋 Setting up CalendarTemplates table...');
        
        const templatesTableCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'calendartemplates'
            )
        `);
        
        if (!templatesTableCheck.rows[0].exists) {
            console.log('  ⚠️  CalendarTemplates table missing, creating...');
            await client.query(`
                CREATE TABLE CalendarTemplates (
                    id                  SERIAL PRIMARY KEY,
                    therapist_id        INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
                    name                VARCHAR(150) NOT NULL,
                    description         TEXT,
                    template_type       VARCHAR(50) NOT NULL,
                    form_data           JSONB DEFAULT NULL,
                    prices              JSONB DEFAULT NULL,
                    cancellation_policy JSONB DEFAULT NULL,
                    reschedule_policy   JSONB DEFAULT NULL,
                    locations           JSONB DEFAULT NULL,
                    schedule_settings   JSONB DEFAULT NULL,
                    is_public           BOOLEAN DEFAULT false,
                    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            await client.query(`CREATE INDEX IF NOT EXISTS idx_calendar_templates_therapist_id ON CalendarTemplates(therapist_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_calendar_templates_type ON CalendarTemplates(template_type)`);
            
            console.log('  ✅ CalendarTemplates table created with indexes');
        } else {
            console.log('  ✅ CalendarTemplates table already exists');
        }

        // ============================================================================
        // 3. CALENDAR VERSIONS TABLE
        // ============================================================================
        console.log('\n📋 Setting up CalendarVersions table...');
        
        const versionsTableCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'calendarversions'
            )
        `);
        
        if (!versionsTableCheck.rows[0].exists) {
            console.log('  ⚠️  CalendarVersions table missing, creating...');
            await client.query(`
                CREATE TABLE CalendarVersions (
                    id                  SERIAL PRIMARY KEY,
                    calendar_id         INT NOT NULL REFERENCES Calendars(id) ON DELETE CASCADE,
                    version_number      INT NOT NULL,
                    title               VARCHAR(255),
                    description         TEXT,
                    form_data           JSONB,
                    prices              JSONB,
                    cancellation_policy JSONB,
                    reschedule_policy   JSONB,
                    locations           JSONB,
                    schedule_settings   JSONB,
                    changed_by          INT REFERENCES Users(id) ON DELETE SET NULL,
                    change_reason       TEXT,
                    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            await client.query(`CREATE INDEX IF NOT EXISTS idx_calendar_versions_calendar_id ON CalendarVersions(calendar_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_calendar_versions_version ON CalendarVersions(version_number)`);
            
            console.log('  ✅ CalendarVersions table created with indexes');
        } else {
            console.log('  ✅ CalendarVersions table already exists');
        }

        // ============================================================================
        // 4. CALENDAR PERMISSIONS TABLE
        // ============================================================================
        console.log('\n📋 Setting up CalendarPermissions table...');
        
        const permissionsTableCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'calendarpermissions'
            )
        `);
        
        if (!permissionsTableCheck.rows[0].exists) {
            console.log('  ⚠️  CalendarPermissions table missing, creating...');
            await client.query(`
                CREATE TABLE CalendarPermissions (
                    id                  SERIAL PRIMARY KEY,
                    calendar_id         INT NOT NULL REFERENCES Calendars(id) ON DELETE CASCADE,
                    user_id             INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
                    permission_type     VARCHAR(50) NOT NULL CHECK (permission_type IN ('view', 'edit', 'manage')),
                    granted_by          INT REFERENCES Users(id) ON DELETE SET NULL,
                    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(calendar_id, user_id)
                )
            `);
            
            await client.query(`CREATE INDEX IF NOT EXISTS idx_calendar_permissions_calendar_id ON CalendarPermissions(calendar_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_calendar_permissions_user_id ON CalendarPermissions(user_id)`);
            
            console.log('  ✅ CalendarPermissions table created with indexes');
        } else {
            console.log('  ✅ CalendarPermissions table already exists');
        }

        // ============================================================================
        // 5. CALENDAR METRICS TABLE
        // ============================================================================
        console.log('\n📋 Setting up CalendarMetrics table...');
        
        const metricsTableCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'calendarmetrics'
            )
        `);
        
        if (!metricsTableCheck.rows[0].exists) {
            console.log('  ⚠️  CalendarMetrics table missing, creating...');
            await client.query(`
                CREATE TABLE CalendarMetrics (
                    id                  SERIAL PRIMARY KEY,
                    calendar_id         INT NOT NULL REFERENCES Calendars(id) ON DELETE CASCADE,
                    date                DATE NOT NULL,
                    views               INT DEFAULT 0,
                    bookings            INT DEFAULT 0,
                    completed_bookings  INT DEFAULT 0,
                    cancelled_bookings  INT DEFAULT 0,
                    revenue             DECIMAL(10, 2) DEFAULT 0.00,
                    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(calendar_id, date)
                )
            `);
            
            await client.query(`CREATE INDEX IF NOT EXISTS idx_calendar_metrics_calendar_id ON CalendarMetrics(calendar_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_calendar_metrics_date ON CalendarMetrics(date)`);
            
            console.log('  ✅ CalendarMetrics table created with indexes');
        } else {
            console.log('  ✅ CalendarMetrics table already exists');
        }

        // ============================================================================
        // 6. CALENDAR CUSTOMIZATION TABLE
        // ============================================================================
        console.log('\n📋 Setting up CalendarCustomization table...');
        
        const customizationTableCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'calendarcustomization'
            )
        `);
        
        if (!customizationTableCheck.rows[0].exists) {
            console.log('  ⚠️  CalendarCustomization table missing, creating...');
            await client.query(`
                CREATE TABLE CalendarCustomization (
                    id                  SERIAL PRIMARY KEY,
                    calendar_id         INT NOT NULL UNIQUE REFERENCES Calendars(id) ON DELETE CASCADE,
                    primary_color       VARCHAR(7) DEFAULT '#3787F8',
                    secondary_color     VARCHAR(7) DEFAULT '#ffffff',
                    logo_url            TEXT,
                    banner_url          TEXT,
                    custom_css          TEXT,
                    branding_text       TEXT,
                    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            await client.query(`CREATE INDEX IF NOT EXISTS idx_calendar_customization_calendar_id ON CalendarCustomization(calendar_id)`);
            
            console.log('  ✅ CalendarCustomization table created with indexes');
        } else {
            console.log('  ✅ CalendarCustomization table already exists');
        }

        // ============================================================================
        // 7. CREATE PERFORMANCE INDEXES
        // ============================================================================
        console.log('\n📋 Creating performance indexes...');
        
        const indexQueries = [
            `CREATE INDEX IF NOT EXISTS idx_calendars_user_id ON Calendars(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_calendars_slug ON Calendars(slug)`,
            `CREATE INDEX IF NOT EXISTS idx_calendars_is_active ON Calendars(is_active)`,
            `CREATE INDEX IF NOT EXISTS idx_calendars_status ON Calendars(status)`,
            `CREATE INDEX IF NOT EXISTS idx_calendars_created_at ON Calendars(created_at)`,
            `CREATE INDEX IF NOT EXISTS idx_calendars_deleted_at ON Calendars(deleted_at)`,
        ];
        
        for (const query of indexQueries) {
            await client.query(query);
        }
        console.log('  ✅ All performance indexes created');

        console.log('\n✅ Calendar feature setup finished!\n');
        console.log('📊 Summary:');
        console.log('  ✓ Calendars table updated with new columns');
        console.log('  ✓ CalendarTemplates table created');
        console.log('  ✓ CalendarVersions table created');
        console.log('  ✓ CalendarPermissions table created');
        console.log('  ✓ CalendarMetrics table created');
        console.log('  ✓ CalendarCustomization table created');
        console.log('  ✓ Performance indexes created\n');

    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Run setup
setupCalendarFeatures()
    .then(() => {
        console.log('🎉 Calendar feature setup completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
