# Cursor Activity Dashboard

A comprehensive, real-time dashboard for monitoring Cursor IDE activity, AI interactions, and development metrics.

![Dashboard Screenshot](images/dashboard-analytics.png)

## Features

- **Activity Timeline**: Real-time file changes, AI prompts, and code modifications
- **Analytics**: Context usage tracking, prompt analysis, and productivity metrics
- **AI Usage Tracking**: Interface usage (Agent/Composer/CMD+K/Chat) and model distribution
- **File Relationship Graph**: TF-IDF semantic analysis and file co-occurrence visualization
- **System Monitoring**: Memory, CPU, and IDE state tracking
- **Persistent Storage**: IndexedDB-based local storage with historical data retention
- **Search Engine**: Full-text, semantic, and fuzzy search across all telemetry data

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

#### AI Usage: Interface & Model Distribution
**Three View Modes** (toggle with radio buttons):

1. **By Interface** - How you interact with AI:
   - 🟣 Agent (Autonomous) - AI working independently
   - 🟠 Composer - Main composition panel
   - 🟢 Tab (CMD+K) - Quick autocomplete/suggestions
   - 🔵 Chat Panel - Traditional chat interface

2. **By Model** - Which AI models are used:
   - 🟠 Claude Sonnet 4.5 (Anthropic)
   - 🟠 Claude Opus (Anthropic)
   - 🟠 Claude Haiku (Anthropic)
   - 🟢 GPT-4 (OpenAI)
   - 🟢 GPT-3.5 (OpenAI)
   - Note: Tab completions excluded (not full model-based)

3. **Combined View** - Both dimensions together:
   - Shows entries like "Claude Sonnet 4.5 (agent)"
   - Tab completions shown as "Tab Completion (CMD+K)"
   - Full context of model + interface usage

**Generalization**: 
- Automatically tracks any new models
- Dynamic color assignment for unknown models
- Normalizes known model variants
- Ready for multi-provider scenarios

### File Graph Page

#### Hierarchical Organization
- **Workspace Grouping**: Files colored by workspace/project
- **Real Filenames**: Git object hashes filtered out (no more `803662867720fa6f...`)
- **Directory Structure**: Shows folder hierarchy
- **Visual Clustering**: Files from same workspace naturally group together

#### Color Coding by Workspace
- 🔵 Indigo - Workspace 1
- 🟣 Purple - Workspace 2  
- 🔴 Pink - Workspace 3
- 🟠 Orange - Workspace 4
- 🟢 Green - Workspace 5
- 🔵 Blue - Workspace 6
- 🟦 Teal - Workspace 7
- 🔴 Rose - Workspace 8
- **Legend** displayed on graph showing workspace → color mapping

#### Semantic Analysis
- **TF-IDF**: Term frequency-inverse document frequency for code similarity
- **Co-occurrence**: Files modified together in same sessions
- **Temporal Proximity**: Files changed around the same time
- **Session-based Similarity**: Jaccard similarity on shared sessions

#### Visualization Controls
- **Layout**: Force-directed (with workspace clustering)
- **Node Size**: By change count
- **File Type Filter**: Multi-select dropdown by extension
- **Threshold**: Similarity filtering (0.0 - 1.0)

#### File Information Modal
When clicking a node, displays:
- Workspace badge (color-coded)
- Directory path (folder structure)
- File name (bold, highlighted)
- File type, total changes, last modified
- Recent events (last 10 modifications)

#### Embeddings Visualization
- **AI Prompt Analysis** (not files - composer conversations excluded)
- 2D/3D embeddings using PCA, t-SNE, or MDS
- Color-coded by timestamp (older = purple, newer = yellow/green)
- **Top Terms & Phrases** extraction with occurrence counts
- Prompts analyzed: Filters out JSON and conversation names
- Shows actual prompt content relationships

### Search Engine

**Keyboard Shortcut**: `CMD+K` or `⌘K` to open search palette

#### Search Modes
- **Full-text**: Lunr.js inverted index for fast text search
- **Semantic**: TF-IDF cosine similarity for related content
- **Fuzzy**: Levenshtein distance for typo tolerance
- **Faceted**: Filter by type, workspace, date, mode

#### Faceted Filters
- `type:prompt` - Only AI prompts
- `type:event` - Only file change events
- `workspace:name` - Specific workspace
- `date:today` - Today's activity
- `date:week` - Last 7 days
- `mode:agent` - Agent interactions only

#### Features
- Real-time results as you type (debounced)
- Keyboard navigation (↑/↓ arrows, Enter to select)
- Search history tracking
- Suggested searches and filters
- Multi-modal search (combines full-text + semantic)
- Click results to view details in modal

## Backend Architecture (Companion Service)

The companion service is a Node.js application that runs alongside Cursor to capture telemetry data.

