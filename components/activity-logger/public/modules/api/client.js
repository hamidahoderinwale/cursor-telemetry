/**
 * API Client Module
 * Handles HTTP requests to the companion service
 */

import { CONFIG } from '../core/config.js';

export class APIClient {
  /**
   * Make a GET request with retry logic and timeout
   */
  static async get(endpoint, options = {}) {
    const timeout = options.timeout || 10000; // 10 second default timeout
    const retries = options.retries || 2; // Retry up to 2 times
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(`${CONFIG.API_BASE}${endpoint}`, {
          signal: controller.signal,
          ...options
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        const isLastAttempt = attempt === retries;
        
        if (isLastAttempt) {
          console.error(`[ERROR] API (${endpoint}) failed after ${retries + 1} attempts:`, error.message);
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
        console.warn(`[WARNING] API (${endpoint}) attempt ${attempt + 1} failed, retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  /**
   * Make a POST request
   */
  static async post(endpoint, data, options = {}) {
    try {
      const response = await fetch(`${CONFIG.API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        body: JSON.stringify(data),
        ...options
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`[ERROR] POST ${endpoint} failed:`, error);
      throw error;
    }
  }

  /**
   * Check service health
   */
  static async checkHealth() {
    try {
      return await this.get('/health', { timeout: 5000, retries: 1 });
    } catch (error) {
      return { status: 'offline', error: error.message };
    }
  }
}

export default APIClient;

