# Mobile-First UI Components

Comprehensive mobile-first components for the Marine Invoice App, optimized for touch interfaces and PWA mode.

## Components

### 1. BottomNav
Bottom tab navigation for mobile PWA mode.

**Features:**
- Shows only on mobile (<768px) in standalone PWA mode
- 5 tabs: Requests, Search, Create, Contacts, More
- 56px height + safe-area-inset-bottom
- Active state with theme color
- Haptic feedback on tap
- Smooth animations with framer-motion

**Usage:**
```tsx
import { BottomNav } from '@/components/mobile';

function App() {
  return (
    <>
      <YourContent />
      <BottomNav />
    </>
  );
}
```

### 2. FAB (Floating Action Button)
Context-aware floating action button.

**Features:**
- 56x56px circular button
- Shows only on mobile
- Auto-hides on scroll down, shows on scroll up
- Extends with label when scrolling up
- Positioned above BottomNav in PWA mode
- Haptic feedback
- Scale animation on tap

**Usage:**
```tsx
import { FAB } from '@/components/mobile';
import { Plus } from 'lucide-react';

<FAB
  onClick={() => navigate('/requests/new')}
  icon={<Plus size={24} />}
  label="New Request"
  ariaLabel="Create new request"
/>
```

### 3. DetailSheet
Full-screen mobile sheet with progressive disclosure.

**Features:**
- Full-screen on mobile, modal on desktop
- Swipe-down to dismiss
- Expandable/collapsible sections
- Sticky header and actions
- Safe area insets
- Smooth animations (150-220ms)

**Usage:**
```tsx
import { DetailSheet } from '@/components/mobile';

<DetailSheet
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Request Details"
  sections={[
    {
      id: 'info',
      title: 'Basic Information',
      content: <RequestInfo data={data} />,
      defaultExpanded: true
    },
    {
      id: 'items',
      title: 'Line Items',
      content: <LineItems items={items} />
    }
  ]}
  actions={
    <button>Save Changes</button>
  }
/>
```

### 4. RequestCard
Mobile card layout for request list.

**Features:**
- Optimized for touch (48px min height)
- Swipe gestures (left/right)
- Long-press context menu
- Status badges
- Currency formatting
- Date formatting
- Kebab menu for actions
- Skeleton loading state

**Usage:**
```tsx
import { RequestCard, RequestCardSkeleton } from '@/components/mobile';

{isLoading ? (
  <RequestCardSkeleton />
) : (
  <RequestCard
    request={request}
    onTap={(req) => navigate(`/requests/${req.id}`)}
    onEdit={(req) => navigate(`/requests/${req.id}/edit`)}
    onDelete={handleDelete}
    onView={handleView}
    onPrint={handlePrint}
  />
)}
```

## Hooks

### useResponsive
Detects screen size, orientation, and PWA mode.

**Returns:**
- `breakpoint`: 'mobile' | 'tablet' | 'desktop'
- `orientation`: 'portrait' | 'landscape'
- `isMobile`, `isTablet`, `isDesktop`: boolean
- `isPWA`: boolean
- `isPortrait`, `isLandscape`: boolean
- `width`, `height`: number

**Usage:**
```tsx
import { useResponsive } from '@/components/mobile';

function MyComponent() {
  const { isMobile, isPWA, breakpoint } = useResponsive();

  return (
    <>
      {isMobile ? <MobileView /> : <DesktopView />}
      {isPWA && <BottomNav />}
    </>
  );
}
```

### useGestures
Handles touch gestures with haptic feedback.

**Gestures:**
- Swipe left/right/up/down
- Long press
- Configurable threshold (default 50px)
- Configurable long press delay (default 500ms)

**Usage:**
```tsx
import { useGestures } from '@/components/mobile';

function SwipeableCard() {
  const gestureRef = useGestures({
    onSwipeLeft: () => console.log('Swiped left'),
    onSwipeRight: () => console.log('Swiped right'),
    onLongPress: () => console.log('Long pressed'),
    threshold: 50,
    longPressDelay: 500
  });

  return <div ref={gestureRef}>Swipe me!</div>;
}
```

### usePullToRefresh
Pull-to-refresh gesture for lists.

**Usage:**
```tsx
import { usePullToRefresh } from '@/components/mobile';

function RefreshableList() {
  const ref = usePullToRefresh(async () => {
    await refetchData();
  });

  return (
    <div ref={ref} className="overflow-y-auto">
      {items.map(item => <Item key={item.id} {...item} />)}
    </div>
  );
}
```

### usePinchZoom
Pinch-to-zoom gesture for images.

**Usage:**
```tsx
import { usePinchZoom } from '@/components/mobile';

function ZoomableImage() {
  const ref = usePinchZoom(
    () => setZoom(z => z * 1.1),
    () => setZoom(z => z * 0.9)
  );

  return <div ref={ref}><img src={src} /></div>;
}
```

