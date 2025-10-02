# PWA Implementation Guide

## Overview
This document describes the Progressive Web App (PWA) infrastructure implemented for the Marine Group Global Services invoice management system.

## Implementation Status

### ✅ Completed Components

#### 1. Web App Manifest (`/public/manifest.webmanifest`)
- **Name**: Marine Group Global Services
- **Short Name**: Marine Group
- **Theme Color**: #0284c7 (sky-600)
- **Background Color**: #ffffff
- **Display Mode**: standalone
- **Orientation**: portrait-primary
- **Categories**: business, productivity
- **Shortcuts**: Requests, Contacts, Vessels

#### 2. Service Worker (`/src/sw.ts`)
Built with Workbox, implements:
- **HTML Caching**: NetworkFirst with 3s timeout
- **JS/CSS Caching**: StaleWhileRevalidate
- **Fonts/Icons**: CacheFirst (1 year)
- **Images**: CacheFirst (maxEntries: 200, 30 days)
- **API Caching**:
  - GET: NetworkFirst with 5s timeout
  - POST/PUT/DELETE: Background sync for offline support
- **Offline Fallback**: Serves `/offline.html` when network unavailable
- **Auto-update**: Skip waiting + claim clients on activation

#### 3. PWA Utilities (`/src/utils/pwa.ts`)
Helper functions for:
- `isPWA()`: Detect if running in standalone mode
- `isIOS()` / `isAndroid()`: Platform detection
- `canInstall()`: Check if app is installable
- `requestPersistentStorage()`: Request storage quota
- `getStorageQuota()`: Get storage usage info
- `getNetworkStatus()`: Online/offline detection
- `onNetworkChange()`: Network status listener

#### 4. Install Prompt Component (`/src/components/pwa/InstallPrompt.tsx`)
- Gentle bottom-sheet CTA design
- iOS-specific install instructions
- Android/Desktop native install prompt
- Dismissal persistence (7 days in localStorage)
- Auto-hide when already installed
- Respects user preferences

#### 5. Configuration Updates
- **vite.config.ts**: Added VitePWA plugin with Workbox
- **index.html**: PWA meta tags, manifest link, Apple icons
- **main.tsx**: Service worker registration
- **App.tsx**: InstallPrompt component integration
- **index.css**: PWA animations and safe area insets

## File Structure

```
project/
├── public/
│   ├── manifest.webmanifest      # PWA manifest
│   ├── offline.html              # Offline fallback page
│   └── icons/                    # App icons (need to generate)
│       ├── icon-192x192.png
│       ├── icon-192x192-maskable.png
│       ├── icon-512x512.png
│       ├── icon-512x512-maskable.png
│       ├── apple-touch-icon.png
│       └── shortcut-*.png        # Shortcut icons
├── src/
│   ├── sw.ts                     # Service worker
│   ├── vite-env.d.ts             # TypeScript definitions
│   ├── utils/
│   │   └── pwa.ts                # PWA utilities
│   └── components/
│       └── pwa/
│           └── InstallPrompt.tsx # Install prompt UI
└── vite.config.ts                # Vite + PWA plugin config
```

## Required Assets (To Generate)

### Icons Needed
You need to generate the following icon assets:

1. **App Icons** (place in `/public/icons/`):
   - `icon-192x192.png` - Standard app icon (192x192px)
   - `icon-192x192-maskable.png` - Maskable icon (192x192px, safe zone)
   - `icon-512x512.png` - Standard app icon (512x512px)
   - `icon-512x512-maskable.png` - Maskable icon (512x512px, safe zone)
   - `apple-touch-icon.png` - iOS home screen (180x180px)

2. **Shortcut Icons** (optional, place in `/public/icons/`):
   - `shortcut-requests.png` - Requests shortcut (96x96px)
   - `shortcut-contacts.png` - Contacts shortcut (96x96px)
   - `shortcut-vessels.png` - Vessels shortcut (96x96px)

