# Payment, Cancellation & Reschedule Policy - Issues Found & Fixes

## 🔴 CRITICAL ISSUES FOUND (8 Total)

### Issue #1: Reschedule Fees Never Charged ⚠️ CRITICAL
**Severity:** CRITICAL - Revenue Loss
**Location:** `backend/routes/bookings.js` (POST /manage/:token/reschedule)
**Problem:** 
- Reschedule fee is stored in policy but never charged or deducted
- `policy.fee` field is completely ignored during rescheduling
- No payment collection for paid rescheduling

**Impact:**
- Therapists can't collect reschedule fees
- Clients get free rescheduling even when fee is configured
- Revenue loss for therapists

**Example:**
```
Calendar configured: Reschedule fee = ₹500 (paid)
Client reschedules booking
Expected: ₹500 charged
Actual: Nothing charged
```

**Fix Needed:**
```javascript
// Add fee charging logic in reschedule endpoint
if (policy?.enabled && policy?.type === 'paid' && policy?.fee) {
    const fee = parseFloat(policy.fee);
    if (fee > 0) {
        // Charge fee or deduct from refund
        await pool.query(
            `UPDATE Appointments SET 
                payment_amount = payment_amount + $1,
                reschedule_fee_charged = $1
             WHERE id = $2`,
            [fee, appt.id]
        );
    }
}
```

---

### Issue #2: Partial Refund Percentage Ignored ⚠️ CRITICAL
**Severity:** CRITICAL - Incorrect Refunds
**Location:** `backend/routes/bookings.js` (POST /manage/:token/cancel)
**Problem:**
- `refundPercentage` field is stored in database but never used
- All partial refunds treated as full refunds
- No calculation of actual refund amount

**Impact:**
- Clients get full refunds when partial refund is configured
- Therapists lose money on cancellations
- Incorrect payment status tracking

**Example:**
```
Calendar configured: Partial refund = 50%
Client paid: ₹1000
Client cancels
Expected refund: ₹500 (50%)
Actual refund: ₹1000 (100%)
```

**Current Code:**
```javascript
// Line 432-440 in bookings.js
if (refundType === 'partial') {
    newPaymentStatus = `CASE WHEN payment_status = 'Paid' THEN 'Partial Refund' ...`;
}
// ❌ refundPercentage is never used!
```

**Fix Needed:**
```javascript
if (refundType === 'partial' && policy?.refundPercentage) {
    const refundPercent = parseFloat(policy.refundPercentage) / 100;
    const refundAmount = appt.payment_amount * refundPercent;
    // Store refund amount for tracking
    await pool.query(
        `UPDATE Appointments SET 
            payment_status = 'Partial Refund',
            refund_amount = $1
         WHERE id = $2`,
        [refundAmount, appt.id]
    );
}
```

---

### Issue #3: Payment Not Enforced During Booking ⚠️ CRITICAL
**Severity:** CRITICAL - No Payment Collection
**Location:** `backend/routes/bookings.js` (POST /public)
**Problem:**
- Booking is created with `payment_status='Pending'` even if payment is required
- No check that payment gateway is connected
- No redirect to payment gateway for paid bookings
- Clients can book without paying

**Impact:**
- Therapists don't receive payment
- Bookings created without payment verification
- Revenue loss

**Example:**
```
Calendar configured: Payment enabled, Razorpay gateway
Client books session
Expected: Redirect to Razorpay payment
Actual: Booking created immediately, payment_status='Pending'
```

**Current Code:**
```javascript
// Line 183-186 in bookings.js
const bookingAmount = calendarService.payment_enabled && calendarService.prices?.length
    ? (calendarService.prices[0]?.amount || 0)
    : 0;
// ❌ Amount is calculated but payment is never enforced!
```

**Fix Needed:**
```javascript
if (calendarService.payment_enabled) {
    if (!calendarService.payment_gateway) {
        return res.status(400).json({ error: 'Payment gateway not configured' });
    }
    if (!calendarService.prices?.length) {
        return res.status(400).json({ error: 'No prices configured' });
    }
    // For non-offline payments, require payment before booking
    if (calendarService.payment_gateway !== 'offline') {
        return res.status(402).json({ 
            error: 'Payment required',
            payment_gateway: calendarService.payment_gateway,
            amount: bookingAmount
        });
    }
}
```

