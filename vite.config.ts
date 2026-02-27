import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import viteCompression from 'vite-plugin-compression'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Optimize React refresh for faster HMR
      fastRefresh: true,
    }),
    // PWA configuration with Workbox
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icons/*.png', 'offline.html'],
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      manifest: false, // Use public/manifest.webmanifest instead
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
      },
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        sourcemap: false,
      },
      devOptions: {
        enabled: false, // Disable in dev for faster HMR
        type: 'module',
      },
    }),
    // Generate bundle analysis report
    visualizer({
      filename: './dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
      template: 'treemap', // Better visualization
    }),
    // Gzip compression
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240, // Only compress files > 10KB
      deleteOriginFile: false,
    }),
    // Brotli compression (better than gzip)
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 10240,
      deleteOriginFile: false,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false, // Disable sourcemaps for smaller bundles
    minify: 'terser',
    cssCodeSplit: true, // Split CSS per route for faster FCP
    chunkSizeWarningLimit: 500, // Warn at 500KB (strict budget)
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'], // Remove specific console calls
        passes: 2, // More aggressive minification
      },
      mangle: {
        safari10: true, // Better Safari compatibility
      },
    },
    rollupOptions: {
      output: {
        // Simplified manual chunking - less aggressive to avoid bundling issues
        manualChunks: {
          // Core vendor libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // UI libraries
          'ui-libs': ['lucide-react', 'framer-motion'],
          // Data management
          'data-libs': ['@tanstack/react-query', '@tanstack/react-table', '@tanstack/react-virtual'],
        },
        // Simple, stable chunk naming
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash][extname]',
      },
      // Tree-shaking optimization
      treeshake: {
        moduleSideEffects: 'no-external', // Aggressive tree-shaking
        propertyReadSideEffects: false,
        unknownGlobalSideEffects: false,
      },
    },
    // Performance budgets
    reportCompressedSize: true,
    // Enable CSS minification
    cssMinify: true,
  },
  server: {
    port: 3000,
    open: true,
    host: '0.0.0.0', // Listen on all interfaces
    allowedHosts: [
      'localhost',
      '.ngrok-free.dev',
      '.ngrok.io',
    ],
    hmr: {
      // clientPort: 443, // Use HTTPS port for HMR through ngrok - disabled for local dev
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false,
        ws: true,
        timeout: 120000,
        proxyTimeout: 120000,
        configure: (proxy, _options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Proxy error:', err.message);
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Backend connection failed', message: err.message }));
            }
          });
        },
      }
    }
  },
})