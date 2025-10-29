/**
 * API Authentication Middleware
 * Protects API endpoints with API key authentication
 */

const crypto = require('crypto');

class AuthMiddleware {
  constructor() {
    // Load API keys from environment or generate one
    this.apiKeys = new Set();
    
    // Load from environment
    const envKeys = process.env.API_KEYS?.split(',').filter(k => k) || [];
    envKeys.forEach(key => this.apiKeys.add(key.trim()));
    
    // If no keys provided and PUBLIC_API is not true, generate one
    if (this.apiKeys.size === 0 && process.env.PUBLIC_API !== 'true') {
      const generatedKey = crypto.randomBytes(32).toString('hex');
      this.apiKeys.add(generatedKey);
      console.log('\n⚠️  No API keys configured!');
      console.log('🔑 Generated temporary API key:', generatedKey);
      console.log('💡 Add to .env file: API_KEYS=' + generatedKey);
      console.log('');
    }
    
    // Check if authentication is required
    this.requireAuth = process.env.REQUIRE_AUTH === 'true' || process.env.API_KEYS;
    
    if (!this.requireAuth) {
      console.log('🔓 API authentication is DISABLED (set REQUIRE_AUTH=true to enable)');
    } else {
      console.log(`🔒 API authentication ENABLED (${this.apiKeys.size} keys configured)`);
    }
  }
  
  /**
   * Express middleware for API key authentication
   */
  authenticate = (req, res, next) => {
    // Skip auth if not required
    if (!this.requireAuth) {
      return next();
    }
    
    // Get API key from header or query parameter
    const apiKey = req.headers['x-api-key'] || 
                   req.headers['authorization']?.replace('Bearer ', '') ||
                   req.query.api_key;
    
    if (!apiKey) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide an API key via X-API-Key header or ?api_key= parameter'
      });
    }
    
    // Validate API key
    if (!this.apiKeys.has(apiKey)) {
      return res.status(403).json({
        error: 'Invalid API key',
        message: 'The provided API key is not valid'
      });
    }
    
    // Authentication successful
    next();
  };
  
  /**
   * Express middleware for optional authentication
   * Allows both authenticated and unauthenticated requests
   */
  optionalAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || 
                   req.headers['authorization']?.replace('Bearer ', '') ||
                   req.query.api_key;
    
    if (apiKey && this.apiKeys.has(apiKey)) {
      req.authenticated = true;
    }
    
    next();
  };
  
  /**
   * Generate a new API key
   */
  generateKey() {
    const newKey = crypto.randomBytes(32).toString('hex');
    this.apiKeys.add(newKey);
    return newKey;
  }
  
  /**
   * Revoke an API key
   */
  revokeKey(apiKey) {
    return this.apiKeys.delete(apiKey);
  }
  
  /**
   * List all API keys (hashed for security)
   */
  listKeys() {
    return Array.from(this.apiKeys).map(key => ({
      key: key.substring(0, 8) + '...' + key.substring(key.length - 8),
      hash: crypto.createHash('sha256').update(key).digest('hex').substring(0, 16)
    }));
  }
}

module.exports = AuthMiddleware;

