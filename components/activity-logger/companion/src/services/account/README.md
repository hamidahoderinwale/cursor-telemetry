# Account Integration Service

Account integration system for Cursor Telemetry, enabling cloud sync, multi-device access, and Netlify deployment support.

## Architecture

```
┌─────────────────────────────────────────┐
│  Dashboard (Netlify/Local)              │
│  • Account Client (frontend)            │
│  • Account Modal UI                     │
└──────────┬──────────────────────────────┘
           │
           ↓ (HTTPS)
┌─────────────────────────────────────────┐
│  Account Service (Cloud)                │
│  • Authentication                       │
│  • Data storage                         │
│  • Device management                    │
└──────────┬──────────────────────────────┘
           │
           ↓ (HTTPS, encrypted)
┌─────────────────────────────────────────┐
│  Local Companion Service                │
│  • Account Service (backend)            │
│  • Cloud Sync Service                   │
│  • Reads Cursor DB                      │
│  • Syncs to cloud                       │
└─────────────────────────────────────────┘
```

## Components

### Backend Services

#### `account-service.js`
Handles user authentication, account management, and device registration.

**Features:**
- User registration and login
- Token management (access/refresh tokens)
- Device ID generation and tracking
- Local account mode (offline support)
- Account status and authentication checks

**Usage:**
```javascript
const AccountService = require('./services/account/account-service');
const accountService = new AccountService(persistentDB, {
  accountServiceUrl: 'https://api.cursor-telemetry.com',
  localMode: false
});

// Register user
await accountService.register(email, password, deviceName);

// Login
await accountService.authenticate(email, password);

// Get account
const account = await accountService.getAccount();

// Check authentication
const isAuth = await accountService.isAuthenticated();
```

#### `cloud-sync-service.js`
Handles syncing local data to/from cloud account service.

**Features:**
- Automatic periodic sync (configurable interval)
- Manual sync trigger
- Incremental sync (only new data)
- Data encryption (AES-256-GCM)
- Conflict resolution
- Sync status tracking

**Usage:**
```javascript
const CloudSyncService = require('./services/account/cloud-sync-service');
const cloudSync = new CloudSyncService(accountService, persistentDB, {
  syncInterval: 5 * 60 * 1000, // 5 minutes
  encryptionEnabled: true
});

// Start automatic sync
await cloudSync.start();

// Manual sync
await cloudSync.syncToCloud();
await cloudSync.syncFromCloud();

// Get sync status
const status = await cloudSync.getSyncStatus();
```

### Frontend Services

#### `account-client.js`
Frontend service for account management and authentication.

**Features:**
- Account status checking
- Login/registration
- Sync management
- Event listeners for account changes

**Usage:**
```javascript
const accountClient = window.accountClient;

// Get status
const status = await accountClient.getStatus();

// Login
await accountClient.login(email, password);

// Register
await accountClient.register(email, password, deviceName);

// Enable/disable sync
await accountClient.enableSync();
await accountClient.disableSync();

// Manual sync
await accountClient.syncNow('both'); // 'up', 'down', or 'both'
```

#### `account-modal.js`
UI component for account management.

**Features:**
- Account status display
- Login/registration forms
- Settings management
- Sync controls

**Usage:**
```javascript
const accountModal = window.accountModal;

// Show account modal
accountModal.show('status'); // 'status', 'login', 'register', 'settings'

// Hide modal
accountModal.hide();
```

## API Endpoints

### Account Management

- `GET /api/account/status` - Get current account status
- `POST /api/account/register` - Register new account
- `POST /api/account/login` - Login to account
- `POST /api/account/logout` - Logout from account

### Cloud Sync

- `GET /api/account/sync/status` - Get sync status
- `POST /api/account/sync/enable` - Enable cloud sync
- `POST /api/account/sync/disable` - Disable cloud sync
- `POST /api/account/sync/now` - Trigger manual sync

## Configuration

### Environment Variables

```bash
# Account service URL (cloud backend)
ACCOUNT_SERVICE_URL=https://api.cursor-telemetry.com

# Local mode (offline account support)
ACCOUNT_LOCAL_MODE=false

# Encryption salt (for data encryption)
ENCRYPTION_SALT=your-secret-salt-here
```

### Frontend Configuration

The dashboard automatically detects deployment environment:

- **Local**: Uses `http://localhost:43917` (companion service)
- **Netlify with account**: Uses account service URL
- **Netlify without account**: Falls back to Render backend

Users can override via localStorage:
```javascript
localStorage.setItem('COMPANION_API_URL', 'http://localhost:43917');
localStorage.setItem('ACCOUNT_SERVICE_URL', 'https://api.cursor-telemetry.com');
localStorage.setItem('ACCOUNT_TOKEN', 'your-token');
```

## Data Flow

### Sync to Cloud

1. Local companion service collects data from Cursor DB
2. Cloud sync service exports data since last sync
3. Data is encrypted (if enabled)
4. Uploaded to account service via HTTPS
5. Last sync timestamp updated

### Sync from Cloud

1. Account service provides data since last sync
2. Data is downloaded via HTTPS
3. Data is decrypted (if encrypted)
4. Imported to local database
5. Conflicts resolved (local wins by default)

## Security

- **Encryption**: AES-256-GCM encryption for sensitive data
- **Token Management**: Access tokens with refresh token support
- **HTTPS Only**: All cloud communication over HTTPS
- **Local Storage**: Tokens stored securely in SQLite database
- **Device Tracking**: Unique device IDs for multi-device support

## Privacy

- **Opt-in Sync**: Users must explicitly enable cloud sync
- **Local-first**: Data stays local by default
- **Encrypted Sync**: All synced data is encrypted
- **User Control**: Users can disable sync at any time
- **Data Retention**: Follows account service retention policies

## Deployment

### Netlify Deployment

1. Deploy dashboard to Netlify
2. Users create accounts via dashboard
3. Local companion service syncs to cloud
4. Dashboard reads from account service

### Local Development

1. Run companion service locally
2. Dashboard connects to localhost
3. Account features work in local mode
4. No cloud sync required

## Future Enhancements

- [ ] OAuth integration (if Cursor adds API)
- [ ] Team/workspace sharing
- [ ] Real-time sync via WebSocket
- [ ] Advanced conflict resolution
- [ ] Data export/import via account
- [ ] Multi-device device management UI






