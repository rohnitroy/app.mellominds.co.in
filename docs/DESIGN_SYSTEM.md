# MelloMinds — Design System & Theme Guide

**Last Updated:** June 5, 2026  
**Audience:** Frontend Developers, UI/UX Designers, Design Agents  
**Purpose:** Standardized design patterns, colors, typography, and components for consistent UI development

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Color Palette](#color-palette)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Components](#components)
6. [Buttons & Actions](#buttons--actions)
7. [Forms & Inputs](#forms--inputs)
8. [Cards & Containers](#cards--containers)
9. [Modals & Overlays](#modals--overlays)
10. [Navigation](#navigation)
11. [Status & Badges](#status--badges)
12. [Icons](#icons)
13. [Shadows & Depth](#shadows--depth)
14. [Animations & Transitions](#animations--transitions)
15. [Responsive Design](#responsive-design)
16. [Accessibility](#accessibility)

---

## Design Philosophy

**MelloMinds UI Principles:**

1. **Clarity First** — Information hierarchy should be immediately obvious
2. **Professional** — Therapist-facing, builds trust
3. **Minimalist** — Avoid visual clutter; whitespace is intentional
4. **Accessible** — WCAG AA compliant, keyboard navigable
5. **Responsive** — Works on tablet/desktop (mobile blocked for now)
6. **Consistent** — Use design tokens; avoid one-off colors/spacing

**Visual Style:**
- Clean, modern, sans-serif dominated
- Warm dark teal accent (primary brand color)
- Generous whitespace
- Subtle shadows for depth
- Rounded corners (8px-20px)

---

## Color Palette

### Primary Brand Colors

| Name | Hex | RGB | Usage |
|---|---|---|---|
| **Dark Teal** (primary) | `#082421` | rgb(8, 36, 33) | Sidebar, buttons, headers, active states |
| **Bright Yellow** (accent) | `#F9E141` | rgb(249, 225, 65) | Active nav items, highlights, CTAs |
| **Teal Accent Light** | `#D5FFFA` | rgb(213, 255, 250) | Nav item text, hover states |

### Semantic Colors

| Name | Hex | Usage |
|---|---|---|
| **Success** | `#10B981` | ✅ Confirmation, paid status, positive actions |
| **Error/Danger** | `#EF4444` | ❌ Cancel, delete, failed payments, errors |
| **Warning** | `#F59E0B` | ⚠️ Pending status, caution messages |
| **Info** | `#3B82F6` | ℹ️ Information messages, neutral actions |

### Neutral Colors

| Name | Hex | RGB | Usage |
|---|---|---|---|
| **White** | `#FFFFFF` | rgb(255, 255, 255) | Cards, forms, content areas |
| **Light Gray** | `#F8F9FA` | rgb(248, 249, 250) | Page background, hover states |
| **Lighter Gray** | `#F4F6F9` | rgb(244, 246, 249) | Alternate backgrounds |
| **Border Gray** | `#E0E0E0` / `#F0F0F0` | — | Dividers, borders, subtle separators |
| **Medium Gray** | `#6B7280` | rgb(107, 114, 128) | Secondary text, labels |
| **Dark Gray** | `#555555` / `#333333` | — | Body text, primary text |
| **Very Dark Gray** | `#0F1A19` | rgb(15, 26, 25) | Headings, emphasis |

### Color Usage Rules

```
Text: #333333 (body), #0F1A19 (headings), #555555 (secondary)
Backgrounds: #FFFFFF (primary), #F8F9FA (secondary), #F4F6F9 (tertiary)
Borders: #E0E0E0 (strong), #F0F0F0 (subtle)
Hover/Active: #F9E141 (bright yellow), rgba(249, 225, 65, 0.1) (pale yellow)
Disabled: #CCC (text), #F8F9FA (background)
```

---

## Typography

### Font Family

**Primary:** `'Urbanist', sans-serif`  
**Fallback:** `sans-serif`

All text uses Urbanist unless otherwise specified. Import via:
```html
<link href="https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Type Scale

| Name | Weight | Size | Line Height | Usage |
|---|---|---|---|---|
| **H1** | 700 | 32px | 1.3 | Page titles |
| **H2** | 700 | 24px | 1.3 | Section headers |
| **H3** | 700 | 20px | 1.4 | Subsection headers, modals |
| **H4** | 600 | 18px | 1.4 | Component titles |
| **Label** | 600 | 14px | 1.5 | Form labels, tags, badges |
| **Body** | 400 | 14px | 1.6 | Paragraph text, descriptions |
| **Body Small** | 400 | 13px | 1.6 | Secondary text, hints |
| **Caption** | 400 | 12px | 1.5 | Timestamps, metadata |
| **Tiny** | 400 | 11px | 1.4 | Very small text, tooltips |

### Font Weight Values

- **400** — Normal (body text)
- **500** — Medium (emphasis, buttons)
- **600** — Semibold (labels, nav items)
- **700** — Bold (headings, active states)

### Example Usage (Inline Styles)

```javascript
// Heading
<h2 style={{ fontFamily: 'Urbanist', fontWeight: 700, fontSize: '24px', lineHeight: '1.3', color: '#0F1A19' }}>
  Sessions
</h2>

// Body Text
<p style={{ fontFamily: 'Urbanist', fontWeight: 400, fontSize: '14px', lineHeight: '1.6', color: '#333' }}>
  Click below to manage your bookings.
</p>

// Label
<label style={{ fontFamily: 'Urbanist', fontWeight: 600, fontSize: '14px', color: '#555' }}>
  Session Duration
</label>
```

---

## Spacing & Layout

### Spacing Scale (8px grid)

All spacing is based on multiples of 8px:

| Token | Value | Usage |
|---|---|---|
| `xs` | 4px | Tight spacing, icon margins |
| `sm` | 8px | Compact spacing |
| `md` | 16px | Default spacing, padding |
| `lg` | 24px | Section spacing |
| `xl` | 32px | Large spacing, modal padding |
| `2xl` | 48px | Extra large spacing |

### Padding Patterns

**Cards/Containers:**
- Standard: `padding: '24px'` or `padding: '20px'`
- Compact: `padding: '16px'`
- Generous: `padding: '32px'` (modals)

**Buttons:**
- Default: `padding: '10px 24px'`
- Small: `padding: '6px 16px'`
- Large: `padding: '12px 32px'`

**Forms:**
- Input padding: `padding: '10px 12px'`
- Form group gap: `gap: '16px'` (vertical)

### Layout Grid

**Dashboard Layout:**
```
┌─────────────────────────────────┐
│  Sidebar (240px) │ Main Content  │
│   (fixed width)  │ (flex: 1)      │
└─────────────────────────────────┘
```

**Content Areas:**
- Max width for readability: ~1200px
- Horizontal padding: 24px-32px
- Vertical padding: 20px-32px

---

## Components

### Component Structure Pattern

Each component should follow this structure:

```typescript
interface ComponentProps {
  label?: string;
  disabled?: boolean;
  error?: string;
  // ... other props
}

const Component: React.FC<ComponentProps> = ({ label, disabled, error, ...props }) => {
  return (
    <div style={{ /* container */ }}>
      {label && <label style={{ /* label style */ }}>{label}</label>}
      <div style={{ /* input container */ }}>
        {/* component content */}
      </div>
      {error && <span style={{ color: '#EF4444', fontSize: '12px' }}>{error}</span>}
    </div>
  );
};
```

---

## Buttons & Actions

### Button Variants

**Primary Button (CTA - Call To Action)**
```javascript
style={{
  background: '#082421',
  color: '#FFFFFF',
  border: 'none',
  padding: '10px 24px',
  borderRadius: '8px',
  fontFamily: 'Urbanist',
  fontWeight: 600,
  fontSize: '14px',
  cursor: 'pointer',
  transition: 'background 0.2s',
}}
onMouseEnter={(e) => e.currentTarget.style.background = '#0d3430'}
onMouseLeave={(e) => e.currentTarget.style.background = '#082421'}
```

**Secondary Button (Alternative)**
```javascript
style={{
  background: '#FFFFFF',
  color: '#082421',
  border: '1px solid #E0E0E0',
  padding: '10px 24px',
  borderRadius: '8px',
  fontFamily: 'Urbanist',
  fontWeight: 500,
  fontSize: '14px',
  cursor: 'pointer',
  transition: 'background 0.2s',
}}
```

**Tertiary Button (Minimal)**
```javascript
style={{
  background: 'none',
  border: 'none',
  color: '#555',
  padding: '10px 16px',
  fontFamily: 'Urbanist',
  fontWeight: 500,
  fontSize: '14px',
  cursor: 'pointer',
  transition: 'color 0.2s',
}}
```

**Danger Button (Destructive)**
```javascript
style={{
  background: '#EF4444',
  color: '#FFFFFF',
  border: 'none',
  padding: '10px 24px',
  borderRadius: '8px',
  fontFamily: 'Urbanist',
  fontWeight: 600,
  fontSize: '14px',
  cursor: 'pointer',
}}
```

### Button States

| State | Style |
|---|---|
| **Default** | Background as defined, cursor: pointer |
| **Hover** | Darken background slightly or add shadow |
| **Active** | Darken more, subtle shadow |
| **Disabled** | Opacity: 0.5, cursor: not-allowed |
| **Loading** | Show spinner, disable interactions |

---

## Forms & Inputs

### Text Input

```javascript
style={{
  padding: '10px 12px',
  border: '1px solid #E0E0E0',
  borderRadius: '6px',
  fontFamily: 'Urbanist',
  fontSize: '14px',
  width: '100%',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
}}
onFocus={(e) => e.currentTarget.style.borderColor = '#082421'}
onBlur={(e) => e.currentTarget.style.borderColor = '#E0E0E0'}
```

### Select/Dropdown

```javascript
style={{
  padding: '10px 12px',
  border: '1px solid #E0E0E0',
  borderRadius: '6px',
  fontFamily: 'Urbanist',
  fontSize: '14px',
  background: '#FFFFFF',
  width: '100%',
  boxSizing: 'border-box',
  cursor: 'pointer',
}}
```

### Checkbox

```javascript
<input 
  type="checkbox"
  style={{
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    accentColor: '#082421',
  }}
/>
```

### Form Errors

```javascript
// Input with error
<input style={{ borderColor: '#EF4444' }} />
<span style={{ color: '#EF4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
  {error}
</span>
```

### Form Label

```javascript
<label style={{
  fontFamily: 'Urbanist',
  fontWeight: 600,
  fontSize: '14px',
  color: '#333',
  marginBottom: '6px',
  display: 'block',
}}>
  Email Address
</label>
```

### Form Group Layout

```javascript
<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
  <label>{label}</label>
  <input {/*...*/} />
  {error && <span style={{ color: '#EF4444', fontSize: '12px' }}>{error}</span>}
</div>
```

---

## Cards & Containers

### Standard Card

```javascript
style={{
  background: '#FFFFFF',
  borderRadius: '12px',
  padding: '24px',
  border: '1px solid #F0F0F0',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
}}
```

### Card with Hover Effect

```javascript
style={{
  background: '#FFFFFF',
  borderRadius: '12px',
  padding: '24px',
  border: '1px solid #F0F0F0',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
  cursor: 'pointer',
  transition: 'all 0.2s',
}}
onMouseEnter={(e) => {
  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
  e.currentTarget.style.transform = 'translateY(-2px)';
}}
onMouseLeave={(e) => {
  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
  e.currentTarget.style.transform = 'translateY(0)';
}}
```

### Status Card (with colored left border)

```javascript
style={{
  background: '#FFFFFF',
  borderRadius: '12px',
  padding: '20px',
  border: '1px solid #F0F0F0',
  borderLeft: '4px solid',
  borderLeftColor: statusColor, // #10B981 (success), #EF4444 (error), etc.
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
}}
```

### Divider

```javascript
<div style={{
  height: '1px',
  background: '#E0E0E0',
  margin: '16px 0',
}} />
```

---

## Modals & Overlays

### Modal Overlay Backdrop

```javascript
style={{
  position: 'fixed',
  inset: 0, // top: 0, right: 0, bottom: 0, left: 0
  background: 'rgba(0, 0, 0, 0.5)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
}}
```

### Modal Content Container

```javascript
style={{
  background: '#FFFFFF',
  borderRadius: '16px',
  padding: '32px',
  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
  maxWidth: '500px',
  width: '100%',
  maxHeight: '90vh',
  overflowY: 'auto',
  zIndex: 1001,
}}
```

### Modal Header (with close button)

```javascript
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
  <h2 style={{ fontFamily: 'Urbanist', fontWeight: 700, fontSize: '20px', margin: 0 }}>
    Modal Title
  </h2>
  <button
    onClick={onClose}
    style={{
      background: 'none',
      border: 'none',
      fontSize: '24px',
      cursor: 'pointer',
      color: '#666',
      padding: '0',
      width: '32px',
      height: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    ×
  </button>
</div>
```

### Modal Footer (with actions)

```javascript
<div style={{
  display: 'flex',
  gap: '12px',
  justifyContent: 'flex-end',
  marginTop: '24px',
  borderTop: '1px solid #E0E0E0',
  paddingTop: '24px',
}}>
  <button>{/* Cancel */}</button>
  <button>{/* Confirm */}</button>
</div>
```

---

## Navigation

### Sidebar Navigation (Primary)

**Container:**
```javascript
style={{
  width: '240px',
  background: '#082421',
  color: 'white',
  display: 'flex',
  flexDirection: 'column',
  padding: '20px 0',
  flexShrink: 0,
}}
```

**Nav Item (Default):**
```javascript
style={{
  display: 'flex',
  alignItems: 'center',
  padding: '12px 20px',
  margin: '16px 0',
  borderRadius: '10px',
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: '14px',
  color: '#D5FFFA',
  transition: 'background 0.2s',
  height: '40px',
  boxSizing: 'border-box',
}}
onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(249, 225, 65, 0.1)'}
onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
```

**Nav Item (Active):**
```javascript
style={{
  background: '#F9E141',
  color: '#082421',
  fontWeight: 600,
  // ... other properties same as default
}}
```

**Nav Divider:**
```javascript
style={{
  height: '1px',
  background: 'rgba(255, 255, 255, 0.2)',
  margin: '16px 12px',
}}
```

---

## Status & Badges

### Badge/Pill Component

```javascript
style={{
  display: 'inline-block',
  padding: '4px 12px',
  borderRadius: '20px',
  fontSize: '12px',
  fontWeight: 600,
  whiteSpace: 'nowrap',
}}
```

### Status Badge Variants

| Status | Background | Text | Example |
|---|---|---|---|
| **Paid** | `#D1FAE5` | `#065F46` | ✓ Paid |
| **Pending** | `#FEF3C7` | `#92400E` | ⏳ Pending |
| **Cancelled** | `#DBEAFE` | `#1E40AF` | ✗ Cancelled |
| **Refunded** | `#E0E7FF` | `#3730A3` | ↩ Refunded |
| **No Show** | `#F3F4F6` | `#374151` | — No Show |

**Implementation:**
```javascript
const statusStyles = {
  paid: { bg: '#D1FAE5', color: '#065F46' },
  pending: { bg: '#FEF3C7', color: '#92400E' },
  cancelled: { bg: '#DBEAFE', color: '#1E40AF' },
  refunded: { bg: '#E0E7FF', color: '#3730A3' },
};

<span style={{
  background: statusStyles[status].bg,
  color: statusStyles[status].color,
  padding: '4px 10px',
  borderRadius: '20px',
  fontSize: '12px',
  fontWeight: 600,
}}>
  {status}
</span>
```

---

## Icons

### Icon Library

**Primary:** React Iconly v2  
**Usage:**
```javascript
import { Calendar, TwoUsers, Wallet, Setting, Paper, AddUser } from 'react-iconly';

<Calendar set="bulk" primaryColor="#082421" />
```

### Icon Sizing

| Size | Value | Usage |
|---|---|---|
| **Small** | 16px | Inline, nav items |
| **Medium** | 20px | Buttons, headers |
| **Large** | 24px | Focus areas, featured |
| **XL** | 32px | Page icons, status |

### Icon Color Rules

- **Primary:** `#082421` (dark teal)
- **Secondary:** `#D5FFFA` (light teal, sidebar nav)
- **Disabled:** `#CCC` (light gray)
- **Accent:** `#F9E141` (yellow, active)

---

## Shadows & Depth

### Shadow Scale

| Level | CSS | Usage |
|---|---|---|
| **None** | none | Flat elements |
| **Subtle** | `0 1px 3px rgba(0,0,0,0.05)` | Cards, containers |
| **Small** | `0 4px 12px rgba(0,0,0,0.08)` | Hovered cards, elevated |
| **Medium** | `0 10px 24px rgba(0,0,0,0.12)` | Dropdowns, tooltips |
| **Large** | `0 20px 40px rgba(0,0,0,0.15)` | Modals, overlays |

**Implementation:**
```javascript
// Card shadow
boxShadow: '0 1px 3px rgba(0,0,0,0.05)'

// Hovered card
boxShadow: '0 4px 12px rgba(0,0,0,0.08)'

// Modal
boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
```

---

## Animations & Transitions

### Transition Timing

| Type | Duration | Easing | Usage |
|---|---|---|---|
| **Quick** | 150ms | ease | Hover states, subtle changes |
| **Standard** | 200ms | ease | Normal interactions |
| **Slow** | 300ms | ease | Page transitions, complex animations |

### Common Animations

**Fade In:**
```javascript
style={{
  animation: 'fadeIn 0.2s ease-in-out',
  keyframes: `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `
}}
```

**Slide Up:**
```javascript
style={{
  animation: 'slideUp 0.3s ease-in-out',
  keyframes: `
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `
}}
```

**Button Hover:**
```javascript
onMouseEnter={(e) => {
  e.currentTarget.style.transform = 'translateY(-2px)';
  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
}}
onMouseLeave={(e) => {
  e.currentTarget.style.transform = 'translateY(0)';
  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
}}
```

### Transition Properties

```javascript
transition: 'all 0.2s ease'
transition: 'background 0.2s ease'
transition: 'transform 0.2s ease, box-shadow 0.2s ease'
```

---

## Responsive Design

### Breakpoints

| Device | Min Width | Max Width |
|---|---|---|
| **Mobile** | 320px | 639px |
| **Tablet** | 640px | 1023px |
| **Desktop** | 1024px | ∞ |

### Current Focus

**Mobile:** Blocked (MobileBlocker component)  
**Tablet/Desktop:** Fully supported

### Media Queries

```css
/* Tablet & Up */
@media (min-width: 640px) {
  .container { padding: 24px; }
}

/* Desktop */
@media (min-width: 1024px) {
  .sidebar { width: 240px; }
  .main-content { flex: 1; }
}

/* Landscape orientation */
@media (orientation: landscape) {
  .sidebar { width: 200px; }
}
```

### Responsive Layout Pattern

```javascript
<div style={{
  display: 'flex',
  flexDirection: window.innerWidth < 1024 ? 'column' : 'row',
  gap: '24px',
}}>
  {/* Content */}
</div>
```

---

## Accessibility

### Color Contrast

**Minimum AA Standard:**
- Text on background: 4.5:1 contrast ratio
- Large text (18px+): 3:1 contrast ratio

**Check:** https://webaim.org/resources/contrastchecker/

**Safe Combinations:**
- `#082421` (dark teal) on `#FFFFFF` (white) ✅ 11.5:1
- `#333333` (dark gray) on `#FFFFFF` (white) ✅ 12.6:1
- `#F9E141` (yellow) on `#082421` (dark) ✅ 6.3:1

### Keyboard Navigation

- All interactive elements focusable (buttons, inputs, links)
- Focus style: `outline: 2px solid #082421; outline-offset: 2px`
- Tab order follows visual hierarchy
- Escape key closes modals

### ARIA & Semantic HTML

```javascript
// Form
<label htmlFor="input-id">Label</label>
<input id="input-id" aria-describedby="error-id" />
<span id="error-id" role="alert">{error}</span>

// Button
<button aria-label="Close modal" onClick={onClose}>×</button>

// Modal
<div role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <h2 id="modal-title">Modal Title</h2>
</div>

// Loading
<div aria-busy="true" aria-label="Loading...">
  <Loader />
</div>
```

### Text Sizing

- Minimum: 12px (caption/metadata only)
- Body text: 14px+
- Headings: 18px+ (larger is better)
- Line height: ≥1.5 for readability

---

## Implementation Checklist

When building new components, ensure:

- [ ] Colors match palette (no custom colors)
- [ ] Typography uses Urbanist font + correct weights
- [ ] Spacing follows 8px grid
- [ ] Buttons have all 4 states (default, hover, active, disabled)
- [ ] Forms have labels, error states, validation
- [ ] Cards have subtle shadow
- [ ] Modals use backdrop overlay
- [ ] Icons are properly sized and colored
- [ ] Animations use standard transitions
- [ ] Component is responsive (tablet/desktop)
- [ ] Focus states visible (outline or highlight)
- [ ] Color contrast ≥4.5:1
- [ ] Related components are consistent

---

## Example: Building a "Book Session" Button

```typescript
import React from 'react';

interface BookButtonProps {
  loading?: boolean;
  onClick: () => void;
  disabled?: boolean;
}

const BookButton: React.FC<BookButtonProps> = ({ loading, onClick, disabled }) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: disabled ? '#CCC' : '#082421',
        color: '#FFFFFF',
        border: 'none',
        padding: '10px 24px',
        borderRadius: '8px',
        fontFamily: 'Urbanist',
        fontWeight: 600,
        fontSize: '14px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        opacity: disabled ? 0.5 : 1,
        transform: isHovered && !disabled ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: isHovered && !disabled 
          ? '0 4px 12px rgba(0,0,0,0.1)' 
          : '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      {loading ? '⏳ Booking...' : '✓ Book Session'}
    </button>
  );
};

export default BookButton;
```

---

## Resources

- **Font:** https://fonts.google.com/specimen/Urbanist
- **Icons:** https://react-iconly.js.org/
- **Colors:** Use hex values from this doc
- **Contrast Checker:** https://webaim.org/resources/contrastchecker/
- **Accessibility:** https://www.w3.org/WAI/WCAG21/quickref/

---

**Questions?** Refer to existing components in `frontend/src/components/` for real examples.