---

### Issue #4: No Refund Amount Tracking ⚠️ HIGH
**Severity:** HIGH - No Audit Trail
**Location:** Database schema and `backend/routes/bookings.js`
**Problem:**
- Only payment status changes, actual refund amounts not stored
- No way to know how much was refunded
- No audit trail for refunds

**Impact:**
- Can't track refund amounts
- No audit trail for disputes
- Accounting issues

**Database Missing:**
```sql
-- These columns don't exist:
refund_amount DECIMAL(10, 2)
reschedule_fee_charged DECIMAL(10, 2)
refund_reason VARCHAR(255)
```

**Fix Needed:**
```sql
ALTER TABLE Appointments ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10, 2) DEFAULT 0.00;
ALTER TABLE Appointments ADD COLUMN IF NOT EXISTS reschedule_fee_charged DECIMAL(10, 2) DEFAULT 0.00;
ALTER TABLE Appointments ADD COLUMN IF NOT EXISTS refund_reason VARCHAR(255);
```

---

### Issue #5: No Payment Gateway Validation ⚠️ HIGH
**Severity:** HIGH - Booking Failures
**Location:** `backend/routes/calendars.js` (POST /api/calendars)
**Problem:**
- Calendar can be created with `payment_gateway='razorpay'` even if not connected
- No verification that selected gateway is actually connected
- Booking fails when trying to process payment

**Impact:**
- Bookings fail with cryptic errors
- Poor user experience
- Therapists don't know why bookings are failing

**Example:**
```
Therapist creates calendar with Razorpay payment
But hasn't connected Razorpay credentials
Client tries to book
Expected: Error message "Connect Razorpay first"
Actual: Booking fails with generic error
```

**Current Code:**
```javascript
// Line 224 in calendars.js
add('payment_gateway', payment_data.paymentGateways?.[0] || null);
// ❌ No validation that gateway is connected!
```

**Fix Needed:**
```javascript
if (payment_data?.acceptPayment && payment_data?.paymentGateways?.length) {
    const gateway = payment_data.paymentGateways[0];
    if (gateway !== 'offline') {
        const gwCheck = await pool.query(
            `SELECT id FROM UserIntegrations WHERE user_id = $1 AND provider = $2`,
            [targetUserId, gateway]
        );
        if (gwCheck.rows.length === 0) {
            return res.status(400).json({ 
                error: `Payment gateway '${gateway}' is not connected. Please connect it first.` 
            });
        }
    }
}
```

---

### Issue #6: No Policy Structure Validation ⚠️ MEDIUM
**Severity:** MEDIUM - Invalid Policies
**Location:** `backend/routes/calendars.js` and `backend/routes/bookings.js`
**Problem:**
- Invalid policy values accepted (negative windows, invalid units)
- No schema validation for JSONB structures
- Policies don't work as intended

**Impact:**
- Policies behave unpredictably
- Invalid configurations accepted
- Enforcement fails silently

**Examples of Invalid Policies Accepted:**
```json
{
  "window": "-24",  // ❌ Negative window
  "unit": "weeks"   // ❌ Invalid unit (should be hours/days/minutes)
}

{
  "refundPercentage": "150"  // ❌ > 100%
}

{
  "fee": "-500"  // ❌ Negative fee
}
```

**Fix Needed:**
```javascript
// Validation function
function validateCancellationPolicy(policy) {
    if (!policy) return true;
    
    if (policy.enabled) {
        const window = parseInt(policy.window);
        if (isNaN(window) || window <= 0) {
            throw new Error('Cancellation window must be a positive number');
        }
        if (!['minutes', 'hours', 'days'].includes(policy.unit)) {
            throw new Error('Invalid unit. Must be minutes, hours, or days');
        }
        if (!['full', 'partial', 'none'].includes(policy.refundType)) {
            throw new Error('Invalid refund type');
        }
        if (policy.refundType === 'partial') {
            const percent = parseFloat(policy.refundPercentage);
            if (isNaN(percent) || percent < 0 || percent > 100) {
                throw new Error('Refund percentage must be between 0 and 100');
            }
        }
    }
    return true;
}
```

---

