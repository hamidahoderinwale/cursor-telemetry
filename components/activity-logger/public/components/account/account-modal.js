/**
 * Account Modal Component
 * UI for account login, registration, and management
 */

class AccountModal {
  constructor() {
    this.modal = null;
    this.currentView = 'status'; // status, login, register, settings
    // Use existing instance or create new one if AccountClient is available
    if (window.accountClient) {
      this.accountClient = window.accountClient;
    } else if (window.AccountClient && typeof window.AccountClient === 'function' && window.AccountClient.prototype && window.AccountClient.prototype.constructor) {
      try {
        this.accountClient = new window.AccountClient();
      } catch (e) {
        console.warn('[AccountModal] Failed to instantiate AccountClient:', e);
        this.accountClient = this._createFallbackClient();
      }
    } else {
      // Fallback: create a minimal mock if AccountClient is not available
      console.warn('[AccountModal] AccountClient not available, using fallback');
      this.accountClient = this._createFallbackClient();
    }
  }

  _createFallbackClient() {
    return {
      getStatus: async () => ({ loggedIn: false, error: 'AccountClient not loaded' }),
      login: async () => ({ success: false, error: 'AccountClient not loaded' }),
      register: async () => ({ success: false, error: 'AccountClient not loaded' }),
      logout: async () => ({ success: false, error: 'AccountClient not loaded' }),
      enableSync: async () => {},
      disableSync: async () => {},
      syncNow: async () => ({ success: false, error: 'AccountClient not loaded' }),
      on: () => {},
      off: () => {}
    };
  }

  /**
   * Show account modal
   */
  show(view = 'status') {
    this.currentView = view;
    this.render();
  }

