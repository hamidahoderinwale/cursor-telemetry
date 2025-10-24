# Cursor Telemetry Dashboard

A comprehensive real-time monitoring and analytics platform for Cursor IDE. It automatically tracks file changes, mines AI prompts from Cursor's internal database, system resources, and file relationships. All data is persisted in SQLite with a real-time web dashboard, with search, and an API (with 50+ endpoints) to build on top of.

### Key Features

- **Real-Time Monitoring**: Track file changes, AI prompts, and system metrics live
- **Cursor DB Mining**: Extract AI conversations directly from Cursor's internal database
- **Advanced Analytics**: Context window usage, error tracking, productivity insights
- **Multi-Layer Search**: Full-text (Lunr.js) + Semantic (TF-IDF) + Fuzzy matching
- **File Relationships**: Co-change patterns, dependency graphs, hotspot detection
- **SQLite Persistence**: Durable storage with 13 indexes and foreign key constraints
- **Comprehensive API**: 50+ REST endpoints + WebSocket real-time updates
- **Export Capability**: Download complete database snapshots as JSON
- **Interactive Dashboard**: 7 views with Chart.js and D3.js visualizations

## Dashboard Preview

### Overview Page
The Overview page provides real-time statistics and activity monitoring at a glance.

![Dashboard Overview](images/dashboard-overview.png)

**Features shown:**
- Active sessions and file change counters
- AI interactions and code changed metrics
- Recent activity timeline with file modifications
- System status (memory, CPU, load average)
- Workspace list with entry and event counts

### Analytics Page
The Analytics page displays comprehensive insights into AI activity, code output, and productivity metrics.

![Dashboard Analytics](images/dashboard-analytics.png)

