# ISO/IEC 27001 Compliance Implementation Plan for MelloMinds

**Last Updated:** June 5, 2026  
**Status:** Planning Phase — Ready for Implementation  
**Target Certification Date:** June 2027  
**Total Effort:** 16-20 developer weeks (spread over 12 months)

---

## Executive Summary

MelloMinds handles sensitive therapist/client data and payment information. ISO 27001 certification requires establishing an Information Security Management System (ISMS) across 14 control areas. This plan outlines phased implementation without breaking existing functionality or losing data.

---

## Current State Assessment

### What's Already in Place ✅

- Password hashing (bcrypt)
- Session-based authentication (express-session + PostgreSQL)
- CORS protection
- Rate limiting on auth endpoints
- Helmet security headers
- Payment signature verification
- Encrypted credential storage (user_integrations table)
- HTTPS-ready deployment (Vercel/Render)
- Data in PostgreSQL (auditable, backupable)

### What's Missing ❌

- Formal information security policy documentation
- Data classification scheme
- Access control matrix (role-based permissions)
- Encryption at rest for database
- Comprehensive audit logging
- Incident response plan
- Business continuity/disaster recovery plan
- Vendor/third-party security assessment
- Security awareness training records
- Change management process
- Data retention & deletion policies
- Security risk assessment documentation

---

## 14 ISO 27001 Control Areas & Implementation Details

### AREA 1: Information Security Policies (A.5)

**Requirement:** Documented security policies approved by management.

**What to Do:**
- Create `docs/SECURITY_POLICY.md` covering:
  - Security objectives aligned with business goals
  - Password policy (min 12 chars, complexity rules)
  - Data classification (Public/Internal/Confidential/Restricted)
  - Acceptable use policy for developers
  - Incident reporting procedures
- Commit with timestamp (immutable record)

**Impact:** Documentation only  
**Timeline:** 1 week  
**Risk:** None  
**Data Loss Risk:** None

---

### AREA 2: Organization of Information Security (A.6)

**Requirement:** Defined roles, responsibilities, security committee.

**What to Do:**
- Document in `docs/SECURITY_GOVERNANCE.md`:
  - Chief Information Security Officer (CISO) role assigned
  - Security committee with monthly meetings
  - Responsibility matrix (who owns access control, incidents, backups, etc.)
  - Escalation process for security issues
- Create `CISO_CONTACTS.md` with on-call rotation

**Impact:** Documentation only  
**Timeline:** 1 week  
**Risk:** None  
**Data Loss Risk:** None

---

### AREA 3: Human Resource Security (A.7)

**Requirement:** Employee background checks, security training, clear desk policy.

**What to Do:**
- Implement pre-hire background verification (legal requirement capture)
- Create `docs/TRAINING_PLAN.md`:
  - Mandatory annual ISO 27001 security training (proof via LMS or email)
  - Specific training for developers (secure coding, data handling)
  - Track completion in `TRAINING_LOG.xlsx` (not in repo)
- Document clear desk policy in employee handbook

**Impact:** Process & documentation  
**Timeline:** Ongoing  
**Risk:** None  
**Data Loss Risk:** None

---

### AREA 4: Asset Management (A.8)

**Requirement:** Inventory of all information assets, ownership, classification.

**What to Do:**
1. Create `docs/ASSET_INVENTORY.md`:
   - List all data assets: users table, appointments, payments, credentials, etc.
   - Owner: therapist data = Product Manager; payment data = Finance Lead; etc.
   - Classification: therapist/client PII = Confidential; session notes = Restricted; etc.
   - Media handling: database backups, logs, code repositories

2. Create `docs/DATA_RETENTION_POLICY.md`:
   - Deleted users: retain encrypted for 90 days (GDPR Right to Erasure)
   - Session logs: retain for 1 year for audit
   - Payment records: retain 7 years (compliance)
   - Old backups: retain latest 30 days + monthly snapshots for 1 year

