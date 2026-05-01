# Mobile Features Guide

## Mobile Navigation

### Hamburger Menu
- **Location**: Top-left corner of header (visible only on mobile)
- **Icon**: Three horizontal lines (☰) when closed, X when open
- **Behavior**: 
  - Tap to open sidebar from left
  - Tap overlay or X to close
  - Automatically closes when navigating to a new page

### Sidebar
- **Desktop**: Always visible on left (240px width)
- **Mobile**: Hidden by default, slides in from left when hamburger is tapped
- **Transition**: Smooth 0.3s ease animation

## Responsive Breakpoints

### Desktop (> 1024px)
- Full sidebar visible
- Multi-column layouts (3-4 columns)
- Side-by-side panels
- Large fonts and spacing

### Tablet (768px - 1024px)
- Sidebar becomes hamburger menu
- 2-column layouts
- Reduced spacing
- Medium fonts

### Mobile (< 768px)
- Hamburger menu
- Single column layouts
- Compact spacing
- Smaller fonts
- Full-width buttons

### Small Mobile (< 480px)
- Ultra-compact layout
- Minimum font sizes
- Stacked elements
- Full-width everything

## Page-Specific Mobile Features

### Dashboard
- **Stats**: 4 columns → 2 columns → 1 column
- **Date Selector**: Full width on mobile
- **Profile Completion**: Stacks vertically
- **Upcoming Bookings**: Horizontal scroll table

### Appointments
- **Tabs**: Horizontal scroll with hidden scrollbar
- **Search**: Full width
- **Table**: Horizontal scroll to preserve all columns
- **Actions**: Three-dot menu remains functional

### All Clients
- **Search**: Full width
- **Add Client**: Full width button
- **Table**: Horizontal scroll
- **Filters**: Stack vertically

### My Calendar
- **Calendar Grid**: 3 columns → 2 columns → 1 column
- **Create Button**: Full width on mobile
- **Calendar Cards**: Full width, easier to tap

### Create Event
- **Sidebar Nav**: Becomes horizontal scrolling tabs
- **Form**: 3 columns → 2 columns → 1 column
- **Schedule Grid**: Stacks vertically
- **Color Picker**: Wraps to multiple rows

### Client View
- **Layout**: Left panel + right panel → stacked vertically
- **Tabs**: Horizontal scroll
- **Stats**: 3 columns → 2 columns
- **Session Cards**: Full width
- **Floating Action Button**: Positioned bottom-right

### My Settings
- **Grid**: 2 columns → 1 column
- **Cards**: Full width
- **Toggle Switches**: Remain on right side
- **Analytics**: 4 columns → 2 columns

### My Profile
- **Form Grid**: 3 columns → 2 columns → 1 column
- **Profile Image**: Stacks above info
- **Save Button**: Full width on mobile

### Payments & Invoice
- **Tabs**: Horizontal scroll
- **Table**: Horizontal scroll
- **Search**: Full width
- **Export**: Aligned right

### Therapists (Enterprise)
- **Stats Bar**: Wraps to multiple rows
- **Invite Button**: Full width
- **Table**: Horizontal scroll
- **Modal Actions**: Stack vertically

## Mobile-Optimized Components

### Tables
- **Behavior**: Horizontal scroll on mobile
- **Styling**: Reduced padding, smaller fonts
- **Touch**: Smooth scrolling with momentum

### Modals
- **Size**: 95% width on mobile (vs fixed width on desktop)
- **Padding**: Reduced for more content space
- **Actions**: Stack vertically on small screens

### Forms
- **Layout**: Single column on mobile
- **Inputs**: Full width with comfortable tap targets
- **Labels**: Above inputs (not side-by-side)

### Dropdowns
- **Width**: Full width on mobile
- **Position**: Adjusted to stay within viewport

### Buttons
- **Size**: Minimum 44x44px for easy tapping
- **Width**: Full width on mobile for primary actions
- **Spacing**: Increased gap between stacked buttons

## Touch Interactions

### Tap Targets
- All interactive elements are at least 44x44px
- Adequate spacing between tappable elements
- Visual feedback on tap (hover states work as active states)

### Scrolling
- Smooth momentum scrolling enabled
- Horizontal scroll for tables and tabs
- Vertical scroll for page content

### Gestures
- **Tap**: Primary interaction
- **Scroll**: Vertical and horizontal where needed
- **Overlay Tap**: Closes mobile menu

## Performance Considerations

### CSS-Only Approach
- No JavaScript required for basic responsiveness
- Minimal performance impact
- Works even if JavaScript fails

### Transitions
- Smooth 0.3s transitions for menu
- Hardware-accelerated transforms
- No layout thrashing

### Scrolling
- `-webkit-overflow-scrolling: touch` for iOS momentum
- Hidden scrollbars for cleaner look
- Efficient repaints

## Accessibility

### Mobile Menu
- `aria-label` on hamburger button
- `aria-expanded` state
- Keyboard accessible (though primarily for touch)

### Touch Targets
- Minimum 44x44px size
- Adequate spacing (8-12px minimum)
- Visual feedback on interaction

### Focus Management
- Logical tab order maintained
- Focus visible on interactive elements
- No focus traps

## Browser Support

### Tested Browsers
- Chrome/Edge (Chromium) - Full support
- Safari iOS - Full support
- Firefox - Full support
- Samsung Internet - Full support

### Required Features
- CSS Media Queries (all modern browsers)
- Flexbox (all modern browsers)
- CSS Grid (all modern browsers)
- CSS Transitions (all modern browsers)

### Fallbacks
- Graceful degradation for older browsers
- Core functionality works without CSS
- Progressive enhancement approach

## Common Mobile Patterns

### Navigation
```
Desktop: Sidebar always visible
Mobile: Hamburger → Sliding sidebar → Overlay
```

### Layout
```
Desktop: Multi-column grids
Mobile: Single column stacks
```

### Tables
```
Desktop: Full table visible
Mobile: Horizontal scroll
```

### Forms
```
Desktop: Multi-column grid
Mobile: Single column stack
```

### Actions
```
Desktop: Side-by-side buttons
Mobile: Stacked full-width buttons
```

## Tips for Users

1. **Navigation**: Tap the hamburger menu (☰) in the top-left to access the sidebar
2. **Tables**: Swipe left/right to see all columns
3. **Tabs**: Swipe left/right to see all tabs
4. **Forms**: Scroll down to see all fields
5. **Modals**: Tap outside or the X to close
6. **Dropdowns**: Tap to open, tap option to select

## Known Limitations

1. **Table Scrolling**: Some tables require horizontal scroll to see all data
2. **Complex Forms**: May require more scrolling on small screens
3. **Modals**: Some modals may be tall and require scrolling
4. **Charts**: Not yet optimized for mobile (if any exist)

## Future Mobile Enhancements

1. **Native App Feel**: Add PWA manifest and service worker
2. **Gestures**: Swipe to close menu, pull to refresh
3. **Offline Mode**: Cache data for offline access
4. **Push Notifications**: Native mobile notifications
5. **Camera Integration**: For document uploads
6. **Biometric Auth**: Fingerprint/Face ID login
