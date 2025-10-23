# Cursor Activity Dashboard

A comprehensive, real-time dashboard for monitoring Cursor IDE activity, AI interactions, and development metrics.

## Features

- **Activity Timeline**: Real-time file changes, AI prompts, and code modifications
- **Analytics**: Context usage tracking, prompt analysis, and productivity metrics
- **File Relationship Graph**: TF-IDF semantic analysis and file co-occurrence visualization
- **System Monitoring**: Memory, CPU, and IDE state tracking
- **Persistent Storage**: IndexedDB-based local storage with historical data retention
- **AI Context Tracking**: Monitor AI model usage and context window utilization

## Quick Start

### Prerequisites

1. The Cursor telemetry companion service must be running
2. Modern web browser with JavaScript enabled

### Running the Dashboard

1. Start the companion service:
   ```bash
   cd ../components/activity-logger/companion
   npm install
   npm start
   ```

2. Open the dashboard:
   ```
   http://localhost:43917/dashboard/
   ```

## Architecture

### Core Files

- **`index.html`**: Main dashboard structure and layout
- **`dashboard.js`**: Core functionality, views, charts, and interactions
- **`dashboard.css`**: Modern design system with dark theme
- **`persistent-storage.js`**: IndexedDB wrapper for local data persistence
- **`analytics-aggregator.js`**: Time-series aggregation and metrics computation
- **`data-synchronizer.js`**: Orchestrates data loading from Cursor DB and companion service

### Data Sources

1. **Cursor Internal Databases** (Historical):
   - `state.vscdb`: Workspace-specific AI conversations and composer data
   - `workspace.json`: Workspace metadata and paths
   - Extracted fields: prompts, context usage %, model modes, lines changed

2. **Companion Service** (Real-time):
   - File system monitoring via Chokidar
   - Git status and commit tracking
   - System resource monitoring (memory, CPU, load)
   - IDE state capture via AppleScript (macOS)
   - SQLite persistence for file contents and events

## Key Metrics Tracked

### Header Stats
- **Active Sessions**: Unique development sessions
- **File Changes**: Total file modification events
- **AI Interactions**: Composer sessions + direct AI prompts
- **Code Changed**: Aggregate lines/characters modified
- **Avg Context Used**: Average AI context window utilization

### Analytics Page

#### Context Usage Over Time
- Real-time tracking of AI context window utilization
- Dual-axis chart showing character count and context percentage
- Data sourced from Cursor's `contextUsagePercent` field

#### AI Activity & Code Output
- Prompt frequency and code generation volume
- Lines added/removed per interaction

#### Continuous Activity Timeline
- Granular activity view (1-min to daily intervals)
- Auto-scaling based on data span

#### File Changes by Type
- Language distribution of modified files

#### Recent Activity (15-min intervals)
- Last 12 hours of development activity

### File Graph Page

#### Semantic Analysis
- **TF-IDF**: Term frequency-inverse document frequency for code similarity
- **Co-occurrence**: Files modified together
- **Temporal Proximity**: Files changed around the same time

#### Visualization Controls
- **Layout**: Force-directed, circular, radial
- **Node Size**: By change count, file size, or recency
- **Overlay**: AI prompts, activity heat
- **Threshold**: Similarity filtering (0.0 - 1.0)
- **File Type Filter**: Multi-select by extension

#### Embeddings Visualization
- 2D/3D prompt embeddings using PCA, t-SNE, or MDS
- Color-coded by timestamp (older = purple, newer = yellow/green)
- Top terms and phrases extraction

## Data Flow

```
Cursor IDE
    ├── state.vscdb (Workspace DB)
    │   └── composer.composerData (AI sessions)
    │       ├── contextUsagePercent
    │       ├── totalLinesAdded/Removed
    │       ├── unifiedMode (agent/chat/edit)
    │       └── timestamps
    │
    └── File Changes
        └── Chokidar Watcher
            └── Companion Service
                ├── SQLite (persistent-db.js)
                │   ├── events table
                │   ├── entries table
                │   └── file contents
                │
                └── HTTP API (:43917)
                    ├── /api/activity
                    ├── /api/workspaces
                    ├── /api/prompts
                    ├── /api/cursor-database
                    ├── /api/file-contents
                    └── /raw-data/*

Dashboard (Browser)
    ├── IndexedDB (persistent-storage.js)
    │   ├── events store
    │   ├── prompts store
    │   ├── analytics store
    │   └── timeSeries store
    │
    └── Data Synchronizer
        ├── Initial: Load from IndexedDB (instant display)
        ├── Background: Fetch from companion service
        └── Periodic: Sync every 30s
```

## API Reference

### Companion Service Endpoints

- `GET /api/activity` - Historical file change events
- `GET /api/workspaces` - All detected workspaces with metadata
- `GET /api/prompts` - AI prompts from Cursor database
- `GET /api/cursor-database` - Raw Cursor database conversations
- `GET /api/file-contents` - Full file contents for TF-IDF analysis
- `GET /raw-data/system-resources` - Memory, CPU, load average
- `GET /raw-data/git` - Git status, branch, commits
- `GET /ide-state` - Current editor state (tabs, file, position)

## Context Tracking Implementation

### What's Tracked

1. **Context Usage Percentage**: Extracted from Cursor's `contextUsagePercent` field
   - Shows how much of the AI model's context window is utilized
   - Displayed in timeline badges, modals, and analytics charts

2. **Model Information**: Mode type (Agent/Chat/Edit) and auto-detection
   - Agent mode = Auto-completion
   - Chat mode = Direct conversation
   - Edit mode = Inline code editing

### What's NOT Available

- **Actual Token Counts**: Cursor doesn't store raw token counts in local databases
- **Token Cost**: Billing information is handled server-side
- **Context Window Size**: Model-specific limits aren't exposed

The dashboard shows **character count** as a proxy metric with clear labeling.

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Requires:
- ES6+ JavaScript support
- IndexedDB API
- Fetch API
- Chart.js 4.x
- D3.js v7

## Development

### Adding New Metrics

1. Add data collection in companion service (`companion/src/index.js`)
2. Update API endpoint or add new route
3. Modify `dashboard.js` to fetch and process data
4. Create visualization function (use Chart.js or D3.js)
5. Add to appropriate view (Overview, Analytics, File Graph)

### Modifying the Design

All styles are in `dashboard.css` with CSS custom properties:
```css
:root {
  --color-bg: #0f0f0f;
  --color-text: #e5e7eb;
  --color-primary: #6366f1;
  /* ... */
}
```

## Troubleshooting

### Dashboard shows "Connecting..."
- Ensure companion service is running on port 43917
- Check browser console for errors
- Verify firewall isn't blocking localhost connections

### No AI Interactions showing
- Cursor must have active composer sessions
- Check that `state.vscdb` exists in workspace storage
- Verify workspace detection in companion service logs

### Context usage shows 0%
- Context data only available for composer sessions
- Older conversations may not have this field
- Try creating a new AI conversation in Cursor

### File Graph shows 0 files
- Companion service needs time to index files
- Make some file changes to trigger indexing
- Check `/api/file-contents` endpoint directly

## License

Part of the Cursor Telemetry project.