### Issue #7: Offline Payment Not Handled ⚠️ MEDIUM
**Severity:** MEDIUM - No Verification
**Location:** `backend/routes/bookings.js` (POST /public)
**Problem:**
- Offline payments marked as "Pending" forever
- No way to mark offline payments as received
- No verification of offline payment

**Impact:**
- Therapists can't confirm offline payments
- Clients don't know if payment was received
- No payment tracking for offline bookings

**Fix Needed:**
```javascript
// Add endpoint to mark offline payment as received
router.patch('/:id/mark-payment-received', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const bookingId = req.params.id;
        
        const result = await pool.query(
            `UPDATE Appointments 
             SET payment_status = 'Paid'
             WHERE id = $1 AND therapist_id = $2 AND payment_status = 'Pending'
             RETURNING *`,
            [bookingId, userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Booking not found or already paid' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to mark payment as received' });
    }
});
```

---

### Issue #8: No Policy Display to Clients ⚠️ MEDIUM
**Severity:** MEDIUM - Poor UX
**Location:** `frontend/src/components/PublicBookingPage.tsx`
**Problem:**
- Cancellation/reschedule policies not shown to clients before booking
- Clients don't know the terms
- No fee disclosure

**Impact:**
- Clients don't know cancellation terms
- Disputes arise after booking
- Poor user experience

**Fix Needed:**
```javascript
// Display policies in booking confirmation
<div className={styles.policiesSection}>
    <h3>Cancellation & Reschedule Policies</h3>
    
    {calendar.cancellation_policy?.enabled && (
        <div>
            <p><strong>Cancellation:</strong></p>
            <p>Must cancel at least {calendar.cancellation_policy.window} {calendar.cancellation_policy.unit} before session</p>
            <p>Refund: {
                calendar.cancellation_policy.refundType === 'full' ? '100%' :
                calendar.cancellation_policy.refundType === 'partial' ? `${calendar.cancellation_policy.refundPercentage}%` :
                'None'
            }</p>
        </div>
    )}
    
    {calendar.reschedule_policy?.enabled && (
        <div>
            <p><strong>Reschedule:</strong></p>
            <p>Must reschedule at least {calendar.reschedule_policy.window} {calendar.reschedule_policy.unit} before session</p>
            {calendar.reschedule_policy.type === 'paid' && (
                <p>Fee: ₹{calendar.reschedule_policy.fee}</p>
            )}
        </div>
    )}
</div>
```

---

## 📊 Issue Summary

| Issue | Severity | Type | Impact | Status |
|-------|----------|------|--------|--------|
| Reschedule fees not charged | CRITICAL | Logic | Revenue loss | ❌ Not Fixed |
| Partial refund % ignored | CRITICAL | Logic | Incorrect refunds | ❌ Not Fixed |
| Payment not enforced | CRITICAL | Logic | No payment collection | ❌ Not Fixed |
| No refund tracking | HIGH | Schema | No audit trail | ❌ Not Fixed |
| No gateway validation | HIGH | Logic | Booking failures | ❌ Not Fixed |
| No policy validation | MEDIUM | Logic | Invalid policies | ❌ Not Fixed |
| Offline payment not handled | MEDIUM | Logic | No verification | ❌ Not Fixed |
| Policies not shown to clients | MEDIUM | UI | Poor UX | ❌ Not Fixed |

---

## 🔧 Implementation Priority

### Phase 1: Critical Fixes (Do First)
1. Implement reschedule fee charging
2. Calculate partial refund amounts
3. Enforce payment before booking
4. Add payment gateway validation

### Phase 2: High Priority (Do Next)
1. Add refund amount tracking columns
2. Implement policy structure validation
3. Display policies to clients
4. Add manual payment verification

### Phase 3: Medium Priority (Do Later)
1. Add policy versioning
2. Implement audit trail
3. Add refund reason tracking
4. Create management dashboard

---

## 📝 Testing Checklist

- [ ] Test reschedule with paid fee
- [ ] Test cancellation with 50% refund
- [ ] Test payment enforcement
- [ ] Test gateway validation
- [ ] Test invalid policy values
- [ ] Test offline payment marking
- [ ] Test policy display to clients
- [ ] Test refund calculations
- [ ] Test edge cases (0% refund, negative fees)
- [ ] Test all policy combinations

---

**Status**: ⚠️ **8 CRITICAL/HIGH ISSUES FOUND - NEED IMMEDIATE FIXES**
