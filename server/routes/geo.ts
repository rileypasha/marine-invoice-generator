import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

// Simple in-memory cache for address lookups
const addressCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000;

// Rate limiting store
const rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // Max 30 requests per minute per IP

// Geoapify API configuration
const GEOAPIFY_API_KEY = '6291b90c7f8c4f888dda207c2f7f349a';
const GEOAPIFY_BASE_URL = 'https://api.geoapify.com/v1/geocode/autocomplete';

interface GeoapifyFeature {
  properties: {
    formatted?: string;
    name?: string;
    street?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  geometry: {
    coordinates: [number, number];
  };
}

interface GeoapifyResponse {
  features: GeoapifyFeature[];
}

/**
 * Clean up expired cache entries
 */
function cleanupCache() {
  const now = Date.now();
  for (const [key, { timestamp }] of addressCache.entries()) {
    if (now - timestamp > CACHE_TTL) {
      addressCache.delete(key);
    }
  }

  // Limit cache size
  if (addressCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(addressCache.entries());
    const toDelete = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    for (const [key] of toDelete) {
      addressCache.delete(key);
    }
  }
}

/**
 * Rate limiting middleware
 */
function rateLimit(req: Request, res: Response, next: any) {
  const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  // Clean up old entries
  for (const [ip, requests] of rateLimitStore.entries()) {
    const validRequests = requests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
    if (validRequests.length === 0) {
      rateLimitStore.delete(ip);
    } else {
      rateLimitStore.set(ip, validRequests);
    }
  }

  // Check current IP
  const requests = rateLimitStore.get(clientIP) || [];
  const recentRequests = requests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);

  if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Too many requests. Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per minute allowed.`,
      retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000)
    });
  }

  // Add current request
  recentRequests.push(now);
  rateLimitStore.set(clientIP, recentRequests);

  next();
}

/**
 * Input validation middleware
 */
function validateInput(req: Request, res: Response, next: any) {
  const { query, limit, lang } = req.query;

  // Validate query parameter
  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      error: 'Invalid query parameter',
      message: 'Query parameter is required and must be a string'
    });
  }

  // Sanitize and validate query
  const cleanQuery = query.trim();
  if (cleanQuery.length < 3) {
    return res.status(400).json({
      error: 'Query too short',
      message: 'Query must be at least 3 characters long'
    });
  }

  if (cleanQuery.length > 200) {
    return res.status(400).json({
      error: 'Query too long',
      message: 'Query must be less than 200 characters'
    });
  }

  // Validate limit parameter
  if (limit !== undefined) {
    const limitNum = parseInt(limit as string, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 10) {
      return res.status(400).json({
        error: 'Invalid limit parameter',
        message: 'Limit must be a number between 1 and 10'
      });
    }
    req.query.limit = limitNum as any;
  } else {
    req.query.limit = 5 as any; // Default limit
  }

  // Validate language parameter
  if (lang !== undefined) {
    const validLangs = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'];
    if (!validLangs.includes(lang as string)) {
      req.query.lang = 'en'; // Default to English
    }
  } else {
    req.query.lang = 'en';
  }

  // Sanitize query for cache key and API call
  req.query.cleanQuery = cleanQuery as any;

  next();
}

/**
 * Normalize Geoapify response to our standard format
 */
function normalizeResponse(geoapifyFeatures: GeoapifyFeature[]) {
  if (!Array.isArray(geoapifyFeatures)) {
    return [];
  }

  return geoapifyFeatures.map(feature => {
    const props = feature.properties || {};
    const geometry = feature.geometry || {};
    const coordinates = geometry.coordinates || [];

    return {
      formatted: props.formatted || '',
      name: props.name,
      street: props.street,
      city: props.city,
      state: props.state,
      postcode: props.postcode,
      country: props.country,
      lat: coordinates[1], // Geoapify uses [lng, lat]
      lon: coordinates[0]
    };
  });
}

/**
 * Address autocomplete endpoint
 * GET /api/geo/address-autocomplete
 */
router.get('/address-autocomplete', rateLimit, validateInput, async (req: Request, res: Response) => {
  const { cleanQuery, limit, lang } = req.query;
  const correlationId = req.headers['x-correlation-id'] || 'unknown';

  try {
    // Clean up cache periodically
    cleanupCache();

    // Check cache first
    const cacheKey = `${cleanQuery}-${limit}-${lang}`;
    const cached = addressCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      logger.info('Address autocomplete cache hit', {
        correlationId,
        query: cleanQuery,
        cacheKey
      });
      return res.json(cached.data);
    }

    // Build API URL
    const apiUrl = new URL(GEOAPIFY_BASE_URL);
    apiUrl.searchParams.set('text', cleanQuery as string);
    apiUrl.searchParams.set('limit', limit as string);
    apiUrl.searchParams.set('lang', lang as string);
    apiUrl.searchParams.set('apiKey', GEOAPIFY_API_KEY);

    logger.info('Fetching address suggestions from Geoapify', {
      correlationId,
      query: cleanQuery,
      limit,
      lang
    });

    // Fetch from Geoapify API
    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Marine-Group-Invoice-System/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Geoapify API error: ${response.status} ${response.statusText}`);
    }

    const geoapifyData = await response.json() as GeoapifyResponse;
    const normalizedResults = normalizeResponse(geoapifyData.features || []);

    // Cache the results
    addressCache.set(cacheKey, {
      data: normalizedResults,
      timestamp: Date.now()
    });

    logger.info('Address autocomplete successful', {
      correlationId,
      query: cleanQuery,
      resultsCount: normalizedResults.length
    });

    res.json(normalizedResults);

  } catch (error) {
    logger.error('Address autocomplete failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      query: cleanQuery,
      stack: error instanceof Error ? error.stack : undefined
    });

    // Return empty results on error to avoid breaking the UI
    res.status(500).json({
      error: 'Address search failed',
      message: 'Unable to search addresses at this time. Please try again later.',
      correlationId
    });
  }
});

export default router;