**Features shown:**
- AI Activity & Code Output correlation graph
- Prompt frequency tracking over time
- Code output volume (KB) visualization
- Modified files over time tracking
- Git repository activity monitoring

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Cursor Telemetry Dashboard                       │
├─────────────────────────────────────────────────────────────────────┤
│  Frontend Dashboard (Vanilla JS)                                   │
│  ├── Real-time Visualizations (Chart.js, D3.js)                   │
│  ├── Multi-layer Search Engine (Lunr.js + TF-IDF Semantic)        │
│  ├── Activity Timeline & File Graph Views                          │
│  ├── Enhanced Analytics Dashboard (Context, Errors, Productivity)  │
│  ├── API Documentation View                                        │
│  ├── Status Popup (Console Monitoring)                             │
│  └── Export JSON (Database Snapshots)                              │
├─────────────────────────────────────────────────────────────────────┤
│  Companion Service (Port 43917) - Node.js/Express                  │
│  ├── HTTP REST API (50+ endpoints)                                │
│  │   ├── Core: /api/activity, /entries, /health                   │
│  │   ├── Database: /api/database/stats, /api/export/database     │
│  │   ├── Analytics: /api/analytics/context, errors, productivity  │
│  │   └── Raw Data: /ide-state, /raw-data/system-resources        │
│  ├── WebSocket Server (Socket.IO for real-time updates)           │
│  ├── SQLite Database (companion.db)                               │
│  │   ├── entries: File changes with before/after code             │
│  │   ├── prompts: AI interactions with rich metadata              │
│  │   └── events: Activity timeline                                │
│  ├── Cursor Database Mining                                        │
│  │   ├── Parser: Extracts from state.vscdb every 10s             │
│  │   ├── Metadata: Lines added/removed, context usage, AI mode   │
│  │   └── Linking: Auto-links prompts to code changes (5min window)│
│  ├── Analytics Engines                                             │
│  │   ├── Context Analyzer: @ mentions, token estimation           │
│  │   ├── Error Tracker: Linter, tests, terminal errors            │
│  │   └── Productivity Tracker: Time-to-edit, iterations, churn   │
│  ├── Data Capture Systems                                          │
│  │   ├── File Watcher (Chokidar): Monitors workspace changes      │
│  │   ├── Clipboard Monitor: Captures prompts from clipboard       │
│  │   ├── AppleScript: IDE state capture (macOS)                   │
│  │   ├── Git Monitor: Commits, branches, activity                 │
│  │   └── System Resources: CPU, memory, load metrics              │
│  └── Integration Points                                            │
│      ├── MCP Server: Model Context Protocol endpoints             │
│      └── Screenshot Monitor: Browser screenshot tracking          │
├─────────────────────────────────────────────────────────────────────┤
│  Data Storage Layer                                                │
│  ├── SQLite Database (companion.db) - Primary storage             │
│  │   ├── Size: ~121MB (typical), 5-10MB/hour growth              │
│  │   ├── Foreign Keys: Enabled for referential integrity          │
│  │   ├── Indexes: 13 indexes for query optimization               │
│  │   └── Validation: Integrity checks, orphan detection           │
│  ├── In-Memory Cache (db object)                                  │
│  │   ├── Fast access for real-time operations                     │
│  │   └── Synchronized with SQLite                                 │
│  └── IndexedDB (Browser - Optional)                               │
│      └── Persistent caching for dashboard offline capability      │
├─────────────────────────────────────────────────────────────────────┤
│  Search & Discovery Engine                                         │
│  ├── Full-Text Search (Lunr.js)                                   │
│  │   ├── Inverted index for fast lookups                          │
│  │   └── Supports advanced queries (type:, date:, workspace:)     │
│  ├── Semantic Search (TF-IDF + Cosine Similarity)                 │
│  │   ├── Document vectorization                                   │
│  │   ├── Context-aware matching                                   │
│  │   └── Auto-activates when full-text scores low                 │
│  ├── Fuzzy Search (Levenshtein Distance)                          │
│  │   ├── Typo tolerance                                           │
│  │   └── Fallback for edge cases                                  │
│  └── Advanced Features                                             │
│      ├── Search history & suggestions                             │
│      ├── Result ranking & scoring                                 │
│      └── Filter support (workspace, type, date range)             │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Activity Capture** (Multiple Sources)
   - **File System**: Chokidar monitors workspace → detects changes → calculates diffs
   - **Cursor Database**: Parser queries state.vscdb every 10s → extracts prompts with metadata
   - **Clipboard**: Monitors every 10s → captures potential prompts
   - **System**: AppleScript captures IDE state every 2s → Git/system metrics collected
   - **Screenshots**: Watches browser screenshot directory for web dev captures

2. **Data Processing & Enrichment**
   - **Prompt Enhancement**: Extract @ mentions, estimate tokens, analyze context usage
   - **Code Analysis**: Calculate before/after diffs, detect patterns, extract metadata
   - **Linking Logic**: Match prompts to code changes within 5-minute window
   - **Analytics Computation**: Context metrics, error detection, productivity tracking

3. **Persistent Storage** (Dual-layer)
   - **In-Memory DB**: Fast access for real-time operations
   - **SQLite DB**: Durable storage with automatic persistence
   - **Synchronization**: Write-through cache pattern ensures consistency

4. **API Serving** (50+ Endpoints)
   - **REST API**: HTTP endpoints for all data access
   - **WebSocket**: Real-time push notifications via Socket.IO
   - **Static Serving**: Dashboard HTML/CSS/JS from Express

5. **Dashboard Rendering**
   - **Data Fetch**: HTTP polling every 5s + WebSocket updates
   - **Search Indexing**: Builds Lunr index + TF-IDF vectors on data load
   - **Visualization**: Chart.js for metrics, D3.js for graphs
   - **State Management**: Global state object with view routing

6. **Search & Discovery**
   - **Query Parsing**: Extract filters and search terms
   - **Multi-method Search**: Lunr → Semantic → Fuzzy (cascading)
   - **Result Aggregation**: Merge results, rank by score + recency
   - **Real-time Updates**: Re-index on data refresh

