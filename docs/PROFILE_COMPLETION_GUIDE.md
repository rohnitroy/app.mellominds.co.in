# Profile Completion System Guide

## Overview

This system ensures users complete their profile 100% before accessing key features like Calendar Setup, Bookings, and other premium features. When a user tries to access a protected feature without a complete profile, a lightbox/popup modal appears asking them to complete their profile first.

## What Constitutes a Complete Profile?

A profile is considered 100% complete when ALL of the following fields are filled:

- ✓ Phone Number
- ✓ Date of Birth
- ✓ Gender
- ✓ Specialization
- ✓ Country
- ✓ State
- ✓ City
- ✓ Pincode
- ✓ Clinic Address

## Architecture

### Backend Changes

**File:** `backend/routes/auth.js`

Added a helper function `isProfileComplete()` that checks if all required fields are present in the user object. The `/auth/me` endpoint now returns a `profileComplete` boolean flag:

```javascript
const isProfileComplete = (user) => {
  const requiredFields = ['phone', 'dob', 'gender', 'specialization', 'country', 'state', 'city', 'pincode', 'clinic_address'];
  return requiredFields.every(field => user[field] && user[field].toString().trim() !== '');
};

router.get('/auth/me', (req, res) => {
  if (req.isAuthenticated()) {
    const { password, reset_token, reset_token_expires, ...userWithoutSensitive } = req.user;
    const profileComplete = isProfileComplete(req.user);
    res.json({ user: { ...userWithoutSensitive, profileComplete } });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});
```

### Frontend Components

#### 1. **ProfileCompletionModal** (`frontend/src/components/ProfileCompletionModal.tsx`)

A reusable modal component that displays when a user tries to access a protected feature without a complete profile.

**Features:**
- Beautiful lightbox with backdrop
- Shows list of required fields
- "Complete Profile" button navigates to profile settings
- "Cancel" button closes the modal
- Smooth animations (fade in/out, slide up/down)
- Mobile responsive

**Usage:**
```tsx
<ProfileCompletionModal
  isOpen={showProfileModal}
  onClose={() => setShowProfileModal(false)}
  featureName="Calendar Setup"
/>
```

#### 2. **useProfileCompletion Hook** (`frontend/src/hooks/useProfileCompletion.ts`)

A custom React hook that manages profile completion state and provides utilities to check profile completion.

**Returns:**
- `isProfileComplete` (boolean) - Whether the user's profile is complete
- `showProfileModal` (boolean) - Whether to show the modal
- `setShowProfileModal` (function) - Control modal visibility
- `checkProfileCompletion` (function) - Check profile and show modal if incomplete

**Usage:**
```tsx
const { isProfileComplete, showProfileModal, setShowProfileModal, checkProfileCompletion } = useProfileCompletion();

// Guard a feature
if (!checkProfileCompletion('Calendar Setup')) return;
```

#### 3. **ProtectedFeature Component** (`frontend/src/components/ProtectedFeature.tsx`)

A wrapper component that automatically protects features behind profile completion checks.

**Usage:**
```tsx
<ProtectedFeature featureName="Calendar Setup">
  <CalendarPage />
</ProtectedFeature>
```

## Implementation Examples

### Example 1: Protecting Calendar Setup (Already Implemented)

**File:** `frontend/src/components/CalendarPage.tsx`

```tsx
import { useProfileCompletion } from '../hooks/useProfileCompletion';
import ProfileCompletionModal from './ProfileCompletionModal';

const CalendarPage: React.FC = () => {
  const { showProfileModal, setShowProfileModal, checkProfileCompletion } = useProfileCompletion();

  const handleCreateCalendar = () => {
    // Check profile completion before allowing calendar creation
    if (!checkProfileCompletion('Calendar Setup')) return;
    
    // Proceed with calendar creation
    navigate('/my-calendar/new');
  };

  return (
    <>
      <button onClick={handleCreateCalendar}>+ Create Calendar</button>
      
      <ProfileCompletionModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        featureName="Calendar Setup"
      />
    </>
  );
};
```

### Example 2: Protecting Other Features

To protect other features like Bookings, Clients, etc., follow this pattern:

```tsx
import { useProfileCompletion } from '../hooks/useProfileCompletion';
import ProfileCompletionModal from './ProfileCompletionModal';

const BookingsPage: React.FC = () => {
  const { showProfileModal, setShowProfileModal, checkProfileCompletion } = useProfileCompletion();

  const handleCreateBooking = () => {
    if (!checkProfileCompletion('Booking Creation')) return;
    // Proceed with booking creation
  };

  return (
    <>
      <button onClick={handleCreateBooking}>Create Booking</button>
      
      <ProfileCompletionModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        featureName="Booking Creation"
      />
    </>
  );
};
```

### Example 3: Using ProtectedFeature Wrapper

For simpler cases where you want to protect an entire page/component:

```tsx
import ProtectedFeature from './components/ProtectedFeature';
import CalendarPage from './components/CalendarPage';

// In your routing
<ProtectedFeature featureName="Calendar Setup">
  <CalendarPage />
</ProtectedFeature>
```

