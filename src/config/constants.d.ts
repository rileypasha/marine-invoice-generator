/**
 * Application Configuration Constants
 * Centralized configuration to eliminate magic numbers and improve maintainability
 */
export declare const TIMEOUTS: {
    readonly SESSION_CHECK_INTERVAL: 10000;
    readonly SESSION_TTL: number;
    readonly GRACEFUL_SHUTDOWN: 30000;
    readonly AUTO_SAVE_BASE_INTERVAL: 120000;
    readonly AUTO_SAVE_ACTIVE_INTERVAL: 30000;
    readonly AUTO_SAVE_DEBOUNCE: 2000;
    readonly INDEXEDDB_BATCH_DELAY: 100;
    readonly INDEXEDDB_BATCH_SIZE: 10;
    readonly API_RETRY_DELAY: 1000;
    readonly API_RETRY_MAX_ATTEMPTS: 3;
    readonly API_CIRCUIT_BREAKER_TIMEOUT: 30000;
    readonly API_CIRCUIT_BREAKER_THRESHOLD: 5;
    readonly RATE_LIMIT_CLEANUP: 60000;
    readonly IDEMPOTENCY_CLEANUP: number;
};
export declare const PERFORMANCE: {
    readonly MAX_RATE_LIMIT_ENTRIES: 10000;
    readonly MAX_IDEMPOTENCY_ENTRIES: 50000;
    readonly INDEXEDDB_PARALLEL_BATCH_SIZE: 5;
    readonly API_PARALLEL_REQUESTS: 3;
    readonly LRU_CACHE_SIZE: 1000;
    readonly ACTIVE_EDITING_THRESHOLD: 60000;
    readonly EDIT_COUNT_THRESHOLD: 3;
};
export declare const RATE_LIMITS: {
    readonly GENERAL_WINDOW_MS: number;
    readonly GENERAL_MAX_REQUESTS: 100;
    readonly AUTH_WINDOW_MS: number;
    readonly AUTH_MAX_ATTEMPTS: 5;
    readonly SAVE_WINDOW_MS: number;
    readonly SAVE_MAX_REQUESTS: 10;
    readonly CSRF_WINDOW_MS: number;
    readonly CSRF_MAX_REQUESTS: 10;
};
export declare const DATABASE: {
    readonly INDEXEDDB_NAME: "InvoiceSaveQueue";
    readonly INDEXEDDB_VERSION: 3;
    readonly STORE_NAME: "queued_saves";
    readonly SESSION_TTL_SECONDS: 1800;
    readonly SESSION_PRUNE_INTERVAL: 300;
    readonly IDEMPOTENCY_TTL: 3600;
};
export declare const NETWORK: {
    readonly REQUEST_SIZE_LIMIT: "10mb";
    readonly COMPRESSION_THRESHOLD: 1024;
    readonly COMPRESSION_LEVEL: 6;
    readonly CORS_MAX_AGE: 86400;
};
export declare const isDevelopment: boolean;
export declare const isProduction: boolean;
export declare const isTest: boolean;
export declare const ENV_OVERRIDES: {
    readonly development: {
        readonly AUTO_SAVE_BASE_INTERVAL: 60000;
        readonly SESSION_CHECK_INTERVAL: 5000;
    };
    readonly test: {
        readonly AUTO_SAVE_BASE_INTERVAL: 1000;
        readonly SESSION_CHECK_INTERVAL: 100;
        readonly INDEXEDDB_BATCH_DELAY: 10;
    };
};
export declare const TIMEOUTS_ENV: {
    readonly SESSION_CHECK_INTERVAL: 10000;
    readonly SESSION_TTL: number;
    readonly GRACEFUL_SHUTDOWN: 30000;
    readonly AUTO_SAVE_BASE_INTERVAL: 120000;
    readonly AUTO_SAVE_ACTIVE_INTERVAL: 30000;
    readonly AUTO_SAVE_DEBOUNCE: 2000;
    readonly INDEXEDDB_BATCH_DELAY: 100;
    readonly INDEXEDDB_BATCH_SIZE: 10;
    readonly API_RETRY_DELAY: 1000;
    readonly API_RETRY_MAX_ATTEMPTS: 3;
    readonly API_CIRCUIT_BREAKER_TIMEOUT: 30000;
    readonly API_CIRCUIT_BREAKER_THRESHOLD: 5;
    readonly RATE_LIMIT_CLEANUP: 60000;
    readonly IDEMPOTENCY_CLEANUP: number;
};
export declare const PERFORMANCE_ENV: {
    readonly MAX_RATE_LIMIT_ENTRIES: 10000;
    readonly MAX_IDEMPOTENCY_ENTRIES: 50000;
    readonly INDEXEDDB_PARALLEL_BATCH_SIZE: 5;
    readonly API_PARALLEL_REQUESTS: 3;
    readonly LRU_CACHE_SIZE: 1000;
    readonly ACTIVE_EDITING_THRESHOLD: 60000;
    readonly EDIT_COUNT_THRESHOLD: 3;
};
export type TimeoutConfig = typeof TIMEOUTS;
export type PerformanceConfig = typeof PERFORMANCE;
export type RateLimitConfig = typeof RATE_LIMITS;
export type DatabaseConfig = typeof DATABASE;
export type NetworkConfig = typeof NETWORK;
//# sourceMappingURL=constants.d.ts.map