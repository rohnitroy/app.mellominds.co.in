# Production Deployment Security Guide

## 🔐 Pre-Deployment Checklist

### 1. Database Security
- [ ] Enable PostgreSQL SSL connections
- [ ] Set strong database password (min 32 characters, mixed case, numbers, symbols)
- [ ] Enable database backups (daily minimum)
- [ ] Enable audit logging on all tables
- [ ] Restrict database access to application servers only
- [ ] Use VPC/private network for database
- [ ] Enable database encryption at rest
- [ ] Set up database monitoring and alerts

### 2. Application Security
- [ ] Update all environment variables for production
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS/SSL certificates
- [ ] Set secure session cookies (httpOnly, secure, sameSite)
- [ ] Enable CORS with specific allowed origins
- [ ] Set up rate limiting on all endpoints
- [ ] Enable request validation and sanitization
- [ ] Set up Web Application Firewall (WAF)

### 3. Schema Integrity
- [ ] Run schema validation before deployment
- [ ] Generate and store schema hash
- [ ] Set up schema monitoring alerts
- [ ] Document all expected database tables and columns
- [ ] Create backup of schema definition

### 4. Data Protection
- [ ] Enable encryption for sensitive data fields
- [ ] Set up audit logging for all data modifications
- [ ] Enable row-level security (RLS) policies
- [ ] Set up data integrity monitoring
- [ ] Create backup and recovery procedures

### 5. Access Control
- [ ] Implement strong authentication (2FA for admin)
- [ ] Set up role-based access control (RBAC)
- [ ] Restrict admin panel access by IP
- [ ] Enable API key rotation
- [ ] Set up OAuth provider verification

### 6. Monitoring & Alerts
- [ ] Set up real-time schema change alerts
- [ ] Set up data integrity monitoring alerts
- [ ] Set up suspicious activity detection
- [ ] Set up performance monitoring
- [ ] Set up error tracking and logging

---

## 🚀 Deployment Steps

### Step 1: Pre-Deployment Validation
```bash
# Run schema validation
node backend/security/schema-validator.js

# Run data integrity check
node backend/security/data-integrity.js

# Run stability check
node backend/stability_check.js
```

### Step 2: Database Backup
```bash
# Create full database backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup integrity
pg_restore --list backup_*.sql | head -20
```

### Step 3: Environment Configuration
```bash
# Update .env for production
NODE_ENV=production
FRONTEND_URL=https://your-production-domain.com
GOOGLE_CALLBACK_URL=https://your-production-domain.com/auth/google/callback
SESSION_SECRET=<generate-new-secure-secret>
ENCRYPTION_MASTER_SECRET=<generate-new-secure-secret>
```

### Step 4: Deploy Application
```bash
# Install dependencies
npm install --production

# Build frontend
cd frontend && npm run build

# Start application
npm start
```

### Step 5: Post-Deployment Verification
```bash
# Verify database connection
curl http://localhost:3001/api/health

# Verify schema integrity
node backend/security/schema-validator.js

# Monitor for errors
tail -f logs/application.log
```

---

## 🛡️ Security Hardening

### Database Level
```sql
-- Enable SSL
ALTER SYSTEM SET ssl = on;

-- Enable audit logging
CREATE EXTENSION IF NOT EXISTS pgaudit;
ALTER SYSTEM SET pgaudit.log = 'ALL';

-- Enable encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Set up Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_isolation ON users
  USING (id = current_user_id::integer);
```

### Application Level
```javascript
// Enable security headers
app.use(helmet());

// Enable CORS with restrictions
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Enable rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests'
}));

// Enable request validation
app.use(express.json({ limit: '10mb' }));
app.use(sanitizeMiddleware);
```

---

## 📊 Monitoring & Alerts

### Schema Change Detection
```javascript
// Monitor schema changes every hour
setInterval(async () => {
  const isValid = await verifySchemaIntegrity();
  if (!isValid) {
    // Alert: Schema tampering detected
    sendAlert('CRITICAL: Schema tampering detected!');
  }
}, 60 * 60 * 1000);
```

### Data Integrity Monitoring
```javascript
// Monitor data integrity every 6 hours
setInterval(async () => {
  const checksums = await monitorDataIntegrity();
  // Compare with stored checksums
  // Alert if mismatch detected
}, 6 * 60 * 60 * 1000);
```

### Suspicious Activity Detection
```javascript
// Check for suspicious activities every 30 minutes
setInterval(async () => {
  const result = await detectSuspiciousActivity();
  if (result.suspicious) {
    sendAlert(`ALERT: ${result.reason}`);
  }
}, 30 * 60 * 1000);
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
# Restore from backup
gunzip < /backups/db_20260527.sql.gz | psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# Verify recovery
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) FROM users;"
```

---

## 🚨 Incident Response

### If Schema Tampering Detected
1. **Immediate Actions:**
   - Stop application
   - Alert security team
   - Preserve logs and evidence
   - Isolate database server

2. **Investigation:**
   - Review audit logs
   - Check for unauthorized access
   - Identify what was changed
   - Determine scope of damage

3. **Recovery:**
   - Restore from latest clean backup
   - Verify schema integrity
   - Revalidate all data
   - Restart application

### If Data Tampering Detected
1. **Immediate Actions:**
   - Enable read-only mode
   - Alert security team
   - Preserve audit logs

2. **Investigation:**
   - Review data modification logs
   - Identify affected records
   - Determine scope of changes

3. **Recovery:**
   - Restore affected data from backup
   - Verify data integrity
   - Resume normal operations

---

## 📋 Maintenance Schedule

### Daily
- [ ] Check application logs for errors
- [ ] Monitor database performance
- [ ] Verify backups completed successfully

### Weekly
- [ ] Review audit logs
- [ ] Check for security alerts
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
- **Schema Tampering:** Immediate escalation to security team
- **Data Corruption:** Immediate escalation to database team
- **Unauthorized Access:** Immediate escalation to security team

### Contact Information
- Security Team: security@mellominds.com
- Database Team: database@mellominds.com
- DevOps Team: devops@mellominds.com

---

## ✅ Deployment Sign-Off

- [ ] All pre-deployment checks passed
- [ ] Database backups verified
- [ ] Schema validation passed
- [ ] Security hardening completed
- [ ] Monitoring and alerts configured
- [ ] Team trained on procedures
- [ ] Incident response plan reviewed

**Deployed by:** ________________  
**Date:** ________________  
**Verified by:** ________________  

---

**Last Updated:** 2026-05-27  
**Version:** 1.0