## Tech Stack

### Frontend (Vanilla JavaScript)
- **Chart.js**: Time-series and metric visualizations
- **D3.js**: Interactive graphs and network visualizations
- **Lunr.js**: Full-text search indexing
- **Socket.IO Client**: Real-time WebSocket communication
- **HTML5/CSS3**: Modern responsive UI with CSS variables
- **IndexedDB**: Optional client-side persistent caching

### Backend (Node.js Companion Service)
- **Express.js**: HTTP server and REST API framework
- **Socket.IO**: Real-time bidirectional WebSocket communication
- **SQLite3**: Primary relational database (`companion.db`)
  - 3 core tables (entries, prompts, events)
  - 13 performance indexes
  - Foreign key constraints enabled
- **Chokidar**: File system monitoring with diff detection
- **Clipboardy**: Cross-platform clipboard access

### Data Mining & Analytics
- **Cursor Database Parser**: Direct SQLite extraction from `state.vscdb`
- **Context Analyzer**: @ mention extraction, token estimation, file co-occurrence
- **Error Tracker**: Linter/test/terminal error aggregation
- **Productivity Tracker**: Time-to-edit, iteration detection, code churn analysis
- **Semantic Search**: TF-IDF vectorization with cosine similarity

### System Integration
- **AppleScript**: macOS IDE state capture (windows, files, cursor position)
- **MCP (Model Context Protocol)**: Standardized AI interaction logging
- **Git Integration**: Commit, branch, and activity monitoring
- **System Metrics**: CPU, memory, load average tracking

## Quick Start

### Prerequisites
- Node.js 16+ 
- macOS (for AppleScript integration - optional for full features)
- Cursor IDE

### Installation & Setup

1. **Clone the repository**:
```bash
git clone https://github.com/hamidahoderinwale/cursor-telemetry.git
cd cursor-telemetry
```

2. **Install dependencies**:
```bash
cd components/activity-logger/companion
npm install
```

3. **Start the companion service**:
```bash
node src/index.js
```

The companion service will:
- Start HTTP server on `http://localhost:43917`
- Initialize SQLite database at `companion/data/companion.db`
- Begin monitoring your workspace directories
- Start Cursor database mining (extracts prompts every 10s)
- Enable clipboard monitoring (optional, configurable)

4. **Access the dashboard**:
```bash
open http://localhost:43917/new-dashboard.html
```

**Dashboard Views:**
- **Overview** - Real-time activity stats and recent changes
- **Activity** - Timeline of all code changes and AI interactions  
- **Analytics** - Context usage, errors, productivity metrics, file relationships
- **File Graph** - Interactive visualization of file dependencies and co-changes
- **Navigator** - Explore workspace structure and file tree
- **System** - Resource usage (CPU/memory/load) and IDE state
- **API Docs** - Complete API reference (50+ endpoints) with examples

### Development Setup

**Configure monitoring** (edit `config.json`):
```json
{
  "workspace_roots": ["/path/to/your/projects"],
  "auto_detect_workspaces": true,
  "ignore": ["node_modules", ".git", "dist"],
  "enable_clipboard": true,
  "port": 43917
}
```

The service automatically monitors:
- File system changes (via Chokidar)
- Cursor database (`~/Library/Application Support/Cursor/User/workspaceStorage/*/state.vscdb`)
- Clipboard (when enabled)
- IDE state (via AppleScript on macOS)
- System resources (CPU, memory, load)
- Git activity (commits, branches)

## Memory System

The Cursor Telemetry Dashboard includes a comprehensive memory system powered by the **PKL Extension** - an intelligent workflow capture and execution engine that transforms your coding sessions into reusable, executable memories.

### What are Memories?

Memories are executable artifacts that capture the complete context of a development session, including:
- **Code files and changes** made during the session
- **Analysis results** from cell stage classification
- **Context information** like file paths, timestamps, and metadata
- **Executable commands** that can recreate the development environment
- **Quality metrics** based on V-measure completeness scoring
- **PKL Facet Analysis** with data science workflow classification