**Impact:** Documentation only  
**Timeline:** 2 weeks  
**Risk:** None  
**Data Loss Risk:** None

---

### AREA 5: Access Control (A.9)

**Requirement:** User access policies, role-based permissions, privilege management.

**Phase 1 (Immediate, Non-Breaking):**
1. Document current access in `docs/ACCESS_CONTROL_MATRIX.md`:
   - Frontend: therapists see only their data (calendar_id checked client-side)
   - Backend: `req.user.id` enforced on all routes; therapist_id foreign key filters
   - Database: no direct SQL access; all via app APIs
   - Admin access: none (explicitly documented as gap; recommend future admin panel)
   - Third-party integrations: Google OAuth (read-only calendar), Razorpay/Cashfree (isolated credentials per therapist)

2. Create `docs/PRIVILEGE_MANAGEMENT.md`:
   - How to onboard new developers (git access, staging env access, production restrictions)
   - Database access: staging only for devs; production via read-only replica or queries only
   - No direct production database access (enforce via IAM in hosting provider)

**Phase 2 (Week 4, Minor Changes, Fully Reversible):**
1. Add role field to database:
   ```sql
   ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'therapist';
   -- Possible values: 'therapist', 'admin' (for future use)
   ```
   Additive only; no data loss, backward compatible.

2. Add role check middleware (defensive):
   ```javascript
   // In routes: if (!['therapist', 'admin'].includes(req.user.role)) { ... }
   // Currently all therapists; admin role prepared for future
   ```

**Impact:** Phase 1: Documentation | Phase 2: Schema + Code (additive)  
**Timeline:** Phase 1: 1 week | Phase 2: 2 weeks  
**Risk:** Very Low (additive columns, defensive checks)  
**Data Loss Risk:** None (can be rolled back)

---

### AREA 6: Cryptography (A.10)

**Requirement:** Encryption of data in transit and at rest; key management.

**Current State:**
- ✅ In transit: HTTPS enforced (Render/Vercel handle TLS)
- ✅ Passwords: bcrypt hashing
- ✅ Credentials: encrypted in user_integrations table
- ❌ Database: data at rest is plain
- ❌ Key management documented

**Phase 1 (Documentation, Immediate):**
1. Create `docs/ENCRYPTION_POLICY.md`:
   - In-transit: TLS 1.2+ required for all API calls (enforce via HSTS headers)
   - At-rest: PostgreSQL native encryption at storage level (AWS RDS, Railway handle this)
   - Credentials: verify encryption in `user_integrations` table
   - Key rotation: annual for application secrets; documented process in `docs/KEY_ROTATION.md`

2. Document current implementation:
   ```javascript
   // Verify in backend/routes/razorpay.js (or similar):
   const encryptedCreds = encrypt(therapistCredentials); // Should exist
   ```

**Phase 2 (Add Encryption Layer, Week 3, Fully Reversible):**
1. If not already encrypted, add to `user_integrations`:
   ```javascript
   const crypto = require('crypto');
   
   function encryptSensitive(data) {
       const key = process.env.ENCRYPTION_KEY;
       const iv = crypto.randomBytes(16);
       const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
       let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
       encrypted += cipher.final('hex');
       const authTag = cipher.getAuthTag();
       return { iv: iv.toString('hex'), data: encrypted, authTag: authTag.toString('hex') };
   }
   
   function decryptSensitive(encryptedObj) {
       const key = process.env.ENCRYPTION_KEY;
       const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), Buffer.from(encryptedObj.iv, 'hex'));
       decipher.setAuthTag(Buffer.from(encryptedObj.authTag, 'hex'));
       let decrypted = decipher.update(encryptedObj.data, 'hex', 'utf8');
       decrypted += decipher.final('utf8');
       return JSON.parse(decrypted);
   }
   ```

2. Update storage to use encryption (JSONB can hold encrypted blob)
3. Backward compatible: old records decrypt fine, new records use new encryption
4. **Fully reversible by decrypting and re-storing**

