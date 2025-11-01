# Cursor Activity Dashboard

A modern, intuitive dashboard for monitoring and visualizing all your Cursor IDE activity data with a fully modular, refactored architecture.

## Features

- **Real-time Statistics** - Live counts of sessions, entries, events, and code changes
- **Smart Filtering** - Filter by source (filewatcher, clipboard, DOM, MCP) or type
- **Code Change Visualization** - Side-by-side before/after code diffs
- **Content Display** - Full prompts, responses, and notes with syntax highlighting
- **Auto-refresh** - Automatically polls companion service for new data
- **Modular Architecture** - Clean separation of HTML templates, view logic, and utilities
- **🐛 Debug Tools** - Built-in debugging and connection testing

## Quick Start

### Option 1: Using the rebuild-run-open script (Recommended)
```bash
cd cursor-telemetry/components/activity-logger
./rebuild-run-open.sh
```

### Option 2: Manual Start

1. **Start the Companion Service** (if not already running):
   ```bash
   cd companion
   npm start
   ```

2. **Start the Dashboard**:
   ```bash
   cd public
   python3 -m http.server 8080
   ```

3. **Open the Dashboard**:
   - Go to `http://localhost:8080/dashboard.html`
   - The dashboard will automatically open in your browser

## Architecture Overview

The dashboard uses a **modular, refactored architecture** with clear separation of concerns:

### 🏗️ Project Structure

```
public/
├── dashboard.html              # Main HTML entry point
├── new-dashboard.js            # Main dashboard logic (legacy functions preserved)
├── new-dashboard.css           # Main stylesheet
│
├── core/                       # Core application modules
│   ├── config.js              # Configuration management
│   ├── state.js               # Application state management
│   ├── api-client.js          # API communication
│   ├── view-router.js         # View routing and navigation
│   └── websocket-manager.js   # WebSocket connections
│
├── views/                      # View modules (one per dashboard view)
│   ├── overview/
│   │   ├── index.js           # View rendering logic
│   │   ├── helpers.js         # HTML template helpers
│   │   └── styles.css         # View-specific styles
│   │
│   ├── activity/
│   │   ├── index.js           # Activity view logic
│   │   ├── timeline-helpers.js # Timeline rendering templates
│   │   └── styles.css
│   │
│   ├── threads/
│   │   ├── index.js           # Threads view logic
│   │   ├── helpers.js         # Thread/prompt templates
│   │   └── styles.css
│   │
│   ├── analytics/
│   │   ├── index.js           # Analytics view logic
│   │   ├── chart-helpers.js   # Chart rendering helpers
│   │   └── styles.css
│   │
│   ├── file-graph/
│   │   ├── index.js           # File graph view logic
│   │   ├── templates.js       # HTML templates
│   │   └── styles.css
│   │
│   ├── navigator/
│   │   ├── index.js           # Navigator view logic
│   │   ├── templates.js       # HTML templates
│   │   └── styles.css
│   │
│   ├── system/
│   │   ├── index.js           # System view logic
│   │   ├── templates.js       # HTML templates
│   │   └── styles.css
│   │
│   └── api-docs/
│       ├── index.js           # API docs view logic
│       └── templates.js       # HTML templates
│
├── utils/                      # Shared utility modules
│   ├── helpers.js             # General utilities (escapeHtml, truncate, etc.)
│   ├── file-helpers.js        # File path utilities
│   ├── math-helpers.js        # Mathematical utilities
│   ├── data-helpers.js        # Data processing utilities
│   ├── time-formatting.js     # Time formatting (formatTimeAgo)
│   ├── event-helpers.js       # Event processing (getEventTitle, getEventDescription)
│   ├── temporal-threading.js  # Temporal grouping logic
│   └── templates.js           # Reusable HTML template utilities
│
├── services/                   # Service modules
│   ├── data/
│   │   ├── persistent-storage.js  # IndexedDB storage
│   │   └── data-synchronizer.js   # Data sync logic
│   ├── analytics/
│   │   ├── analytics-manager.js
│   │   ├── analytics-aggregator.js
│   │   └── prompt-analytics-engine.js
│   └── search/
│       ├── search-engine.js
│       └── semantic-analysis-engine.js
│
├── components/                 # Reusable UI components
│   ├── charts/                # Chart components
│   ├── modals/                # Modal dialogs
│   └── ...
│
└── visualizations/            # Complex visualizations
    ├── file-graph-visualizer.js
    └── time-series-visualizer.js
```

## Architecture Principles

### 🔹 Separation of Concerns

1. **HTML Templates** → Separate template files (`templates.js`, `helpers.js`)
   - All HTML markup is in dedicated template modules
   - Templates export functions that return HTML strings
   - No HTML embedded directly in view logic files