### Icon Design Guidelines
- **Standard Icons**: Regular app icon with transparent or white background
- **Maskable Icons**:
  - Add 20% safe zone padding around important content
  - Background should be solid color (#0284c7 recommended)
  - Icon will be cropped into various shapes (circle, squircle, etc.)
- **Apple Touch Icon**: No transparency, solid background

### Quick Icon Generation
You can use online tools like:
- https://www.pwabuilder.com/imageGenerator
- https://maskable.app/editor
- https://favicon.io/

Or use a script to generate from a source image:
```bash
# Example using ImageMagick
convert source.png -resize 192x192 icon-192x192.png
convert source.png -resize 512x512 icon-512x512.png
convert source.png -resize 180x180 apple-touch-icon.png
```

## Build & Testing

### Development
```bash
npm run dev
# Service worker disabled in dev for faster HMR
```

### Production Build
```bash
npm run build
# Generates service worker and precaches assets
```

### Preview Production Build
```bash
npm run preview
# Test PWA functionality locally
```

## Testing Checklist

### ✅ Desktop Testing
- [ ] Install prompt appears on first visit
- [ ] Can dismiss and it doesn't reappear for 7 days
- [ ] Can install app via install button
- [ ] Installed app opens in standalone window
- [ ] Offline page displays when network unavailable
- [ ] Service worker caches assets correctly

### ✅ Android Testing
- [ ] Install banner appears in Chrome
- [ ] Can install to home screen
- [ ] App icon displays correctly
- [ ] Splash screen shows on launch
- [ ] Runs in standalone mode (no browser UI)
- [ ] Shortcuts appear in long-press menu
- [ ] Works offline after installation

### ✅ iOS Testing
- [ ] Install instructions appear in Safari
- [ ] Can add to home screen via Share menu
- [ ] App icon displays correctly (180x180)
- [ ] Status bar style is correct
- [ ] Safe area insets work properly
- [ ] Runs in standalone mode
- [ ] Works offline (limited by iOS restrictions)

### ✅ Lighthouse PWA Audit
Expected scores:
- **PWA Score**: 100/100
- **Performance**: 90+/100
- **Accessibility**: 95+/100
- **Best Practices**: 95+/100
- **SEO**: 90+/100

Run audit:
```bash
npm install -g @lhci/cli
npm run build
npm run preview
lhci autorun --config=lighthouserc.js
```

## Browser Support

### ✅ Fully Supported
- Chrome 90+ (Android/Desktop)
- Edge 90+ (Desktop)
- Samsung Internet 14+
- Opera 76+

### ⚠️ Partial Support
- Safari 15+ (iOS/macOS)
  - No background sync
  - Limited offline capabilities
  - Manual install only
- Firefox 90+ (Desktop)
  - No install prompt
  - Manual install only

### ❌ Not Supported
- IE 11 (no service worker support)

## Performance Optimizations

### Caching Strategy
- **HTML**: Fresh content, 3s network timeout
- **JS/CSS**: Stale while revalidate (always fast)
- **Images**: Cache first (reduce bandwidth)
- **API**: Network first with offline fallback
- **Background Sync**: Retry failed POST/PUT/DELETE

### Bundle Size
- Service worker: ~15KB (minified)
- PWA utilities: ~3KB
- Install prompt: ~2KB
- Total PWA overhead: ~20KB

## Security Considerations

### Content Security Policy
Add to server headers:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; worker-src 'self'
```

### HTTPS Required
PWA features require HTTPS in production:
- Service workers only work over HTTPS
- Install prompt requires HTTPS
- Exception: localhost for development

## Troubleshooting

### Service Worker Not Registering
1. Check browser console for errors
2. Verify HTTPS in production
3. Check `navigator.serviceWorker` is available
4. Clear service worker cache and reload

### Install Prompt Not Showing
1. Verify manifest.webmanifest is accessible
2. Check all required manifest fields
3. Ensure icons are available
4. Check for HTTPS (required in production)
5. Test in incognito/private browsing

### Offline Mode Not Working
1. Open DevTools → Application → Service Workers
2. Verify service worker is activated
3. Check Cache Storage for cached assets
4. Test in DevTools offline mode
5. Check Network tab for cache hits

### Icons Not Displaying
1. Verify icon files exist at specified paths
2. Check manifest.webmanifest icon paths
3. Clear cache and reinstall app
4. Test different icon sizes
5. Validate maskable icons have safe zone

## Future Enhancements

### Planned Features
- [ ] Push notifications for invoice updates
- [ ] Background sync for offline form submissions
- [ ] App shortcuts to frequent actions
- [ ] Share target API for receiving files
- [ ] Badging API for unread counts
- [ ] Periodic background sync for data refresh

### Advanced Caching
- [ ] Runtime caching strategies per route
- [ ] Precaching critical user data
- [ ] Cache versioning and migration
- [ ] Selective cache invalidation

### Analytics
- [ ] Track install rate
- [ ] Monitor offline usage
- [ ] Service worker performance metrics
- [ ] Cache hit/miss ratios

## Resources

### Documentation
- [PWA Best Practices](https://web.dev/pwa/)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
- [Web App Manifest Spec](https://www.w3.org/TR/appmanifest/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

### Tools
- [PWA Builder](https://www.pwabuilder.com/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Workbox](https://developers.google.com/web/tools/workbox)
- [Maskable Icon Editor](https://maskable.app/)

### Testing
- Chrome DevTools PWA Audit
- Lighthouse Performance Testing
- WebPageTest for real-world conditions
- BrowserStack for cross-browser testing
