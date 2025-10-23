# Cursor Activity Dashboard

A modern, real-time dashboard for monitoring Cursor IDE activity, AI interactions, code changes, and development analytics.

## Features

- **Real-time Activity Feed**: Track file changes, AI interactions, and prompts
- **Analytics**: View trends over time for code changes, AI usage, and system resources
- **File Relationship Graph**: Visualize semantic connections between files using TF-IDF analysis
- **Persistent Storage**: IndexedDB-based local storage for historical data
- **Workspace Management**: Track activity across multiple workspaces
- **System Monitoring**: Monitor memory, CPU, and git status

## Files

- `index.html` - Main dashboard HTML
- `dashboard.css` - Styles and design system
- `dashboard.js` - Core dashboard logic and UI rendering
- `persistent-storage.js` - IndexedDB wrapper for local data persistence
- `analytics-aggregator.js` - Analytics computation and aggregation
- `data-synchronizer.js` - Data sync orchestration between Cursor databases and companion service

## Requirements

- Companion service running on `http://localhost:43917`
- Modern web browser with ES6+ support
- IndexedDB support for persistent storage

## Usage

### Local Development

Simply open `index.html` in a web browser, or serve via the companion service:

```bash
# The companion service automatically serves the dashboard
cd ../components/activity-logger/companion
npm start
```

Then navigate to: `http://localhost:43917/new-dashboard.html`

### Standalone

You can also serve this dashboard independently:

```bash
# Using Python
python -m http.server 8080

# Using Node.js (with http-server)
npx http-server -p 8080
```

Then navigate to: `http://localhost:8080/index.html`

## Configuration

The dashboard connects to the companion service at `http://localhost:43917` by default. To change this, modify the `CONFIG` object in `dashboard.js`:

```javascript
const CONFIG = {
  API_BASE: 'http://localhost:43917',
  WS_URL: 'ws://localhost:43917',
  REFRESH_INTERVAL: 30000
};
```

## Data Sources

The dashboard pulls data from:

1. **Companion Service APIs**:
   - `/api/activity` - File changes and events
   - `/api/workspaces` - Workspace information
   - `/api/ide-state` - Current IDE state
   - `/raw-data/system-resources` - System metrics
   - `/raw-data/git` - Git status
   - `/api/cursor-database` - Cursor database extracts

2. **Cursor Databases** (via companion service):
   - `state.vscdb` - Global state and conversations
   - `workspace.vscdb` - Workspace-specific data
   - Composer sessions and AI interactions

3. **Local IndexedDB**:
   - Historical events
   - Cached prompts
   - Analytics data
   - Time series metrics

## Views

### Overview
- Quick stats and recent activity
- Activity timeline with both events and prompts
- Workspace switcher

### Activity
- Unified timeline of all events and AI interactions
- Filterable by workspace, type, and time
- Click any item to see detailed information

### Analytics
- Continuous activity timeline (auto-scaling granularity)
- Recent activity by 15-minute intervals
- AI activity & code output over time
- Git status tracking
- System resource monitoring

### File Graph
- Interactive force-directed graph
- TF-IDF-based semantic similarity
- File type filtering
- Adjustable similarity threshold
- Detailed file information on click

### System
- Real-time system metrics (Memory, CPU, Load)
- Git repository status
- Editor state (open tabs, current file)

### Workspace
- List of all workspaces
- Activity stats per workspace
- Quick navigation

## Architecture

```
┌─────────────────┐
│   index.html    │
│  (Dashboard UI) │
└────────┬────────┘
         │
         ├──────────────┬──────────────┬──────────────┐
         │              │              │              │
    ┌────▼─────┐   ┌───▼────┐   ┌────▼─────┐   ┌────▼─────┐
    │dashboard │   │persist │   │analytics │   │data-sync │
    │   .js    │◄──┤storage │◄──┤aggregator│◄──┤   .js    │
    │          │   │  .js   │   │   .js    │   │          │
    └──────────┘   └───┬────┘   └──────────┘   └────┬─────┘
                       │                             │
                   ┌───▼─────┐                  ┌────▼─────────┐
                   │IndexedDB│                  │  Companion   │
                   │(Browser)│                  │   Service    │
                   └─────────┘                  │  (Backend)   │
                                                └──────────────┘
```

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Opera: ✅ Full support

## Privacy

All data is stored locally in your browser's IndexedDB. No data is sent to external servers. The dashboard only communicates with the local companion service running on your machine.

## License

Part of the Cursor Telemetry project.