**Impact:** Phase 1: Documentation | Phase 2: Code (additive encryption layer)  
**Timeline:** Phase 1: 3 days | Phase 2: 1 week  
**Risk:** None (encryption is additive)  
**Data Loss Risk:** None

---

### AREA 7: Physical & Environmental Security (A.11)

**Requirement:** Secure data center, access controls, backup procedures.

**What to Do:**
1. Document in `docs/PHYSICAL_SECURITY.md`:
   - Hosting: Render (Node.js), Vercel (React), AWS RDS or Railway (PostgreSQL)
   - All hosted on managed cloud services with SOC 2 Type II compliance
   - Physical access: handled by cloud providers
   - Backups: automated daily snapshots; retention 30 days

2. Create `docs/BACKUP_RECOVERY_PLAN.md`:
   - RTO (Recovery Time Objective): 1 hour
   - RPO (Recovery Point Objective): last 24 hours
   - Test recovery monthly (document in `BACKUP_TEST_LOG.md`)
   - Contact info for cloud provider support

**Impact:** Documentation only  
**Timeline:** 1 week  
**Risk:** None  
**Data Loss Risk:** None

---

### AREA 8: Operations Security (A.12)

**Requirement:** Documented procedures, change management, incident handling.

**Phase 1 (Documentation):**
1. Create `docs/CHANGE_MANAGEMENT.md`:
   - All changes via git commits (immutable audit trail)
   - Review/approval: pull request review before merge (enforce in GitHub)
   - Testing: staging environment for all changes
   - Rollback: git revert or hotfix branch
   - Documentation: commit messages must include reason

2. Create `docs/INCIDENT_RESPONSE.md`:
   - Classification: Critical/High/Medium/Low
   - Response procedure: detect → contain → eradicate → recover → communicate
   - Escalation: who to notify (CISO, legal, customers)
   - Communication template
   - Post-incident review within 48 hours

3. Create `INCIDENT_LOG.md` (template) for recording incidents

**Phase 2 (Add Audit Logging, Week 2):**
Create comprehensive audit trail (additive table):

```sql
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    action VARCHAR(255),
    resource VARCHAR(255),
    details JSONB,
    ip_address VARCHAR(45),
    timestamp TIMESTAMP DEFAULT NOW(),
    status VARCHAR(50)
);
```

Log on sensitive operations:
- User login/logout
- Payment processing (create, refund)
- Credential connection (Razorpay, Cashfree)
- Data export/access
- Password changes

```javascript
async function logAudit(userId, action, resource, details, status = 'success') {
    await db.query(
        'INSERT INTO audit_log (user_id, action, resource, details, ip_address, timestamp, status) VALUES ($1, $2, $3, $4, $5, NOW(), $6)',
        [userId, action, resource, JSON.stringify(details), req.ip, status]
    );
}

// Usage in routes:
app.post('/api/razorpay/refund', async (req, res) => {
    try {
        const result = await processRefund(...);
        await logAudit(req.user.id, 'payment_refund', `appointment_${appointmentId}`, { amount: refundAmount, reason: 'cancellation' });
        res.json(result);
    } catch (err) {
        await logAudit(req.user.id, 'payment_refund', `appointment_${appointmentId}`, { error: err.message }, 'failure');
        res.status(500).json({ error: 'Refund failed' });
    }
});
```

**Impact:** Phase 1: Documentation | Phase 2: New table + logging in routes  
**Timeline:** Phase 1: 1 week | Phase 2: 2 weeks  
**Risk:** None (additive table, non-breaking)  
**Data Loss Risk:** None

---

### AREA 9: Communications Security (A.13)

**Requirement:** Secure data transfer, network controls, email encryption.