2. **View Logic** → View `index.js` files
   - Contains only rendering orchestration
   - Calls template functions to generate HTML
   - Handles initialization and lifecycle

3. **Business Logic** → Utility modules
   - Pure functions for data processing
   - Reusable across multiple views
   - No HTML or DOM manipulation

### 🔹 Module Loading Order

The `dashboard.html` loads modules in a specific order:

1. **Core utilities** (no dependencies)
   - `utils/helpers.js`
   - `utils/time-formatting.js`
   - `utils/event-helpers.js`
   - `utils/temporal-threading.js`

2. **View helpers** (may depend on utilities)
   - `views/activity/timeline-helpers.js`
   - `views/overview/helpers.js`
   - `views/threads/helpers.js`

3. **View templates** (may depend on helpers)
   - `views/*/templates.js` files

4. **View logic** (depends on templates/helpers)
   - `views/*/index.js` files

5. **View router** (depends on all views)
   - `core/view-router.js`

### 🔹 Function Exports

All functions are exported to `window` for global access:

```javascript
// Template functions
window.renderFileGraphViewTemplate = renderFileGraphViewTemplate;
window.renderSystemStatus = renderSystemStatus;

// View functions
window.renderOverviewView = renderOverviewView;
window.renderActivityView = renderActivityView;

// Utility functions
window.formatTimeAgo = formatTimeAgo;
window.getEventTitle = getEventTitle;
```

## Dashboard Interface

### View Navigation

The dashboard includes multiple specialized views:

- **Overview** - Summary statistics, recent activity, system status
- **Activity** - Unified timeline of events, prompts, and terminal commands
- **Threads** - Conversation threads and captured prompts
- **Analytics** - Charts and statistics for productivity insights
- **File Graph** - Semantic file relationship visualization
- **Navigator** - UMAP-based codebase navigation
- **System** - System resource monitoring
- **API Docs** - Complete API documentation

### Key Features

- **Alternating Timeline Layout** - Events on left, prompts on right
- **Temporal Threading** - Groups related activities by time windows
- **Conversation Threading** - Groups AI prompts by conversation ID
- **Real-time Updates** - WebSocket connections for live data
- **Persistent Storage** - IndexedDB caching for fast startup

## Development

### Adding a New View

1. Create view directory: `public/views/my-view/`
2. Create template file: `templates.js` (or `helpers.js` for smaller views)
3. Create view logic: `index.js`
4. Export functions to `window`
5. Add script tags to `dashboard.html` (in correct order)
6. Register view in `core/view-router.js`

### Modifying Templates

Templates are in dedicated files:
- Large views: `views/{view-name}/templates.js`
- Helper components: `views/{view-name}/helpers.js`

### Adding Utilities

1. Add utility function to appropriate `utils/*.js` file
2. Export to `window` for global access
3. Load script in `dashboard.html` before dependent modules

## Data Sources

The dashboard connects to the companion service (port 43917) and displays:

1. **File Changes** - Complete before/after code with file paths
2. **AI Prompts** - Prompts from Cursor's database with conversation metadata
3. **Terminal Commands** - Command history with exit codes
4. **System Events** - Logging and status events
5. **Context Snapshots** - Context window usage analytics

## 🔄 Auto-refresh

The dashboard automatically:
- Polls the companion service every 2 seconds
- Updates statistics in real-time
- Refreshes views when new data arrives
- Maintains connection status indicators
- Uses IndexedDB for persistent caching

## 🐛 Troubleshooting

### No Data Showing
1. Check companion service is running on port 43917
2. Click "Test Connection" to verify connectivity
3. Check browser console for errors
4. Verify module loading order in Network tab

### Template Functions Not Found
1. Check `dashboard.html` loads all required template files
2. Verify function exports with `window.{functionName}` in console
3. Check script loading order (templates before views)

### View Not Rendering
1. Check `core/view-router.js` registers the view
2. Verify view function exported to `window`
3. Check browser console for JavaScript errors

## 📦 Dependencies

### Core Libraries
- **Chart.js** - Chart rendering
- **D3.js** - Graph visualizations
- **UMAP.js** - Dimensionality reduction
- **Lunr.js** - Full-text search

### Browser APIs
- **IndexedDB** - Persistent storage
- **WebSocket** - Real-time updates
- **Service Worker** - Caching and offline support

## Next Steps

The dashboard is now ready to use! It will automatically display all your Cursor activity data in a beautiful, modern interface. The modular architecture makes it easy to extend and maintain.

### Refactoring Status

✅ **Completed:**
- All HTML templates extracted to separate modules
- View logic separated from templates
- Utility functions organized into dedicated modules
- Proper module loading order established
- All functions exported and accessible

🔄 **In Progress:**
- Legacy functions in `new-dashboard.js` preserved for compatibility
- Gradually migrating remaining inline HTML to templates

Enjoy monitoring your Cursor activity!
