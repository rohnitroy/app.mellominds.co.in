# Security Quick Reference Guide

## 🚀 Quick Start

### Before Production Deployment
```bash
# 1. Validate schema
node backend/security/schema-validator.js

# 2. Check stability
node backend/stability_check.js

# 3. Backup database
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup.sql

# 4. Deploy
npm install --production
npm start
```

---

## 🔐 Security Features at a Glance

| Feature | Status | Check Frequency | Alert Level |
|---------|--------|-----------------|-------------|
| Schema Validation | ✅ Active | On startup | CRITICAL |
| Schema Integrity | ✅ Active | Every 24h | CRITICAL |
| Data Integrity | ✅ Active | Every 6h | WARNING |
| Suspicious Activity | ✅ Active | Every 30m | WARNING |
| Audit Logging | ✅ Active | Continuous | INFO |
| SQL Injection Prevention | ✅ Active | Continuous | CRITICAL |
| Rate Limiting | ✅ Active | Continuous | WARNING |
| CORS Protection | ✅ Active | Continuous | CRITICAL |
| Encryption | ✅ Active | Continuous | INFO |

---

## 📊 Monitoring Commands

### Check Schema Integrity
```bash
node backend/security/schema-validator.js
```

### Check Data Integrity
```bash
node backend/security/data-integrity.js
```

### Check Stability
```bash
node backend/stability_check.js
```

### List All Users
```bash
node backend/list_users.js
```

### View Audit Logs
```sql
SELECT * FROM audit_logs 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Check for Suspicious Activities
```sql
-- Bulk deletions
SELECT * FROM audit_logs 
WHERE action = 'DELETE' 
AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id
HAVING COUNT(*) > 10;

-- Schema changes
SELECT * FROM audit_logs 
WHERE action LIKE '%ALTER%' 
AND created_at > NOW() - INTERVAL '1 hour';
```

---

## 🚨 Incident Response

### If Schema Tampering Detected
```bash
# 1. Stop application
systemctl stop mellominds

# 2. Check what changed
node backend/security/schema-validator.js

# 3. Review audit logs
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20;"

# 4. Restore from backup
gunzip < /backups/db_20260527.sql.gz | psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# 5. Restart application
systemctl start mellominds

# 6. Verify integrity
node backend/security/schema-validator.js
```

### If Data Tampering Detected
```bash
# 1. Enable read-only mode
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "ALTER DATABASE mello_db SET default_transaction_read_only = on;"

# 2. Check what changed
node backend/security/data-integrity.js

# 3. Review audit logs
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT * FROM audit_logs WHERE action IN ('UPDATE', 'DELETE') ORDER BY created_at DESC LIMIT 50;"

# 4. Restore affected data
gunzip < /backups/db_20260527.sql.gz | psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# 5. Disable read-only mode
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "ALTER DATABASE mello_db SET default_transaction_read_only = off;"

# 6. Restart application
systemctl restart mellominds
```

---

## 📋 Daily Maintenance

### Morning Checklist
- [ ] Check application logs for errors
- [ ] Verify database is responding
- [ ] Check backup completed successfully
- [ ] Review any security alerts

### Weekly Checklist
- [ ] Review audit logs
- [ ] Check for suspicious activities
- [ ] Verify schema integrity
- [ ] Test backup recovery
- [ ] Update security patches

### Monthly Checklist
- [ ] Full security audit
- [ ] Review access logs
- [ ] Update dependencies
- [ ] Performance optimization
- [ ] Disaster recovery drill

---

## 🔑 Environment Variables

### Required for Production
```bash
NODE_ENV=production
FRONTEND_URL=https://your-domain.com
GOOGLE_CALLBACK_URL=https://your-domain.com/auth/google/callback
SESSION_SECRET=<generate-new-secure-secret>
ENCRYPTION_MASTER_SECRET=<generate-new-secure-secret>
DB_HOST=<database-host>
DB_PORT=5432
DB_NAME=mello_db
DB_USER=<database-user>
DB_PASSWORD=<database-password>
```

### Generate Secure Secrets
```bash
# Generate SESSION_SECRET (32+ characters)
openssl rand -base64 32

