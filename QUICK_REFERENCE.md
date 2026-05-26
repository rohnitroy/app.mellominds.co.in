# Profile Completion System - Quick Reference

## TL;DR

Users must complete their profile (9 required fields) before accessing features like Calendar Setup. If they try to access a protected feature without a complete profile, a modal appears asking them to complete it first.

## Required Profile Fields

1. Phone Number
2. Date of Birth
3. Gender
4. Specialization
5. Country
6. State
7. City
8. Pincode
9. Clinic Address

## Quick Implementation (Copy-Paste)

### For Any Component

```tsx
import { useProfileCompletion } from '../hooks/useProfileCompletion';
import ProfileCompletionModal from './ProfileCompletionModal';

const MyComponent: React.FC = () => {
  const { showProfileModal, setShowProfileModal, checkProfileCompletion } = useProfileCompletion();

  const handleProtectedAction = () => {
    if (!checkProfileCompletion('Feature Name')) return;
    // Your code here
  };

  return (
    <>
      <button onClick={handleProtectedAction}>Do Something</button>
      
      <ProfileCompletionModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        featureName="Feature Name"
      />
    </>
  );
};

export default MyComponent;
```

## Files Created

| File | Purpose |
|------|---------|
| `frontend/src/components/ProfileCompletionModal.tsx` | Modal component |
| `frontend/src/components/ProfileCompletionModal.module.css` | Modal styling |
| `frontend/src/components/ProtectedFeature.tsx` | Wrapper component |
| `frontend/src/hooks/useProfileCompletion.ts` | Custom hook |
| `PROFILE_COMPLETION_GUIDE.md` | Full documentation |
| `IMPLEMENTATION_CHECKLIST.md` | Implementation tasks |

## Files Modified

| File | Changes |
|------|---------|
| `backend/routes/auth.js` | Added `isProfileComplete()` function, updated `/auth/me` endpoint |
| `frontend/src/context/AuthContext.tsx` | Added `profileComplete` field to User interface |
| `frontend/src/components/CalendarPage.tsx` | Integrated profile completion checks |

## API Response

```json
{
  "user": {
    "id": "123",
    "user_name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "dob": "1990-01-01",
    "gender": "Male",
    "specialization": "Counselling Therapist",
    "country": "India",
    "state": "Maharashtra",
    "city": "Mumbai",
    "pincode": "400001",
    "clinic_address": "123 Main St",
    "profileComplete": true,
    ...
  }
}
```

## Hook Usage

```tsx
const { 
  isProfileComplete,      // boolean - is profile complete?
  showProfileModal,       // boolean - show modal?
  setShowProfileModal,    // function - control modal
  checkProfileCompletion  // function - check & show modal if incomplete
} = useProfileCompletion();

// Check profile before action
if (!checkProfileCompletion('Feature Name')) return;
```

## Modal Props

```tsx
<ProfileCompletionModal
  isOpen={boolean}              // Show/hide modal
  onClose={() => {}}            // Called when modal closes
  featureName="string"          // Feature name to display
/>
```

## Common Patterns

### Pattern 1: Button Protection
```tsx
<button onClick={() => {
  if (!checkProfileCompletion('Calendar')) return;
  handleCreateCalendar();
}}>
  Create Calendar
</button>
```

### Pattern 2: Route Protection
```tsx
<ProtectedFeature featureName="Calendar Setup">
  <CalendarPage />
</ProtectedFeature>
```

### Pattern 3: Conditional Rendering
```tsx
{isProfileComplete ? (
  <FeatureComponent />
) : (
  <IncompleteProfileMessage />
)}
```

## Testing

```bash
# Check if profile is complete
curl http://localhost:3000/api/auth/me

# Should include: "profileComplete": true/false
```

## Debugging

```tsx
// In component
const { isProfileComplete } = useProfileCompletion();
console.log('Profile complete:', isProfileComplete);

// In browser DevTools
// Check user object in React DevTools
// Look for profileComplete field
```

## Common Issues

| Issue | Solution |
|-------|----------|
| Modal not showing | Check if `profileComplete: false` in API response |
| Navigation not working | Verify `/settings/my-profile` route exists |
| Styling looks off | Check if CSS module is imported correctly |
| Hook error | Ensure component is inside `<AuthProvider>` |

## Next Steps

1. ✅ Calendar Setup - Already protected
2. [ ] Protect Bookings page
3. [ ] Protect Clients page
4. [ ] Protect Payment setup
5. [ ] Protect other features

See `IMPLEMENTATION_CHECKLIST.md` for full list.

## Documentation

- **Full Guide:** `PROFILE_COMPLETION_GUIDE.md`
- **Checklist:** `IMPLEMENTATION_CHECKLIST.md`
- **This File:** `QUICK_REFERENCE.md`

## Support

For detailed information, see the full documentation files.
