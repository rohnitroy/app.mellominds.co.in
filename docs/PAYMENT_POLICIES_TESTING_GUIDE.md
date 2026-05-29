# Payment Policies - Testing Guide

## Quick Reference

All 5 backend tasks are now implemented and ready for testing. This guide provides step-by-step instructions for testing each feature.

---

## Prerequisites

- Backend running on `http://localhost:3001`
- Database migrations applied (FeeTracking, RefundTracking, PaymentVerification, PendingPayments, PolicyValidation tables exist)
- Test user with Google Calendar connected
- Test calendar created with payment policies configured

---

## Test Scenarios

### Scenario 1: Reschedule with Fee

**Setup:**
```
1. Create calendar with:
   - Title: "Test Reschedule Fee"
   - Reschedule Policy: Enabled, Type: Paid, Fee: ₹500
```

**Test Steps:**
```
1. POST /api/bookings/public
   {
     "calendar_id": 1,
     "start_time": "2026-06-15T10:00:00Z",
     "client_email": "test@example.com",
     "client_name": "Test Client"
   }
   → Response: 201 with appointment ID (e.g., 123)

2. GET /api/bookings/manage/:cancel_token
   → Response: 200 with booking details

3. POST /api/bookings/manage/:cancel_token/reschedule
   {
     "new_start_time": "2026-06-16T10:00:00Z"
   }
   → Response: 200 with success message

4. Verify in database:
   SELECT * FROM FeeTracking WHERE appointment_id = 123;
   → Should show: fee_type='reschedule', fee_amount=500, fee_status='pending'
   
   SELECT reschedule_fee_charged FROM Appointments WHERE id = 123;
   → Should show: 500
```

---

### Scenario 2: Partial Refund on Cancellation

**Setup:**
```
1. Create calendar with:
   - Title: "Test Partial Refund"
   - Payment: Enabled, Gateway: Offline, Price: ₹1000
   - Cancellation Policy: Enabled, Type: Partial, Refund %: 50
```

**Test Steps:**
```
1. POST /api/bookings/public
   {
     "calendar_id": 2,
     "start_time": "2026-06-20T14:00:00Z",
     "client_email": "client@example.com",
     "client_name": "Client Name",
     "razorpay_order_id": "order_123"
   }
   → Response: 201 with appointment ID (e.g., 124)

2. POST /api/bookings/manage/:cancel_token/cancel
   → Response: 200 with success message

3. Verify in database:
   SELECT * FROM RefundTracking WHERE appointment_id = 124;
   → Should show: 
     - original_amount: 1000
     - refund_amount: 500
     - refund_percentage: 50
     - refund_reason: 'Client cancellation'
     - refund_status: 'pending'
   
   SELECT refund_amount, payment_status FROM Appointments WHERE id = 124;
   → Should show: refund_amount=500, payment_status='Partial Refund'
```

---

### Scenario 3: Full Refund on Cancellation

**Setup:**
```
1. Create calendar with:
   - Title: "Test Full Refund"
   - Payment: Enabled, Gateway: Offline, Price: ₹2000
   - Cancellation Policy: Enabled, Type: Full
```

**Test Steps:**
```
1. POST /api/bookings/public
   {
     "calendar_id": 3,
     "start_time": "2026-06-25T11:00:00Z",
     "client_email": "fullrefund@example.com",
     "client_name": "Full Refund Client",
     "razorpay_order_id": "order_456"
   }
   → Response: 201 with appointment ID (e.g., 125)

2. POST /api/bookings/manage/:cancel_token/cancel
   → Response: 200 with success message

3. Verify in database:
   SELECT * FROM RefundTracking WHERE appointment_id = 125;
   → Should show: 
     - original_amount: 2000
     - refund_amount: 2000
     - refund_percentage: 100
   
   SELECT payment_status FROM Appointments WHERE id = 125;
   → Should show: payment_status='Refunded'
```

---

### Scenario 4: No Refund on Cancellation

**Setup:**
```
1. Create calendar with:
   - Title: "Test No Refund"
   - Payment: Enabled, Gateway: Offline, Price: ₹1500
   - Cancellation Policy: Enabled, Type: None
```

