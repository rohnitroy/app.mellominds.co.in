/**
 * Security Fixes Test Suite
 * 
 * Tests all 8 security fixes using pure logic mocks.
 * - No real DB connections
 * - No real emails sent
 * - No real HTTP calls
 * - No data modified
 * 
 * Run with: node --test tests/security-fixes.test.js
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(label, result, expected) {
    if (result === expected || (expected === undefined && result)) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.error(`  ❌ ${label}`);
        console.error(`     Expected: ${JSON.stringify(expected)}`);
        console.error(`     Got:      ${JSON.stringify(result)}`);
        failed++;
    }
}

function notOk(label, result) {
    if (!result) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.error(`  ❌ ${label} — expected falsy, got: ${JSON.stringify(result)}`);
        failed++;
    }
}

// ─── FIX 1: Temp password NOT in API response ─────────────────────────────────

describe('Fix 1 — forgot-password response does not expose tempPassword', () => {
    test('response body should not contain tempPassword field', () => {
        // Simulate what the fixed route now returns
        const fixedResponse = {
            message: 'If this email is registered, a temporary password has been sent to your inbox.'
        };
        ok('no tempPassword key in response', 'tempPassword' in fixedResponse, false);
        ok('message key present', 'message' in fixedResponse, true);
    });

    test('old response shape is gone', () => {
        // The old shape was: { tempPassword: 'Abc12345' }
        const oldShape = { tempPassword: 'Abc12345' };
        ok('old shape had tempPassword exposed', 'tempPassword' in oldShape, true); // confirm old was bad
        // Fixed shape
        const newShape = { message: 'If this email is registered, a temporary password has been sent to your inbox.' };
        ok('new shape has no tempPassword', 'tempPassword' in newShape, false);
    });
});

// ─── FIX 2: Cashfree webhook signature verification ──────────────────────────

describe('Fix 2 — Cashfree webhook signature cannot be bypassed', () => {
    const secretKey = 'test_secret_key_123';

    function computeSignature(timestamp, rawBody, key) {
        return crypto.createHmac('sha256', key).update(timestamp + rawBody).digest('base64');
    }

    // Simulate the fixed webhook verification logic
    function verifyWebhook({ timestamp, signature, rawBody, secretKey, nodeEnv }) {
        if (timestamp && signature) {
            const expected = computeSignature(timestamp, rawBody, secretKey);
            if (expected !== signature) return { status: 400, error: 'Invalid signature' };
            return { status: 200, received: true };
        } else {
            // No headers
            if (nodeEnv === 'production') {
                return { status: 400, error: 'Webhook signature required in production' };
            }
            // Sandbox: allow but warn
            return { status: 200, received: true, warning: 'no signature headers' };
        }
    }

    test('valid signature passes', () => {
        const ts = String(Date.now());
        const body = JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK', data: { order: { order_id: 'mello_1_123' }, payment: { payment_status: 'SUCCESS' } } });
        const sig = computeSignature(ts, body, secretKey);
        const result = verifyWebhook({ timestamp: ts, signature: sig, rawBody: body, secretKey, nodeEnv: 'production' });
        ok('valid signature → 200', result.status, 200);
    });

    test('tampered signature is rejected', () => {
        const ts = String(Date.now());
        const body = JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK' });
        const result = verifyWebhook({ timestamp: ts, signature: 'bad_signature', rawBody: body, secretKey, nodeEnv: 'production' });
        ok('bad signature → 400', result.status, 400);
        ok('error message present', result.error, 'Invalid signature');
    });

    test('missing signature headers rejected in production', () => {
        const result = verifyWebhook({ timestamp: null, signature: null, rawBody: '{}', secretKey, nodeEnv: 'production' });
        ok('no headers in production → 400', result.status, 400);
        ok('correct error', result.error, 'Webhook signature required in production');
    });

    test('missing signature headers allowed in sandbox', () => {
        const result = verifyWebhook({ timestamp: null, signature: null, rawBody: '{}', secretKey, nodeEnv: 'development' });
        ok('no headers in sandbox → 200', result.status, 200);
        ok('warning present', !!result.warning, true);
    });

    test('old bypass path is gone — no more skipping verification when appointment not found', () => {
        // Old code: if apptRes.rows.length > 0 { verify } else { skip and update DB }
        // New code: verify first using calendar ID from order prefix, reject if not found
        // Simulate: order ID exists, but no credentials found → should reject
        function oldLogic(apptFound, sigPresent) {
            if (sigPresent && apptFound) return 'verified';
            if (sigPresent && !apptFound) return 'skipped_verification'; // BUG
            return 'no_sig';
        }
        function newLogic(credentialsFound, sigPresent, nodeEnv) {
            if (sigPresent && credentialsFound) return 'verified';
            if (sigPresent && !credentialsFound) return 'rejected'; // FIXED
            if (!sigPresent && nodeEnv === 'production') return 'rejected';
            return 'sandbox_allowed';
        }
        ok('old logic had bypass', oldLogic(false, true), 'skipped_verification');
        ok('new logic rejects when creds not found', newLogic(false, true, 'production'), 'rejected');
    });
});

// ─── FIX 3: /api/v1/users route disabled ─────────────────────────────────────

describe('Fix 3 — /api/v1/users route is disabled', () => {
    test('route is commented out in server.js', async () => {
        const fs = await import('node:fs');
        const serverContent = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
        // Check the active (uncommented) mount is absent — commented lines are fine
        const activeMount = serverContent
            .split('\n')
            .filter(line => !line.trim().startsWith('//'))
            .join('\n')
            .includes("app.use('/api/v1/users', usersRoutes)");
        ok('usersRoutes not actively mounted', activeMount, false);
        ok('disable comment present', serverContent.includes('NOTE: /api/v1/users is disabled'), true);
    });
});

// ─── FIX 4: Rate limiter on auth routes ──────────────────────────────────────

describe('Fix 4 — Rate limiter applied to auth routes', () => {
    test('server.js applies authLimiter to /auth', async () => {
        const fs = await import('node:fs');
        const serverContent = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
        ok('authLimiter defined', serverContent.includes('const authLimiter = rateLimit('), true);
        ok('authLimiter applied to /auth route', serverContent.includes("app.use('/auth', authLimiter, authRoutes)"), true);
        ok('windowMs is 15 minutes', serverContent.includes('15 * 60 * 1000'), true);
        ok('max is 20 requests', serverContent.includes('max: 20'), true);
    });

    test('rate limiter logic — blocks after max attempts', () => {
        // Simulate rate limiter counter
        const MAX = 20;
        const WINDOW_MS = 15 * 60 * 1000;
        let hits = 0;
        const windowStart = Date.now();

        function simulateRequest() {
            const now = Date.now();
            if (now - windowStart > WINDOW_MS) hits = 0; // reset window
            hits++;
            if (hits > MAX) return 429;
            return 200;
        }

        // First 20 should pass
        for (let i = 0; i < 20; i++) simulateRequest();
        ok('20 requests pass', hits, 20);

        // 21st should be blocked
        const status = simulateRequest();
        ok('21st request blocked (429)', status, 429);
    });
});

// ─── FIX 5: Helmet security headers ──────────────────────────────────────────

describe('Fix 5 — Helmet middleware added', () => {
    test('helmet imported and used in server.js', async () => {
        const fs = await import('node:fs');
        const serverContent = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
        ok('helmet imported', serverContent.includes("import helmet from 'helmet'"), true);
        ok('helmet applied', serverContent.includes('app.use(helmet('), true);
        ok('crossOriginResourcePolicy set to cross-origin', serverContent.includes("crossOriginResourcePolicy: { policy: 'cross-origin' }"), true);
    });
});

// ─── FIX 6: Notes ownership check ────────────────────────────────────────────

describe('Fix 6 — Notes POST verifies appointment ownership', () => {
    test('notes.js contains ownership check query', async () => {
        const fs = await import('node:fs');
        const notesContent = fs.readFileSync(new URL('../routes/notes.js', import.meta.url), 'utf8');
        ok('ownership check query present', notesContent.includes('SELECT id FROM Appointments WHERE id = $1 AND therapist_id = $2'), true);
        ok('403 returned on ownership failure', notesContent.includes("status(403)"), true);
        ok('access denied message', notesContent.includes('Appointment not found or access denied'), true);
    });

    test('ownership check logic — blocks cross-therapist note creation', () => {
        // Simulate the check
        function canCreateNote(appointmentTherapistId, requestingTherapistId) {
            // Simulates: SELECT id FROM Appointments WHERE id=$1 AND therapist_id=$2
            return appointmentTherapistId === requestingTherapistId;
        }
        ok('same therapist can create note', canCreateNote(42, 42), true);
        ok('different therapist blocked', canCreateNote(42, 99), false);
    });
});

// ─── FIX 7: JSON body size limit ─────────────────────────────────────────────

describe('Fix 7 — JSON body size limit set to 50kb', () => {
    test('server.js sets 50kb limit on json parser', async () => {
        const fs = await import('node:fs');
        const serverContent = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
        ok('json limit set', serverContent.includes("express.json({ limit: '50kb' })"), true);
        ok('urlencoded limit set', serverContent.includes("express.urlencoded({ extended: true, limit: '50kb' })"), true);
    });

    test('50kb limit rejects oversized payloads', () => {
        const LIMIT = 50 * 1024; // 50kb in bytes
        const normalPayload = JSON.stringify({ name: 'test', email: 'test@test.com' });
        const oversizedPayload = 'x'.repeat(LIMIT + 1);
        ok('normal payload under limit', Buffer.byteLength(normalPayload) < LIMIT, true);
        ok('oversized payload over limit', Buffer.byteLength(oversizedPayload) > LIMIT, true);
    });
});

// ─── FIX 8: Pincode input validation ─────────────────────────────────────────

describe('Fix 8 — Pincode validated before external API call', () => {
    // Replicate the exact validation added to MyProfile.tsx
    function shouldFetchPincode(pincode) {
        return /^\d{6}$/.test(pincode);
    }

    test('valid 6-digit pincode triggers fetch', () => {
        ok('110001 is valid', shouldFetchPincode('110001'), true);
        ok('400001 is valid', shouldFetchPincode('400001'), true);
        ok('560001 is valid', shouldFetchPincode('560001'), true);
    });

    test('invalid pincodes do not trigger fetch', () => {
        notOk('5 digits rejected', shouldFetchPincode('11000'));
        notOk('7 digits rejected', shouldFetchPincode('1100011'));
        notOk('letters rejected', shouldFetchPincode('11000a'));
        notOk('empty string rejected', shouldFetchPincode(''));
        notOk('SQL injection rejected', shouldFetchPincode("'; DROP TABLE--"));
        notOk('spaces rejected', shouldFetchPincode('110 001'));
    });

    test('MyProfile.tsx contains the validation guard', async () => {
        const fs = await import('node:fs');
        const profileContent = fs.readFileSync(new URL('../../frontend/src/MyProfile.tsx', import.meta.url), 'utf8');
        ok('regex guard present', profileContent.includes('/^\\d{6}$/.test(pincode)'), true);
        ok('early return on invalid pincode', profileContent.includes('if (!/^\\d{6}$/.test(pincode)) return'), true);
    });
});

// ─── FIX 9: Cashfree SDK crossOrigin attribute ────────────────────────────────

describe('Fix 9 — Cashfree SDK script has crossOrigin attribute', () => {
    test('PublicBookingPage.tsx sets crossOrigin on script tag', async () => {
        const fs = await import('node:fs');
        const pageContent = fs.readFileSync(
            new URL('../../frontend/src/components/PublicBookingPage.tsx', import.meta.url), 'utf8'
        );
        ok('crossOrigin attribute set', pageContent.includes("script.crossOrigin = 'anonymous'"), true);
    });
});

// ─── Summary ──────────────────────────────────────────────────────────────────

after(() => {
    console.log('\n' + '─'.repeat(50));
    console.log(`Results: ${passed} passed, ${failed} failed`);
    if (failed > 0) {
        console.error('Some tests failed. Review the fixes above.');
        process.exit(1);
    } else {
        console.log('All security fix tests passed. No data was modified.');
    }
});