# Generate ENCRYPTION_MASTER_SECRET (32+ characters)
openssl rand -base64 32
```

---

## 🛡️ Security Best Practices

### Do's ✅
- ✅ Use parameterized queries
- ✅ Validate all inputs
- ✅ Log all sensitive operations
- ✅ Use HTTPS/SSL
- ✅ Keep dependencies updated
- ✅ Use strong passwords
- ✅ Enable 2FA for admin
- ✅ Regular backups
- ✅ Monitor logs
- ✅ Test recovery procedures

### Don'ts ❌
- ❌ Don't use string interpolation in SQL
- ❌ Don't hardcode secrets
- ❌ Don't disable security headers
- ❌ Don't skip input validation
- ❌ Don't ignore security alerts
- ❌ Don't use weak passwords
- ❌ Don't skip backups
- ❌ Don't expose error details
- ❌ Don't disable CORS
- ❌ Don't disable rate limiting

---

## 📞 Emergency Contacts

### Critical Issues
- **Security Team:** security@mellominds.com
- **Database Team:** database@mellominds.com
- **DevOps Team:** devops@mellominds.com

### Escalation Procedure
1. Identify severity level
2. Contact appropriate team
3. Preserve logs and evidence
4. Document incident
5. Follow recovery procedure
6. Post-incident review

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| PRODUCTION_DEPLOYMENT_GUIDE.md | Step-by-step deployment |
| SECURITY_MEASURES.md | Comprehensive security docs |
| ANTI_TAMPERING_SUMMARY.md | Implementation summary |
| SECURITY_QUICK_REFERENCE.md | This file |

---

## ✅ Deployment Checklist

- [ ] All security measures implemented
- [ ] Schema validation passing
- [ ] Data integrity verified
- [ ] Backups automated
- [ ] Monitoring configured
- [ ] Alerts configured
- [ ] Team trained
- [ ] Documentation reviewed
- [ ] Incident response plan ready
- [ ] Recovery procedures tested

---

## 🎯 Key Metrics

### Schema Integrity
- Last validation: Check `.schema-hash` file
- Status: Run `node backend/security/schema-validator.js`
- Hash: SHA-256 of schema structure

### Data Integrity
- Last check: Query `audit_logs` table
- Checksums: MD5 of critical tables
- Changes: Count in `audit_logs`

### Performance
- Query time: <100ms for most queries
- Database connections: <50 active
- Error rate: <0.1%

---

## 🚀 Production Deployment

### Step 1: Pre-Deployment
```bash
node backend/security/schema-validator.js
node backend/stability_check.js
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup.sql
```

### Step 2: Update Configuration
```bash
# Update .env for production
NODE_ENV=production
FRONTEND_URL=https://your-domain.com
# Generate new secrets
SESSION_SECRET=$(openssl rand -base64 32)
ENCRYPTION_MASTER_SECRET=$(openssl rand -base64 32)
```

### Step 3: Deploy
```bash
npm install --production
npm start
```

### Step 4: Verify
```bash
curl https://your-domain.com/api/health
node backend/security/schema-validator.js
```

---

## 📝 Logging

### Application Logs
```bash
# View recent logs
tail -f logs/application.log

# Search for errors
grep ERROR logs/application.log

# Search for security alerts
grep "ALERT\|CRITICAL" logs/application.log
```

### Database Logs
```bash
# View PostgreSQL logs
tail -f /var/log/postgresql/postgresql.log

# Search for errors
grep ERROR /var/log/postgresql/postgresql.log
```

### Audit Logs
```sql
-- View recent audit logs
SELECT * FROM audit_logs 
ORDER BY created_at DESC 
LIMIT 100;

-- View by user
SELECT * FROM audit_logs 
WHERE user_id = 1 
ORDER BY created_at DESC;

-- View by action
SELECT * FROM audit_logs 
WHERE action = 'UPDATE' 
ORDER BY created_at DESC;
```

---

**Last Updated:** 2026-05-27  
**Version:** 1.0  
**Status:** ✅ Production Ready
