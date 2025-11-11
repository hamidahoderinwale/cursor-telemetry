# Cursor Telemetry Dashboard

## Overview

The Cursor Telemetry Dashboard is an intelligent monitoring platform that captures and analyzes your complete development workflow in Cursor IDE. It automatically tracks file changes, mines AI prompts from Cursor's internal database, and provides AI-powered insights through natural language interfaces and visual state management.

### Key Features

- **AI-Powered Annotations**: Automatic event descriptions, intent classification, and state summarization using OpenRouter API
- **Natural Language Interface**: Control development states with commands like "Fork a state for trying authentication"
- **Visual State Management**: D3.js graph visualization of state relationships with fork/merge capabilities
- **Semantic Search**: Embedding-based search for finding states and events by meaning
- **Real-Time Monitoring**: Track file changes, AI prompts, and system metrics live
- **Advanced Analytics**: Context window usage, error tracking, productivity insights
- **Multi-Layer Search**: Full-text (Lunr.js) + Semantic (OpenRouter embeddings) + Fuzzy matching
- **SQLite Persistence**: Durable storage with comprehensive indexing

## Quick Start

### Prerequisites
- Node.js 16+
- macOS (for AppleScript integration - optional)
- Cursor IDE
- OpenRouter API key (for AI features - optional but recommended)

### Installation

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

3. **Configure OpenRouter API** (optional but recommended for AI features):
```bash
# Create .env file or set environment variable
export OPENROUTER_API_KEY=your_api_key_here
```

4. **Start the companion service**:
```bash
node src/index.js
```

The service will:
- Start HTTP server on `http://localhost:43917`
- Initialize SQLite database at `companion/data/companion.db`
- Begin monitoring workspace directories
- Start Cursor database mining (extracts prompts every 10s)

5. **Access the dashboard**:
```bash
open http://localhost:43917/dashboard.html
```

## Core Features

### AI-Powered Annotations

Events are automatically annotated with AI-generated descriptions:

- **Event Annotations**: "Added authentication middleware" instead of "file changed"
- **Intent Classification**: Automatically tags events as `feature`, `bug-fix`, `refactor`, `experiment`, etc.
- **State Summarization**: Generates summaries when creating development states
- **Visual Indicators**: Lucide icons show annotations throughout the UI

### Natural Language State Management

Control your development workflow with natural language commands:

**Examples:**
- `"Fork a state for trying a new authentication approach"`
- `"Show me states where I was fixing the login bug"`
- `"Find states where I was working on API endpoints"`
- `"Merge the performance optimization into main"`

**Features:**
- Command parser with AI understanding (OpenRouter) and rule-based fallback
- Semantic state search using embeddings
- Intelligent recommendations (unfinished experiments, similar states)

### Visual State Management

**State Graph Visualization:**
- D3.js force-directed graph showing state relationships
- Color-coded by intent (experiment, feature, bug-fix, etc.)
- Interactive: click to select, double-click to switch, drag to merge
- Zoom and pan support

**Timeline Integration:**
- State transitions shown in timeline with visual markers
- "Forked experiment state" and "Merged optimization state" events
- State boundary markers group related events
- Color-coded borders and icons

### Dashboard Views

- **Overview** - Real-time activity stats and recent changes
- **Activity** - Timeline of all code changes and AI interactions with annotations
- **Analytics** - Context usage, errors, productivity metrics
- **File Graph** - Interactive visualization of file dependencies
- **States** - Visual state management with graph and list views
- **Navigator** - Explore workspace structure
- **System** - Resource usage and IDE state
- **API Docs** - Complete API reference

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Cursor Telemetry Dashboard                   │
├─────────────────────────────────────────────────────────┤
│  Frontend Dashboard (Vanilla JS)                        │
│  ├── AI-Powered Annotations (Lucide icons)              │
│  ├── Natural Language Command Interface                 │
│  ├── State Graph Visualization (D3.js)                  │
│  ├── Semantic Search (OpenRouter embeddings)            │
│  ├── Multi-layer Search (Lunr.js + embeddings)         │
│  └── Real-time Visualizations (Chart.js, D3.js)          │
├─────────────────────────────────────────────────────────┤
│  Companion Service (Port 43917) - Node.js/Express        │
│  ├── HTTP REST API (50+ endpoints)                     │
│  ├── WebSocket Server (Socket.IO)                       │
│  ├── SQLite Database (companion.db)                     │
│  ├── AI Services                                        │
│  │   ├── Event Annotation Service                       │
│  │   ├── Intent Classification                          │
│  │   ├── State Summarization                           │
│  │   └── Natural Language Parser                       │
│  ├── State Management                                   │
│  │   ├── State Manager (fork/merge/create)              │
│  │   ├── State Recommender                             │
│  │   └── Semantic State Search                         │
│  ├── Cursor Database Mining                             │
│  ├── File Watcher (Chokidar)                           │
│  └── Analytics Engines                                 │
└─────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

Create a `.env` file or set environment variables:

