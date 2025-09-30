/**
 * API Manager
 * Handles API requests with timeout management, retry logic, and connection error handling
 */

const { EventEmitter } = require('events');

class APIManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            baseURL: options.baseURL || 'http://localhost:3000',
            timeout: options.timeout || 30000,
            retries: options.retries || 3,
            retryDelay: options.retryDelay || 1000,
            maxRetryDelay: options.maxRetryDelay || 10000,
            retryMultiplier: options.retryMultiplier || 2,
            enableCircuitBreaker: options.enableCircuitBreaker !== false,
            circuitBreakerThreshold: options.circuitBreakerThreshold || 5,
            circuitBreakerTimeout: options.circuitBreakerTimeout || 60000,
            enableRequestDeduplication: options.enableRequestDeduplication !== false,
            requestCacheTimeout: options.requestCacheTimeout || 5000,
            ...options
        };
        
        // Use built-in fetch instead of axios
        this.baseURL = this.options.baseURL;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'User-Agent': 'cursor-dashboard-api/1.0.0'
        };
        
        this.circuitBreaker = {
            failures: 0,
            lastFailureTime: null,
            state: 'CLOSED' // CLOSED, OPEN, HALF_OPEN
        };
        
        this.requestCache = new Map();
        this.pendingRequests = new Map();
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            timeoutRequests: 0,
            retryRequests: 0,
            cacheHits: 0,
            circuitBreakerTrips: 0
        };
        
        this.setupInterceptors();
    }
    
    /**
     * Setup HTTP interceptors (using fetch instead of axios)
     */
    setupInterceptors() {
        // No interceptors needed with fetch - handled in request method
    }
    
    /**
     * Generate unique request ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Check if request should be retried
     */
    shouldRetry(error, retryCount = 0) {
        if (retryCount >= this.options.retries) return false;
        
        // Retry on network errors and 5xx status codes
        return (
            error.name === 'AbortError' ||
            error.name === 'TypeError' ||
            (error.status && error.status >= 500)
        );
    }
    
    /**
     * Retry request with exponential backoff
     */
    async retryRequest(config, retryCount = 0) {
        const delay = Math.min(
            this.options.retryDelay * Math.pow(this.options.retryMultiplier, retryCount),
            this.options.maxRetryDelay
        );
        
        this.stats.retryRequests++;
        
        this.emit('request-retry', {
            id: config.requestId,
            attempt: retryCount + 1,
            delay: delay
        });
        
        await this.sleep(delay);
        
        return this.makeFetchRequest(config, retryCount + 1);
    }
    
    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Make HTTP request using fetch
     */
    async makeFetchRequest(config, retryCount = 0) {
        const requestId = this.generateRequestId();
        const startTime = Date.now();
        
        this.stats.totalRequests++;
        
        this.emit('request-started', {
            id: requestId,
            url: config.url,
            method: config.method
        });
        
        try {
            const url = config.url.startsWith('http') ? config.url : `${this.baseURL}${config.url}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);
            
            const response = await fetch(url, {
                method: config.method || 'GET',
                headers: { ...this.defaultHeaders, ...config.headers },
                body: config.data ? JSON.stringify(config.data) : undefined,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            const duration = Date.now() - startTime;
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            this.stats.successfulRequests++;
            
            this.emit('request-success', {
                id: requestId,
                duration: duration,
                status: response.status
            });
            
            return { data, status: response.status, headers: response.headers };
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            this.stats.failedRequests++;
            
            if (error.name === 'AbortError') {
                this.stats.timeoutRequests++;
            }
            
            this.emit('request-failed', {
                id: requestId,
                duration: duration,
                error: error.message,
                code: error.name
            });
            
            // Handle retry logic
            if (this.shouldRetry(error, retryCount)) {
                return this.retryRequest({ ...config, requestId }, retryCount);
            }
            
            throw error;
        }
    }
    
    /**
     * Check circuit breaker state
     */
    checkCircuitBreaker() {
        if (!this.options.enableCircuitBreaker) return true;
        
        const now = Date.now();
        
        switch (this.circuitBreaker.state) {
            case 'CLOSED':
                return true;
                
            case 'OPEN':
                if (now - this.circuitBreaker.lastFailureTime > this.options.circuitBreakerTimeout) {
                    this.circuitBreaker.state = 'HALF_OPEN';
                    return true;
                }
                return false;
                
            case 'HALF_OPEN':
                return true;
                
            default:
                return true;
        }
    }
    
    /**
     * Update circuit breaker state
     */
    updateCircuitBreaker(success) {
        if (!this.options.enableCircuitBreaker) return;
        
        if (success) {
            this.circuitBreaker.failures = 0;
            this.circuitBreaker.state = 'CLOSED';
        } else {
            this.circuitBreaker.failures++;
            this.circuitBreaker.lastFailureTime = Date.now();
            
            if (this.circuitBreaker.failures >= this.options.circuitBreakerThreshold) {
                this.circuitBreaker.state = 'OPEN';
                this.stats.circuitBreakerTrips++;
                
                this.emit('circuit-breaker-opened', {
                    failures: this.circuitBreaker.failures,
                    threshold: this.options.circuitBreakerThreshold
                });
            }
        }
    }
    
    /**
     * Generate cache key for request
     */
    generateCacheKey(config) {
        const { method, url, params, data } = config;
        return `${method}:${url}:${JSON.stringify(params)}:${JSON.stringify(data)}`;
    }
    
    /**
     * Check request cache
     */
    getCachedRequest(cacheKey) {
        if (!this.options.enableRequestDeduplication) return null;
        
        const cached = this.requestCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.options.requestCacheTimeout) {
            this.stats.cacheHits++;
            return cached.response;
        }
        
        return null;
    }
    
    /**
     * Cache request response
     */
    cacheRequest(cacheKey, response) {
        if (!this.options.enableRequestDeduplication) return;
        
        this.requestCache.set(cacheKey, {
            response: response,
            timestamp: Date.now()
        });
    }
    
    /**
     * Make HTTP request with all optimizations
     */
    async request(config) {
        // Check circuit breaker
        if (!this.checkCircuitBreaker()) {
            throw new Error('Circuit breaker is OPEN');
        }
        
        // Check for duplicate requests
        const cacheKey = this.generateCacheKey(config);
        const cached = this.getCachedRequest(cacheKey);
        if (cached) {
            return cached;
        }
        
        // Check for pending identical requests
        if (this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey);
        }
        
        try {
            // Create request promise
            const requestPromise = this.makeFetchRequest(config);
            
            // Store pending request
            this.pendingRequests.set(cacheKey, requestPromise);
            
            // Wait for response
            const response = await requestPromise;
            
            // Update circuit breaker
            this.updateCircuitBreaker(true);
            
            // Cache successful response
            this.cacheRequest(cacheKey, response);
            
            return response;
            
        } catch (error) {
            // Update circuit breaker
            this.updateCircuitBreaker(false);
            
            throw error;
            
        } finally {
            // Remove pending request
            this.pendingRequests.delete(cacheKey);
        }
    }
    
    /**
     * GET request
     */
    async get(url, config = {}) {
        return this.request({
            method: 'GET',
            url: url,
            ...config
        });
    }
    
    /**
     * POST request
     */
    async post(url, data, config = {}) {
        return this.request({
            method: 'POST',
            url: url,
            data: data,
            ...config
        });
    }
    
    /**
     * PUT request
     */
    async put(url, data, config = {}) {
        return this.request({
            method: 'PUT',
            url: url,
            data: data,
            ...config
        });
    }
    
    /**
     * DELETE request
     */
    async delete(url, config = {}) {
        return this.request({
            method: 'DELETE',
            url: url,
            ...config
        });
    }
    
    /**
     * Batch requests
     */
    async batch(requests) {
        const promises = requests.map(request => this.request(request));
        return Promise.allSettled(promises);
    }
    
    /**
     * Health check
     */
    async healthCheck() {
        try {
            const response = await this.get('/health', { timeout: 5000 });
            return {
                healthy: true,
                status: response.status,
                responseTime: response.duration
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message
            };
        }
    }
    
    /**
     * Clear request cache
     */
    clearCache() {
        this.requestCache.clear();
        this.pendingRequests.clear();
    }
    
    /**
     * Get API statistics
     */
    getStats() {
        const successRate = this.stats.totalRequests > 0 
            ? (this.stats.successfulRequests / this.stats.totalRequests) * 100 
            : 0;
        
        return {
            ...this.stats,
            successRate: successRate.toFixed(2) + '%',
            circuitBreaker: {
                state: this.circuitBreaker.state,
                failures: this.circuitBreaker.failures,
                threshold: this.options.circuitBreakerThreshold
            },
            cache: {
                size: this.requestCache.size,
                pending: this.pendingRequests.size
            }
        };
    }
    
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            timeoutRequests: 0,
            retryRequests: 0,
            cacheHits: 0,
            circuitBreakerTrips: 0
        };
    }
    
    /**
     * Destroy API manager
     */
    destroy() {
        this.clearCache();
        this.removeAllListeners();
    }
}

module.exports = APIManager;