## How It Works

### User Flow

1. **User tries to access a protected feature** (e.g., clicks "Create Calendar")
2. **`checkProfileCompletion()` is called** with the feature name
3. **System checks `user.profileComplete` flag** from the backend
4. **If profile is incomplete:**
   - Modal is shown with feature name and required fields list
   - User can click "Complete Profile" to navigate to profile settings
   - User can click "Cancel" to close the modal
5. **If profile is complete:**
   - Feature access is granted
   - User can proceed normally

### Data Flow

```
Backend (/auth/me)
    ↓
Returns user object with profileComplete flag
    ↓
AuthContext stores user data
    ↓
useProfileCompletion hook reads profileComplete
    ↓
Component checks profile before allowing feature access
    ↓
Shows ProfileCompletionModal if incomplete
```

## Styling

The modal uses CSS Modules for scoped styling (`ProfileCompletionModal.module.css`). Key features:

- **Responsive Design:** Works on mobile, tablet, and desktop
- **Animations:** Smooth fade and slide transitions
- **Accessibility:** Proper button states, focus management
- **Color Scheme:** Uses blue (#3b82f6) for primary actions, gray for secondary

## Adding Profile Completion to More Features

To add profile completion checks to any feature:

1. **Import the hook:**
   ```tsx
   import { useProfileCompletion } from '../hooks/useProfileCompletion';
   ```

2. **Use the hook in your component:**
   ```tsx
   const { showProfileModal, setShowProfileModal, checkProfileCompletion } = useProfileCompletion();
   ```

3. **Check profile before allowing feature access:**
   ```tsx
   const handleFeatureAccess = () => {
     if (!checkProfileCompletion('Feature Name')) return;
     // Proceed with feature
   };
   ```

4. **Render the modal:**
   ```tsx
   <ProfileCompletionModal
     isOpen={showProfileModal}
     onClose={() => setShowProfileModal(false)}
     featureName="Feature Name"
   />
   ```

## Features to Protect

Recommended features to protect with profile completion:

- ✓ Calendar Setup (Already implemented)
- [ ] Booking Creation
- [ ] Client Management
- [ ] Payment Integration
- [ ] Availability Settings
- [ ] Email Preferences
- [ ] Notifications
- [ ] Profile Link/Public Profile
- [ ] Chat/Chatbot Setup
- [ ] Enterprise Settings (for enterprise users)

## Testing

### Manual Testing

1. **Create a test user** with incomplete profile (missing some fields)
2. **Try to access Calendar Setup** → Modal should appear
3. **Click "Complete Profile"** → Should navigate to profile settings
4. **Fill in all required fields** → Profile should be marked complete
5. **Try to access Calendar Setup again** → Should work without modal

### Automated Testing (Optional)

```tsx
// Example test
describe('ProfileCompletionModal', () => {
  it('should show modal when profile is incomplete', () => {
    // Mock user with incomplete profile
    const user = { profileComplete: false };
    
    // Render component
    // Assert modal is visible
  });

  it('should navigate to profile when Complete Profile is clicked', () => {
    // Render modal
    // Click "Complete Profile" button
    // Assert navigation to /settings/my-profile
  });
});
```

## Troubleshooting

### Modal not appearing

1. **Check if `profileComplete` is being returned from backend:**
   ```bash
   curl http://localhost:3000/api/auth/me
   ```
   Should include `"profileComplete": false` in response

2. **Verify hook is imported correctly:**
   ```tsx
   import { useProfileCompletion } from '../hooks/useProfileCompletion';
   ```

3. **Check if `checkProfileCompletion()` is being called:**
   ```tsx
   const handleClick = () => {
     console.log('Checking profile...');
     if (!checkProfileCompletion('Feature')) return;
     console.log('Profile complete, proceeding...');
   };
   ```

### Modal appearing for complete profiles

1. **Verify all required fields are filled in the database**
2. **Check that `isProfileComplete()` function includes all required fields**
3. **Clear browser cache and refresh**

## Future Enhancements

- [ ] Add profile completion percentage indicator
- [ ] Show which specific fields are missing
- [ ] Add inline profile completion form in modal
- [ ] Add profile completion reminder notifications
- [ ] Track profile completion analytics
- [ ] Add different completion levels (basic, advanced, complete)

## Files Modified/Created

### Created Files
- `frontend/src/components/ProfileCompletionModal.tsx`
- `frontend/src/components/ProfileCompletionModal.module.css`
- `frontend/src/components/ProtectedFeature.tsx`
- `frontend/src/hooks/useProfileCompletion.ts`
- `PROFILE_COMPLETION_GUIDE.md` (this file)

### Modified Files
- `backend/routes/auth.js` - Added `isProfileComplete()` function and updated `/auth/me` endpoint
- `frontend/src/context/AuthContext.tsx` - Added `profileComplete` field to User interface
- `frontend/src/components/CalendarPage.tsx` - Integrated profile completion checks

## Support

For questions or issues with the profile completion system, refer to this guide or check the implementation in the files listed above.
