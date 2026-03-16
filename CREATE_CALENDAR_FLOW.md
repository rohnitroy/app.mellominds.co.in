# Create Calendar Flow - Complete Guide

## Overview
When you click "+ Create Calendar" in My Calendars, here's what happens:

---

## Step 1: Choose Resource Type Modal

A modal appears with 3 options:

### Appointments Section:
1. **One on One** 
   - Icon: Single person
   - Description: "Allow invitees to schedule 1:1 meetings with you."
   - Use case: Individual therapy sessions, consultations

2. **Group**
   - Icon: Multiple people
   - Description: "Accept multiple registrations for the same session."
   - Use case: Group therapy, workshops, classes

### Events Section:
3. **Webinar**
   - Icon: Computer screen
   - Description: "Host recurring or one-time webinars online."
   - Use case: Online seminars, training sessions

---

## Step 2: Create Event Page (4 Tabs)

After selecting a type, you're taken to a detailed configuration page with 4 tabs:

### Tab 1: BASIC ⚙️

**Event Details:**
- **Event Name** - Title of your calendar (e.g., "Individual Therapy Session")
- **Description** - Rich text editor with formatting options (Bold, Italic, Lists, Links)
- **Slug** - Custom URL path (auto-generated from name, editable)
- **Therapist** - Shows your name (read-only)

**Location:**
- **Google Meet** - Auto-create video conference links
- **In-Person** - Add physical location with:
  - Location name
  - Address
  - City, State, Country
- Can add multiple locations
- Shows connection status for video apps

---

### Tab 2: SCHEDULE 📅

**Durations:**
- Set session length (Minutes/Hours)
- Add multiple duration options
- Example: 30 min, 60 min, 90 min

**Date Ranges:**
- **Calendar days into the future** - How far ahead people can book (default: 60 days)
- **Business days into the future** - Exclude weekends
- **Within a date range** - Specific start/end dates
- **Any date into the future** - No limit

**Schedule:**
- Select from your saved availability schedules
- Shows weekly availability grid (Sun-Sat)
- Edit or create new schedules
- Displays available time slots per day

**Slots Generator:**
- Generate slots in custom intervals (e.g., every 30 minutes)
- Different from event duration

**Break Time:**
- Add buffer before/after events
- Prevents back-to-back bookings
- Options: Before Event or After Event
- Set duration in minutes

**Minimum Notice:**
- How far in advance bookings must be made
- Options: Minutes, Hours, Days
- Prevents last-minute bookings

---

### Tab 3: FORM 📝

**Registration Form:**
- Customize what information you collect from clients

**Form Heading:**
- Default: "Registration"
- Customizable title

**Quick Form Templates:**
- **Name, Email & Phone** - All three fields
- **Name & Email** - Basic info only
- **Name & Phone** - No email required

**Custom Questions:**
- Drag and drop to reorder
- Question types:
  - Text (short answer)
  - Long Text (paragraph)
  - Phone number
  - Dropdown (select one)
  - Radio buttons (select one)
  - Checkboxes (select multiple)
- Mark questions as required
- Default questions (Name, Email) cannot be deleted

**Question Builder:**
- Add custom questions with "+ Add Question" button
- Configure:
  - Question text
  - Question type
  - Required/Optional
  - Options (for dropdown/radio/checkbox)

---

### Tab 4: PAYMENT 💳

**Accept Payment:**
- Toggle on/off
- Collect payment when someone books

**Payment Gateways:**
- **Razorpay** - Indian payment gateway
- **Cashfree** - Alternative gateway
- Can enable multiple gateways

**Pricing:**
- Add multiple price options
- Configure:
  - Amount
  - Currency (INR, USD, EUR)
  - Label (e.g., "Consultation Fee")
- Display multiple pricing tiers

**Cancellation Policy:**
- Toggle on/off
- **Minimum Cancellation Notice:**
  - How long before session can be cancelled
  - Options: Minutes, Hours, Days
- **Refund Policy:**
  - Full Refund - 100% money back
  - Partial Refund - Specify percentage
  - No Refund - Keep full payment

**Reschedule Policy:**
- Toggle on/off
- **Minimum Reschedule Notice:**
  - How long before session can be rescheduled
  - Options: Minutes, Hours, Days
- **Reschedule Fee:**
  - Free Rescheduling - No charge
  - Paid Rescheduling - Set fee amount

---

## Step 3: Header Actions

While creating/editing, you have these options:

- **Copy Link** - Get shareable booking URL
- **Preview** - See how it looks to clients
- **<> Embed** - Get embed code for website
- **💾 Save Changes** - Save and publish calendar

---

## What Gets Saved

When you click "Save Changes", the system creates:

1. **Calendar Record** with:
   - Title
   - Duration
   - Type (one_on_one, group, webinar)
   - Description
   - Slug (URL path)
   - Active status
   - Form data (custom questions)

2. **Public Booking Page** at:
   - `https://yourdomain.com/book/{userId}/{slug}`
   - Example: `https://app.mellominds.co.in/book/7/individual-session`

3. **Booking Link** you can share with clients

---

## After Creation

The calendar appears in your "My Calendars" list with:
- Toggle to enable/disable
- Share button
- Three-dot menu (Edit Details, Delete)
- Copy link button
- Book button (for manual bookings)
- Slug display with edit option

---

## Key Features

✅ **Rich customization** - Control every aspect of booking
✅ **Multiple locations** - Offer online and in-person options
✅ **Custom forms** - Collect exactly the info you need
✅ **Payment integration** - Accept payments directly
✅ **Flexible policies** - Set cancellation and reschedule rules
✅ **Availability sync** - Uses your configured working hours
✅ **Google Calendar integration** - Prevents double bookings

---

## Tips

1. **Set availability first** - Click "Available Hours" before creating calendars
2. **Use descriptive names** - Helps clients understand what they're booking
3. **Keep forms simple** - Only ask for essential information
4. **Test the booking flow** - Use the preview to see client experience
5. **Share the link** - Copy and send to clients via email/WhatsApp
