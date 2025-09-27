/**
 * HTTP client with retry logic, error handling, and authentication
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  CursorTelemetryConfig,
  ApiResponse,
  CursorTelemetryError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  NotFoundError,
  ServerError
} from '../types';

export class HttpClient {
  private client: AxiosInstance;
  private config: CursorTelemetryConfig;

  constructor(config: CursorTelemetryConfig) {
    this.config = {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      debug: false,
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'cursor-telemetry-sdk/1.0.0'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add API key if provided
        if (this.config.apiKey) {
          config.headers.Authorization = `Bearer ${this.config.apiKey}`;
        }

        // Add request ID for tracking
        config.headers['X-Request-ID'] = this.generateRequestId();

        if (this.config.debug) {
          console.log(`[CursorTelemetry] ${config.method?.toUpperCase()} ${config.url}`, {
            headers: config.headers,
            data: config.data
          });
        }

        return config;
      },
      (error) => {
        if (this.config.debug) {
          console.error('[CursorTelemetry] Request error:', error);
        }
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        if (this.config.debug) {
          console.log(`[CursorTelemetry] ${response.status} ${response.config.url}`, {
            data: response.data,
            headers: response.headers
          });
        }

        // Check if response has the expected format
        if (response.data && typeof response.data === 'object') {
          if (response.data.success === false) {
            throw this.createErrorFromResponse(response);
          }
        }

        return response;
      },
      async (error) => {
        if (this.config.debug) {
          console.error('[CursorTelemetry] Response error:', error);
        }

        // Handle retry logic
        if (this.shouldRetry(error)) {
          return this.retryRequest(error.config);
        }

        throw this.createErrorFromAxiosError(error);
      }
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private shouldRetry(error: any): boolean {
    if (!error.config || error.config.__retryCount >= this.config.retries!) {
      return false;
    }

    // Retry on network errors or 5xx status codes
    return (
      !error.response ||
      (error.response.status >= 500 && error.response.status < 600) ||
      error.code === 'ECONNABORTED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNREFUSED'
    );
  }

  private async retryRequest(config: AxiosRequestConfig): Promise<AxiosResponse> {
    config.__retryCount = (config.__retryCount || 0) + 1;
    
    const delay = this.config.retryDelay! * Math.pow(2, config.__retryCount - 1);
    
    if (this.config.debug) {
      console.log(`[CursorTelemetry] Retrying request in ${delay}ms (attempt ${config.__retryCount})`);
    }

    await this.sleep(delay);
    return this.client.request(config);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private createErrorFromResponse(response: AxiosResponse): CursorTelemetryError {
    const { data } = response;
    const message = data.error || 'Unknown error';
    const requestId = response.headers['x-request-id'];

    switch (response.status) {
      case 400:
        return new ValidationError(message, requestId);
      case 401:
        return new AuthenticationError(message, requestId);
      case 404:
        return new NotFoundError(message, requestId);
      case 429:
        const retryAfter = response.headers['retry-after'];
        return new RateLimitError(message, retryAfter ? parseInt(retryAfter) : undefined, requestId);
      case 500:
      case 502:
      case 503:
      case 504:
        return new ServerError(message, requestId);
      default:
        return new CursorTelemetryError(message, 'UNKNOWN_ERROR', response.status, requestId);
    }
  }

  private createErrorFromAxiosError(error: any): CursorTelemetryError {
    if (error.response) {
      return this.createErrorFromResponse(error.response);
    }

    if (error.request) {
      return new CursorTelemetryError(
        'Network error - no response received',
        'NETWORK_ERROR',
        undefined,
        error.config?.headers?.['X-Request-ID']
      );
    }

    return new CursorTelemetryError(
      error.message || 'Unknown error',
      'UNKNOWN_ERROR',
      undefined,
      error.config?.headers?.['X-Request-ID']
    );
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<ApiResponse<T>>(url, config);
    return response.data.data || response.data;
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<ApiResponse<T>>(url, data, config);
    return response.data.data || response.data;
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<ApiResponse<T>>(url, data, config);
    return response.data.data || response.data;
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<ApiResponse<T>>(url, config);
    return response.data.data || response.data;
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<ApiResponse<T>>(url, data, config);
    return response.data.data || response.data;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.get('/health');
      return true;
    } catch (error) {
      return false;
    }
  }

  // Update configuration
  updateConfig(newConfig: Partial<CursorTelemetryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.baseUrl) {
      this.client.defaults.baseURL = newConfig.baseUrl;
    }
    
    if (newConfig.timeout) {
      this.client.defaults.timeout = newConfig.timeout;
    }
  }

  // Get current configuration
  getConfig(): CursorTelemetryConfig {
    return { ...this.config };
  }
}
