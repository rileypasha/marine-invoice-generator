# PWA Icons

This directory contains icons for the Progressive Web App installation.

## Required Icons

### App Icons
- `icon-192x192.png` - Standard app icon (192x192px)
- `icon-192x192-maskable.png` - Maskable icon with safe zone (192x192px)
- `icon-512x512.png` - Standard app icon (512x512px)
- `icon-512x512-maskable.png` - Maskable icon with safe zone (512x512px)
- `apple-touch-icon.png` - iOS home screen icon (180x180px)

### Shortcut Icons (Optional)
- `shortcut-requests.png` - Requests shortcut (96x96px)
- `shortcut-contacts.png` - Contacts shortcut (96x96px)
- `shortcut-vessels.png` - Vessels shortcut (96x96px)

## Design Guidelines

### Standard Icons
- Use the Marine Group logo or brand icon
- Transparent or white background
- Ensure icon is centered and visible

### Maskable Icons
- Add 20% safe zone padding around important content
- Use solid background color (#0284c7 recommended - sky-600)
- Icon will be cropped into various shapes (circle, squircle, rounded square)
- Test at https://maskable.app/

### Apple Touch Icon
- No transparency (use solid background)
- 180x180px
- iOS will automatically round corners

## Quick Generation

### Option 1: Online Tools
- **PWA Builder**: https://www.pwabuilder.com/imageGenerator
- **Maskable Icon Editor**: https://maskable.app/editor
- **Favicon Generator**: https://favicon.io/

### Option 2: Using ImageMagick (Command Line)
```bash
# Install ImageMagick first
# Then from your source icon (e.g., logo.png):

convert logo.png -resize 192x192 -background none -gravity center -extent 192x192 icon-192x192.png
convert logo.png -resize 512x512 -background none -gravity center -extent 512x512 icon-512x512.png
convert logo.png -resize 180x180 -background white -gravity center -extent 180x180 apple-touch-icon.png

# For maskable icons (with padding and background):
convert logo.png -resize 154x154 -background "#0284c7" -gravity center -extent 192x192 icon-192x192-maskable.png
convert logo.png -resize 410x410 -background "#0284c7" -gravity center -extent 512x512 icon-512x512-maskable.png

# Shortcut icons:
convert logo.png -resize 96x96 -background none -gravity center -extent 96x96 shortcut-requests.png
convert logo.png -resize 96x96 -background none -gravity center -extent 96x96 shortcut-contacts.png
convert logo.png -resize 96x96 -background none -gravity center -extent 96x96 shortcut-vessels.png
```

### Option 3: Using Sharp (Node.js)
Create a `generate-icons.js` script:

```javascript
const sharp = require('sharp');
const fs = require('fs');

const source = './source-icon.png'; // Your source image

// Standard icons
sharp(source)
  .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toFile('./public/icons/icon-192x192.png');

sharp(source)
  .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toFile('./public/icons/icon-512x512.png');

// Maskable icons (with padding and background)
sharp(source)
  .resize(154, 154, { fit: 'contain', background: { r: 2, g: 132, b: 199 } })
  .extend({ top: 19, bottom: 19, left: 19, right: 19, background: { r: 2, g: 132, b: 199 } })
  .toFile('./public/icons/icon-192x192-maskable.png');

sharp(source)
  .resize(410, 410, { fit: 'contain', background: { r: 2, g: 132, b: 199 } })
  .extend({ top: 51, bottom: 51, left: 51, right: 51, background: { r: 2, g: 132, b: 199 } })
  .toFile('./public/icons/icon-512x512-maskable.png');

// Apple touch icon (no transparency)
sharp(source)
  .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
  .toFile('./public/icons/apple-touch-icon.png');
```

Then run: `npm install sharp && node generate-icons.js`

## Testing Icons

1. **Visual Test**: Open each icon to verify it looks correct
2. **Maskable Test**: Use https://maskable.app/ to preview how it looks in different shapes
3. **PWA Test**: Install the app and check if icons display correctly
4. **iOS Test**: Add to home screen on iOS and verify the icon

## Fallback Icons

If you don't have custom icons yet, you can:
1. Use the current `favicon.png` temporarily
2. Copy it to all required icon files
3. Generate proper icons later

```bash
cp ../../favicon.png icon-192x192.png
cp ../../favicon.png icon-512x512.png
cp ../../favicon.png apple-touch-icon.png
# etc.
```

## Icon Checklist

- [ ] All icons are PNG format
- [ ] Icons have correct dimensions
- [ ] Maskable icons have 20% safe zone
- [ ] Apple touch icon has no transparency
- [ ] Icons look good on light and dark backgrounds
- [ ] Icons are optimized (compressed)
- [ ] Icons are accessible in `/public/icons/` directory
