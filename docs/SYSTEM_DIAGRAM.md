# Profile Completion System - Visual Diagrams

## 1. Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         App Component                            │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    AuthProvider                          │   │
│  │  (Provides user data with profileComplete flag)         │   │
│  │                                                          │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │              CalendarPage Component               │ │   │
│  │  │                                                    │ │   │
│  │  │  ┌──────────────────────────────────────────────┐ │ │   │
│  │  │  │  useProfileCompletion Hook                   │ │ │   │
│  │  │  │  - Reads profileComplete from context       │ │ │   │
│  │  │  │  - Manages modal visibility                 │ │ │   │
│  │  │  │  - Provides checkProfileCompletion()        │ │ │   │
│  │  │  └──────────────────────────────────────────────┘ │ │   │
│  │  │                                                    │ │   │
│  │  │  ┌──────────────────────────────────────────────┐ │ │   │
│  │  │  │  Create Calendar Button                      │ │ │   │
│  │  │  │  onClick: checkProfileCompletion()          │ │ │   │
│  │  │  └──────────────────────────────────────────────┘ │ │   │
│  │  │                                                    │ │   │
│  │  │  ┌──────────────────────────────────────────────┐ │ │   │
│  │  │  │  ProfileCompletionModal                      │ │ │   │
│  │  │  │  - Shows when profile incomplete            │ │ │   │
│  │  │  │  - Lists required fields                     │ │ │   │
│  │  │  │  - Navigates to profile settings             │ │ │   │
│  │  │  └──────────────────────────────────────────────┘ │ │   │
│  │  │                                                    │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                      User Login                                   │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│              Backend: /auth/me Endpoint                           │
│                                                                   │
│  1. Check if user authenticated                                  │
│  2. Call isProfileComplete(user)                                 │
│  3. Return user object with profileComplete flag                 │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│              Frontend: AuthContext                                │
│                                                                   │
│  1. Receive user object from backend                             │
│  2. Store user data in context state                             │
│  3. Make available to all components via useAuth()               │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│              Component: CalendarPage                              │
│                                                                   │
│  1. Use useProfileCompletion hook                                │
│  2. Get isProfileComplete from context                           │
│  3. Render UI based on profile status                            │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│              User Interaction                                     │
│                                                                   │
│  Click "Create Calendar" button                                  │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│              checkProfileCompletion() Function                    │
│                                                                   │
│  1. Check isProfileComplete value                                │
│  2. If false: show modal, return false                           │
│  3. If true: return true, allow feature access                   │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                    ┌────┴────┐
                    │          │
                    ▼          ▼
        ┌──────────────────┐  ┌──────────────────┐
        │  Profile         │  │  Profile         │
        │  Complete        │  │  Incomplete      │
        │  (true)          │  │  (false)         │
        └────────┬─────────┘  └────────┬─────────┘
                 │                     │
                 ▼                     ▼
        ┌──────────────────┐  ┌──────────────────┐
        │ Allow Feature    │  │ Show Modal       │
        │ Access           │  │ - Required fields│
        │                  │  │ - Complete btn   │
        │                  │  │ - Cancel btn     │
        └──────────────────┘  └────────┬─────────┘
                                       │
                                ┌──────┴──────┐
                                │             │
                                ▼             ▼
                        ┌──────────────┐  ┌──────────┐
                        │ Navigate to  │  │ Close    │
                        │ Profile      │  │ Modal    │
                        │ Settings     │  │          │
                        └──────────────┘  └──────────┘