### Memory Types

#### 1. Session Memories
Created from individual development sessions, containing:
- Complete session context and state
- All code changes and file modifications
- Analysis results and insights
- Executable commands to recreate the session

#### 2. Workflow Memories
Template memories for common development patterns:
- Data analysis workflows
- Model training pipelines
- Visualization creation patterns
- Debugging procedures

#### 3. Integration Memories
Memories that integrate with external tools:
- Cursor IDE session files (`.cursor-session`)
- Jupyter notebook generation
- File system operations
- API integrations

### Cell-Stage Classification

Automatically classifies notebook cells into 12 data science stages:
- `import` - Loading libraries and dependencies
- `data_loading` - Reading datasets and external data
- `data_preprocessing` - Cleaning and transforming data
- `exploratory_analysis` - Initial data exploration (EDA)
- `statistical_analysis` - Statistical tests and correlations
- `machine_learning` - Model training and validation
- `visualization` - Creating charts and plots
- `model_evaluation` - Performance metrics and validation
- `deployment` - Production code and APIs
- `testing` - Unit tests and validation
- `utility` - Helper functions and tools
- `configuration` - Settings and parameters

### Memory Management

#### Creating Memories
```bash
# Create memory from a session with PKL features
curl -X POST http://localhost:3000/api/session/{sessionId}/create-memory \
  -H "Content-Type: application/json" \
  -d '{
    "category": "analysis",
    "type": "workflow",
    "tags": ["data-science", "visualization"],
    "includeMemories": true,
    "includeASTAnalysis": true,
    "includeKuraAnalysis": true,
    "pklFeatures": true
  }'
```

#### Executing Memories
```bash
# Execute a stored memory
curl -X POST http://localhost:3000/api/memories/{memoryId}/execute \
  -H "Content-Type: application/json" \
  -d '{
    "context": {
      "targetDirectory": "/path/to/workspace",
      "parameters": {
        "datasetPath": "/data/sample.csv"
      }
    }
  }'
```

#### Memory Commands (Chat Interface)
- `@memory create from session {sessionId}` - Create memory from session
- `@memory search {query}` - Search memories
- `@memory execute {memoryId}` - Execute a memory
- `@memory list` - List all memories
- `@memory stats` - Show memory statistics
- `@memory export` - Export all memories
- `@memory delete {memoryId}` - Delete a memory

### Memory Quality Metrics

- **Completeness Score (0-1)**: How complete the memory capture is
- **V-Measure Score (0-1)**: Clustering quality and homogeneity
- **File Coverage**: Percentage of relevant files captured
- **Analysis Depth**: Level of analysis performed
- **Execution Success Rate**: How often the memory executes successfully

## API Reference

> **Interactive Documentation**: For complete API reference with examples, request/response formats, and live testing, visit:
> ```
> http://localhost:43917/new-dashboard.html#api-docs
> ```

### Companion Service API (Port 43917)

The companion service exposes 50+ REST endpoints organized into these categories:

#### Core Data Endpoints
- `GET /api/data` - Complete dataset (entries, prompts, events)
- `GET /api/entries` - File change history with before/after code
- `GET /api/prompts` - AI prompts with rich metadata (16 fields)
- `GET /api/events` - Activity timeline
- `GET /api/conversations` - AI conversation threads

#### Database & Export
- `GET /api/database/stats` - Database statistics with integrity checks
- `GET /api/database/entries-with-prompts` - Entries with linked prompts (JOIN)
- `GET /api/database/prompts-with-entries` - Prompts with linked entries (JOIN)
- `GET /api/export/database` - Export complete database as JSON snapshot

