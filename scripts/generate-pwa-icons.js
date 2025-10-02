#!/usr/bin/env node

/**
 * PWA Icon Generator
 * Generates all required PWA icons from source logo
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SOURCE_IMAGE = path.join(__dirname, '../public/notextlogo.png');
const OUTPUT_DIR = path.join(__dirname, '../public/icons');

// Icon specifications
const ICONS = [
  // Standard icons
  { size: 192, name: 'icon-192x192.png', maskable: false },
  { size: 512, name: 'icon-512x512.png', maskable: false },

  // Maskable icons (with safe zone padding)
  { size: 192, name: 'icon-192x192-maskable.png', maskable: true },
  { size: 512, name: 'icon-512x512-maskable.png', maskable: true },

  // Apple touch icon
  { size: 180, name: 'apple-touch-icon.png', maskable: false },

  // Additional sizes for better coverage
  { size: 72, name: 'icon-72x72.png', maskable: false },
  { size: 96, name: 'icon-96x96.png', maskable: false },
  { size: 128, name: 'icon-128x128.png', maskable: false },
  { size: 144, name: 'icon-144x144.png', maskable: false },
  { size: 152, name: 'icon-152x152.png', maskable: false },
  { size: 384, name: 'icon-384x384.png', maskable: false },
];

async function generateIcons() {
  try {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      console.log('✅ Created icons directory');
    }

    // Check if source image exists
    if (!fs.existsSync(SOURCE_IMAGE)) {
      console.error('❌ Source image not found:', SOURCE_IMAGE);
      process.exit(1);
    }

    console.log('📸 Generating PWA icons from:', SOURCE_IMAGE);
    console.log('');

    // Generate each icon
    for (const icon of ICONS) {
      const outputPath = path.join(OUTPUT_DIR, icon.name);

      let pipeline = sharp(SOURCE_IMAGE);

      if (icon.maskable) {
        // Maskable icons need padding (80% safe zone)
        // So the actual icon should be 80% of the canvas
        const iconSize = Math.round(icon.size * 0.8);
        const padding = Math.round((icon.size - iconSize) / 2);

        pipeline = pipeline
          .resize(iconSize, iconSize, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 }
          })
          .extend({
            top: padding,
            bottom: padding,
            left: padding,
            right: padding,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
          });
      } else {
        // Standard icons
        pipeline = pipeline
          .resize(icon.size, icon.size, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 }
          });
      }

      await pipeline
        .png({ quality: 100 })
        .toFile(outputPath);

      const stats = fs.statSync(outputPath);
      const sizeKB = (stats.size / 1024).toFixed(1);

      console.log(`✅ ${icon.name.padEnd(30)} ${icon.size}×${icon.size}px  ${sizeKB}KB ${icon.maskable ? '(maskable)' : ''}`);
    }

    console.log('');
    console.log('🎉 All PWA icons generated successfully!');
    console.log('📁 Icons saved to:', OUTPUT_DIR);
    console.log('');
    console.log('Next steps:');
    console.log('1. Check the icons in public/icons/');
    console.log('2. Run: npm run build');
    console.log('3. Test: npm run preview');

  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    process.exit(1);
  }
}

// Run the generator
generateIcons();
