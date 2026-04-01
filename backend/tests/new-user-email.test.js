/**
 * New User Alert Email — Test Suite
 *
 * Tests:
 *   1. Template output validation (no SMTP, no DB)
 *   2. Live SMTP delivery using real credentials from .env
 *
 * Safe to run at any time:
 *   - Zero DB reads or writes
 *   - No user accounts created or modified
 *   - Email sent only to the internal team addresses (sarafaastha13@gmail.com)
 *
 * Run with:
 *   node --env-file=backend/.env backend/tests/new-user-email.test.js
 */

import '../config/env.js';
import { describe, test, after } from 'node:test';
import { newUserAlertEmail, sendEmail } from '../lib/email.js';

let passed = 0;
let failed = 0;

function ok(label, result, expected) {
    if (result === expected) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.error(`  ❌ ${label}`);
        console.error(`     Expected: ${JSON.stringify(expected)}`);
        console.error(`     Got:      ${JSON.stringify(result)}`);
        failed++;
    }
}

function contains(label, haystack, needle) {
    if (typeof haystack === 'string' && haystack.includes(needle)) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.error(`  ❌ ${label} — "${needle}" not found`);
        failed++;
    }
}

// ─── Suite 1: Template output ─────────────────────────────────────────────────

describe('newUserAlertEmail — template validation', () => {

    test('email signup: subject contains therapist name', () => {
        const { subject } = newUserAlertEmail({
            userName: 'Dr. Test User',
            email: 'testuser@example.com',
            authProvider: 'email',
        });
        contains('subject has name', subject, 'Dr. Test User');
        contains('subject has emoji', subject, '🎉');
    });

    test('email signup: HTML contains all key fields', () => {
        const { html } = newUserAlertEmail({
            userName: 'Dr. Test User',
            email: 'testuser@example.com',
            authProvider: 'email',
        });
        contains('HTML has name',            html, 'Dr. Test User');
        contains('HTML has email',           html, 'testuser@example.com');
        contains('HTML has provider label',  html, 'Email & Password');
        contains('HTML has IST timestamp',   html, 'IST');
        contains('HTML has MelloMinds brand',html, 'MelloMinds');
    });

    test('google signup: provider label is Google OAuth', () => {
        const { html } = newUserAlertEmail({
            userName: 'Google User',
            email: 'googleuser@gmail.com',
            authProvider: 'google',
        });
        contains('HTML has Google OAuth label', html, 'Google OAuth');
        contains('HTML has Google brand color', html, '#4285F4');
    });

    test('email signup: provider color is teal (#2D7579)', () => {
        const { html } = newUserAlertEmail({
            userName: 'Email User',
            email: 'emailuser@example.com',
            authProvider: 'email',
        });
        contains('HTML has teal color for email provider', html, '#2D7579');
    });

    test('subject and html keys are always present', () => {
        const result = newUserAlertEmail({
            userName: 'Anyone',
            email: 'anyone@example.com',
            authProvider: 'email',
        });
        ok('subject key exists',  typeof result.subject, 'string');
        ok('html key exists',     typeof result.html,    'string');
        ok('subject not empty',   result.subject.length > 0, true);
        ok('html not empty',      result.html.length > 0,    true);
    });
});

// ─── Suite 2: Live SMTP delivery ──────────────────────────────────────────────

describe('sendEmail — live SMTP delivery test', () => {

    test('sends new user alert email via real SMTP', async () => {
        const { subject, html } = newUserAlertEmail({
            userName: '[TEST] Kiro Automated Test',
            email:    'kiro-test@mellominds.co.in',
            authProvider: 'email',
        });

        // Prefix subject so it's clearly identifiable as a test in the inbox
        const testSubject = `[TEST] ${subject}`;

        try {
            await sendEmail({
                to:      'sarafaastha13@gmail.com',
                cc:      'adosolve@gmail.com',
                subject: testSubject,
                html,
            });
            console.log('  ✅ SMTP delivery succeeded — check sarafaastha13@gmail.com inbox');
            passed++;
        } catch (err) {
            console.error('  ❌ SMTP delivery failed:', err.message);
            failed++;
        }
    });
});

// ─── Summary ──────────────────────────────────────────────────────────────────

after(() => {
    console.log('\n' + '─'.repeat(55));
    console.log(`Results: ${passed} passed, ${failed} failed`);
    if (failed > 0) {
        console.error('One or more tests failed. See output above.');
        process.exit(1);
    } else {
        console.log('All tests passed. No DB data was touched.');
    }
});