#### Context Window Analytics
- `GET /api/analytics/context` - Context usage statistics
- `GET /api/analytics/context/snapshots` - Historical context snapshots
- `GET /api/analytics/context/timeline` - Context usage over time
- `GET /api/analytics/context/file-relationships` - File co-occurrence patterns

#### Error & Bug Tracking
- `GET /api/analytics/errors` - Error statistics by type
- `GET /api/analytics/errors/recent` - Recent errors with details

#### Productivity Insights
- `GET /api/analytics/productivity` - Comprehensive productivity metrics
  - Time-to-first-edit after prompt
  - Active vs waiting time
  - Prompt iteration counts
  - Code churn rates
  - Debug activity frequency

#### File Relationships
- `GET /api/analytics/file-relationships` - File co-change patterns
- `GET /api/file-graph` - File dependency graph data

#### Search & Query
- `GET /api/search?q={query}` - Multi-layer search (Lunr + TF-IDF + fuzzy)
- `GET /api/entries/search?query={q}` - Search file changes
- `GET /api/entries/by-file?path={path}` - Get entries for specific file
- `GET /api/entries/range?start={t1}&end={t2}` - Time-range query

#### System & Health
- `GET /health` - Service health and uptime
- `GET /stats` - Activity statistics
- `GET /config` - Current configuration
- `POST /config` - Update configuration
- `GET /queue` - Event queue status
- `DELETE /queue` - Clear event queue

#### Monitoring Controls
- `POST /clipboard` - Enable/disable clipboard monitoring
- `POST /file-monitoring` - Enable/disable file watching
- `GET /system/state` - IDE state (via AppleScript)
- `GET /system/metrics` - CPU, memory, load average

### WebSocket Real-Time Updates

The companion service maintains WebSocket connections on `ws://localhost:43917` for real-time dashboard updates.

#### Server → Client Events
- `data-update` - New file changes, prompts, or events
- `file-changed` - File modification with diff
- `prompt-captured` - New AI prompt from Cursor DB
- `system-metrics` - Updated CPU/memory/load
- `stats-update` - Refreshed statistics

Real-time updates ensure the dashboard reflects changes within 1-2 seconds of occurrence.

## API Usage Examples

### Fetching Data

```bash
# Get all activity data
curl http://localhost:43917/api/data

# Search across all content
curl "http://localhost:43917/api/search?q=authentication"

# Get productivity metrics
curl http://localhost:43917/api/analytics/productivity

# Export database snapshot
curl http://localhost:43917/api/export/database > backup-$(date +%Y%m%d).json
```

### JavaScript Fetch

```javascript
// Fetch recent file changes
const entries = await fetch('http://localhost:43917/api/entries')
  .then(r => r.json());

// Search prompts
const results = await fetch('http://localhost:43917/api/search?q=bug fix')
  .then(r => r.json());

// Get context analytics
const context = await fetch('http://localhost:43917/api/analytics/context')
  .then(r => r.json());
```

### WebSocket Integration

```javascript
const ws = new WebSocket('ws://localhost:43917');

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Real-time update:', update.type, update.data);
};

ws.send(JSON.stringify({ type: 'subscribe', channel: 'file-changes' }));
```

## Configuration

### config.json Settings

Located at `components/activity-logger/companion/config.json`:

```json
{
  "workspace_roots": [
    "/Users/you/projects",
    "/Users/you/workspace"
  ],
  "auto_detect_workspaces": true,
  "port": 43917,
  "enable_clipboard": true,
  "enable_screenshots": true,
  "ignore": [
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    "__pycache__"
  ],
  "cursor_db_poll_interval": 10000,
  "max_file_size_mb": 5,
  "db_path": "./data/companion.db"
}
```

### Key Configuration Options

- **workspace_roots**: Directories to monitor for file changes
- **auto_detect_workspaces**: Automatically discover Cursor workspaces
- **port**: HTTP server port (default: 43917)
- **enable_clipboard**: Capture clipboard content (requires permission)
- **enable_screenshots**: Capture browser screenshots when available
- **cursor_db_poll_interval**: Cursor DB polling frequency (ms)
- **ignore**: File patterns to exclude from monitoring