### Core Components

#### 1. **Main Service** (`index.js`)
- Express.js HTTP server (port 43917)
- WebSocket support via Socket.IO
- REST API endpoints for data access
- In-memory database with SQLite persistence
- Session management and workspace detection
- File watching orchestration

**Key APIs**:
- `GET /api/activity` - File change events with diffs
- `GET /api/workspaces` - All detected workspaces
- `GET /api/prompts` - AI prompts from Cursor DB
- `GET /api/cursor-database` - Raw conversation data
- `GET /api/file-contents` - Full file contents for TF-IDF
- `GET /raw-data/system-resources` - Memory, CPU metrics
- `GET /raw-data/git` - Git status and commits
- `GET /ide-state` - Current editor state

#### 2. **Cursor Database Parser** (`cursor-db-parser.js`) ⭐ NEW
**Purpose**: Extract AI conversations and prompts from Cursor's internal SQLite databases

**Features**:
- Queries `state.vscdb` files in workspace storage
- Extracts composer sessions with metadata:
  - Conversation titles and timestamps
  - Lines added/removed per session
  - Context usage percentage
  - AI mode (agent/chat/edit)
  - Model information inference
- Resolves workspace IDs to actual folder paths
- Parses `workspace.json` for friendly names
- Monitors global and workspace-specific databases
- 10-second update interval

**Data Extracted**:
```javascript
{
  text: "Conversation title",
  workspaceId: "62376d09",
  workspacePath: "/Users/username/project",
  workspaceName: "my-project",
  composerId: "uuid",
  timestamp: 1234567890,
  contextUsage: 74.3,
  mode: "agent",
  modelName: "claude-4.5-sonnet",  // Inferred
  linesAdded: 150,
  linesRemoved: 20
}
```

#### 3. **Persistent Database** (`persistent-db.js`) ⭐ NEW
**Purpose**: SQLite persistence for companion service data

**Tables**:
- `entries` - File change records with before/after code
- `events` - Activity events with metadata
- `prompts` - Captured AI prompts and responses

**Features**:
- Automatic table creation
- CRUD operations for all data types
- Stores full file contents for TF-IDF analysis
- Survives service restarts
- Statistics queries
- Transaction support

**Database Schema**:
```sql
CREATE TABLE entries (
  id INTEGER PRIMARY KEY,
  session_id TEXT,
  workspace_path TEXT,
  file_path TEXT,
  before_code TEXT,
  after_code TEXT,
  timestamp TEXT
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  type TEXT,
  details TEXT,
  timestamp TEXT
);

CREATE TABLE prompts (
  id INTEGER PRIMARY KEY,
  text TEXT,
  workspace_id TEXT,
  timestamp TEXT,
  mode TEXT,
  model_name TEXT
);
```

#### 4. **IDE State Capture** (`ide-state-capture.js`)
**Purpose**: Capture current Cursor editor state via AppleScript

**Capabilities**:
- Active window title parsing
- Open tabs detection
- Current file and cursor position
- Language mode detection
- Editor settings from `settings.json`

**AppleScript Integration**:
```applescript
tell application "System Events" to tell process "Cursor"
  set windowTitle to name of window 1
  return windowTitle
end tell
```

**Limitations**: macOS only, requires accessibility permissions

#### 5. **File Watcher** (`fileWatcher.js`)
**Purpose**: Real-time file system monitoring

**Technology**: Chokidar
- Watches workspace directories
- Ignores patterns from config
- Debouncing (300ms stabilization)
- Captures file content before/after changes
- Calculates diffs (lines/chars added/removed)

#### 6. **Diff Engine** (`diffEngine.js`)
**Purpose**: Calculate code differences

**Features**:
- Line-by-line diff computation
- Character-level changes
- Before/after content capture
- Statistics generation (lines added/removed)

#### 7. **Queue System** (`queue.js`)
**Purpose**: Event queuing and processing

**Features**:
- In-memory event queue
- Pending prompts tracking
- Event acknowledgment
- WebSocket broadcasting

#### 8. **Clipboard Monitor** (`clipboardMonitor.js`)
**Purpose**: Capture AI prompts from clipboard

**Features**:
- 10-second polling interval
- Prompt pattern detection
- Duplicate filtering
- 30-second minimum interval between captures

#### 9. **Prompt Capture System** (`prompt-capture-system.js`)
**Purpose**: Multi-method prompt capture

**Methods**:
- Clipboard monitoring
- File system watching
- MCP (Model Context Protocol) integration
- Manual capture endpoint

### Data Flow

