/**
 * HTTP Client tests
 */

import { HttpClient } from '../src/utils/http-client';
import { CursorTelemetryConfig } from '../src/types';

describe('HttpClient', () => {
  let httpClient: HttpClient;
  let mockConfig: CursorTelemetryConfig;

  beforeEach(() => {
    mockConfig = {
      baseUrl: 'http://localhost:3000',
      apiKey: 'test-api-key',
      timeout: 5000,
      retries: 2,
      retryDelay: 100,
      debug: false
    };

    httpClient = new HttpClient(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const defaultConfig = { baseUrl: 'http://localhost:3000' };
      const client = new HttpClient(defaultConfig);
      
      expect(client.getConfig()).toEqual({
        baseUrl: 'http://localhost:3000',
        timeout: 30000,
        retries: 3,
        retryDelay: 1000,
        debug: false
      });
    });

    it('should merge provided config with defaults', () => {
      expect(httpClient.getConfig()).toEqual(mockConfig);
    });
  });

  describe('healthCheck', () => {
    it('should return true for successful health check', async () => {
      const mockAxios = require('axios');
      mockAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: { status: 'ok' } }),
        interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
        defaults: { baseURL: '', timeout: 5000, headers: {} }
      });

      const result = await httpClient.healthCheck();
      expect(result).toBe(true);
    });

    it('should return false for failed health check', async () => {
      const mockAxios = require('axios');
      mockAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('Connection failed')),
        interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
        defaults: { baseURL: '', timeout: 5000, headers: {} }
      });

      const result = await httpClient.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const newConfig = { timeout: 10000, debug: true };
      httpClient.updateConfig(newConfig);
      
      const updatedConfig = httpClient.getConfig();
      expect(updatedConfig.timeout).toBe(10000);
      expect(updatedConfig.debug).toBe(true);
      expect(updatedConfig.baseUrl).toBe('http://localhost:3000'); // Should preserve existing values
    });
  });

  describe('error handling', () => {
    it('should handle authentication errors', async () => {
      const mockAxios = require('axios');
      const mockError = {
        response: {
          status: 401,
          data: { error: 'Unauthorized' },
          headers: { 'x-request-id': 'req-123' }
        }
      };

      mockAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(mockError),
        interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
        defaults: { baseURL: '', timeout: 5000, headers: {} }
      });

      await expect(httpClient.get('/test')).rejects.toThrow('Unauthorized');
    });

    it('should handle rate limit errors', async () => {
      const mockAxios = require('axios');
      const mockError = {
        response: {
          status: 429,
          data: { error: 'Rate limit exceeded' },
          headers: { 'retry-after': '60', 'x-request-id': 'req-123' }
        }
      };

      mockAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(mockError),
        interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
        defaults: { baseURL: '', timeout: 5000, headers: {} }
      });

      await expect(httpClient.get('/test')).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle validation errors', async () => {
      const mockAxios = require('axios');
      const mockError = {
        response: {
          status: 400,
          data: { error: 'Invalid request' },
          headers: { 'x-request-id': 'req-123' }
        }
      };

      mockAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(mockError),
        interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
        defaults: { baseURL: '', timeout: 5000, headers: {} }
      });

      await expect(httpClient.get('/test')).rejects.toThrow('Invalid request');
    });

    it('should handle server errors', async () => {
      const mockAxios = require('axios');
      const mockError = {
        response: {
          status: 500,
          data: { error: 'Internal server error' },
          headers: { 'x-request-id': 'req-123' }
        }
      };

      mockAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(mockError),
        interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
        defaults: { baseURL: '', timeout: 5000, headers: {} }
      });

      await expect(httpClient.get('/test')).rejects.toThrow('Internal server error');
    });
  });
});
