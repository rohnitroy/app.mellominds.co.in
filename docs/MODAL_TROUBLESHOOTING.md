# Profile Completion Modal - Troubleshooting Guide

## Issue: Modal Not Appearing

If the profile completion modal is not appearing when you try to access Calendar Setup, follow these troubleshooting steps:

### Step 1: Check Backend Response

First, verify that the backend is returning the `profileComplete` flag correctly.

**In Browser DevTools (Network Tab):**
1. Open DevTools (F12)
2. Go to Network tab
3. Refresh the page
4. Look for a request to `/api/auth/me`
5. Click on it and check the Response

**Expected Response:**
```json
{
  "user": {
    "id": "123",
    "user_name": "John Doe",
    "email": "john@example.com",
    "profileComplete": false,
    ...
  }
}
```

**If `profileComplete` is missing:**
- Backend changes may not have been applied
- Check `backend/routes/auth.js` has the `isProfileComplete()` function
- Restart the backend server

### Step 2: Check Frontend State

**In Browser DevTools (React DevTools):**
1. Install React DevTools extension if not already installed
2. Open DevTools (F12)
3. Go to Components tab
4. Find `AuthProvider` component
5. Expand it and look for the `user` object
6. Check if `profileComplete` field exists and is `false`

**If `profileComplete` is missing:**
- AuthContext may not have been updated
- Check `frontend/src/context/AuthContext.tsx` includes `profileComplete` in User interface
- Clear browser cache and refresh

### Step 3: Check Hook State

**In Browser Console:**
```javascript
// Add this to CalendarPage component temporarily for debugging
const { isProfileComplete, showProfileModal } = useProfileCompletion();
console.log('isProfileComplete:', isProfileComplete);
console.log('showProfileModal:', showProfileModal);
```

**Expected Output (if profile incomplete):**
```
isProfileComplete: false
showProfileModal: false (initially, becomes true when button clicked)
```

### Step 4: Check Button Click Handler

**Verify the button is calling checkProfileCompletion():**

In `CalendarPage.tsx`, the "Create Calendar" button should have:
```tsx
onClick={() => {
  if (!checkProfileCompletion('Calendar Setup')) return;
  // ... rest of code
}}
```

**To Debug:**
1. Add console.log in the button click handler
2. Click the button
3. Check browser console for the log message

### Step 5: Check Modal Rendering

**In Browser DevTools (Elements Tab):**
1. Open DevTools (F12)
2. Go to Elements tab
3. Press Ctrl+F (or Cmd+F on Mac)
4. Search for "Complete Your Profile"
5. If found, the modal is rendering but may have CSS issues
6. If not found, the modal is not rendering at all

### Step 6: Check CSS Classes

**If modal is rendering but not visible:**

In Elements tab, look for the modal element and check:
1. `.backdrop` class has `z-index: 9998`
2. `.modal` class has `z-index: 9999`
3. `.container` class has `position: fixed`
4. No CSS is overriding these values

**Common CSS Issues:**
- Parent component has `overflow: hidden` (clips the modal)
- Another element has higher z-index
- Modal is positioned off-screen

### Step 7: Check Profile Data

**Verify user profile is actually incomplete:**

In Browser Console:
```javascript
// Get current user from AuthContext
const user = /* get from React DevTools */;
console.log('Phone:', user.phone);
console.log('DOB:', user.dob);
console.log('Gender:', user.gender);
console.log('Specialization:', user.specialization);
console.log('Country:', user.country);
console.log('State:', user.state);
console.log('City:', user.city);
console.log('Pincode:', user.pincode);
console.log('Clinic Address:', user.clinic_address);
```

**If all fields are filled:**
- Profile is actually complete
- `profileComplete` should be `true`
- Modal should not appear
- This is expected behavior

## Common Issues and Solutions

### Issue 1: Modal appears but is invisible

**Symptoms:** Console shows modal is rendering, but you can't see it