```
File System Changes
    ↓
Chokidar Watcher → Diff Engine → Queue → SQLite
                                    ↓
                                WebSocket → Dashboard

Cursor Database (state.vscdb)
    ↓
SQLite Queries → Parser → Workspace Resolution → Queue
                                                    ↓
                                                Dashboard

System Resources
    ↓
Node.js os module → Periodic Collection (2s) → HTTP API
                                                  ↓
                                            Dashboard

AppleScript (macOS)
    ↓
IDE State Capture → Periodic Polling (2s) → HTTP API
                                               ↓
                                         Dashboard
```

### Recent Backend Additions

1. **`cursor-db-parser.js`** - Complete Cursor database mining
2. **`persistent-db.js`** - SQLite persistence layer
3. **Model name inference** - Maps AI modes to models
4. **Enhanced diff calculation** - Full before/after content
5. **Workspace resolution** - ID → path → friendly name
6. **File contents API** - `/api/file-contents` for TF-IDF
7. **Context usage tracking** - Extracts `contextUsagePercent`
8. **Session-based similarity** - Tracks co-modified files

### Configuration

**File**: `config.json`
```json
{
  "workspace_roots": ["/path/to/projects"],
  "auto_detect_workspaces": true,
  "ignore": ["node_modules", ".git"],
  "enable_clipboard": true,
  "port": 43917
}
```

### Dependencies

- `express` - HTTP server
- `socket.io` - WebSocket support
- `chokidar` - File watching
- `sqlite3` - Database persistence
- `lunr` - Search indexing
- `cors` - CORS support

## Data Capture Techniques

This project employs multiple sophisticated data capture methods to provide comprehensive telemetry without requiring Cursor modifications:

### 1. **Cursor Database Mining**
**Location**: `~/Library/Application Support/Cursor/User/workspaceStorage/*/state.vscdb`

**Technique**: Direct SQLite query of Cursor's internal databases

**Data Captured**:
- AI Composer sessions (`composer.composerData`)
  - Conversation titles and timestamps
  - Lines added/removed per session
  - Context usage percentage (`contextUsagePercent`)
  - AI mode (agent/chat/edit)
  - Force mode settings
- Workspace metadata (`workspace.json`)
  - Workspace paths and friendly names
  - Last modified times
  - Project identifiers

**Implementation**: `cursor-db-parser.js` uses `sqlite3` to query `.vscdb` files and `JSON.parse()` to extract structured data from `valueBlob` columns.

**Challenges**:
- No explicit model names stored (inferred from mode)
- Conversation messages are ephemeral (not persisted)
- Database can be locked during Cursor operation

### 2. **File System Monitoring**
**Technique**: Real-time file watching with Chokidar

**Data Captured**:
- File creation, modification, deletion events
- Full file paths and extensions
- Timestamps with millisecond precision
- File content snapshots (before/after)
- Diff statistics (lines/chars added/removed)

**Implementation**: 
```javascript
chokidar.watch(paths, {
  ignored: config.ignore,
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilizationThreshold: 300,
    pollInterval: 100
  }
})
```

**Advantages**:
- Captures all file changes regardless of editor
- Works with any workspace structure
- Minimal performance impact

### 3. **Git Repository Analysis**
**Technique**: Periodic `git status` command execution via child_process

**Data Captured**:
- Current branch name
- Modified/staged/unstaged files count
- Uncommitted changes
- Repository state

**Implementation**:
```javascript
const { stdout } = await execAsync('git status --porcelain', { cwd });
const files = stdout.trim().split('\n').filter(Boolean);
```

**Update Frequency**: Every 5 seconds

### 4. **System Resource Monitoring**
**Technique**: Node.js `os` module and process metrics

**Data Captured**:
- Memory usage (RSS, heap used/total)
- CPU load average (1/5/15 min)
- System uptime
- Free/total memory
- Platform information

**Implementation**:
```javascript
{
  memory: process.memoryUsage(),
  system: {
    loadAverage: os.loadavg(),
    freeMem: os.freemem(),
    totalMem: os.totalmem(),
    uptime: os.uptime()
  },
  timestamp: Date.now()
}
```

**Update Frequency**: Every 2 seconds

### 5. **IDE State Capture (macOS)**
**Technique**: AppleScript automation via `osascript`

**Data Captured**:
- Active window title (contains filename + workspace)
- Open tabs (parsed from window title)
- Current file and position
- Language mode (derived from file extension)
- Editor settings (from `settings.json`)

**Implementation**:
```applescript
tell application "System Events" to tell process "Cursor"
  set windowTitle to name of window 1
  return windowTitle
end tell
```

**Parsing Logic**: Extracts filename and workspace from title format: `filename — workspace_name`

**Limitations**: macOS-specific, requires accessibility permissions

### 6. **Model Name Inference**
**Technique**: Mode-to-model mapping based on Cursor defaults

