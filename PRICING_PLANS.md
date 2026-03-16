# Pricing Plans & Upgrade Modal

## Overview
The application now includes a comprehensive pricing plan modal that displays when users click "Upgrade now" in the dashboard header.

## Pricing Structure

### Free Tier (₹0/forever)
- 1 Calendar/Resource
- Up to 10 bookings per month
- Basic availability settings
- Email notifications
- Google Calendar integration
- Basic client management

### Professional Plan (₹999/month) - MOST POPULAR
- Unlimited calendars
- Unlimited bookings
- Advanced availability settings
- Email + SMS notifications
- Payment gateway integration (Razorpay/Cashfree/UPI)
- Client notes & clinical profiles
- Custom booking forms
- Automated reminders
- Priority support
- Remove "Powered by MelloMinds" branding

### Premium Plan (₹1,999/month)
Everything in Professional, plus:
- Team management (multiple therapists)
- Advanced analytics & reports
- Custom domain for booking pages
- Webhook integrations
- API access
- Video consultation integration (Zoom/Google Meet)
- Automated follow-up sequences
- Client portal access
- White-label solution
- Dedicated account manager

### Enterprise Plan (Custom Pricing)
Everything in Premium, plus:
- Custom integrations
- Multi-location support
- Advanced security & compliance
- Custom workflows
- Training & onboarding
- SLA guarantees

## Implementation Details

### Files Created
1. `frontend/src/components/UpgradePlanModal.tsx` - Main modal component
2. `frontend/src/components/UpgradePlanModal.module.css` - Modal styling

### Integration
- Modal opens when clicking "Upgrade now" button in dashboard header
- Closes when clicking outside modal or close button (×)
- Responsive design with 3-column grid on desktop, single column on mobile
- Professional plan highlighted as "Most Popular"

### Features
- Side-by-side plan comparison
- Feature checkmarks (✓) and crosses (×)
- "Start 14-Day Free Trial" buttons for paid plans
- "Current Plan" disabled button for Free tier
- Enterprise section with "Contact Sales" button
- Smooth animations and hover effects
- Theme-consistent colors (#2D7579, #D5FFFA)

### Styling Highlights
- Cards with hover effects (lift and shadow)
- Popular plan badge with gradient background
- Checkmarks in circular badges with theme colors
- Smooth transitions and animations
- Custom scrollbar styling
- Responsive grid layout

## Future Enhancements
- Backend integration for actual payment processing
- Stripe/Razorpay payment gateway integration
- Annual billing option (save 20%)
- Trial period tracking
- Plan upgrade/downgrade functionality
- Usage tracking and limits enforcement
