/**
 * Application Configuration Constants
 * Centralized configuration to eliminate magic numbers and improve maintainability
 */

// Timing Configuration
export const TIMEOUTS = {
  // Session and Auth
  SESSION_CHECK_INTERVAL: 10_000,        // 10 seconds
  SESSION_TTL: 30 * 60 * 1000,          // 30 minutes
  GRACEFUL_SHUTDOWN: 30_000,             // 30 seconds

  // Auto-save Configuration
  AUTO_SAVE_BASE_INTERVAL: 120_000,      // 2 minutes (when not actively editing)
  AUTO_SAVE_ACTIVE_INTERVAL: 30_000,     // 30 seconds (during active editing)
  AUTO_SAVE_DEBOUNCE: 2_000,             // 2 seconds debounce

  // IndexedDB Operations
  INDEXEDDB_BATCH_DELAY: 100,            // 100ms batch collection window
  INDEXEDDB_BATCH_SIZE: 10,              // Max items per batch

  // API Client
  API_RETRY_DELAY: 1_000,                // 1 second base retry delay
  API_RETRY_MAX_ATTEMPTS: 3,             // Maximum retry attempts
  API_CIRCUIT_BREAKER_TIMEOUT: 30_000,   // 30 seconds circuit breaker timeout
  API_CIRCUIT_BREAKER_THRESHOLD: 5,      // Failures before opening circuit

  // Cleanup Intervals
  RATE_LIMIT_CLEANUP: 60_000,            // 1 minute cleanup interval
  IDEMPOTENCY_CLEANUP: 60 * 60 * 1000,   // 1 hour cleanup interval
} as const;

// Performance Configuration
export const PERFORMANCE = {
  // Memory Limits
  MAX_RATE_LIMIT_ENTRIES: 10_000,        // Maximum rate limit cache size
  MAX_IDEMPOTENCY_ENTRIES: 50_000,       // Maximum idempotency cache size

  // Batch Sizes
  INDEXEDDB_PARALLEL_BATCH_SIZE: 5,      // Parallel operations in batch
  API_PARALLEL_REQUESTS: 3,              // Concurrent API requests

  // Cache Settings
  LRU_CACHE_SIZE: 1_000,                 // Default LRU cache size

  // Activity Detection
  ACTIVE_EDITING_THRESHOLD: 60_000,      // 1 minute threshold for active editing
  EDIT_COUNT_THRESHOLD: 3,               // Minimum edits to consider active
} as const;

// Rate Limiting Configuration
export const RATE_LIMITS = {
  // General API
  GENERAL_WINDOW_MS: 15 * 60 * 1000,     // 15 minutes
  GENERAL_MAX_REQUESTS: 100,             // 100 requests per window

  // Authentication
  AUTH_WINDOW_MS: 15 * 60 * 1000,        // 15 minutes
  AUTH_MAX_ATTEMPTS: 5,                  // 5 attempts per window

  // Save Operations
  SAVE_WINDOW_MS: 60 * 1000,             // 1 minute
  SAVE_MAX_REQUESTS: 10,                 // 10 saves per minute

  // CSRF Token Generation
  CSRF_WINDOW_MS: 60 * 1000,             // 1 minute
  CSRF_MAX_REQUESTS: 10,                 // 10 requests per minute
} as const;

// Database Configuration
export const DATABASE = {
  INDEXEDDB_NAME: 'InvoiceSaveQueue',
  INDEXEDDB_VERSION: 3,                  // Increment for schema changes
  STORE_NAME: 'queued_saves',

  // Redis Configuration
  REDIS_SESSION_PREFIX: 'sess:',
  REDIS_SESSION_TTL: 1800,               // 30 minutes in seconds
  REDIS_IDEMPOTENCY_PREFIX: 'idempotency:',
  REDIS_IDEMPOTENCY_TTL: 3600,           // 1 hour in seconds
} as const;

// Network Configuration
export const NETWORK = {
  // Request Limits
  REQUEST_SIZE_LIMIT: '50mb',  // Increased to handle invoices with multiple base64-encoded attachments and receipts

  // Compression
  COMPRESSION_THRESHOLD: 1024,           // 1KB minimum for compression
  COMPRESSION_LEVEL: 6,                  // Balance between speed and ratio

  // CORS
  CORS_MAX_AGE: 86400,                   // 24 hours
} as const;

// Development vs Production Constants
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isProduction = process.env.NODE_ENV === 'production';
export const isTest = process.env.NODE_ENV === 'test';

// Environment-specific overrides
export const ENV_OVERRIDES = {
  development: {
    AUTO_SAVE_BASE_INTERVAL: 60_000,     // 1 minute for faster dev feedback
    SESSION_CHECK_INTERVAL: 5_000,       // 5 seconds for dev testing
  },
  test: {
    AUTO_SAVE_BASE_INTERVAL: 1_000,      // 1 second for fast tests
    SESSION_CHECK_INTERVAL: 100,         // 100ms for test speed
    INDEXEDDB_BATCH_DELAY: 10,          // 10ms for faster tests
  },
} as const;

// Apply environment overrides
function getConfigWithOverrides<T extends Record<string, any>>(
  baseConfig: T,
  env: keyof typeof ENV_OVERRIDES = process.env.NODE_ENV as keyof typeof ENV_OVERRIDES
): T {
  const overrides = ENV_OVERRIDES[env] || {};
  return { ...baseConfig, ...overrides };
}

// Export environment-aware configurations
export const TIMEOUTS_ENV = getConfigWithOverrides(TIMEOUTS);
export const PERFORMANCE_ENV = getConfigWithOverrides(PERFORMANCE);

// Type definitions for configuration
export type TimeoutConfig = typeof TIMEOUTS;
export type PerformanceConfig = typeof PERFORMANCE;
export type RateLimitConfig = typeof RATE_LIMITS;
export type DatabaseConfig = typeof DATABASE;
export type NetworkConfig = typeof NETWORK;