```

## 3. Profile Completion Check Logic

```
┌─────────────────────────────────────────────────────────────────┐
│              isProfileComplete(user) Function                    │
│                                                                  │
│  Required Fields:                                               │
│  ├─ phone                                                       │
│  ├─ dob                                                         │
│  ├─ gender                                                      │
│  ├─ specialization                                              │
│  ├─ country                                                     │
│  ├─ state                                                       │
│  ├─ city                                                        │
│  ├─ pincode                                                     │
│  └─ clinic_address                                              │
│                                                                  │
│  Logic:                                                         │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ For each required field:                                   ││
│  │   1. Check if field exists                                 ││
│  │   2. Check if field is not null                            ││
│  │   3. Check if field is not empty string                    ││
│  │   4. Check if field is not whitespace-only                 ││
│  │                                                             ││
│  │ If ALL fields pass: return true                            ││
│  │ If ANY field fails: return false                           ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 4. Modal State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                    Modal State Machine                           │
│                                                                  │
│  ┌──────────────┐                                               │
│  │   CLOSED     │                                               │
│  │ (isOpen=false)                                               │
│  └────────┬─────┘                                               │
│           │                                                     │
│           │ checkProfileCompletion() called                     │
│           │ profileComplete = false                             │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    OPENING                               │  │
│  │  - setShowProfileModal(true)                             │  │
│  │  - Animation: fadeIn + slideUp (300ms)                   │  │
│  └────────┬─────────────────────────────────────────────────┘  │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    OPEN                                  │  │
│  │  - Modal visible                                         │  │
│  │  - User can interact                                     │  │
│  │  - Two options:                                          │  │
│  │    1. Click "Complete Profile" → Navigate               │  │
│  │    2. Click "Cancel" → Close                             │  │
│  └────────┬─────────────────────────────────────────────────┘  │
│           │                                                     │
│           ├─────────────────────────────────────────┐           │
│           │                                         │           │
│           ▼                                         ▼           │
│  ┌──────────────────┐                    ┌──────────────────┐  │
│  │    CLOSING       │                    │    CLOSING       │  │
│  │ (Complete btn)   │                    │  (Cancel btn)    │  │
│  │ - Animation      │                    │ - Animation      │  │
│  │ - Navigate       │                    │ - Close only     │  │
│  └────────┬─────────┘                    └────────┬─────────┘  │
│           │                                       │             │
│           ▼                                       ▼             │
│  ┌──────────────────┐                    ┌──────────────────┐  │
│  │ /settings/       │                    │     CLOSED       │  │
│  │ my-profile       │                    │ (isOpen=false)   │  │
│  └──────────────────┘                    └──────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 5. Feature Protection Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                  Feature Protection Pattern                      │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Component (e.g., CalendarPage)                          │   │
│  │                                                          │   │
│  │  1. Import Hook & Modal                                 │   │
│  │     import { useProfileCompletion } from '...'          │   │
│  │     import ProfileCompletionModal from '...'            │   │
│  │                                                          │   │
│  │  2. Use Hook                                            │   │
│  │     const { showProfileModal, ... } =                   │   │
│  │       useProfileCompletion()                            │   │
│  │                                                          │   │
│  │  3. Protect Feature                                     │   │
│  │     const handleAction = () => {                        │   │
│  │       if (!checkProfileCompletion('Feature')) return    │   │
│  │       // Proceed with feature                           │   │
│  │     }                                                   │   │
│  │                                                          │   │
│  │  4. Render Modal                                        │   │
│  │     <ProfileCompletionModal                             │   │
│  │       isOpen={showProfileModal}                         │   │
│  │       onClose={() => setShowProfileModal(false)}        │   │
│  │       featureName="Feature Name"                        │   │
│  │     />                                                  │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 6. User Journey Map

