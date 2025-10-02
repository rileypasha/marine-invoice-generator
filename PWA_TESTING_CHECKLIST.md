# 🎉 PWA Testing Checklist

Your Marine Group PWA is now built and running! Follow this checklist to verify everything works.

## 📍 Current Status

✅ **Icons Generated**: 11 PWA icons in `/public/icons/`
✅ **Production Build**: Complete (no errors)
✅ **Preview Server**: Running on http://localhost:4173
✅ **Service Worker**: Built (57KB, 16KB gzipped)
✅ **Manifest**: Generated and linked

---

## 🧪 Testing Steps

### 1. Open the PWA in Chrome

1. Open Chrome browser
2. Navigate to: **http://localhost:4173**
3. App should load with the Marine Group logo

### 2. Verify PWA Manifest (Chrome DevTools)

1. Press `F12` to open DevTools
2. Go to **Application** tab
3. Click **Manifest** in left sidebar
4. Verify:
   - ✅ Name: "Marine Group Global Services"
   - ✅ Short name: "Marine Group"
   - ✅ Start URL: "/"
   - ✅ Display: "standalone"
   - ✅ Theme color: "#0284c7"
   - ✅ Icons: 192x192 and 512x512 (both standard and maskable)
   - ✅ No errors shown

### 3. Verify Service Worker

1. In **Application** tab, click **Service Workers**
2. Verify:
   - ✅ Status: "activated and is running"
   - ✅ Source: sw.js
   - ✅ No errors in console

### 4. Check Cached Assets

1. In **Application** tab, click **Cache Storage**
2. You should see cache named like: `workbox-precache-v2-...`
3. Expand it - should contain ~50+ cached files:
   - ✅ index.html
   - ✅ JavaScript bundles
   - ✅ CSS files
   - ✅ Icons

### 5. Test Offline Mode

1. In **Application → Service Workers**, check **Offline** checkbox
2. Refresh the page (Ctrl+R or Cmd+R)
3. Verify:
   - ✅ Page loads from cache (not error page)
   - ✅ Navigation works
   - ✅ Can view requests/contacts/vessels

### 6. Test Install Prompt

**Desktop (Chrome/Edge):**
1. Look for install icon in address bar (⊕ or computer icon)
2. Click it
3. Click "Install"
4. Verify:
   - ✅ PWA opens in standalone window (no browser UI)
   - ✅ Custom icon in taskbar/dock

**Mobile (Android Chrome):**
1. Open http://localhost:4173 (or use ngrok for remote access)
2. Chrome should show "Add to Home Screen" banner
3. Tap "Install"
4. Verify:
   - ✅ Icon appears on home screen
   - ✅ Opens full-screen (no browser UI)
   - ✅ Bottom nav visible in PWA mode

**iOS Safari:**
1. Open in Safari
2. Tap Share button (square with arrow)
3. Scroll and tap "Add to Home Screen"
4. Verify:
   - ✅ Icon appears on home screen
   - ✅ Opens full-screen
   - ✅ Correct app title

### 7. Test Mobile UI (Responsive Design)

1. In DevTools, toggle **Device Toolbar** (Ctrl+Shift+M)
2. Select "iPhone 14 Pro" or "Pixel 5"
3. Verify:
   - ✅ Bottom navigation appears (5 tabs)
   - ✅ Request cards (not table) on mobile
   - ✅ Touch targets ≥ 44px
   - ✅ FAB (Floating Action Button) visible
   - ✅ Safe area insets respected

### 8. Performance Check (Lighthouse)

1. In DevTools, go to **Lighthouse** tab
2. Select:
   - ✅ Mobile
   - ✅ Performance
   - ✅ Progressive Web App
   - ✅ Accessibility
3. Click "Analyze page load"
4. Expected scores:
   - 🎯 Performance: ≥90
   - 🎯 PWA: 100
   - 🎯 Accessibility: ≥95
   - 🎯 Best Practices: ≥90

---

## 🐛 Troubleshooting

### Issue: Install button not showing

**Solution**:
- PWA must be served over HTTPS (localhost is okay)
- Check DevTools Console for errors
- Manifest must be valid (check Application → Manifest)
- Service worker must be registered

### Issue: Service worker not activating

**Solution**:
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- In DevTools → Application → Service Workers, click "Update"
- Check Console for service worker errors

### Issue: Icons not loading

**Solution**:
- Verify icons exist: `/public/icons/icon-192x192.png`
- Check manifest.webmanifest `icons` array
- Clear cache and hard refresh

### Issue: Offline mode shows error page

**Solution**:
- Service worker might not be activated yet
- Navigate to a few pages to trigger precaching
- Check Cache Storage has entries
- Wait 5-10 seconds after first load

### Issue: Mobile UI not showing (bottom nav missing)

**Solution**:
- Must be in PWA mode (standalone)
- Or viewport must be <768px
- Check DevTools Console for errors
- Verify import in App.tsx: `import { BottomNav } from '@/components/mobile'`

---

## 📊 Bundle Analysis

Want to see what's in your bundle?

1. Open: `dist/stats.html` in browser
2. Interactive treemap shows:
   - Bundle sizes by chunk
   - What libraries are largest
   - Gzip/Brotli compression savings

**Current Sizes:**
- React core: 148KB gzipped (stable, good caching)
- Vendor libs: 281KB gzipped
- Service worker: 16KB gzipped
- Total initial: ~450-500KB gzipped ✅ (under 500KB budget!)

---

## 🚀 Next Steps

### Ready for Production?

1. **Deploy to HTTPS** (required for service workers in prod)
   - Vercel, Netlify, Cloudflare Pages, or Render
   - Service workers won't work over HTTP in production

2. **Test on Real Devices**
   - iOS Safari (iPhone)
   - Android Chrome
   - Test offline mode in airplane mode

3. **Monitor Performance**
   - Set up analytics endpoint: `/api/analytics/performance`
   - Track Web Vitals in production
   - Monitor service worker updates

4. **Optional Enhancements**
   - Web Push notifications (iOS 16.4+)
   - Background sync for offline edits
   - Periodic background sync
   - Share Target API
   - Shortcuts API (already in manifest)

---

## 📝 Quick Commands

```bash
# Rebuild PWA
npm run build

# Restart preview
npm run preview

# Test production build
npm run build && npm run preview

# Generate new icons (if you update logo)
node scripts/generate-pwa-icons.js
```

---

## ✅ Success Criteria

Your PWA is ready when:

- ✅ Lighthouse PWA score: 100
- ✅ Installable on desktop and mobile
- ✅ Works offline after first load
- ✅ Service worker registered and active
- ✅ No console errors
- ✅ Mobile UI shows bottom nav + cards
- ✅ Performance score ≥90

**Current Status**: Ready for testing! 🎉

Open http://localhost:4173 and start checking boxes above!