**What to Do:**
1. Document in `docs/COMMUNICATIONS_SECURITY.md`:
   - All APIs: HTTPS required (enforce via redirect and CORS)
   - Email: transactional emails (Resend/SendGrid) over TLS
   - Payment data: no sensitive data in logs or error messages
   - API keys: stored in environment variables, never in code
   - Database connection: over TLS (cloud provider handles)

2. Verify current security headers:
   ```javascript
   // Already exists (from Helmet + CORS):
   // - Strict-Transport-Security: enforce HTTPS
   // - Content-Security-Policy: prevent XSS
   // - X-Frame-Options: prevent clickjacking
   ```

3. Create `docs/SECRETS_MANAGEMENT.md`:
   - Never commit `.env` files
   - Rotate API keys annually
   - Use GitHub Secrets for CI/CD
   - Audit who has access to production secrets

**Impact:** Documentation only  
**Timeline:** 1 week  
**Risk:** None  
**Data Loss Risk:** None

---

### AREA 10: System Acquisition, Development & Maintenance (A.14)

**Requirement:** Secure development practices, code review, testing, deployment.

**Phase 1 (Documentation):**
1. Create `docs/SECURE_CODING_STANDARDS.md`:
   - Input validation: sanitize all user input (escape SQL, XSS)
   - Authentication: session timeout 30 mins; force re-auth for sensitive ops
   - Authorization: `req.user.id` checks on all routes
   - Error handling: generic messages to users; detailed logs for debugging
   - Dependency management: `npm audit` weekly; update vulnerabilities

2. Create `docs/CODE_REVIEW_CHECKLIST.md`:
   - All PRs require review before merge
   - Checklist: no hardcoded secrets, input validation, auth checks, error handling
   - Security reviewer assigned randomly

3. Create `docs/TESTING_PLAN.md`:
   - Unit tests: 80%+ coverage
   - Integration tests: payment flows, auth flows
   - Security tests: SQL injection, XSS, CSRF
   - Penetration testing: annual by third-party

**Phase 2 (Add Dependency Scanning, Week 2):**
Add GitHub Actions workflow:

```yaml
name: Security Audit
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm audit --audit-level=moderate
```

Enforces no medium+ vulnerabilities in dependencies.

**Impact:** Phase 1: Documentation | Phase 2: CI/CD (non-breaking)  
**Timeline:** Phase 1: 1 week | Phase 2: 3 days  
**Risk:** None  
**Data Loss Risk:** None

---

### AREA 11: Supplier Relationships (A.15)

**Requirement:** Third-party security assessments, contracts.

**What to Do:**
1. Create `docs/SUPPLIER_SECURITY_ASSESSMENT.md`:
   - List all third parties:
     - **Razorpay:** aggregator model, no MelloMinds PII, therapist credentials encrypted
     - **Cashfree:** same as Razorpay
     - **Google:** OAuth (read-only calendar), no payment data
     - **Cloudinary:** media storage, no PII
     - **Resend/SendGrid:** transactional email, no sensitive data
     - **Render/Railway/Vercel:** hosting, SOC 2 Type II compliance
   - For each: verify SOC 2 / ISO 27001 / equivalent compliance
   - Contracts: DPA (Data Processing Agreement) with all data processors

2. Document incident notification requirements: third-parties must notify within 24 hours if breach occurs

**Impact:** Documentation only  
**Timeline:** 2 weeks  
**Risk:** None  
**Data Loss Risk:** None

---

### AREA 12: Information Security Incident Management (A.16)

**Requirement:** Incident detection, response, reporting.

**Phase 1 (Documentation & Process):**
Expand `docs/INCIDENT_RESPONSE.md`:
- **Detection:** audit logs reviewed daily; automated alerts for:
  - Failed login attempts (>5 in 1 min = IP block)
  - Refund requests (>₹50k in 1 day = manual review)
  - Data exports (any export = logged + notification)
- **Containment:** revoke compromised API keys; force password reset if needed
- **Communication:** notify CISO within 1 hour; affected users within 24 hours
- **Regulatory:** report to data protection authority if PII leaked (GDPR / India privacy law)