  /**
   * Hide account modal
   */
  hide() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }

  /**
   * Render modal
   */
  async render() {
    // Remove existing modal
    this.hide();

    // Get account status
    const status = await this.accountClient.getStatus();

    // Create modal
    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay';
    this.modal.style.zIndex = '10000';
    this.modal.innerHTML = this.getModalHTML(status);

    document.body.appendChild(this.modal);

    // Setup event listeners
    this.setupEventListeners(status);
  }

  /**
   * Get modal HTML
   */
  getModalHTML(status) {
    if (this.currentView === 'login') {
      return this.getLoginHTML();
    } else if (this.currentView === 'register') {
      return this.getRegisterHTML();
    } else if (this.currentView === 'settings') {
      return this.getSettingsHTML(status);
    } else {
      return this.getStatusHTML(status);
    }
  }

  /**
   * Get status view HTML
   */
  getStatusHTML(status) {
    const isAuthenticated = status.authenticated;
    const account = status.account;
    const sync = status.sync;

    return `
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h2>Account</h2>
          <button class="modal-close" onclick="window.accountModal.hide()">&times;</button>
        </div>
        <div class="modal-body">
          ${isAuthenticated ? `
            <div style="margin-bottom: var(--space-lg);">
              <div style="display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-md);">
                <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--color-primary); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 20px;">
                  ${account.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style="font-weight: 600; color: var(--color-text);">${account.email}</div>
                  <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Account ID: ${account.account_id.substring(0, 8)}...</div>
                </div>
              </div>
            </div>

            <div style="margin-bottom: var(--space-lg); padding: var(--space-md); background: var(--color-bg-alt); border-radius: var(--radius-md);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-sm);">
                <span style="font-weight: 600; color: var(--color-text);">Cloud Sync</span>
                <span style="font-size: var(--text-sm); color: ${sync.enabled ? 'var(--color-success)' : 'var(--color-text-muted)'};">
                  ${sync.enabled ? ' Enabled' : 'Disabled'}
                </span>
              </div>
              ${sync.last_sync ? `
                <div style="font-size: var(--text-sm); color: var(--color-text-muted);">
                  Last sync: ${new Date(sync.last_sync).toLocaleString()}
                </div>
              ` : ''}
            </div>

            <div style="display: flex; gap: var(--space-sm);">
              <button class="btn btn-secondary" onclick="window.accountModal.show('settings')" style="flex: 1;">
                Settings
              </button>
              <button class="btn btn-primary" onclick="window.accountModal.handleLogout()" style="flex: 1;">
                Logout
              </button>
            </div>
          ` : `
            <div style="text-align: center; padding: var(--space-xl) 0;">
              <div style="font-size: 48px; margin-bottom: var(--space-md);"></div>
              <h3 style="margin-bottom: var(--space-sm);">No Account Connected</h3>
              <p style="color: var(--color-text-muted); margin-bottom: var(--space-lg); line-height: 1.6;">
                Connect your account to port your Cursor code easily across devices.<br>
                Sync your telemetry data, conversations, and access your dashboard from anywhere.
              </p>
              <div style="display: flex; gap: var(--space-sm);">
                <button class="btn btn-primary" onclick="window.accountModal.show('login')" style="flex: 1;">
                  Login
                </button>
                <button class="btn btn-secondary" onclick="window.accountModal.show('register')" style="flex: 1;">
                  Register
                </button>
              </div>
            </div>
          `}
        </div>
      </div>
    `;
  }

  /**
   * Get login view HTML
   */
  getLoginHTML() {
    return `
      <div class="modal-content" style="max-width: 400px;">
        <div class="modal-header">
          <h2>Login</h2>
          <button class="modal-close" onclick="window.accountModal.hide()">&times;</button>
        </div>
        <div class="modal-body">
          <form id="loginForm" onsubmit="window.accountModal.handleLogin(event)">
            <div style="margin-bottom: var(--space-md);">
              <label style="display: block; margin-bottom: var(--space-xs); font-weight: 600; color: var(--color-text);">
                Email
              </label>
              <input 
                type="email" 
                id="loginEmail" 
                required 
                style="width: 100%; padding: var(--space-sm); border: 1px solid var(--color-border); border-radius: var(--radius-sm);"
                placeholder="your@email.com"
              />
            </div>
            <div style="margin-bottom: var(--space-lg);">
              <label style="display: block; margin-bottom: var(--space-xs); font-weight: 600; color: var(--color-text);">
                Password
              </label>
              <input 
                type="password" 
                id="loginPassword" 
                required 
                style="width: 100%; padding: var(--space-sm); border: 1px solid var(--color-border); border-radius: var(--radius-sm);"
                placeholder="••••••••"
              />
            </div>
            <div id="loginError" style="display: none; padding: var(--space-sm); background: var(--color-error-bg); color: var(--color-error); border-radius: var(--radius-sm); margin-bottom: var(--space-md);"></div>
            <div style="display: flex; gap: var(--space-sm);">
              <button type="button" class="btn btn-secondary" onclick="window.accountModal.show('status')" style="flex: 1;">
                Cancel
              </button>
              <button type="submit" class="btn btn-primary" style="flex: 1;">
                Login
              </button>
            </div>
            <div style="text-align: center; margin-top: var(--space-md);">
              <a href="#" onclick="window.accountModal.show('register'); return false;" style="color: var(--color-primary); text-decoration: none; font-size: var(--text-sm);">
                Don't have an account? Register
              </a>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  /**
   * Get register view HTML
   */
  getRegisterHTML() {
    return `
      <div class="modal-content" style="max-width: 400px;">
        <div class="modal-header">
          <h2>Register</h2>
          <button class="modal-close" onclick="window.accountModal.hide()">&times;</button>
        </div>
        <div class="modal-body">
          <form id="registerForm" onsubmit="window.accountModal.handleRegister(event)">
            <div style="margin-bottom: var(--space-md);">
              <label style="display: block; margin-bottom: var(--space-xs); font-weight: 600; color: var(--color-text);">
                Email
              </label>
              <input 
                type="email" 
                id="registerEmail" 
                required 
                style="width: 100%; padding: var(--space-sm); border: 1px solid var(--color-border); border-radius: var(--radius-sm);"
                placeholder="your@email.com"
              />
            </div>
            <div style="margin-bottom: var(--space-md);">
              <label style="display: block; margin-bottom: var(--space-xs); font-weight: 600; color: var(--color-text);">
                Password
              </label>
              <input 
                type="password" 
                id="registerPassword" 
                required 
                minlength="8"
                style="width: 100%; padding: var(--space-sm); border: 1px solid var(--color-border); border-radius: var(--radius-sm);"
                placeholder="••••••••"
              />
            </div>
            <div style="margin-bottom: var(--space-md);">
              <label style="display: block; margin-bottom: var(--space-xs); font-weight: 600; color: var(--color-text);">
                Device Name (optional)
              </label>
              <input 
                type="text" 
                id="registerDeviceName" 
                style="width: 100%; padding: var(--space-sm); border: 1px solid var(--color-border); border-radius: var(--radius-sm);"
                placeholder="${navigator.userAgentData?.platform || 'My Device'}"
              />
            </div>
            <div id="registerError" style="display: none; padding: var(--space-sm); background: var(--color-error-bg); color: var(--color-error); border-radius: var(--radius-sm); margin-bottom: var(--space-md);"></div>
            <div style="display: flex; gap: var(--space-sm);">
              <button type="button" class="btn btn-secondary" onclick="window.accountModal.show('status')" style="flex: 1;">
                Cancel
              </button>
              <button type="submit" class="btn btn-primary" style="flex: 1;">
                Register
              </button>
            </div>
            <div style="text-align: center; margin-top: var(--space-md);">
              <a href="#" onclick="window.accountModal.show('login'); return false;" style="color: var(--color-primary); text-decoration: none; font-size: var(--text-sm);">
                Already have an account? Login
              </a>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  /**
   * Get settings view HTML
   */
  getSettingsHTML(status) {
    const sync = status.sync;

    return `
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h2>Account Settings</h2>
          <button class="modal-close" onclick="window.accountModal.hide()">&times;</button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom: var(--space-lg);">
            <h3 style="margin-bottom: var(--space-md);">Cloud Sync</h3>
            <div style="padding: var(--space-md); background: var(--color-bg-alt); border-radius: var(--radius-md); margin-bottom: var(--space-md);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-sm);">
                <span style="color: var(--color-text);">Sync Status</span>
                <span style="font-size: var(--text-sm); color: ${sync.enabled ? 'var(--color-success)' : 'var(--color-text-muted)'};">
                  ${sync.enabled ? ' Enabled' : 'Disabled'}
                </span>
              </div>
              ${sync.last_sync ? `
                <div style="font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-sm);">
                  Last sync: ${new Date(sync.last_sync).toLocaleString()}
                </div>
              ` : ''}
              <div style="display: flex; gap: var(--space-sm);">
                <button 
                  class="btn ${sync.enabled ? 'btn-secondary' : 'btn-primary'}" 
                  onclick="window.accountModal.toggleSync()"
                  style="flex: 1;"
                >
                  ${sync.enabled ? 'Disable Sync' : 'Enable Sync'}
                </button>
                ${sync.enabled ? `
                  <button 
                    class="btn btn-secondary" 
                    onclick="window.accountModal.syncNow()"
                    style="flex: 1;"
                  >
                    Sync Now
                  </button>
                ` : ''}
              </div>
            </div>
          </div>

          <div style="display: flex; gap: var(--space-sm);">
            <button class="btn btn-secondary" onclick="window.accountModal.show('status')" style="flex: 1;">
              Back
            </button>
            <button class="btn btn-primary" onclick="window.accountModal.handleLogout()" style="flex: 1;">
              Logout
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners(status) {
    // Close on overlay click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal) {
        this.hide();
      }
    });
  }

  /**
   * Handle login
   */
  async handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    errorDiv.style.display = 'none';
    errorDiv.textContent = '';

    try {
      const result = await this.accountClient.login(email, password);
      
      if (result.success) {
        this.show('status');
        this.showNotification('Login successful!', 'success');
      } else {
        errorDiv.textContent = result.error || 'Login failed';
        errorDiv.style.display = 'block';
      }
    } catch (error) {
      errorDiv.textContent = error.message || 'An error occurred';
      errorDiv.style.display = 'block';
    }
  }

  /**
   * Handle register
   */
  async handleRegister(event) {
    event.preventDefault();
    
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const deviceName = document.getElementById('registerDeviceName').value;
    const errorDiv = document.getElementById('registerError');

    errorDiv.style.display = 'none';
    errorDiv.textContent = '';

    try {
      const result = await this.accountClient.register(email, password, deviceName);
      
      if (result.success) {
        this.show('status');
        this.showNotification('Registration successful!', 'success');
      } else {
        errorDiv.textContent = result.error || 'Registration failed';
        errorDiv.style.display = 'block';
      }
    } catch (error) {
      errorDiv.textContent = error.message || 'An error occurred';
      errorDiv.style.display = 'block';
    }
  }

  /**
   * Handle logout
   */
  async handleLogout() {
    try {
      const result = await this.accountClient.logout();
      
      if (result.success) {
        this.show('status');
        this.showNotification('Logged out successfully', 'success');
      }
    } catch (error) {
      this.showNotification('Logout failed: ' + error.message, 'error');
    }
  }

  /**
   * Toggle sync
   */
  async toggleSync() {
    const status = await this.accountClient.getStatus();
    
    try {
      if (status.sync.enabled) {
        await this.accountClient.disableSync();
        this.showNotification('Cloud sync disabled', 'info');
      } else {
        await this.accountClient.enableSync();
        this.showNotification('Cloud sync enabled', 'success');
      }
      this.show('settings');
    } catch (error) {
      this.showNotification('Failed to toggle sync: ' + error.message, 'error');
    }
  }

  /**
   * Sync now
   */
  async syncNow() {
    try {
      this.showNotification('Syncing...', 'info');
      const result = await this.accountClient.syncNow();
      
      if (result.success) {
        this.showNotification('Sync complete!', 'success');
        this.show('settings');
      } else {
        this.showNotification('Sync failed: ' + (result.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      this.showNotification('Sync error: ' + error.message, 'error');
    }
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    // Use existing notification system if available
    if (window.showNotification) {
      window.showNotification(message, type);
    } else {
      alert(message);
    }
  }
}

// Create global instance
window.AccountModal = AccountModal;
window.accountModal = new AccountModal();