**Data Captured**:
- AI interface type (Agent/Composer/Chat/Edit)
- Inferred model name (Claude Sonnet 4.5, GPT-4, etc.)
- Auto-mode detection

**Implementation**:
```javascript
let modelName = 'unknown';
if (isAuto || mode === 'agent') {
  modelName = 'claude-4.5-sonnet';  // Default for Agent
} else if (mode === 'chat') {
  modelName = 'claude-4.5-sonnet';  // Default for Chat
}
```

**Note**: Cursor doesn't persist actual model names, so we infer from mode and allow manual override

### 7. **Persistent Storage Strategy**

**Companion Service** (Backend):
- SQLite database (`persistent-db.js`)
- Tables: `events`, `entries`, `prompts`
- Stores full file contents for TF-IDF analysis
- Survives service restarts

**Dashboard** (Frontend):
- IndexedDB (`persistent-storage.js`)
- Stores: events, prompts, analytics, timeSeries
- Enables instant dashboard load
- Background sync with companion service

### 8. **Workspace Detection**
**Technique**: Multi-source workspace identification

**Sources**:
1. Configuration file (`workspace_roots`)
2. Auto-detection (`.git` directories)
3. Strong indicator files (`.cursor`, `package.json`, `Cargo.toml`)
4. Cursor database workspace storage directories
5. File watcher active paths

**Deduplication**: Combines all sources and resolves to canonical paths with friendly names

### 9. **Search & Indexing**
**Technique**: Lunr.js full-text search + custom semantic analysis

**Indexed Data**:
- File paths and content
- AI prompts and responses
- Event descriptions
- Workspace names
- Timestamps (as searchable text)

**Search Modes**:
- Full-text: Lunr.js inverted index
- Semantic: TF-IDF cosine similarity
- Fuzzy: Levenshtein distance
- Faceted: Type, workspace, date filters

### 10. **Embeddings & Semantic Analysis**
**Technique**: TF-IDF vectorization + dimensionality reduction

**Process**:
1. Tokenize code/prompts (remove stopwords, punctuation)
2. Build term frequency matrix
3. Compute inverse document frequency
4. Create TF-IDF vectors
5. Apply PCA/t-SNE/MDS for visualization
6. Compute cosine similarity for relationships

**Applications**:
- File relationship graphs
- Prompt similarity detection
- Code cluster visualization
- Top terms/phrases extraction

## Data Flow

```
Cursor IDE
    ├── state.vscdb (Workspace DB) ──────────────┐
    │   └── composer.composerData                │ SQLite Queries
    │       ├── contextUsagePercent              │
    │       ├── totalLinesAdded/Removed          │
    │       ├── unifiedMode (agent/chat/edit)    │
    │       └── timestamps                        │
    │                                             │
    ├── workspace.json ──────────────────────────┤
    │   ├── folder paths                         │
    │   └── workspace IDs                        │
    │                                             │
    └── File System                               │
        ├── *.js, *.ts, *.py, etc. ──────────────┤
        └── .git/ (status) ──────────────────────┤
                                                  │
                                                  ↓
                                    Companion Service (Node.js)
                                           ├── Chokidar (file watching)
                                           ├── cursor-db-parser.js (SQLite)
                                           ├── ide-state-capture.js (AppleScript)
                                           ├── os module (system metrics)
                                           ├── child_process (git commands)
                                           │
                                           ├── SQLite (persistent-db.js)
                                           │   ├── events table
                                           │   ├── entries table
                                           │   ├── prompts table
                                           │   └── file contents (full text)
                                           │
                                           └── HTTP API (:43917)
                                               ├── /api/activity
                                               ├── /api/workspaces
                                               ├── /api/prompts
                                               ├── /api/cursor-database
                                               ├── /api/file-contents
                                               ├── /raw-data/system-resources
                                               ├── /raw-data/git
                                               └── /ide-state

Dashboard (Browser)
    ├── IndexedDB (persistent-storage.js)
    │   ├── events store (file changes)
    │   ├── prompts store (AI interactions)
    │   ├── analytics store (aggregated metrics)
    │   └── timeSeries store (historical data)
    │
    ├── Data Synchronizer (data-synchronizer.js)
    │   ├── Initial: Load from IndexedDB (instant)
    │   ├── Background: Fetch from companion API
    │   └── Periodic: Sync every 30s
    │
    ├── Analytics Aggregator (analytics-aggregator.js)
    │   ├── Time-series buckets (minute/hour/day)
    │   ├── Compute statistics
    │   └── Update IndexedDB
    │
    ├── Search Engine (search-engine.js)
    │   ├── Lunr.js index
    │   ├── TF-IDF vectors
    │   └── Query parser
    │
    └── Visualizations
        ├── Chart.js (time series)
        ├── D3.js (force graphs)
        └── Custom canvas rendering
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
