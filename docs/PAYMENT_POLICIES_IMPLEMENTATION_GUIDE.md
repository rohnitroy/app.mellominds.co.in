# Payment Policies - Implementation Guide

## Overview

The database infrastructure for payment, cancellation, and reschedule policies is now complete. This guide provides the code implementations needed to make the policies work end-to-end.

---

## Implementation Tasks

### Task 1: Implement Reschedule Fee Charging

**File:** `backend/routes/bookings.js`
**Endpoint:** `POST /manage/:token/reschedule`
**Location:** Around line 514

**Current Code:**
```javascript
await dbClient.query(
    `UPDATE Appointments SET start_time = $1, end_time = $2 WHERE id = $3`,
    [newStart, newEnd, appt.id]
);
```

**New Code:**
```javascript
// Calculate reschedule fee if applicable
let rescheduleFeeToPay = 0;
if (policy?.enabled && policy?.type === 'paid' && policy?.fee) {
    rescheduleFeeToPay = parseFloat(policy.fee);
    
    // Log fee in FeeTracking table
    await dbClient.query(
        `INSERT INTO FeeTracking (appointment_id, fee_type, fee_amount, fee_status, collected_at)
         VALUES ($1, 'reschedule', $2, 'pending', NOW())`,
        [appt.id, rescheduleFeeToPay]
    );
}

// Update appointment with new times and fee
await dbClient.query(
    `UPDATE Appointments SET 
        start_time = $1, 
        end_time = $2,
        reschedule_fee_charged = $3,
        updated_at = NOW()
     WHERE id = $4`,
    [newStart, newEnd, rescheduleFeeToPay, appt.id]
);
```

---

### Task 2: Implement Partial Refund Calculation

**File:** `backend/routes/bookings.js`
**Endpoint:** `POST /manage/:token/cancel`
**Location:** Around line 432-440

**Current Code:**
```javascript
const refundType = policy?.enabled ? (policy.refundType || 'full') : 'full';
let newPaymentStatus;
if (refundType === 'none') {
    newPaymentStatus = `CASE WHEN payment_status = 'Paid' THEN 'Paid' WHEN payment_status = 'Pending' THEN 'Cancelled' ELSE payment_status END`;
} else if (refundType === 'partial') {
    newPaymentStatus = `CASE WHEN payment_status = 'Paid' THEN 'Partial Refund' WHEN payment_status = 'Pending' THEN 'Cancelled' ELSE payment_status END`;
} else {
    newPaymentStatus = `CASE WHEN payment_status = 'Paid' THEN 'Refunded' WHEN payment_status = 'Pending' THEN 'Cancelled' ELSE payment_status END`;
}
```

**New Code:**
```javascript
const refundType = policy?.enabled ? (policy.refundType || 'full') : 'full';
let refundAmount = 0;
let refundPercentage = 100;
let newPaymentStatus;

if (refundType === 'none') {
    refundAmount = 0;
    refundPercentage = 0;
    newPaymentStatus = `CASE WHEN payment_status = 'Paid' THEN 'Paid' WHEN payment_status = 'Pending' THEN 'Cancelled' ELSE payment_status END`;
} else if (refundType === 'partial') {
    refundPercentage = parseFloat(policy?.refundPercentage || 50);
    refundAmount = (appt.payment_amount * refundPercentage) / 100;
    newPaymentStatus = `CASE WHEN payment_status = 'Paid' THEN 'Partial Refund' WHEN payment_status = 'Pending' THEN 'Cancelled' ELSE payment_status END`;
    
    // Log refund in RefundTracking table
    await dbClient.query(
        `INSERT INTO RefundTracking (appointment_id, original_amount, refund_amount, refund_percentage, refund_reason, refund_status)
         VALUES ($1, $2, $3, $4, $5, 'pending')`,
        [appt.id, appt.payment_amount, refundAmount, refundPercentage, 'Client cancellation']
    );
} else {
    // Full refund
    refundAmount = appt.payment_amount;
    refundPercentage = 100;
    newPaymentStatus = `CASE WHEN payment_status = 'Paid' THEN 'Refunded' WHEN payment_status = 'Pending' THEN 'Cancelled' ELSE payment_status END`;
    
    // Log refund in RefundTracking table
    await dbClient.query(
        `INSERT INTO RefundTracking (appointment_id, original_amount, refund_amount, refund_percentage, refund_reason, refund_status)
         VALUES ($1, $2, $3, $4, $5, 'pending')`,
        [appt.id, appt.payment_amount, refundAmount, refundPercentage, 'Client cancellation']
    );
}

// Update appointment with refund details
await dbClient.query(
    `UPDATE Appointments SET
        status = 'cancelled',
        payment_status = ${newPaymentStatus},
        refund_amount = $1,
        refund_reason = 'Client cancellation',
        updated_at = NOW()
     WHERE id = $2`,
    [refundAmount, appt.id]
);
```