## Project Structure

```
cursor-telemetry/
├── components/
│   └── activity-logger/                # Companion Service & Dashboard
│       ├── companion/                  # Backend Service (Port 43917)
│       │   ├── src/
│       │   │   ├── index.js           # Main server & orchestration
│       │   │   ├── persistent-db.js   # SQLite database layer
│       │   │   ├── file-watcher.js    # File system monitoring
│       │   │   ├── cursor-db-parser.js # Cursor DB mining
│       │   │   ├── context-analyzer.js # Context window analytics
│       │   │   ├── error-tracker.js   # Error & bug tracking
│       │   │   ├── productivity-tracker.js # Productivity insights
│       │   │   ├── clipboard-monitor.js # Clipboard capture
│       │   │   └── ...               # Other modules
│       │   ├── data/
│       │   │   └── companion.db      # SQLite database
│       │   ├── config.json           # Configuration
│       │   └── package.json
│       └── public/                   # Frontend Dashboard
│           ├── new-dashboard.html    # Main dashboard UI
│           ├── new-dashboard.js      # Dashboard logic
│           ├── new-dashboard.css     # Dashboard styles
│           ├── search-engine.js      # Multi-layer search
│           ├── data-synchronizer.js  # Data fetching & caching
│           ├── analytics-aggregator.js # Metrics computation
│           ├── persistent-storage.js # Frontend persistence
│           └── components/           # Reusable UI components
├── sdk/                             # Client SDKs
│   ├── javascript/                  # TypeScript/JavaScript SDK
│   └── python/                      # Python SDK
├── api/
│   ├── openapi.yaml                # API specification
│   └── README.md                   # API documentation
└── README.md                       # This file
```

## Performance & Monitoring

### System Performance
- **Startup Time**: Service initializes in < 2 seconds
- **Database Operations**: SQLite queries execute in < 50ms (indexed)
- **Real-time Updates**: WebSocket latency < 100ms
- **Search Performance**: Multi-layer search completes in < 200ms
- **Memory Footprint**: ~50-100MB for companion service
- **CPU Usage**: < 5% during active monitoring

### Analytics Metrics Tracked
- **Context Usage**: Token count, @ mentions, context window utilization
- **Error Frequency**: Linter errors, test failures, terminal errors per session
- **Productivity**: Time-to-first-edit, active coding time, prompt iterations
- **Code Churn**: Lines added/removed, file modification frequency
- **File Relationships**: Co-change patterns, dependency graphs, hotspots

### Optimization Features
- **Indexed Queries**: 13 database indexes for fast retrieval
- **Batched Updates**: WebSocket broadcasting every 2 seconds
- **Smart Polling**: Cursor DB checked every 10s (configurable)
- **Efficient Diffs**: Only changed code sections stored
- **Frontend Caching**: IndexedDB for persistent dashboard state

## Data Capture & Information Types

The Cursor Telemetry Dashboard captures comprehensive information about your development activities through multiple monitoring mechanisms. Understanding what data is captured is crucial for privacy and security.

### Data Capture Sources

#### 1. **Clipboard Monitoring**
- **What's Captured**: Complete clipboard content when copied
- **Frequency**: Every 10 seconds (configurable)
- **Data Types**: 
  - Code snippets, prompts, responses
  - API keys, passwords, tokens
  - Personal information, file paths
  - Any text copied to clipboard
- **Storage**: Raw text stored in database
- **Privacy**: No filtering applied by default

#### 2. **MCP (Model Context Protocol) Integration**
- **What's Captured**: Direct communication from Cursor IDE
- **Data Types**:
  - Complete prompt/response pairs
  - File paths and context
  - Code changes (before/after)
  - Session information
- **Storage**: Full conversation history
- **Privacy**: No redaction applied