### hapticFeedback
Trigger device vibration.

**Usage:**
```tsx
import { hapticFeedback } from '@/components/mobile';

// Single vibration
hapticFeedback(10); // 10ms

// Pattern
hapticFeedback([50, 100, 50]); // vibrate, pause, vibrate
```

## Styles

### Mobile CSS (`src/styles/mobile.css`)
Comprehensive mobile-first styles:

- **Typography:** Mobile-optimized font sizes (16px base to prevent iOS zoom)
- **Touch Targets:** Minimum 44x44px (iOS) / 48x48px (Android)
- **Safe Areas:** iOS notch and home indicator support
- **Spacing:** Mobile-optimized gutters (16px) and sections (24px)
- **Animations:** Smooth 60fps with prefers-reduced-motion support
- **Scrolling:** Momentum scrolling with hidden scrollbars
- **Pull-to-Refresh:** Visual indicator
- **Skeleton Loading:** Animated placeholders

### Tailwind Utilities
Extended Tailwind config with mobile utilities:

**Safe Area Spacing:**
```tsx
<div className="pt-safe-top pb-safe-bottom">Content</div>
```

**Touch Targets:**
```tsx
<button className="min-h-touch min-w-touch">Button</button>
```

**Mobile Font:**
```tsx
<p className="text-base-mobile">16px with 1.5 line-height</p>
```

**Skeleton Loading:**
```tsx
<div className="h-4 bg-muted animate-skeleton rounded" />
```

## Accessibility

All components follow WCAG 2.1 AA standards:

- **Touch Targets:** 44x44px minimum (iOS), 48x48px recommended
- **Focus Visible:** Clear focus indicators
- **ARIA Labels:** All interactive elements properly labeled
- **Keyboard Navigation:** Full keyboard support
- **Screen Readers:** Semantic HTML and ARIA attributes
- **Reduced Motion:** Respects prefers-reduced-motion
- **High Contrast:** Works in high contrast mode

## Performance

- **60fps Animations:** Hardware-accelerated transforms
- **Debounced Resize:** 150ms debounce on window resize
- **Passive Listeners:** All touch events use passive: true
- **Layout Shift Prevention:** content-visibility for images
- **Lazy Loading:** Components load on demand
- **Tree Shaking:** Import only what you need

## Browser Support

- **iOS:** Safari 14+, Chrome, Firefox
- **Android:** Chrome, Samsung Internet, Firefox
- **PWA Mode:** Standalone display mode detection
- **Safe Areas:** CSS env() variable support
- **Vibration:** Navigator.vibrate API (graceful degradation)

## Testing

Test on these devices for best coverage:
- iPhone SE (375x667) - smallest modern iPhone
- iPhone 14 (390x844) - standard size
- Pixel 5 (393x851) - standard Android
- iPad Mini (768x1024) - tablet breakpoint

Run mobile tests:
```bash
npm run test:mobile
```

## Migration Guide

### From Desktop Table to Mobile Cards

**Before:**
```tsx
<DataTable data={requests} columns={columns} />
```

**After:**
```tsx
const { isMobile } = useResponsive();

{isMobile ? (
  <div className="space-y-3">
    {requests.map(req => (
      <RequestCard key={req.id} request={req} {...actions} />
    ))}
  </div>
) : (
  <DataTable data={requests} columns={columns} />
)}
```

### Adding Bottom Navigation

```tsx
// In App.tsx or MainLayout.tsx
import { BottomNav } from '@/components/mobile';

function App() {
  return (
    <>
      <YourRoutes />
      <BottomNav />
    </>
  );
}
```

### Adding FAB to a Page

```tsx
import { FAB } from '@/components/mobile';
import { Plus } from 'lucide-react';

function RequestsPage() {
  const navigate = useNavigate();

  return (
    <>
      <RequestsList />
      <FAB
        onClick={() => navigate('/requests/new')}
        icon={<Plus size={24} />}
        label="New Request"
        ariaLabel="Create new invoice request"
      />
    </>
  );
}
```

## Best Practices

1. **Test on Real Devices:** Simulators don't capture touch behavior accurately
2. **Use Haptic Feedback Sparingly:** Only for important interactions
3. **Respect Safe Areas:** Always use safe-area insets for fixed positioning
4. **Optimize for Thumbs:** Place primary actions in thumb-friendly zones
5. **Progressive Enhancement:** Desktop-first code, mobile-enhanced
6. **Performance Budget:** Keep CLS < 0.1, FID < 100ms, LCP < 2.5s
7. **Test PWA Mode:** Install app to test standalone display mode
8. **Accessibility First:** Use semantic HTML and ARIA labels