---

### Task 3: Implement Payment Enforcement During Booking

**File:** `backend/routes/bookings.js`
**Endpoint:** `POST /public`
**Location:** Around line 183-186

**Current Code:**
```javascript
const bookingAmount = calendarService.payment_enabled && calendarService.prices?.length
    ? (calendarService.prices[0]?.amount || 0)
    : 0;
```

**New Code:**
```javascript
// Check if payment is required
if (calendarService.payment_enabled) {
    // Validate payment gateway is configured
    if (!calendarService.payment_gateway) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
            error: 'Payment gateway not configured for this calendar' 
        });
    }
    
    // Validate prices are configured
    if (!calendarService.prices?.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
            error: 'No prices configured for this calendar' 
        });
    }
    
    // For non-offline payments, require payment before booking
    if (calendarService.payment_gateway !== 'offline') {
        // Store pending payment for webhook processing
        const bookingAmount = parseFloat(calendarService.prices[0]?.amount || 0);
        
        await client.query(
            `INSERT INTO PendingPayments (calendar_id, order_id, gateway, amount, client_email, client_name, client_phone, form_responses, location_type, partner_email, partner_phone, partner_name, start_time)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [calendar_id, `pending-${Date.now()}`, calendarService.payment_gateway, bookingAmount, client_email, client_name, client_phone || null, form_responses ? JSON.stringify(form_responses) : null, location_type || 'google_meet', partner_email || null, partner_phone || null, partner_name || null, startTime]
        );
        
        await client.query('ROLLBACK');
        return res.status(402).json({ 
            error: 'Payment required',
            payment_gateway: calendarService.payment_gateway,
            amount: bookingAmount,
            currency: calendarService.prices[0]?.currency || 'INR'
        });
    }
}

const bookingAmount = calendarService.payment_enabled && calendarService.prices?.length
    ? (calendarService.prices[0]?.amount || 0)
    : 0;
```

---

### Task 4: Implement Payment Gateway Validation

**File:** `backend/routes/calendars.js`
**Endpoint:** `POST /api/calendars` and `PUT /api/calendars/:id`
**Location:** Around line 224

**Current Code:**
```javascript
add('payment_gateway', payment_data.paymentGateways?.[0] || null);
```

**New Code:**
```javascript
// Validate payment gateway if payment is enabled
if (payment_data?.acceptPayment && payment_data?.paymentGateways?.length) {
    const gateway = payment_data.paymentGateways[0];
    
    if (gateway !== 'offline') {
        // Check if gateway is connected
        const gwCheck = await pool.query(
            `SELECT id FROM UserIntegrations WHERE user_id = $1 AND provider = $2`,
            [targetUserId, gateway]
        );
        
        if (gwCheck.rows.length === 0) {
            return res.status(400).json({ 
                error: `Payment gateway '${gateway}' is not connected. Please connect it first in settings.` 
            });
        }
    }
    
    // Log validation
    await pool.query(
        `INSERT INTO PolicyValidation (calendar_id, policy_type, is_valid, error_message)
         VALUES ($1, 'payment_gateway', true, NULL)`,
        [calendarId || 'new']
    );
}