Create incident severity matrix:
- **Critical:** payment gateway compromised, PII exposed (< 1 hour response)
- **High:** unauthorized access detected, data tampering (< 4 hour response)
- **Medium:** failed authentication, potential vulnerability (< 1 day response)
- **Low:** suspicious log pattern, third-party alert (< 1 week response)

**Phase 2 (Add Automated Alerts, Week 3):**
```javascript
const failedLogins = new Map();

app.post('/api/auth/login', async (req, res) => {
    if (failedLogins.get(req.body.email) > 5) {
        await logAudit(null, 'login_blocked', req.ip, { reason: 'excessive_failures' }, 'failure');
        // TODO: integrate with alerting (PagerDuty, Slack webhook)
        res.status(429).json({ error: 'Too many attempts. Try again later.' });
        return;
    }
    // ... rest of login logic
});
```

**Impact:** Phase 1: Documentation | Phase 2: Monitoring code (non-breaking)  
**Timeline:** Phase 1: 1 week | Phase 2: 2 weeks  
**Risk:** None  
**Data Loss Risk:** None

---

### AREA 13: Business Continuity Management (A.17)

**Requirement:** BCP, disaster recovery, testing.

**What to Do:**
1. Create `docs/BUSINESS_CONTINUITY_PLAN.md`:
   - **Critical functions:** therapist access, client bookings, payment processing
   - **RTO:** 1 hour (automated failover)
   - **RPO:** 24 hours (daily backups)
   - **Disaster scenarios:**
     - Database corruption: restore from backup (< 1 hour)
     - App crash: automated restart (< 5 mins)
     - DDoS attack: Render/Vercel handle mitigation
     - Third-party outage: queue payments, retry when available
   - **Communication:** status page (Statuspage.io) updated every 30 mins

2. Create `docs/BACKUP_RESTORE_PROCEDURE.md`:
   - Monthly drill: restore backup to staging, verify integrity
   - Document in `BACKUP_TEST_LOG.md`

3. Create `docs/FAILOVER_PROCEDURE.md`:
   - If production down: switch DNS (if applicable) or wait for auto-recovery
   - Estimated downtime: < 1 hour

**Impact:** Documentation only  
**Timeline:** 1 week  
**Risk:** None  
**Data Loss Risk:** None

---

### AREA 14: Compliance (A.18)

**Requirement:** Regulatory compliance, internal audits, legal obligations.

**What to Do:**
1. Create `docs/COMPLIANCE_FRAMEWORK.md`:
   - **GDPR (EU users):** DPA with cloud providers, right to deletion (soft-delete for 90 days), consent tracking
   - **India privacy law:** follow GDPR standards (safer approach)
   - **PCI DSS:** N/A (payment data never touches platform)
   - **GST:** compliance layer (not yet implemented; documented for future)

2. Create `docs/LEGAL_OBLIGATIONS.md`:
   - Therapist licensing verification (recommend background check service)
   - Client consent for data processing (in-app during intake)
   - Data retention: session notes 7 years, client profiles 5 years after last booking
   - Audit log retention: 2 years minimum

3. Create `docs/INTERNAL_AUDIT_CHECKLIST.md`:
   - Annual review: access control, encryption, backups, incidents
   - Semi-annual: dependency vulnerabilities, policy updates
   - Document findings in `INTERNAL_AUDIT_LOG.md`

**Impact:** Documentation only  
**Timeline:** 2 weeks  
**Risk:** None  
**Data Loss Risk:** None

---

## 12-Month Implementation Roadmap