**Solutions:**
1. Check z-index values in CSS
2. Check if parent has `overflow: hidden`
3. Check if backdrop is covering the modal
4. Try scrolling down (modal might be off-screen)

### Issue 2: Modal appears but buttons don't work

**Symptoms:** Modal is visible but clicking buttons does nothing

**Solutions:**
1. Check browser console for JavaScript errors
2. Verify `useNavigate()` hook is working
3. Check if `/settings/my-profile` route exists
4. Try clicking the backdrop to close (should work)

### Issue 3: Modal appears but text is cut off

**Symptoms:** Modal is visible but content is truncated

**Solutions:**
1. Check `max-height: 90vh` in CSS
2. Check `overflow-y: auto` is set
3. Try resizing browser window
4. Check on mobile device (different viewport)

### Issue 4: Modal appears multiple times

**Symptoms:** Multiple modals stack on top of each other

**Solutions:**
1. Check `createPortal` is only called once
2. Verify modal is not rendered in multiple places
3. Check `isOpen` prop is being controlled correctly
4. Look for duplicate ProfileCompletionModal components

## Quick Checklist

- [ ] Backend returns `profileComplete` flag in `/auth/me`
- [ ] AuthContext includes `profileComplete` in User interface
- [ ] CalendarPage imports `useProfileCompletion` hook
- [ ] CalendarPage imports `ProfileCompletionModal` component
- [ ] Button click handler calls `checkProfileCompletion()`
- [ ] Modal is rendered in CalendarPage
- [ ] CSS z-index values are high enough (9998, 9999)
- [ ] User profile is actually incomplete (missing required fields)
- [ ] Browser cache is cleared
- [ ] Backend server is running
- [ ] Frontend is recompiled

## Testing Steps

### Manual Test 1: Complete Profile Flow
1. Create a new user with incomplete profile
2. Log in
3. Navigate to Calendar Setup
4. Click "Create Calendar" button
5. Modal should appear
6. Click "Complete Profile"
7. Should navigate to `/settings/my-profile`
8. Fill in all required fields
9. Save profile
10. Return to Calendar
11. Click "Create Calendar" again
12. Modal should NOT appear
13. Feature should work

### Manual Test 2: Modal Interactions
1. Modal appears
2. Click "Cancel" button → Modal closes
3. Click "Create Calendar" again → Modal appears again
4. Click backdrop (outside modal) → Modal closes
5. Click "Create Calendar" again → Modal appears again
6. Click close button (✕) → Modal closes

### Manual Test 3: Responsive Design
1. Test on desktop (1920x1080)
2. Test on tablet (768x1024)
3. Test on mobile (375x667)
4. Modal should be visible and usable on all sizes

## Debug Console Commands

```javascript
// Check if modal component is loaded
console.log(typeof ProfileCompletionModal);

// Check if hook is working
const { isProfileComplete, showProfileModal, checkProfileCompletion } = useProfileCompletion();
console.log({ isProfileComplete, showProfileModal });

// Manually trigger modal
checkProfileCompletion('Test Feature');

// Check user object
const { user } = useAuth();
console.log(user);

// Check if createPortal is working
console.log(document.body.innerHTML.includes('Complete Your Profile'));
```

## Still Not Working?

If you've gone through all these steps and the modal still isn't appearing:

1. **Check browser console for errors** - Look for red error messages
2. **Check backend logs** - Look for errors in server output
3. **Clear all caches** - Browser cache, local storage, session storage
4. **Restart servers** - Restart both frontend and backend
5. **Check file modifications** - Verify all files were modified correctly
6. **Review git diff** - Check what changes were actually made

## Getting Help

When reporting an issue, include:
1. Browser and version (Chrome 120, Firefox 121, etc.)
2. Screenshot of the issue
3. Browser console errors (if any)
4. Network tab response from `/auth/me`
5. React DevTools state (user object)
6. Steps to reproduce

---

**Last Updated:** May 26, 2026
**Status:** Troubleshooting Guide Complete
