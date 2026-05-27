# MelloMinds Security Measures - Anti-Tampering System

## Overview
This document outlines the comprehensive security measures implemented to prevent database and application tampering in production.

---

## 🔐 Security Layers

### 1. Schema Validation & Integrity Monitoring

**File:** `backend/security/schema-validator.js`

**Features:**
- ✅ Validates database schema on server startup
- ✅ Detects missing critical columns
- ✅ Detects unexpected columns (potential tampering)
- ✅ Generates SHA-256 hash of schema structure
- ✅ Compares current schema against stored hash
- ✅ Alerts on any schema modifications

**Expected Schema:**
```
Users Table:
- id, email, password, google_id, auth_provider, user_name
- phone, plan_name, org_role, org_owner_id, dob, gender
- language_spoken, country, state, city, pincode, clinic_address
- profile_picture, reset_token, reset_token_expires, created_at, updated_at

Chat Messages Table:
- id, conversation_id, message_type, content, metadata, created_at

Chat Conversations Table:
- id, user_id, title, context_data, is_active, created_at, updated_at

Appointments Table:
- id, therapist_id, client_id, start_time, end_time, status, created_at

Clients Table:
- id, therapist_id, first_name, last_name, email, phone, created_at

Enterprise Leads Table:
- id, name, phone, email, company_name, created_at
```

**How It Works:**
1. On server startup, validates all critical tables exist
2. Checks all required columns are present
3. Generates schema hash and stores in `.schema-hash` file
4. On subsequent startups, compares current hash with stored hash
5. If mismatch detected, alerts and prevents startup (production only)

**Usage:**
```bash
# Manual validation
node backend/security/schema-validator.js

# Automatic on server startup
npm run dev  # or npm start
```

---

### 2. Data Integrity Monitoring

**File:** `backend/security/data-integrity.js`

**Features:**
- ✅ Calculates MD5 checksums of critical tables
- ✅ Detects unauthorized data modifications
- ✅ Maintains audit trail of all changes
- ✅ Detects suspicious activities (bulk deletes, schema changes)
- ✅ Logs all sensitive operations

**Critical Tables Monitored:**
- users
- appointments
- clients
- organization_therapists

**How It Works:**
1. Calculates MD5 checksum of each critical table
2. Stores checksums for comparison
3. Detects bulk deletions (>10 in 1 hour)
4. Detects schema modifications
5. Logs all changes to audit_logs table

**Usage:**
```bash
# Manual check
node backend/security/data-integrity.js

# Automatic monitoring (production)
# Runs every 6 hours automatically
```

---

### 3. Audit Logging

**Features:**
- ✅ Logs all data modifications
- ✅ Tracks user actions
- ✅ Records what changed and when
- ✅ Maintains complete audit trail
- ✅ Enables forensic analysis

**Audit Log Fields:**
```
- user_id: Who made the change
- action: What action (INSERT, UPDATE, DELETE, ALTER)
- table_name: Which table was affected
- record_id: Which record was modified
- changes: What changed (JSON)
- created_at: When it happened
```

**Usage:**
```sql
-- View audit logs
SELECT * FROM audit_logs 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Find suspicious activities
SELECT * FROM audit_logs 
WHERE action = 'DELETE' 
AND created_at > NOW() - INTERVAL '1 hour';
```

---

### 4. Row Level Security (RLS)

**Features:**
- ✅ Restricts data access by user
- ✅ Prevents unauthorized data viewing
- ✅ Enforces data isolation
- ✅ Database-level security

**Implementation:**
```sql
-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy for user isolation
CREATE POLICY user_isolation ON users
  USING (id = current_user_id::integer);
```

---

### 5. Encryption

**Features:**
- ✅ Encrypts sensitive data at rest
- ✅ Uses AES-256 encryption
- ✅ Secure key management
- ✅ Transparent encryption/decryption

**Encrypted Fields:**
- reset_token
- sensitive user data
- emergency contact information

**Usage:**
```javascript
import { encryptSensitiveData, decryptSensitiveData } from './lib/encryption.js';

// Encrypt
const encrypted = encryptSensitiveData(sensitiveData);

// Decrypt
const decrypted = decryptSensitiveData(encrypted);
```

---

### 6. SQL Injection Prevention

**Features:**
- ✅ Parameterized queries (prepared statements)
- ✅ Input validation and sanitization
- ✅ No string interpolation in SQL
- ✅ Type checking

**Example:**
```javascript
// ✅ SAFE - Parameterized query
await pool.query('SELECT * FROM users WHERE email = $1', [email]);

// ❌ UNSAFE - String interpolation
await pool.query(`SELECT * FROM users WHERE email = '${email}'`);
```

---

### 7. Rate Limiting

**Features:**
- ✅ Prevents brute force attacks
- ✅ Limits API requests per user
- ✅ Configurable thresholds
- ✅ Different limits for different endpoints

**Configuration:**
```javascript
// Auth endpoints: 20 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
});

// General API: 200 requests per 15 minutes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
});
```

---

### 8. CORS & Security Headers

**Features:**
- ✅ Restricts cross-origin requests
- ✅ Sets security headers
- ✅ Prevents clickjacking
- ✅ Prevents MIME type sniffing