add('payment_gateway', payment_data.paymentGateways?.[0] || null);
```

---

### Task 5: Implement Offline Payment Verification

**File:** `backend/routes/bookings.js`
**New Endpoint:** `PATCH /api/bookings/:id/mark-payment-received`

**New Code:**
```javascript
// PATCH /api/bookings/:id/mark-payment-received - Mark offline payment as received
router.patch('/:id/mark-payment-received', ensureAuthenticated, async (req, res) => {
    const dbClient = await pool.connect();
    try {
        const userId = req.user.id;
        const bookingId = parseInt(req.params.id);
        const { payment_method } = req.body;
        
        // Verify therapist owns this booking
        const apptRes = await dbClient.query(
            `SELECT id, payment_status, payment_amount FROM Appointments 
             WHERE id = $1 AND therapist_id = $2`,
            [bookingId, userId]
        );
        
        if (apptRes.rows.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        const appt = apptRes.rows[0];
        
        if (appt.payment_status !== 'Pending') {
            return res.status(400).json({ error: 'Payment already processed' });
        }
        
        // Update payment status
        const result = await dbClient.query(
            `UPDATE Appointments 
             SET payment_status = 'Paid', updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [bookingId]
        );
        
        // Log payment verification
        await dbClient.query(
            `INSERT INTO PaymentVerification (appointment_id, verification_type, status, verified_at, verified_by)
             VALUES ($1, $2, 'verified', NOW(), $3)`,
            [bookingId, payment_method || 'manual', userId]
        );
        
        // Send confirmation email to client
        const apptData = result.rows[0];
        if (apptData.client_email && await isEmailEnabled(userId, 'payment_confirmation')) {
            const emailContent = paymentConfirmationEmail({
                clientName: apptData.client_name,
                amount: apptData.payment_amount,
                sessionTitle: apptData.title,
                sessionTime: new Date(apptData.start_time).toLocaleString('en-IN')
            });
            await sendEmail({ to: apptData.client_email, ...emailContent, senderId: userId });
        }
        
        res.json({ 
            message: 'Payment marked as received',
            appointment: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error marking payment as received:', error);
        res.status(500).json({ error: 'Failed to mark payment as received' });
    } finally {
        dbClient.release();
    }
});
```

---

### Task 6: Display Policies to Clients

**File:** `frontend/src/components/PublicBookingPage.tsx`
**Location:** In booking confirmation section

**New Code:**
```javascript
// Display policies before booking confirmation
const renderPolicies = () => (
    <div className={styles.policiesSection}>
        <h3>Cancellation & Reschedule Policies</h3>
        
        {calendar.cancellation_policy?.enabled && (
            <div className={styles.policyCard}>
                <h4>Cancellation Policy</h4>
                <p>
                    <strong>Cancellation Window:</strong> Must cancel at least{' '}
                    {calendar.cancellation_policy.window} {calendar.cancellation_policy.unit} before session
                </p>
                <p>
                    <strong>Refund:</strong>{' '}
                    {calendar.cancellation_policy.refundType === 'full' 
                        ? '100% refund' 
                        : calendar.cancellation_policy.refundType === 'partial' 
                        ? `${calendar.cancellation_policy.refundPercentage}% refund` 
                        : 'No refund'}
                </p>
            </div>
        )}
        
        {calendar.reschedule_policy?.enabled && (
            <div className={styles.policyCard}>
                <h4>Reschedule Policy</h4>
                <p>
                    <strong>Reschedule Window:</strong> Must reschedule at least{' '}
                    {calendar.reschedule_policy.window} {calendar.reschedule_policy.unit} before session
                </p>
                {calendar.reschedule_policy.type === 'paid' && (
                    <p>
                        <strong>Reschedule Fee:</strong> ₹{calendar.reschedule_policy.fee}
                    </p>
                )}
            </div>
        )}
    </div>
);
```

---

## Testing Procedures

### Test 1: Reschedule Fee Charging
```
1. Create calendar with reschedule fee = ₹500
2. Create booking
3. Reschedule booking
4. Verify FeeTracking table has entry
5. Verify reschedule_fee_charged = 500 in Appointments
```

### Test 2: Partial Refund Calculation
```
1. Create calendar with 50% partial refund
2. Create paid booking (₹1000)
3. Cancel booking
4. Verify RefundTracking table shows:
   - original_amount = 1000
   - refund_amount = 500
   - refund_percentage = 50
5. Verify Appointments.refund_amount = 500
```

### Test 3: Payment Enforcement
```
1. Create calendar with Razorpay payment enabled
2. Try to book without payment
3. Verify error: "Payment required"
4. Verify PendingPayments table has entry
```

### Test 4: Payment Gateway Validation
```
1. Try to create calendar with Razorpay payment but no Razorpay connected
2. Verify error: "Payment gateway 'razorpay' is not connected"
3. Connect Razorpay
4. Try again - should succeed
```

### Test 5: Offline Payment Verification
```
1. Create calendar with offline payment
2. Create booking
3. Call PATCH /api/bookings/:id/mark-payment-received
4. Verify payment_status = 'Paid'
5. Verify PaymentVerification table has entry
```

---

## Deployment Checklist

- [ ] Implement Task 1: Reschedule fee charging
- [ ] Implement Task 2: Partial refund calculation
- [ ] Implement Task 3: Payment enforcement
- [ ] Implement Task 4: Payment gateway validation
- [ ] Implement Task 5: Offline payment verification
- [ ] Implement Task 6: Display policies to clients
- [ ] Run all tests
- [ ] Code review
- [ ] Deploy to staging
- [ ] Test in staging environment
- [ ] Deploy to production
- [ ] Monitor for issues

---

**Status**: 📋 **READY FOR IMPLEMENTATION**
