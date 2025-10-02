const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../public/icons/logo.svg');
const outputDir = path.join(__dirname, '../public/icons');

// Icon sizes needed for PWA
const sizes = [
  { size: 72, name: 'icon-72x72.png' },
  { size: 96, name: 'icon-96x96.png' },
  { size: 128, name: 'icon-128x128.png' },
  { size: 144, name: 'icon-144x144.png' },
  { size: 152, name: 'icon-152x152.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 384, name: 'icon-384x384.png' },
  { size: 512, name: 'icon-512x512.png' },
  { size: 180, name: 'apple-touch-icon.png' }
];

// Maskable sizes (with padding for safe zone)
const maskableSizes = [
  { size: 192, name: 'icon-192x192-maskable.png' },
  { size: 512, name: 'icon-512x512-maskable.png' }
];

async function generateIcons() {
  console.log('Reading SVG from:', svgPath);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate regular icons
  for (const { size, name } of sizes) {
    const outputPath = path.join(outputDir, name);
    console.log(`Generating ${name}...`);

    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(outputPath);
  }

  // Generate maskable icons (with padding for safe zone)
  for (const { size, name } of maskableSizes) {
    const outputPath = path.join(outputDir, name);
    console.log(`Generating ${name} (maskable)...`);

    // Maskable icons need 20% padding (safe zone)
    const iconSize = Math.round(size * 0.8);
    const padding = Math.round((size - iconSize) / 2);

    await sharp(svgPath)
      .resize(iconSize, iconSize)
      .extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: { r: 12, g: 74, b: 110, alpha: 1 } // #0C4A6E
      })
      .png()
      .toFile(outputPath);
  }

  console.log('✅ All PWA icons generated successfully!');
}

generateIcons().catch(error => {
  console.error('Error generating icons:', error);
  process.exit(1);
});