**Test Steps:**
```
1. POST /api/bookings/public
   {
     "calendar_id": 4,
     "start_time": "2026-07-01T15:00:00Z",
     "client_email": "norefund@example.com",
     "client_name": "No Refund Client",
     "razorpay_order_id": "order_789"
   }
   → Response: 201 with appointment ID (e.g., 126)

2. POST /api/bookings/manage/:cancel_token/cancel
   → Response: 200 with success message

3. Verify in database:
   SELECT * FROM RefundTracking WHERE appointment_id = 126;
   → Should show: EMPTY (no refund tracking for no-refund policy)
   
   SELECT payment_status FROM Appointments WHERE id = 126;
   → Should show: payment_status='Paid' (unchanged)
```

---

### Scenario 5: Payment Enforcement - Razorpay

**Setup:**
```
1. Create calendar with:
   - Title: "Test Payment Enforcement"
   - Payment: Enabled, Gateway: Razorpay, Price: ₹500
   - Razorpay must be connected in UserIntegrations
```

**Test Steps:**
```
1. POST /api/bookings/public
   {
     "calendar_id": 5,
     "start_time": "2026-07-05T10:00:00Z",
     "client_email": "payment@example.com",
     "client_name": "Payment Test"
   }
   → Response: 402 Payment Required
   → Body: {
       "error": "Payment required",
       "payment_gateway": "razorpay",
       "amount": 500,
       "currency": "INR"
     }

2. Verify in database:
   SELECT * FROM PendingPayments WHERE gateway = 'razorpay';
   → Should show pending payment entry with amount=500

3. After payment webhook:
   → Appointment should be created with payment_status='Paid'
```

---

### Scenario 6: Payment Enforcement - Offline

**Setup:**
```
1. Create calendar with:
   - Title: "Test Offline Payment"
   - Payment: Enabled, Gateway: Offline, Price: ₹800
```

**Test Steps:**
```
1. POST /api/bookings/public
   {
     "calendar_id": 6,
     "start_time": "2026-07-10T13:00:00Z",
     "client_email": "offline@example.com",
     "client_name": "Offline Payment Client"
   }
   → Response: 201 with appointment ID (e.g., 127)
   → Booking created immediately (no payment required)

2. Verify in database:
   SELECT payment_status FROM Appointments WHERE id = 127;
   → Should show: payment_status='Pending'
```

---

### Scenario 7: Offline Payment Verification

**Setup:**
```
1. Use appointment from Scenario 6 (ID: 127)
2. Therapist is authenticated
```

**Test Steps:**
```
1. PATCH /api/bookings/127/mark-payment-received
   {
     "payment_method": "cash"
   }
   → Response: 200 with success message

2. Verify in database:
   SELECT payment_status FROM Appointments WHERE id = 127;
   → Should show: payment_status='Paid'
   
   SELECT * FROM PaymentVerification WHERE appointment_id = 127;
   → Should show: verification_type='cash', status='verified'

3. Verify email sent to client
   → Check email logs for payment confirmation
```

---

### Scenario 8: Payment Gateway Validation - Create Calendar

**Setup:**
```
1. Razorpay NOT connected in UserIntegrations
```

**Test Steps:**
```
1. POST /api/calendars
   {
     "title": "Test Gateway Validation",
     "duration": "60 minutes",
     "payment_data": {
       "acceptPayment": true,
       "paymentGateways": ["razorpay"],
       "prices": [{"amount": 500, "currency": "INR"}]
     }
   }
   → Response: 400 Bad Request
   → Body: {
       "error": "Payment gateway 'razorpay' is not connected. Please connect it first in settings."
     }

2. Connect Razorpay in UserIntegrations

3. Retry POST /api/calendars
   → Response: 201 Created
   → Calendar created successfully
```

---

### Scenario 9: Payment Gateway Validation - Update Calendar

**Setup:**
```
1. Calendar exists with offline payment
2. Razorpay NOT connected
```

**Test Steps:**
```
1. PUT /api/calendars/:id
   {
     "payment_data": {
       "acceptPayment": true,
       "paymentGateways": ["razorpay"],
       "prices": [{"amount": 1000, "currency": "INR"}]
     }
   }
   → Response: 400 Bad Request
   → Body: {
       "error": "Payment gateway 'razorpay' is not connected. Please connect it first in settings."
     }

2. Connect Razorpay

3. Retry PUT /api/calendars/:id
   → Response: 200 OK
   → Calendar updated successfully
```

