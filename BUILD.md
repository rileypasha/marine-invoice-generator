# Marine Invoice Generator - Build & Distribution Guide

This document explains how to build and distribute the Marine Invoice Generator as standalone desktop applications for Windows (.exe), macOS (.dmg), and Linux (.AppImage).

## Prerequisites

- Node.js (v16 or higher)
- npm (comes with Node.js)
- Git (optional, for version control)

## Installation

1. Clone or download the project
2. Install dependencies:
   ```bash
   npm install
   ```

## Available Build Scripts

### Development
```bash
npm start          # Run the Electron app in development mode
npm run dev        # Start webpack dev server (for web development)
```

### Building Distribution Files

#### Build for Specific Platform
```bash
npm run dist:mac   # Build .dmg file for macOS
npm run dist:win   # Build .exe installer for Windows  
npm run dist       # Build for current platform
```

#### Build for All Platforms
```bash
npm run dist:all   # Build for Windows, macOS, and Linux
npm run release    # Clean, build, and create all distribution files
```

#### Utility Scripts
```bash
npm run dist:clean # Remove all build artifacts
npm run build      # Build the web assets with webpack
```

## Output Files

After running the build commands, you'll find the distribution files in the `dist/` directory:

- **Windows**: `Marine Invoice Generator Setup 1.0.0.exe` (~85MB)
- **macOS**: `Marine Invoice Generator-1.0.0.dmg` (~104MB)
- **Linux**: `Marine Invoice Generator-1.0.0.AppImage` (~110MB)

## Distribution

### For End Users

**Windows:**
- Download the `.exe` file
- Run the installer and follow the setup wizard
- The app will be installed and a desktop shortcut will be created

**macOS:**
- Download the `.dmg` file
- Open the DMG and drag the app to Applications folder
- Run the app from Applications (may need to allow in Security settings)

**Linux:**
- Download the `.AppImage` file
- Make it executable: `chmod +x Marine\ Invoice\ Generator-1.0.0.AppImage`
- Run directly: `./Marine\ Invoice\ Generator-1.0.0.AppImage`

### Code Signing & Notarization

Currently, the builds are unsigned. For production distribution:

**Windows:**
- Obtain a code signing certificate
- Set environment variable: `CSC_LINK=path/to/certificate.p12`
- Set password: `CSC_KEY_PASSWORD=your_password`

**macOS:**
- Obtain Apple Developer certificate
- Remove `CSC_IDENTITY_AUTO_DISCOVERY=false` from build scripts
- Configure notarization credentials

## Build Configuration

The build configuration is defined in `package.json` under the `"build"` field:

- **AppId**: `com.marinegroup.invoice`
- **Product Name**: Marine Invoice Generator
- **Output Directory**: `dist/`
- **Target Architectures**: x64 only
- **Windows**: NSIS installer with desktop shortcuts
- **macOS**: DMG with drag-to-Applications layout
- **Linux**: AppImage portable executable

## Troubleshooting

### Common Issues

1. **Build fails on macOS due to signing**
   - Ensure `CSC_IDENTITY_AUTO_DISCOVERY=false` is set
   - Or configure proper code signing certificates

2. **Icon issues**
   - Icons are currently using Electron defaults
   - Add proper icon files to `assets/` folder if needed

3. **Large bundle size**
   - The webpack bundle is currently ~698KB
   - Consider code splitting for better performance

4. **Missing dependencies**
   - Run `npm install` to ensure all dependencies are installed
   - Use `npm ci` for clean installs in CI/CD environments

## File Structure

```
dist/
├── Marine Invoice Generator Setup 1.0.0.exe    # Windows installer
├── Marine Invoice Generator-1.0.0.dmg          # macOS disk image  
├── Marine Invoice Generator-1.0.0.AppImage     # Linux portable app
├── win-unpacked/                                # Windows app files
├── mac/                                         # macOS app bundle
└── linux-unpacked/                              # Linux app files
```

## Updates & Versioning

To create a new release:

1. Update version in `package.json`
2. Run `npm run release`
3. Distribute the new files from the `dist/` directory

The version number will automatically be included in the filenames.