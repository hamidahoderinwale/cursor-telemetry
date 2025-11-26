/**
 * Account Client
 * Frontend service for account management and authentication
 */

class AccountClient {
  constructor() {
    this.apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    this.accountCache = null;
    this.listeners = [];
  }

  /**
   * Get current account status
   */
  async getStatus() {
    try {
      const response = await fetch(`${this.apiBase}/api/account/status`);
      if (!response.ok) {
        throw new Error('Failed to get account status');
      }
      const data = await response.json();
      this.accountCache = data;
      this.notifyListeners('status', data);
      return data;
    } catch (error) {
      console.error('[ACCOUNT] Error getting status:', error.message);
      return {
        success: false,
        authenticated: false,
        account: null,
        sync: { enabled: false }
      };
    }
  }

  /**
   * Register new account
   */
  async register(email, password, deviceName) {
    try {
      const response = await fetch(`${this.apiBase}/api/account/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, device_name: deviceName })
      });

      const data = await response.json();
      
      if (data.success) {
        this.accountCache = null; // Clear cache
        await this.getStatus(); // Refresh status
        this.notifyListeners('registered', data);
      }

      return data;
    } catch (error) {
      console.error('[ACCOUNT] Registration error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Login to account
   */
  async login(email, password) {
    try {
      const response = await fetch(`${this.apiBase}/api/account/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      
      if (data.success) {
        this.accountCache = null; // Clear cache
        await this.getStatus(); // Refresh status
        this.notifyListeners('logged_in', data);
      }

      return data;
    } catch (error) {
      console.error('[ACCOUNT] Login error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Logout from account
   */
  async logout() {
    try {
      const response = await fetch(`${this.apiBase}/api/account/logout`, {
        method: 'POST'
      });

      const data = await response.json();
      
      if (data.success) {
        this.accountCache = null;
        this.notifyListeners('logged_out', data);
      }

      return data;
    } catch (error) {
      console.error('[ACCOUNT] Logout error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Enable cloud sync
   */
  async enableSync() {
    try {
      const response = await fetch(`${this.apiBase}/api/account/sync/enable`, {
        method: 'POST'
      });

      const data = await response.json();
      
      if (data.success) {
        await this.getStatus();
        this.notifyListeners('sync_enabled', data);
      }

      return data;
    } catch (error) {
      console.error('[ACCOUNT] Enable sync error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Disable cloud sync
   */
  async disableSync() {
    try {
      const response = await fetch(`${this.apiBase}/api/account/sync/disable`, {
        method: 'POST'
      });

      const data = await response.json();
      
      if (data.success) {
        await this.getStatus();
        this.notifyListeners('sync_disabled', data);
      }

      return data;
    } catch (error) {
      console.error('[ACCOUNT] Disable sync error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Trigger manual sync
   */
  async syncNow(direction = 'both') {
    try {
      const response = await fetch(`${this.apiBase}/api/account/sync/now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction })
      });

      const data = await response.json();
      
      if (data.success) {
        this.notifyListeners('sync_complete', data);
      }

      return data;
    } catch (error) {
      console.error('[ACCOUNT] Sync error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus() {
    try {
      const response = await fetch(`${this.apiBase}/api/account/sync/status`);
      if (!response.ok) {
        throw new Error('Failed to get sync status');
      }
      return await response.json();
    } catch (error) {
      console.error('[ACCOUNT] Error getting sync status:', error.message);
      return {
        success: false,
        enabled: false
      };
    }
  }

  /**
   * Subscribe to account events
   */
  on(event, callback) {
    this.listeners.push({ event, callback });
  }

  /**
   * Unsubscribe from account events
   */
  off(event, callback) {
    this.listeners = this.listeners.filter(
      listener => !(listener.event === event && listener.callback === callback)
    );
  }

  /**
   * Notify listeners of events
   */
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      if (listener.event === event) {
        listener.callback(data);
      }
    });
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated() {
    const status = await this.getStatus();
    return status.authenticated;
  }
}

// Create global instance
window.AccountClient = AccountClient;
window.accountClient = new AccountClient();






