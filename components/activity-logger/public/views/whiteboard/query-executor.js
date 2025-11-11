/**
 * Query Executor - Executes SQL queries against telemetry data
 */

class QueryExecutor {
  constructor() {
    this.apiBase = window.CONFIG?.API_BASE_URL || 'http://localhost:43917';
  }

  async execute(sql) {
    try {
      // Validate and sanitize SQL
      const sanitized = this.sanitizeSQL(sql);
      
      // Execute via API
      const response = await fetch(`${this.apiBase}/api/whiteboard/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sanitized })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Query execution failed' }));
        throw new Error(error.error || 'Query execution failed');
      }

      const data = await response.json();
      return data.results;
    } catch (error) {
      console.error('Query execution error:', error);
      
      // Check if it's a network/CORS error
      const errorMessage = error.message || error.toString();
      const isNetworkError = errorMessage.includes('CORS') || 
                             errorMessage.includes('NetworkError') || 
                             errorMessage.includes('Failed to fetch') ||
                             errorMessage.includes('network error') ||
                             error.name === 'NetworkError' ||
                             error.name === 'TypeError';
      
      if (isNetworkError) {
        throw new Error(`Cannot connect to companion service at ${this.apiBase}. Please ensure the service is running.`);
      }
      
      throw error;
    }
  }

  sanitizeSQL(sql) {
    // Basic SQL sanitization - only allow SELECT statements
    const trimmed = sql.trim().toUpperCase();
    
    if (!trimmed.startsWith('SELECT')) {
      throw new Error('Only SELECT queries are allowed');
    }

    // Block dangerous operations
    const dangerous = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE'];
    for (const keyword of dangerous) {
      if (trimmed.includes(keyword)) {
        throw new Error(`Operation ${keyword} is not allowed`);
      }
    }

    // Translate legacy table names: 'events' -> 'entries'
    // Use case-insensitive replacement to handle various SQL formats
    let sanitized = sql;
    sanitized = sanitized.replace(/\bFROM\s+events\b/gi, 'FROM entries');
    sanitized = sanitized.replace(/\bJOIN\s+events\b/gi, 'JOIN entries');
    sanitized = sanitized.replace(/\bevents\./gi, 'entries.');

    return sanitized;
  }
}

