# PWA Components

React components for Progressive Web App functionality.

## Components

### InstallPrompt
Smart install prompt that adapts to platform and respects user preferences.

**Features:**
- Platform detection (iOS vs Android/Desktop)
- iOS-specific install instructions
- Native install prompt for supported browsers
- 7-day dismissal persistence
- Auto-hide when already installed
- Animated bottom-sheet design

**Usage:**
```tsx
import { InstallPrompt } from '@/components/pwa/InstallPrompt'

function App() {
  return (
    <>
      <InstallPrompt />
      {/* Your app content */}
    </>
  )
}
```

**Props:**
None - component handles all state internally

**Behavior:**
1. Listens for `beforeinstallprompt` event
2. Shows iOS instructions if on Safari
3. Shows install button for Android/Desktop
4. Dismissal stored in localStorage for 7 days
5. Auto-hides in standalone mode

**Styling:**
- Uses Tailwind CSS classes
- Sky-600 theme color
- Bottom-sheet animation
- Lucide React icons

**Testing:**
```tsx
// Test on different platforms
// Desktop: Chrome/Edge (native prompt)
// iOS: Safari (manual instructions)
// Android: Chrome (native prompt)

// Force show prompt (for testing)
localStorage.removeItem('pwa-install-dismissed')
window.location.reload()
```

## File Structure

```
src/components/pwa/
├── InstallPrompt.tsx    # Main install prompt component
└── README.md            # This file
```

## Platform Support

### ✅ Full Support
- Chrome 90+ (Android/Desktop)
- Edge 90+ (Desktop)
- Samsung Internet 14+

### ⚠️ Partial Support
- Safari (iOS/macOS) - Manual install only
- Firefox - Manual install only

## Customization

### Modify Dismissal Duration
```tsx
// In InstallPrompt.tsx
const DISMISS_DURATION = 14 * 24 * 60 * 60 * 1000; // 14 days
```

### Change Theme Color
```tsx
// Update gradient background
className="bg-gradient-to-t from-sky-600 to-sky-500"
// Change to your brand color
className="bg-gradient-to-t from-blue-600 to-blue-500"
```

### Customize Messages
```tsx
<h3>Install Our App</h3>  // Change title
<p>Your custom message</p> // Change description
```

## Integration

The InstallPrompt component is already integrated in `App.tsx`:

```tsx
import { InstallPrompt } from './components/pwa/InstallPrompt'

function App() {
  return (
    <Router>
      <InstallPrompt />
      {/* Routes */}
    </Router>
  )
}
```

## Future Components

Planned PWA components:

- **UpdatePrompt** - Notify users of new versions
- **OfflineBanner** - Show network status
- **SyncStatus** - Display background sync status
- **PushNotifications** - Handle push notification permissions
- **ShareButton** - Web Share API integration