**Configuration:**
```javascript
// CORS - only allow frontend domain
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

// Security headers
app.use(helmet());
```

---

## 🚀 Production Deployment Security

### Pre-Deployment Checklist

```bash
# 1. Validate schema
node backend/security/schema-validator.js

# 2. Check data integrity
node backend/security/data-integrity.js

# 3. Run stability check
node backend/stability_check.js

# 4. Backup database
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup.sql

# 5. Update environment variables
# Set NODE_ENV=production
# Update FRONTEND_URL
# Generate new SESSION_SECRET
# Generate new ENCRYPTION_MASTER_SECRET

# 6. Deploy application
npm install --production
npm start
```

### Continuous Monitoring (Production)

The application automatically runs these checks in production:

1. **Schema Integrity Check** - Every 24 hours
   - Verifies schema hasn't been modified
   - Alerts if tampering detected
   - Prevents startup if critical issues found

2. **Data Integrity Check** - Every 6 hours
   - Calculates table checksums
   - Detects unauthorized modifications
   - Logs all changes

3. **Suspicious Activity Detection** - Every 30 minutes
   - Detects bulk deletions
   - Detects schema changes
   - Alerts security team

---

## 🛡️ What Gets Protected

### Database Level
- ✅ Schema structure (columns, types, constraints)
- ✅ Data integrity (checksums, audit logs)
- ✅ Access control (RLS policies)
- ✅ Encryption (sensitive data)

### Application Level
- ✅ SQL injection prevention
- ✅ Rate limiting
- ✅ CORS restrictions
- ✅ Security headers
- ✅ Input validation

### Operational Level
- ✅ Audit logging
- ✅ Monitoring & alerts
- ✅ Backup & recovery
- ✅ Incident response

---

## 🚨 Incident Response

### If Schema Tampering Detected

**Automatic Actions:**
1. Application startup fails (production)
2. Alert sent to security team
3. Logs preserved for investigation
4. Database access restricted

**Manual Actions:**
1. Stop application immediately
2. Isolate database server
3. Review audit logs
4. Restore from clean backup
5. Investigate root cause
6. Implement additional security measures

### If Data Tampering Detected

**Automatic Actions:**
1. Alert sent to security team
2. Suspicious activity logged
3. Audit trail preserved

**Manual Actions:**
1. Enable read-only mode
2. Identify affected records
3. Restore from backup
4. Verify data integrity
5. Resume operations

---

## 📊 Monitoring Dashboard

### Key Metrics to Monitor

```
1. Schema Integrity
   - Last validation: [timestamp]
   - Status: ✅ Valid / ❌ Invalid
   - Hash: [SHA-256]

2. Data Integrity
   - Users table checksum: [MD5]
   - Appointments table checksum: [MD5]
   - Clients table checksum: [MD5]
   - Last check: [timestamp]

3. Audit Trail
   - Total entries: [count]
   - Last 24 hours: [count]
   - Suspicious activities: [count]

4. Performance
   - Query response time: [ms]
   - Database connections: [count]
   - Error rate: [%]
```

---

## 🔄 Backup & Recovery

### Automated Backups

```bash
# Daily backup at 2 AM
0 2 * * * pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | gzip > /backups/db_$(date +\%Y\%m\%d).sql.gz

# Weekly full backup
0 3 * * 0 pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | gzip > /backups/full_$(date +\%Y\%m\%d).sql.gz
```

### Recovery Procedure

```bash
# 1. Stop application
systemctl stop mellominds

# 2. Restore from backup
gunzip < /backups/db_20260527.sql.gz | psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# 3. Verify recovery
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) FROM users;"

# 4. Restart application
systemctl start mellominds

# 5. Verify schema integrity
node backend/security/schema-validator.js
```

---

## 📋 Maintenance Schedule

### Daily
- [ ] Check application logs
- [ ] Monitor database performance
- [ ] Verify backups completed

### Weekly
- [ ] Review audit logs
- [ ] Check security alerts
- [ ] Verify schema integrity
- [ ] Test backup recovery

### Monthly
- [ ] Full security audit
- [ ] Update dependencies
- [ ] Review access logs
- [ ] Performance optimization

### Quarterly
- [ ] Penetration testing
- [ ] Security assessment
- [ ] Disaster recovery drill
- [ ] Update security policies

---

## 📞 Support & Escalation

### Critical Issues
- **Schema Tampering:** Immediate escalation
- **Data Corruption:** Immediate escalation
- **Unauthorized Access:** Immediate escalation

### Contact Information
- Security Team: security@mellominds.com
- Database Team: database@mellominds.com
- DevOps Team: devops@mellominds.com

---

## ✅ Security Checklist

- [ ] Schema validation enabled
- [ ] Data integrity monitoring enabled
- [ ] Audit logging enabled
- [ ] Row Level Security enabled
- [ ] Encryption enabled
- [ ] SQL injection prevention enabled
- [ ] Rate limiting enabled
- [ ] CORS configured
- [ ] Security headers enabled
- [ ] Backups automated
- [ ] Monitoring alerts configured
- [ ] Incident response plan ready

---

**Last Updated:** 2026-05-27  
**Version:** 1.0  
**Status:** ✅ Active
