import { apiClient, ApiError, AuthRequiredError } from '../../src/lib/apiClient';
import authStore from '../../src/stores/authStore';

// Mock fetch
global.fetch = jest.fn();

describe('ApiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('401 handling', () => {
    it('should not retry on 401 responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Authentication required' }),
      });

      const handleAuthRequiredSpy = jest.spyOn(authStore, 'handleAuthRequired');

      await expect(apiClient.post('/api/save', {}))
        .rejects.toThrow(AuthRequiredError);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(handleAuthRequiredSpy).toHaveBeenCalled();
    });

    it('should include credentials in requests', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true }),
      });

      authStore.setState({ isAuthenticated: true, csrfToken: 'test-token' });

      await apiClient.post('/api/save', { data: 'test' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: 'include',
          headers: expect.objectContaining({
            'X-CSRF-Token': 'test-token',
            'X-Correlation-ID': expect.any(String),
          }),
        })
      );
    });
  });

  describe('5xx retry logic', () => {
    it('should retry on 500 errors with exponential backoff', async () => {
      let attempts = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.resolve({
            ok: false,
            status: 500,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({ message: 'Server error' }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ success: true }),
        });
      });

      authStore.setState({ isAuthenticated: true });

      const result = await apiClient.get('/api/data');
      
      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry POST requests by default', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Server error' }),
      });

      authStore.setState({ isAuthenticated: true });

      await expect(apiClient.post('/api/save', {}))
        .rejects.toThrow(ApiError);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('idempotency', () => {
    it('should include idempotency key when provided', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true }),
      });

      authStore.setState({ isAuthenticated: true });
      const idempotencyKey = 'test-key-123';

      await apiClient.post('/api/save', {}, { idempotencyKey });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Idempotency-Key': idempotencyKey,
          }),
        })
      );
    });
  });

  describe('auth state checking', () => {
    it('should throw AuthRequiredError when not authenticated', async () => {
      authStore.setState({ isAuthenticated: false });

      await expect(apiClient.post('/api/save', {}))
        .rejects.toThrow(AuthRequiredError);

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should skip auth check when skipAuth is true', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true }),
      });

      authStore.setState({ isAuthenticated: false });

      const result = await apiClient.get('/api/public', { skipAuth: true });
      
      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});