| Month | Week | Task | Impact | Risk | Timeline |
|---|---|---|---|---|---|
| **Month 1** | 1 | Security policy docs (A.5, A.6, A.7, A.8) | Docs | None | 1 wk |
| | 2 | Governance & contacts (A.6) | Docs | None | 1 wk |
| | 3-4 | Asset inventory & data retention (A.8) | Docs | None | 2 wk |
| **Month 2** | 5 | Access control matrix (A.9) | Docs | None | 1 wk |
| | 6 | Change management & incident response (A.12) | Docs | None | 1 wk |
| | 7-8 | Physical security & backups (A.11) | Docs | None | 2 wk |
| **Month 3** | 9-10 | **Add role column to users table** (A.9) | Schema | Very Low | 2 wk |
| | 11-12 | **Create audit_log table** (A.12) | Schema | None | 2 wk |
| **Month 4** | 13-14 | **Implement audit logging in routes** (A.12) | Code | Low | 2 wk |
| | 15-16 | Secure coding standards (A.14) | Docs | None | 2 wk |
| **Month 5** | 17-18 | **Encrypt at-rest credentials** (A.6) | Code | Low | 2 wk |
| | 19-20 | Communications security (A.13) | Docs | None | 2 wk |
| **Month 6** | 21-22 | **Add automated alerts** (A.16) | Code | None | 2 wk |
| | 23-24 | Incident response drill | Process | None | 2 wk |
| **Month 7** | 25-26 | Third-party assessments (A.15) | Docs | None | 2 wk |
| | 27-28 | Code review checklist (A.14) | Docs | None | 2 wk |
| **Month 8** | 29-30 | **Add dependency scanning CI/CD** (A.14) | CI/CD | None | 1 wk |
| | 31-32 | Testing plan & penetration test quotes (A.14) | Docs | None | 2 wk |
| **Month 9-12** | 33-52 | Business continuity, compliance framework, internal audits, annual penetration test | Docs + Process + External | None | 4 mo |

---

## Data Safety Guarantees

### Before Any Schema Changes

```bash
# Backup database
pg_dump production_db > backup_$(date +%Y%m%d).sql
```

### Testing Protocol
- All migrations run on staging first
- Verify data integrity before → after: `SELECT COUNT(*) FROM table`
- Additive changes only (no deletions)

### Reversibility
- **Encryption is reversible:** can recover plain data from backups; code layer can be disabled
- **Schema changes are additive:** new columns, new tables (backward compatible)
- **Git history preserves everything:** any change can be undone via `git revert`
- **Automated backups:** daily snapshots; test restore monthly

### Key Principles
1. **No production data is deleted**
2. **All changes are tested on staging first**
3. **Backup exists before every schema change**
4. **Rollback procedure documented for each change**
5. **Git audit trail is permanent**

---

## Cost Estimate

| Item | Cost |
|---|---|
| **Developer time** | 16-20 weeks (₹8-12 lakhs depending on rates) |
| **GitHub Actions CI/CD** | Free |
| **Statuspage (optional)** | $150/month |
| **Penetration testing** | ₹3-5 lakhs (annual) |
| **ISO 27001 audit & certification** | ₹5-10 lakhs (optional; adds credibility) |
| **Total first year** | ₹17-32 lakhs |
| **Total per year (ongoing)** | ₹8-15 lakhs (maintenance + testing) |

---

## Start Here: Week 1 Tasks

1. **Create `docs/SECURITY_POLICY.md`** — 2 days
2. **Create `docs/SECURITY_GOVERNANCE.md`** — 1 day
3. **Create `docs/ASSET_INVENTORY.md`** — 2 days
4. **Assign CISO role** — same day
5. **Commit & push** — same day

**Expected output:** 4 documentation files, 0 code changes, 0 data loss, ready for Month 1 completion.

---

## Questions Before Starting?

1. Which control area to start with? (Recommend: Areas 1-2 first, then 4-5)
2. Who should be CISO?
3. Penetration testing: internal vs. external vendor?
4. ISO 27001 certification: desired or nice-to-have?

---

**Reference:** This plan aligns with ISO/IEC 27001:2022 (latest version). All 14 control areas mapped. Non-breaking, data-safe implementation path provided.
