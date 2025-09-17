/**
 * Unit tests for Geoapify Address Autocomplete API
 *
 * Tests:
 * - Input validation (query length, parameters)
 * - Rate limiting functionality
 * - Response normalization
 * - Error handling
 * - Security measures
 */

const request = require('supertest');
const express = require('express');
const geoRouter = require('../../server/routes/geo');

// Mock fetch for testing
global.fetch = jest.fn();

describe('Geo API Route', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/geo', geoRouter);
    jest.clearAllMocks();

    // Reset environment
    process.env.GEOAPIFY_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  describe('Input Validation', () => {
    test('should reject missing query parameter', async () => {
      const response = await request(app)
        .get('/api/geo/address-autocomplete');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid query parameter');
      expect(response.body.message).toBe('Query parameter is required and must be a string');
    });

    test('should reject empty query parameter', async () => {
      const response = await request(app)
        .get('/api/geo/address-autocomplete?query=');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Query too short');
      expect(response.body.message).toBe('Query must be at least 3 characters long');
    });

    test('should reject query shorter than 3 characters', async () => {
      const response = await request(app)
        .get('/api/geo/address-autocomplete?query=ab');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Query too short');
    });

    test('should reject query longer than 200 characters', async () => {
      const longQuery = 'a'.repeat(201);
      const response = await request(app)
        .get('/api/geo/address-autocomplete?query=' + longQuery);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Query too long');
      expect(response.body.message).toBe('Query must be less than 200 characters');
    });

    test('should validate limit parameter', async () => {
      const response = await request(app)
        .get('/api/geo/address-autocomplete?query=123%20Main%20St&limit=invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid limit parameter');
      expect(response.body.message).toBe('Limit must be a number between 1 and 10');
    });

    test('should reject limit outside valid range', async () => {
      const response = await request(app)
        .get('/api/geo/address-autocomplete?query=123%20Main%20St&limit=20');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid limit parameter');
    });

    test('should use default values for missing optional parameters', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ features: [] })
      });

      const response = await request(app)
        .get('/api/geo/address-autocomplete?query=123%20Main%20St');

      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=5'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('lang=en'),
        expect.any(Object)
      );
    });
  });

  describe('API Configuration', () => {
    test('should return error when API key is not configured', async () => {
      delete process.env.GEOAPIFY_API_KEY;

      const response = await request(app)
        .get('/api/geo/address-autocomplete?query=123%20Main%20St');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Service configuration error');
      expect(response.body.message).toBe('Address autocomplete service is not properly configured');
    });
  });

  describe('Response Normalization', () => {
    test('should normalize Geoapify response correctly', async () => {
      const mockGeoapifyResponse = {
        features: [
          {
            properties: {
              formatted: '123 Main Street, New York, NY 10001, USA',
              house_number: '123',
              street: 'Main Street',
              city: 'New York',
              state: 'NY',
              postcode: '10001',
              country: 'USA'
            },
            geometry: {
              coordinates: [-73.935242, 40.730610]
            }
          }
        ]
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGeoapifyResponse)
      });

      const response = await request(app)
        .get('/api/geo/address-autocomplete?query=123%20Main%20St');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toEqual({
        label: '123 Main Street, New York, NY 10001, USA',
        line1: '123 Main Street',
        city: 'New York',
        state: 'NY',
        postal_code: '10001',
        country: 'USA',
        lat: 40.730610,
        lon: -73.935242
      });
    });

    test('should handle missing address components', async () => {
      const mockGeoapifyResponse = {
        features: [
          {
            properties: {
              formatted: 'Partial Address',
              street: 'Unknown Street'
            },
            geometry: {
              coordinates: [-73.935242, 40.730610]
            }
          }
        ]
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGeoapifyResponse)
      });

      const response = await request(app)
        .get('/api/geo/address-autocomplete?query=unknown');

      expect(response.status).toBe(200);
      expect(response.body[0]).toEqual({
        label: 'Partial Address',
        line1: 'Unknown Street',
        city: '',
        state: '',
        postal_code: '',
        country: '',
        lat: 40.730610,
        lon: -73.935242
      });
    });

    test('should filter out results with empty labels', async () => {
      const mockGeoapifyResponse = {
        features: [
          {
            properties: {},
            geometry: { coordinates: [-73.935242, 40.730610] }
          },
          {
            properties: {
              formatted: 'Valid Address'
            },
            geometry: { coordinates: [-73.935242, 40.730610] }
          }
        ]
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGeoapifyResponse)
      });

      const response = await request(app)
        .get('/api/geo/address-autocomplete?query=test');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].label).toBe('Valid Address');
    });
  });

  describe('Error Handling', () => {
    test('should handle Geoapify API errors', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      const response = await request(app)
        .get('/api/geo/address-autocomplete?query=123%20Main%20St');

      expect(response.status).toBe(502);
      expect(response.body.error).toBe('External service error');
      expect(response.body.message).toBe('Address lookup service is temporarily unavailable');
    });

    test('should handle network timeouts', async () => {
      // Mock AbortError
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      global.fetch.mockRejectedValueOnce(abortError);

      const response = await request(app)
        .get('/api/geo/address-autocomplete?query=123%20Main%20St');

      expect(response.status).toBe(504);
      expect(response.body.error).toBe('Request timeout');
      expect(response.body.message).toBe('Address lookup service timed out. Please try again.');
    });

    test('should handle unexpected errors', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const response = await request(app)
        .get('/api/geo/address-autocomplete?query=123%20Main%20St');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
      expect(response.body.message).toBe('An unexpected error occurred while processing your request');
    });
  });

  describe('Rate Limiting', () => {
    test('should allow requests within rate limit', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ features: [] })
      });

      // Make 5 requests (under the limit)
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .get('/api/geo/address-autocomplete?query=test' + i);
        expect(response.status).toBe(200);
      }
    });

    test('should block requests exceeding rate limit', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ features: [] })
      });

      // Make requests up to the limit (30 requests per minute)
      const promises = [];
      for (let i = 0; i < 35; i++) {
        promises.push(
          request(app)
            .get('/api/geo/address-autocomplete?query=test' + i)
        );
      }

      const responses = await Promise.all(promises);

      // Some responses should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Rate limited response should have proper structure
      if (rateLimitedResponses.length > 0) {
        expect(rateLimitedResponses[0].body.error).toBe('Rate limit exceeded');
        expect(rateLimitedResponses[0].body.retryAfter).toBeDefined();
      }
    });
  });

  describe('Caching', () => {
    test('should cache responses for identical queries', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ features: [] })
      });

      // Make first request
      await request(app)
        .get('/api/geo/address-autocomplete?query=123%20Main%20St');

      // Make second identical request
      await request(app)
        .get('/api/geo/address-autocomplete?query=123%20Main%20St');

      // Should only call fetch once due to caching
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('should not cache different queries', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ features: [] })
      });

      // Make different requests
      await request(app)
        .get('/api/geo/address-autocomplete?query=123%20Main%20St');

      await request(app)
        .get('/api/geo/address-autocomplete?query=456%20Oak%20Ave');

      // Should call fetch twice for different queries
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Security', () => {
    test('should not expose API key in error messages', async () => {
      global.fetch.mockRejectedValueOnce(new Error('API key invalid'));

      const response = await request(app)
        .get('/api/geo/address-autocomplete?query=123%20Main%20St');

      expect(response.status).toBe(500);
      expect(JSON.stringify(response.body)).not.toContain('test-api-key');
    });

    test('should sanitize input to prevent injection', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ features: [] })
      });

      const maliciousQuery = encodeURIComponent('<script>alert("xss")</script>');
      const response = await request(app)
        .get('/api/geo/address-autocomplete?query=' + maliciousQuery);

      expect(response.status).toBe(200);
      // Verify that the query was properly sanitized in the API call
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/text=[^<>]*$/),
        expect.any(Object)
      );
    });

    test('should use proper headers for external API calls', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ features: [] })
      });

      await request(app)
        .get('/api/geo/address-autocomplete?query=123%20Main%20St');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'Marine-Invoice-Generator/1.0',
            'Accept': 'application/json'
          })
        })
      );
    });
  });
});