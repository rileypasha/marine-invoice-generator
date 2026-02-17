import authStore, { AuthRequiredError } from '../stores/authStore';
import { generateCorrelationId } from '../utils/idempotency';
import { TIMEOUTS_ENV, PERFORMANCE_ENV } from '../config/constants';

/**
 * Circuit breaker pattern implementation for API resilience
 */
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;
  private readonly failureThreshold = TIMEOUTS_ENV.API_CIRCUIT_BREAKER_THRESHOLD;
  private readonly timeout = TIMEOUTS_ENV.API_CIRCUIT_BREAKER_TIMEOUT;
  private readonly halfOpenMaxCalls = 3;

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        console.log('🔄 Circuit breaker transitioning to HALF_OPEN');
      } else {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.halfOpenMaxCalls) {
        this.state = 'CLOSED';
        console.log('✅ Circuit breaker CLOSED - service recovered');
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      console.log(`❌ Circuit breaker OPEN - ${this.failureCount} failures`);
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount,
    };
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}

/**
 * Request cache for reducing duplicate API calls
 */
class RequestCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: any, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    // Cleanup expired entries
    this.cleanup();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        age: Date.now() - entry.timestamp,
        ttl: entry.ttl,
      })),
    };
  }
}

export interface ApiRequestOptions extends RequestInit {
  skipAuth?: boolean;
  idempotencyKey?: string;
  maxRetries?: number;
  retryDelay?: number;
  useCache?: boolean;
  cacheTTL?: number;
  skipCircuitBreaker?: boolean;
  timeout?: number;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  correlationId: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private abortControllers: Map<string, AbortController>;
  private circuitBreaker = new CircuitBreaker();
  private requestCache = new RequestCache();
  private performanceMetrics = {
    totalRequests: 0,
    successCount: 0,
    failureCount: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageResponseTime: 0,
    circuitBreakerTrips: 0,
  };
  private responseTimes: number[] = [];

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
    this.abortControllers = new Map();
  }

  private async handleResponse<T>(response: Response, correlationId: string): Promise<T> {
    const contentType = response.headers.get('content-type');
    let data: any;

    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      if (response.status === 401) {
        authStore.handleAuthRequired();
        throw new AuthRequiredError(data?.message || 'Authentication required');
      }

      throw new ApiError(
        response.status,
        data?.code || 'API_ERROR',
        data?.message || `Request failed with status ${response.status}`,
        data?.details
      );
    }

    return data;
  }

  /**
   * Optimized retry with exponential backoff and jitter
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    delay: number,
    attempt = 1
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      // Don't retry client errors, auth errors, or circuit breaker errors
      if (
        attempt >= maxRetries ||
        (error instanceof ApiError && error.status < 500) ||
        error instanceof AuthRequiredError ||
        (error as Error).message.includes('Circuit breaker')
      ) {
        throw error;
      }

      // Optimized backoff: cap maximum delay and reduce jitter
      const baseDelay = Math.min(delay * Math.pow(1.5, attempt - 1), 5000); // Cap at 5s
      const jitter = Math.random() * 500; // Reduce jitter to 500ms
      const backoffDelay = baseDelay + jitter;

      console.log(`⏳ Retrying in ${backoffDelay.toFixed(0)}ms (attempt ${attempt}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));

      return this.retryWithBackoff(fn, maxRetries, delay, attempt + 1);
    }
  }

  async request<T = any>(
    url: string,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const {
      skipAuth = false,
      idempotencyKey,
      maxRetries = TIMEOUTS_ENV.API_RETRY_MAX_ATTEMPTS,
      retryDelay = TIMEOUTS_ENV.API_RETRY_DELAY,
      useCache = false,
      cacheTTL = 5 * 60 * 1000, // 5 minutes default
      skipCircuitBreaker = false,
      timeout = 10000, // 10 second timeout
      ...fetchOptions
    } = options;

    const correlationId = generateCorrelationId();
    const fullUrl = `${this.baseUrl}${url}`;
    const requestKey = `${fetchOptions.method || 'GET'}:${fullUrl}:${JSON.stringify(fetchOptions.body || '')}`;
    const startTime = performance.now();

    this.performanceMetrics.totalRequests++;

    // Check cache for GET requests
    if (useCache && fetchOptions.method === 'GET') {
      const cached = this.requestCache.get(requestKey);
      if (cached) {
        this.performanceMetrics.cacheHits++;
        console.log(`📦 Cache hit for ${requestKey}`);
        return cached;
      }
      this.performanceMetrics.cacheMisses++;
    }

    const performRequest = async (): Promise<T> => {
      if (!skipAuth && !authStore.isAuthenticated) {
        throw new AuthRequiredError('Not authenticated');
      }

      // Apply circuit breaker pattern
      const executeWithCircuitBreaker = skipCircuitBreaker
        ? (fn: () => Promise<T>) => fn()
        : (fn: () => Promise<T>) => this.circuitBreaker.execute(fn);

      return executeWithCircuitBreaker(async () => {
        const controller = new AbortController();
        const requestId = `${fetchOptions.method || 'GET'}-${url}-${correlationId}`;
        this.abortControllers.set(requestId, controller);

        // Set up timeout
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, timeout);

        try {
          const headers: Record<string, string> = {
            ...this.defaultHeaders,
            'X-Correlation-ID': correlationId,
          };

          if (fetchOptions.headers instanceof Headers) {
            fetchOptions.headers.forEach((value, key) => {
              headers[key] = value;
            });
          } else if (Array.isArray(fetchOptions.headers)) {
            fetchOptions.headers.forEach(([key, value]) => {
              headers[key] = value;
            });
          } else if (fetchOptions.headers && typeof fetchOptions.headers === 'object') {
            Object.entries(fetchOptions.headers as Record<string, string>).forEach(([key, value]) => {
              headers[key] = value;
            });
          }

          if (authStore.csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(fetchOptions.method || '')) {
            headers['X-CSRF-Token'] = authStore.csrfToken;
          }

          if (idempotencyKey) {
            headers['Idempotency-Key'] = idempotencyKey;
          }

          const response = await fetch(fullUrl, {
            ...fetchOptions,
            headers,
            credentials: 'include',
            signal: controller.signal,
          });

          const duration = performance.now() - startTime;
          this.recordResponseTime(duration);

          console.log(`📨 [${requestId}] Response status: ${response.status} (${duration.toFixed(2)}ms)`);

          const result = await this.handleResponse<T>(response, correlationId);

          // Cache successful GET responses
          if (useCache && fetchOptions.method === 'GET' && response.ok) {
            this.requestCache.set(requestKey, result, cacheTTL);
          }

          this.performanceMetrics.successCount++;
          return result;

        } catch (error) {
          this.performanceMetrics.failureCount++;

          if ((error as Error).message.includes('Circuit breaker')) {
            this.performanceMetrics.circuitBreakerTrips++;
          }

          throw error;
        } finally {
          clearTimeout(timeoutId);
          this.abortControllers.delete(requestId);
        }
      });
    };

    // Only retry safe methods and non-auth errors
    if (maxRetries > 1 && (!fetchOptions.method || ['GET', 'HEAD', 'OPTIONS'].includes(fetchOptions.method))) {
      return this.retryWithBackoff(performRequest, maxRetries, retryDelay);
    }

    return performRequest();
  }

  async get<T = any>(url: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'GET',
      useCache: options?.useCache ?? true, // Enable cache by default for GET requests
    });
  }

  async post<T = any>(url: string, data?: any, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(url: string, data?: any, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T = any>(url: string, data?: any, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(url: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }

  abortRequest(url: string, method = 'GET'): void {
    const controllers = Array.from(this.abortControllers.entries())
      .filter(([key]) => key.includes(`${method}-${url}`));
    
    controllers.forEach(([key, controller]) => {
      controller.abort();
      this.abortControllers.delete(key);
    });
  }

  abortAll(): void {
    this.abortControllers.forEach(controller => controller.abort());
    this.abortControllers.clear();
  }

  /**
   * Record response time for performance metrics
   */
  private recordResponseTime(duration: number): void {
    this.responseTimes.push(duration);
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift(); // Keep last 100 measurements
    }

    this.performanceMetrics.averageResponseTime =
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
  }

  /**
   * Get performance metrics and circuit breaker status
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      circuitBreaker: this.circuitBreaker.getState(),
      cache: this.requestCache.getStats(),
      activeRequests: this.abortControllers.size,
    };
  }

  /**
   * Reset performance metrics
   */
  resetPerformanceMetrics(): void {
    this.performanceMetrics = {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      circuitBreakerTrips: 0,
    };
    this.responseTimes = [];
  }

  /**
   * Reset circuit breaker state
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }

  /**
   * Clear request cache
   */
  clearCache(): void {
    this.requestCache.clear();
  }
}

export const apiClient = new ApiClient();
export default apiClient;