```
┌─────────────────────────────────────────────────────────────────┐
│                      User Journey Map                            │
│                                                                  │
│  START: User with Incomplete Profile                            │
│    │                                                            │
│    ├─ Logs in                                                   │
│    │  └─ Backend returns profileComplete: false                │
│    │                                                            │
│    ├─ Navigates to Calendar Setup                              │
│    │  └─ CalendarPage loads                                    │
│    │                                                            │
│    ├─ Clicks "Create Calendar" button                          │
│    │  └─ checkProfileCompletion() called                       │
│    │                                                            │
│    ├─ Modal appears                                            │
│    │  ├─ Shows required fields                                 │
│    │  ├─ Shows "Complete Profile" button                       │
│    │  └─ Shows "Cancel" button                                 │
│    │                                                            │
│    ├─ User clicks "Complete Profile"                           │
│    │  └─ Navigates to /settings/my-profile                     │
│    │                                                            │
│    ├─ User fills in all required fields                        │
│    │  ├─ Phone Number                                          │
│    │  ├─ Date of Birth                                         │
│    │  ├─ Gender                                                │
│    │  ├─ Specialization                                        │
│    │  ├─ Country                                               │
│    │  ├─ State                                                 │
│    │  ├─ City                                                  │
│    │  ├─ Pincode                                               │
│    │  └─ Clinic Address                                        │
│    │                                                            │
│    ├─ User saves profile                                       │
│    │  └─ Backend updates user record                           │
│    │                                                            │
│    ├─ User navigates back to Calendar                          │
│    │  └─ AuthContext refreshes user data                       │
│    │                                                            │
│    ├─ User clicks "Create Calendar" again                      │
│    │  └─ checkProfileCompletion() called                       │
│    │                                                            │
│    ├─ Profile is now complete                                  │
│    │  └─ Feature access is granted                             │
│    │                                                            │
│    └─ User can create calendar ✓                               │
│                                                                  │
│  END: User with Complete Profile                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 7. File Structure

```
MelloMinds Application
│
├── backend/
│   └── routes/
│       └── auth.js (MODIFIED)
│           ├── isProfileComplete() function
│           └── /auth/me endpoint (updated)
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CalendarPage.tsx (MODIFIED)
│   │   │   ├── ProfileCompletionModal.tsx (NEW)
│   │   │   ├── ProfileCompletionModal.module.css (NEW)
│   │   │   └── ProtectedFeature.tsx (NEW)
│   │   │
│   │   ├── context/
│   │   │   └── AuthContext.tsx (MODIFIED)
│   │   │       └── Added profileComplete field
│   │   │
│   │   └── hooks/
│   │       └── useProfileCompletion.ts (NEW)
│   │
│   └── ...
│
├── PROFILE_COMPLETION_GUIDE.md (NEW)
├── IMPLEMENTATION_CHECKLIST.md (NEW)
├── QUICK_REFERENCE.md (NEW)
├── IMPLEMENTATION_SUMMARY.md (NEW)
└── SYSTEM_DIAGRAM.md (NEW - this file)
```

## 8. Integration Points

```
┌─────────────────────────────────────────────────────────────────┐
│                   Integration Points                             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Backend Integration                                     │   │
│  │  - /auth/me endpoint returns profileComplete flag        │   │
│  │  - No database schema changes needed                     │   │
│  │  - Uses existing user fields                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Frontend Integration                                    │   │
│  │  - AuthContext provides user data                        │   │
│  │  - useProfileCompletion hook manages state               │   │
│  │  - Components use hook to check profile                  │   │
│  │  - Modal shows when profile incomplete                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Feature Integration                                     │   │
│  │  - Calendar Setup (implemented)                          │   │
│  │  - Bookings (ready to implement)                         │   │
│  │  - Clients (ready to implement)                          │   │
│  │  - Payments (ready to implement)                         │   │
│  │  - Other features (ready to implement)                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 9. Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   Error Handling Flow                            │
│                                                                  │
│  Scenario 1: User not authenticated                             │
│  ├─ /auth/me returns 401                                        │
│  ├─ AuthContext sets isAuthenticated = false                    │
│  ├─ useProfileCompletion returns isProfileComplete = false      │
│  └─ Modal shows (user should login first)                       │
│                                                                  │
│  Scenario 2: Missing required fields                            │
│  ├─ isProfileComplete() returns false                           │
│  ├─ profileComplete flag = false                                │
│  ├─ Modal shows with list of required fields                    │
│  └─ User navigates to profile settings                          │
│                                                                  │
│  Scenario 3: Navigation fails                                   │
│  ├─ "Complete Profile" button click fails                       │
│  ├─ Modal stays open                                            │
│  ├─ User can retry or cancel                                    │
│  └─ No feature access granted                                   │
│                                                                  │
│  Scenario 4: Profile update fails                               │
│  ├─ User fills profile but save fails                           │
│  ├─ profileComplete remains false                               │
│  ├─ Modal still shows on feature access                         │
│  └─ User can retry profile completion                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 10. Performance Considerations

```
┌─────────────────────────────────────────────────────────────────┐
│              Performance Considerations                          │
│                                                                  │
│  ✓ Lightweight Check                                            │
│    └─ Simple boolean comparison (O(1))                          │
│                                                                  │
│  ✓ No Additional API Calls                                      │
│    └─ Uses existing /auth/me endpoint                           │
│                                                                  │
│  ✓ No Database Queries                                          │
│    └─ Uses existing user data                                   │
│                                                                  │
│  ✓ Minimal Bundle Size                                          │
│    └─ ~400 lines of code total                                  │
│    └─ ~10KB minified + gzipped                                  │
│                                                                  │
│  ✓ Smooth Animations                                            │
│    └─ CSS transitions (GPU accelerated)                         │
│    └─ No JavaScript animation loops                             │
│                                                                  │
│  ✓ Cached State                                                 │
│    └─ profileComplete cached in AuthContext                     │
│    └─ No repeated calculations                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

**Visual Diagrams Created:** 10
**Last Updated:** May 26, 2026
**Status:** ✅ Complete
