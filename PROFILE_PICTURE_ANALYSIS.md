# Profile Picture Analysis

## Database Storage

### Table: `Users`
- **Column:** `profile_picture` (TEXT type)
- **Storage Method:** Stores URL strings (not binary data)
- **Sources:**
  1. **Google OAuth Login** - Automatically fetches from Google profile
     - Format: `https://lh3.googleusercontent.com/a/...`
     - Example: `https://lh3.googleusercontent.com/a/ACg8ocKy0aUCkMqRZGnxN9t_FPZCmo47duCHv2AIALC-JfrHxmA3ZMZw=s96-c`
  2. **Manual Upload** - Currently NOT implemented (shows alert: "Image upload not yet implemented on backend")
  3. **NULL/Empty** - Users who signed up with email/password have no profile picture

### Current Data:
```
User 3 (pmeet8926@gmail.com): ✅ Has Google profile picture
User 6 (meetpandya0101@outlook.com): ❌ NULL (no picture)
User 7 (adosolve@gmail.com): ✅ Has Google profile picture
User 8 (ramsurse2@gmail.com): ✅ Has Google profile picture
User 9 (rohnitroy.corp@gmail.com): ✅ Has Google profile picture
```

---

## Where Profile Pictures Are Displayed

### 1. **Main Dashboard Header** (App.tsx) ✅ WORKING
- **Location:** Top-right corner, next to user name and email
- **Component:** `.user-info-card > .user-avatar`
- **Code:**
  ```tsx
  <img src={user?.profile_picture || "Profile.svg"} alt="Profile" />
  ```
- **Fallback:** Shows `Profile.svg` icon if no picture
- **Visibility:** Always visible on all pages (in header)

### 2. **My Profile Page** (MyProfile.tsx) ✅ NOW FIXED
- **Location:** Top-left of profile form
- **Component:** `.profileImageSection > .profileAvatar`
- **Code:**
  ```tsx
  {profilePicture ? (
    <img src={profilePicture} alt="Profile" className={styles.profileImage} />
  ) : (
    <svg>{/* fallback icon */}</svg>
  )}
  ```
- **Styling:** 120px circular avatar with yellow background fallback
- **Has Button:** "+ Change profile image" (backend not implemented yet)
- **Status:** NOW DISPLAYS ACTUAL PROFILE PICTURE

### 3. **Public Booking Page** (PublicBookingPage.tsx) ⚠️ NOT DISPLAYED
- **Location:** Therapist info section
- **Interface:** Has `profile_picture?: string` in Calendar interface
- **Current Status:** Field exists but NOT displayed in UI
- **Potential Location:** Could show therapist's picture on booking page

---

## Summary

### ✅ Working:
1. Profile pictures from Google OAuth are stored in database
2. Header shows profile picture correctly with fallback
3. **My Profile page now shows actual profile picture** (FIXED)

### ❌ Not Working:
1. **Image upload** - Backend not implemented
2. **Public booking page** - Profile picture not displayed

### 📊 Display Count:
- **Currently Displaying:** 2 locations (Dashboard header + My Profile page) ✅
- **Should Display:** 3 locations (Header, My Profile, Public Booking)
- **Missing:** 1 location (Public Booking page)

---

## Recommendations

### Priority 1: Fix My Profile Page Display
Update `MyProfile.tsx` to show actual profile picture instead of SVG icon:
```tsx
<div className={styles.profileAvatar}>
  {user?.profile_picture ? (
    <img src={user.profile_picture} alt="Profile" />
  ) : (
    <svg>{/* fallback icon */}</svg>
  )}
</div>
```

### Priority 2: Implement Image Upload
Add backend endpoint to:
1. Accept image file upload
2. Store in cloud storage (AWS S3, Cloudinary, etc.)
3. Save URL to database
4. Return new URL to frontend

### Priority 3: Show on Public Booking Page
Display therapist's profile picture on the booking page for better trust and personalization.

---

## Technical Details

### Current Flow:
1. **Google Login** → Passport.js fetches profile picture URL → Saves to DB
2. **Email/Password Signup** → No profile picture → NULL in DB
3. **Frontend** → Fetches user data → Shows picture in header only

### Image Upload Flow (To Implement):
1. User clicks "+ Change profile image"
2. File picker opens
3. User selects image
4. Frontend uploads to backend endpoint
5. Backend uploads to cloud storage
6. Backend saves URL to database
7. Frontend updates display

### Storage Options:
- **AWS S3** - Scalable, reliable
- **Cloudinary** - Image optimization, transformations
- **Local Storage** - Not recommended for production
- **Google Cloud Storage** - Good for Google-integrated apps