```bash
# OpenRouter API (required for AI features)
OPENROUTER_API_KEY=your_api_key_here

# Optional: Customize models
OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small
OPENROUTER_CHAT_MODEL=microsoft/phi-3-mini-128k-instruct:free
```

### config.json

Located at `components/activity-logger/companion/config.json`:

```json
{
  "workspace_roots": ["/path/to/your/projects"],
  "auto_detect_workspaces": true,
  "port": 43917,
  "enable_clipboard": true,
  "ignore": ["node_modules", ".git", "dist"]
}
```

## API Reference

### AI & Annotation Endpoints

- `POST /api/annotations/event` - Annotate a single event
- `POST /api/annotations/events/batch` - Batch annotate events
- `POST /api/annotations/intent` - Classify intent for events
- `POST /api/annotations/state-summary` - Generate state summary
- `GET /api/annotations/events/:eventId` - Get annotations for event
- `POST /api/annotations/refresh` - Re-annotate events

### State Management Endpoints

- `POST /api/states/parse-command` - Parse natural language command
- `POST /api/states/execute` - Execute natural language command
- `POST /api/states/search` - Semantic search states
- `GET /api/states/recommendations` - Get state recommendations
- `GET /api/states` - List all states
- `POST /api/states` - Create new state
- `POST /api/states/:id/fork` - Fork a state
- `GET /api/states/:id1/diff/:id2` - Get state diff

### Core Data Endpoints

- `GET /api/data` - Complete dataset
- `GET /api/entries` - File change history
- `GET /api/prompts` - AI prompts with metadata
- `GET /api/events` - Activity timeline
- `GET /api/analytics/context` - Context usage statistics
- `GET /api/analytics/productivity` - Productivity metrics

For complete API documentation, visit: `http://localhost:43917/dashboard.html#api-docs`

## Usage Examples

### Natural Language Commands

Open the search palette (⌘K) and try:

```
Fork a state for trying a new authentication approach
Show me states where I was fixing the login bug
Find states where I was working on API endpoints
Merge the performance optimization into main
```

### Creating and Managing States

**Via Natural Language:**
- Use the search palette to create, fork, or merge states
- Commands are parsed and executed automatically

**Via API:**
```bash
# Create a state
curl -X POST http://localhost:43917/api/states \
  -H "Content-Type: application/json" \
  -d '{"name": "Authentication Experiment", "description": "Trying JWT approach"}'

# Fork a state
curl -X POST http://localhost:43917/api/states/state-123/fork \
  -H "Content-Type: application/json" \
  -d '{"name": "JWT Alternative", "description": "Testing different approach"}'
```

### Viewing Annotations

Annotations appear automatically in:
- **Timeline view**: Below event descriptions with Lucide sparkles icon
- **Search results**: In search result cards
- **Event modals**: Prominently displayed at top of modal
- **Intent badges**: Color-coded badges on events

## Tech Stack

### Frontend
- **Vanilla JavaScript** - No framework dependencies
- **D3.js** - State graph and file graph visualizations
- **Chart.js** - Analytics charts
- **Lunr.js** - Full-text search
- **Lucide Icons** - Modern icon library
- **Socket.IO Client** - Real-time updates

### Backend
- **Node.js/Express** - HTTP server and REST API
- **SQLite3** - Primary database
- **Socket.IO** - WebSocket server
- **OpenRouter API** - AI embeddings and chat completions
- **Chokidar** - File system monitoring

## Data Sources

- **File System**: Chokidar monitors workspace changes
- **Cursor Database**: Direct SQLite reads from Cursor's `state.vscdb`
- **Terminal**: Shell history and process monitoring
- **System Metrics**: CPU, memory, load average
- **Git**: Commit and branch activity

## Privacy & Data

- **Storage**: SQLite database at `companion/data/companion.db`
- **Data Captured**: File changes, AI prompts, terminal commands, system metrics
- **No Encryption**: Data stored in plain text by default
- **Export**: Download complete database via `/api/export/database`

**Note**: The system captures code, prompts, and system information. Review captured data regularly and implement retention policies for production use.

## Development

### Project Structure

```
cursor-telemetry/
├── components/
│   └── activity-logger/
│       ├── companion/              # Backend service
│       │   ├── src/
│       │   │   ├── index.js
│       │   │   ├── services/
│       │   │   │   ├── event-annotation-service.js
│       │   │   │   ├── state-manager.js
│       │   │   │   ├── natural-language-parser.js
│       │   │   │   └── state-recommender.js
│       │   │   ├── routes/
│       │   │   │   ├── annotations.js
│       │   │   │   └── states.js
│       │   │   └── database/
│       │   │       └── persistent-db.js
│       │   └── data/
│       │       └── companion.db
│       └── public/                 # Frontend dashboard
│           ├── dashboard.html
│           ├── views/
│           │   ├── states/
│           │   │   ├── state-graph.js
│           │   │   └── index.js
│           │   └── activity/
│           │       └── timeline-helpers.js
│           └── services/
│               ├── annotation-service.js
│               └── state-service.js
└── README.md
```

## License

See LICENSE file for details.

---

**System Requirements**: macOS recommended for full AppleScript integration. Core features work on Linux/Windows.