#### 3. **File System Monitoring**
- **What's Captured**: File changes and modifications
- **Data Types**:
  - Complete file contents (before/after)
  - File paths (including usernames)
  - Code diffs and changes
  - Configuration files
- **Storage**: Full file content snapshots
- **Privacy**: No path anonymization

#### 4. **DOM Monitoring**
- **What's Captured**: Web page content and interactions
- **Data Types**:
  - Form inputs and selections
  - Page content and structure
  - User interactions
- **Storage**: HTML content and metadata
- **Privacy**: No content filtering

#### 5. **Cursor Database Mining**
- **What's Captured**: Direct extraction from Cursor's internal SQLite databases
- **Source Location**: `~/Library/Application Support/Cursor/User/workspaceStorage/*/state.vscdb`
- **Data Types**:
  - **AI Conversation Titles**: Complete prompt/conversation names from Composer
  - **Code Impact Metrics**: Lines added/removed per conversation (aggregated)
  - **Context Usage**: Percentage of context window utilized per prompt
  - **AI Mode Information**: Agent/Chat/Edit mode, model type (Claude 4.5 Sonnet inferred)
  - **Workspace Context**: Workspace paths, friendly names, and session IDs
  - **Temporal Data**: Creation/update timestamps for linking to code changes
- **Metadata Captured**:
  ```javascript
  {
    "text": "Implementing user authentication system",
    "workspacePath": "/Users/dev/project",
    "linesAdded": 247,
    "linesRemoved": 83,
    "contextUsage": 67.5,
    "mode": "agent",
    "modelName": "claude-4.5-sonnet",
    "composerId": "uuid-12345",
    "timestamp": 1729814400000
  }
  ```
- **Update Frequency**: Every 10 seconds via database polling
- **Linkage**: Prompts automatically linked to subsequent code changes for traceability
- **Storage**: Extended SQLite schema with 16+ metadata fields per prompt
- **Privacy**: Full conversation history with no filtering

### Information Types Captured

#### **Code & Development Data**
```javascript
{
  "file_path": "/Users/john.smith/projects/auth/src/auth.js",
  "before_code": "const auth = require('auth');",
  "after_code": "const jwt = require('jsonwebtoken');\nconst auth = require('auth');",
  "prompt": "How do I implement JWT authentication?",
  "response": "Here's how to implement JWT authentication...",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### **Sensitive Information**
- **API Keys**: GitHub tokens, AWS credentials, Stripe keys
- **Passwords**: Database passwords, service credentials
- **Personal Data**: Names, emails, phone numbers
- **Business Information**: Company names, project details
- **System Information**: Usernames, file paths, directory structure

#### **Security & Privacy Data**
- **Authentication Tokens**: JWT secrets, OAuth tokens
- **Database Credentials**: Connection strings, passwords
- **Private Keys**: SSH keys, encryption keys
- **Environment Variables**: Complete .env file contents
- **Configuration Files**: API keys, secrets, credentials

### Data Storage & Retention

#### **Storage Format**
- **Database**: SQLite (`companion.db`) with full text storage
- **Format**: Plain text (no encryption)
- **Retention**: Indefinite (no automatic cleanup)
- **Access**: No authentication required
- **Schema**:
  - **entries**: File changes with before/after code, prompt linkage
  - **prompts**: Enhanced metadata (16 fields) including AI mode, context usage, code impact
  - **events**: Activity timeline with detailed event metadata
- **Location**: `components/activity-logger/companion/data/companion.db`

#### **Data Volume**
- **Per Session**: 10-50MB of raw data
- **Clipboard Entries**: 50-200 per session
- **File Changes**: 20-100 per session (tracked in entries table)
- **MCP Entries**: 30-150 per session
- **AI Prompts**: 20-100 per session with full metadata
- **Database Growth**: ~5-10MB per hour of active development

### Security Detection & Analytics

The system includes advanced security detection capabilities:

#### **Secret Detection Patterns**
- **GitHub Tokens**: `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`
- **AWS Credentials**: Access keys, secret keys
- **Database URLs**: PostgreSQL, MySQL, MongoDB
- **JWT Secrets**: Authentication tokens
- **Private Keys**: RSA, DSA, EC, OpenSSH
- **API Keys**: Google, Stripe, Slack, etc.

#### **Analytics API Examples**
```bash
# Get database statistics with integrity checks
curl "http://localhost:43917/api/database/stats"

