const express = require('express');
const router = express.Router();
const pino = require('pino');

// Logger instance
const logger = pino({
  level: process.env.LOG_LEVEL || 'info'
});

// Simple in-memory cache for address lookups
const addressCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000;

// Rate limiting store
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // Max 30 requests per minute per IP

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
function rateLimit(req, res, next) {
  const clientIP = req.ip || req.connection.remoteAddress;
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
    logger.warn({ clientIP, requestCount: recentRequests.length }, 'Rate limit exceeded for geo API');
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
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
function validateInput(req, res, next) {
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
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 10) {
      return res.status(400).json({
        error: 'Invalid limit parameter',
        message: 'Limit must be a number between 1 and 10'
      });
    }
    req.query.limit = limitNum;
  } else {
    req.query.limit = 5; // Default limit
  }

  // Validate language parameter
  if (lang !== undefined) {
    const validLangs = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'];
    if (!validLangs.includes(lang)) {
      req.query.lang = 'en'; // Default to English
    }
  } else {
    req.query.lang = 'en';
  }

  // Sanitize query for cache key and API call
  req.query.cleanQuery = cleanQuery;

  next();
}

/**
 * Normalize Geoapify response to our standard format
 */
function normalizeResponse(geoapifyFeatures) {
  if (!Array.isArray(geoapifyFeatures)) {
    return [];
  }

  return geoapifyFeatures.map(feature => {
    const props = feature.properties || {};
    const geometry = feature.geometry || {};
    const coordinates = geometry.coordinates || [];

    // Extract address components
    const houseNumber = props.house_number || '';
    const street = props.street || '';
    const line1 = houseNumber && street ? `${houseNumber} ${street}` : (street || houseNumber || '');

    return {
      label: props.formatted || props.name || line1,
      line1: line1,
      city: props.city || props.municipality || '',
      state: props.state || props.region || '',
      postal_code: props.postcode || '',
      country: props.country || '',
      lat: coordinates.length >= 2 ? coordinates[1] : null,
      lon: coordinates.length >= 2 ? coordinates[0] : null
    };
  }).filter(item => item.label); // Filter out empty results
}

/**
 * GET /api/geo/address-autocomplete
 * Proxy endpoint for Geoapify address autocomplete
 */
router.get('/address-autocomplete', rateLimit, validateInput, async (req, res) => {
  const { cleanQuery, limit, lang } = req.query;
  const clientIP = req.ip || req.connection.remoteAddress;

  try {
    // Check if API key is configured
    const apiKey = process.env.GEOAPIFY_API_KEY;
    if (!apiKey) {
      logger.error('GEOAPIFY_API_KEY environment variable not configured');
      return res.status(500).json({
        error: 'Service configuration error',
        message: 'Address autocomplete service is not properly configured'
      });
    }

    // Create cache key
    const cacheKey = `${cleanQuery}:${limit}:${lang}`;

    // Check cache first
    cleanupCache();
    const cached = addressCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      logger.info({ query: cleanQuery, clientIP, cached: true }, 'Serving cached address autocomplete result');
      return res.json(cached.data);
    }

    // Make request to Geoapify
    const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete');
    url.searchParams.set('text', cleanQuery);
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('lang', lang);
    url.searchParams.set('apiKey', apiKey);

    logger.info({ query: cleanQuery, clientIP, limit, lang }, 'Making Geoapify API request');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Marine-Invoice-Generator/1.0',
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.error({
        status: response.status,
        statusText: response.statusText,
        query: cleanQuery,
        clientIP
      }, 'Geoapify API error');

      return res.status(502).json({
        error: 'External service error',
        message: 'Address lookup service is temporarily unavailable'
      });
    }

    const data = await response.json();
    const normalizedResults = normalizeResponse(data.features || []);

    // Cache the result
    addressCache.set(cacheKey, {
      data: normalizedResults,
      timestamp: Date.now()
    });

    logger.info({
      query: cleanQuery,
      resultCount: normalizedResults.length,
      clientIP
    }, 'Successfully processed address autocomplete request');

    res.json(normalizedResults);

  } catch (error) {
    if (error.name === 'AbortError') {
      logger.error({ query: cleanQuery, clientIP }, 'Geoapify API request timeout');
      return res.status(504).json({
        error: 'Request timeout',
        message: 'Address lookup service timed out. Please try again.'
      });
    }

    logger.error({
      error: error.message,
      stack: error.stack,
      query: cleanQuery,
      clientIP
    }, 'Unexpected error in address autocomplete');

    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while processing your request'
    });
  }
});

module.exports = router;