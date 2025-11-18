/**
 * Account Routes
 * API endpoints for account management and cloud sync
 */

const AccountService = require('../services/account/account-service');
const CloudSyncService = require('../services/account/cloud-sync-service');

function setupAccountRoutes(app, persistentDB, options = {}) {
  // Initialize services
  const accountService = new AccountService(persistentDB, options);
  const cloudSyncService = new CloudSyncService(accountService, persistentDB, options);
  
  // Return account service instance for use by other services
  // This allows sharing service to access account info

  // Start cloud sync if account is configured
  accountService.getAccount().then(account => {
    if (account && account.sync_enabled) {
      cloudSyncService.start().catch(error => {
        console.error('[ACCOUNT] Failed to start cloud sync:', error.message);
      });
    }
  });

  /**
   * GET /api/account/status
   * Get current account status
   */
  app.get('/api/account/status', async (req, res) => {
    try {
      const account = await accountService.getAccount();
      
      // Try to get sync status, but don't fail if it errors
      let syncStatus = {
        enabled: false,
        authenticated: account !== null,
        last_sync: null,
        sync_in_progress: false,
        account_email: account?.email || null
      };
      
      try {
        syncStatus = await cloudSyncService.getSyncStatus();
      } catch (syncError) {
        console.warn('[ACCOUNT] Error getting sync status:', syncError.message);
        // Use default sync status if getSyncStatus fails
      }

      res.json({
        success: true,
        authenticated: account !== null,
        account: account ? {
          account_id: account.account_id,
          email: account.email,
          sync_enabled: account.sync_enabled
        } : null,
        sync: syncStatus
      });
    } catch (error) {
      console.error('[ACCOUNT] Error getting account status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/account/register
   * Register new account
   */
  app.post('/api/account/register', async (req, res) => {
    try {
      const { email, password, device_name } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        });
      }

      const result = await accountService.register(email, password, device_name);

      // Start cloud sync if not in local mode
      if (result.success && !result.local_mode) {
        await cloudSyncService.start();
      }

      res.json({
        success: true,
        account: {
          account_id: result.account_id,
          email: result.email
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/account/login
   * Login to account
   */
  app.post('/api/account/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        });
      }

      const result = await accountService.authenticate(email, password);

      // Start cloud sync if not in local mode
      if (result.success && !result.local_mode) {
        await cloudSyncService.start();
      }

      res.json({
        success: true,
        account: {
          account_id: result.account_id,
          email: result.email
        }
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/account/logout
   * Logout from account
   */
  app.post('/api/account/logout', async (req, res) => {
    try {
      cloudSyncService.stop();
      await accountService.logout();

      res.json({
        success: true
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/account/sync/enable
   * Enable cloud sync
   */
  app.post('/api/account/sync/enable', async (req, res) => {
    try {
      const account = await accountService.getAccount();
      if (!account) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
      }

      // Update sync enabled in database
      await persistentDB.run(
        'UPDATE accounts SET sync_enabled = 1 WHERE account_id = ?',
        [account.account_id]
      );

      // Start sync service
      await cloudSyncService.start();

      res.json({
        success: true
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/account/sync/disable
   * Disable cloud sync
   */
  app.post('/api/account/sync/disable', async (req, res) => {
    try {
      cloudSyncService.stop();

      const account = await accountService.getAccount();
      if (account) {
        await persistentDB.run(
          'UPDATE accounts SET sync_enabled = 0 WHERE account_id = ?',
          [account.account_id]
        );
      }

      res.json({
        success: true
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/account/sync/now
   * Trigger manual sync
   */
  app.post('/api/account/sync/now', async (req, res) => {
    try {
      const account = await accountService.getAccount();
      if (!account) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
      }

      const { direction = 'both' } = req.body;

      let result = {};

      if (direction === 'up' || direction === 'both') {
        result.upload = await cloudSyncService.syncToCloud();
      }

      if (direction === 'down' || direction === 'both') {
        result.download = await cloudSyncService.syncFromCloud();
      }

      res.json({
        success: true,
        sync: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/account/sync/status
   * Get sync status
   */
  app.get('/api/account/sync/status', async (req, res) => {
    try {
      const status = await cloudSyncService.getSyncStatus();
      res.json({
        success: true,
        ...status
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  console.log('[ROUTES] Account routes initialized');
  
  // Return account service for use by other services
  return accountService;
}

module.exports = setupAccountRoutes;