# Get context analytics (@ mentions, token usage)
curl "http://localhost:43917/api/analytics/context"

# Get error tracking statistics
curl "http://localhost:43917/api/analytics/errors"

# Get productivity metrics
curl "http://localhost:43917/api/analytics/productivity"

# Export complete database snapshot
curl "http://localhost:43917/api/export/database" > telemetry-export.json
```

**For complete API reference**, visit the built-in documentation:
```bash
open http://localhost:43917/new-dashboard.html#api-docs
```

The API documentation view provides:
- 50+ endpoint reference with examples
- Request/response formats
- Query parameters
- WebSocket event documentation
- Performance notes

### Privacy Controls

#### **Current Limitations**
- **No Default Protection**: All data captured without filtering
- **No Encryption**: Plain text storage
- **No Access Controls**: Open API endpoints
- **No Retention Limits**: Indefinite storage

#### **Available Controls**
```javascript
// Privacy configuration (optional)
const privacyConfig = {
  enabled: false,              // DISABLED by default
  redactNames: false,         // NO name redaction
  redactNumbers: false,       // NO number redaction
  redactEmails: false,        // NO email redaction
  redactFilePaths: false      // NO path redaction
};
```

#### **Security Recommendations**
1. **Enable Privacy Controls**: Configure data redaction
2. **Regular Security Audits**: Use security analytics API
3. **Data Cleanup**: Implement retention policies
4. **Access Controls**: Secure API endpoints
5. **Encryption**: Implement data encryption

### Data Export & Analysis

#### **Export Capabilities**
```bash
# Export all data
curl "http://localhost:3000/api/export/json"

# Export security report
curl "http://localhost:3000/api/security/analytics" > security-report.json

# Export conversations
curl "http://localhost:3000/api/conversations"
```

#### **Analytics Endpoints**
- **Security Analytics**: `/api/security/analytics`
- **Conversation Analytics**: `/api/conversations/analytics`
- **Prompt Analytics**: `/api/prompts/analytics`
- **Risk Assessment**: `/api/security/risk-assessment`

## Privacy Considerations

**Critical**: The system captures sensitive data with no privacy protection by default:

1. **Review Captured Data**: Check what information is being stored
2. **Enable Privacy Controls**: Configure data redaction and filtering
3. **Monitor Security Issues**: Use security analytics to identify risks
4. **Implement Data Policies**: Set retention limits and access controls
5. **Regular Audits**: Review captured data for sensitive information

**Security Warning**: The system captures API keys, passwords, personal information, and business data in plain text with no encryption or access controls.

## Related Projects
- [Clio](https://github.com/openclio/clio) - Faceted analysis framework
- [D3.js](https://d3js.org/) - Data visualization library
- [General User Models from Computer Use] (https://arxiv.org/abs/2505.10831)

## Support

For questions, issues, or contributions, please:
- Open an issue on GitHub
- Check the documentation in `/docs`
- Review the API reference above
- Read `PRIVACY_CONTROLS_ANALYSIS.md` for privacy considerations

---

**Note**: This dashboard is designed specifically for data science workflows and provides specialized insights into Jupyter notebook-based development patterns. The system is optimized for macOS, Cursor IDE integration, and requires .ipynb files for full functionality.

**Privacy Warning**: The current privacy controls are not connected to data capture. All data is captured regardless of privacy settings. See `PRIVACY_CONTROLS_ANALYSIS.md` for details.// Test change for companion service