---

### Scenario 10: Cancellation Window Enforcement

**Setup:**
```
1. Create calendar with:
   - Cancellation Policy: Enabled, Window: 24 hours
   - Booking scheduled for tomorrow
```

**Test Steps:**
```
1. POST /api/bookings/public
   {
     "calendar_id": 7,
     "start_time": "2026-06-29T10:00:00Z",
     "client_email": "window@example.com",
     "client_name": "Window Test"
   }
   → Response: 201 with appointment ID

2. POST /api/bookings/manage/:cancel_token/cancel
   (within 24 hours of session)
   → Response: 400 Bad Request
   → Body: {
       "error": "Cancellations must be made at least 24 hours before the session."
     }

3. Wait 24+ hours, then retry
   → Response: 200 OK
   → Cancellation successful
```

---

### Scenario 11: Reschedule Window Enforcement

**Setup:**
```
1. Create calendar with:
   - Reschedule Policy: Enabled, Window: 48 hours
   - Booking scheduled for 2 days from now
```

**Test Steps:**
```
1. POST /api/bookings/public
   {
     "calendar_id": 8,
     "start_time": "2026-07-02T10:00:00Z",
     "client_email": "reschedule@example.com",
     "client_name": "Reschedule Test"
   }
   → Response: 201 with appointment ID

2. POST /api/bookings/manage/:cancel_token/reschedule
   (within 48 hours of session)
   {
     "new_start_time": "2026-07-03T10:00:00Z"
   }
   → Response: 400 Bad Request
   → Body: {
       "error": "Rescheduling must be done at least 48 hours before the session."
     }

3. Wait 48+ hours, then retry
   → Response: 200 OK
   → Reschedule successful
```

---

## Database Verification Queries

### Check all reschedule fees
```sql
SELECT a.id, a.client_name, a.title, f.fee_amount, f.fee_status
FROM FeeTracking f
JOIN Appointments a ON f.appointment_id = a.id
ORDER BY f.created_at DESC;
```

### Check all refunds
```sql
SELECT a.id, a.client_name, a.title, r.original_amount, r.refund_amount, r.refund_percentage, r.refund_status
FROM RefundTracking r
JOIN Appointments a ON r.appointment_id = a.id
ORDER BY r.created_at DESC;
```

### Check payment verifications
```sql
SELECT a.id, a.client_name, p.verification_type, p.status, p.verified_at
FROM PaymentVerification p
JOIN Appointments a ON p.appointment_id = a.id
ORDER BY p.verified_at DESC;
```

### Check pending payments
```sql
SELECT * FROM PendingPayments
ORDER BY created_at DESC;
```

### Check policy validations
```sql
SELECT * FROM PolicyValidation
ORDER BY created_at DESC;
```

---

## Common Issues & Solutions

### Issue: "Payment gateway not configured"
**Cause:** Calendar created with payment enabled but no gateway selected
**Solution:** Update calendar with valid payment_gateway value

### Issue: "Payment gateway 'razorpay' is not connected"
**Cause:** Trying to use Razorpay but not connected in UserIntegrations
**Solution:** Connect Razorpay in settings first, then create/update calendar

### Issue: Refund not calculated correctly
**Cause:** refundPercentage not set in policy
**Solution:** Ensure cancellation_policy has refundPercentage field (defaults to 50%)

### Issue: Reschedule fee not charged
**Cause:** Reschedule policy type not set to 'paid'
**Solution:** Ensure reschedule_policy.type = 'paid' and fee is set

### Issue: Payment verification fails
**Cause:** Trying to mark payment as received for non-pending payment
**Solution:** Only works for payment_status = 'Pending'

---

## Performance Considerations

- FeeTracking and RefundTracking queries should use appointment_id index
- PolicyValidation queries should use calendar_id index
- PendingPayments should be cleaned up after webhook processing
- Consider archiving old records for performance

---

## Next Steps

1. Run all test scenarios
2. Verify database entries are created correctly
3. Check email confirmations are sent
4. Test with real payment gateways (Razorpay, Cashfree)
5. Implement frontend policy display (Task 6)
6. Deploy to staging
7. Production deployment

---

**Last Updated:** May 28, 2026
**Status:** Ready for Testing

