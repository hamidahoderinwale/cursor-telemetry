# Cursor Companion Service

A local-first companion service for the Cursor Activity Logger that provides file watching, AI-powered annotations, natural language state management, and comprehensive data capture.

## Features

### Core Data Capture
- **File Watcher**: Monitors code changes using Chokidar with diff detection
- **Cursor Database Mining**: Extracts AI prompts from Cursor's internal database
- **Terminal Monitoring**: Captures shell commands and process execution
- **System Metrics**: CPU, memory, and load average tracking
- **Git Integration**: Commit and branch activity monitoring

### AI-Powered Features
- **Event Annotation**: Automatic AI-generated descriptions for events
- **Intent Classification**: Classifies development activity (feature, bug-fix, refactor, etc.)
- **State Summarization**: Generates summaries for development states
- **Natural Language Parser**: Parses commands like "Fork a state for trying authentication"
- **Semantic Search**: Embedding-based search using OpenRouter API

### State Management
- **State Creation**: Create development states with snapshots
- **State Forking**: Fork states for experiments and features
- **State Merging**: Merge states with conflict detection
- **State Recommendations**: Intelligent suggestions for unfinished experiments
- **State Graph**: Visual representation of state relationships

### API & Integration
- **REST API**: 50+ endpoints for data access and control
- **WebSocket Server**: Real-time updates via Socket.IO
- **MCP Server**: JSON-RPC integration with Cursor (optional)
- **SQLite Database**: Persistent storage with comprehensive indexing

## Quick Start

1. **Install dependencies**:
   ```bash
   cd companion
   npm install
   ```

2. **Configure OpenRouter API** (optional but recommended):
   ```bash
   # Set environment variable
   export OPENROUTER_API_KEY=your_api_key_here
   
   # Or create .env file
   echo "OPENROUTER_API_KEY=your_api_key_here" > .env
   ```

3. **Start the service**:
   ```bash
   npm start
   # or
   node src/index.js
   ```

The service will:
- Start HTTP server on `http://localhost:43917`
- Initialize SQLite database at `data/companion.db`
- Begin monitoring workspace directories
- Start Cursor database mining (extracts prompts every 10s)
- Enable AI features if OpenRouter API key is configured

## Configuration

### Environment Variables

```bash
# Required for AI features
OPENROUTER_API_KEY=your_api_key_here

# Optional: Customize models
OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small
OPENROUTER_CHAT_MODEL=microsoft/phi-3-mini-128k-instruct:free
```

### config.json

Located at `companion/config.json`:

```json
{
  "workspace_roots": ["/path/to/your/projects"],
  "auto_detect_workspaces": true,
  "port": 43917,
  "enable_clipboard": true,
  "enable_screenshots": true,
  "enable_mcp": false,
  "ignore": ["node_modules", ".git", "dist"],
  "cursor_db_poll_interval": 10000,
  "max_file_size_mb": 5
}
```

## API Endpoints

### AI & Annotations

- `POST /api/ai/embeddings` - Generate embeddings for text
- `POST /api/ai/chat` - Chat completions
- `GET /api/ai/status` - Check AI service availability
- `POST /api/annotations/event` - Annotate a single event
- `POST /api/annotations/events/batch` - Batch annotate events
- `POST /api/annotations/intent` - Classify intent for events
- `POST /api/annotations/state-summary` - Generate state summary
- `GET /api/annotations/events/:eventId` - Get annotations for event
- `POST /api/annotations/refresh` - Re-annotate events

### State Management

- `POST /api/states/parse-command` - Parse natural language command
- `POST /api/states/execute` - Execute natural language command
- `POST /api/states/search` - Semantic search states
- `GET /api/states/recommendations` - Get state recommendations
- `GET /api/states` - List all states
- `POST /api/states` - Create new state
- `POST /api/states/:id/fork` - Fork a state
- `GET /api/states/:id1/diff/:id2` - Get state diff

### Core Data

- `GET /api/data` - Complete dataset
- `GET /api/entries` - File change history
- `GET /api/prompts` - AI prompts with metadata
- `GET /api/events` - Activity timeline
- `GET /api/activity` - Combined activity feed

### Analytics

- `GET /api/analytics/context` - Context usage statistics
- `GET /api/analytics/productivity` - Productivity metrics
- `GET /api/analytics/errors` - Error statistics

### Health & Status

- `GET /health` - Service health check
- `GET /stats` - Activity statistics
- `GET /config` - Current configuration
- `POST /config` - Update configuration

## Services

### Event Annotation Service

Automatically annotates events with AI-generated descriptions:

```javascript
const EventAnnotationService = require('./services/event-annotation-service');
const service = new EventAnnotationService();

// Annotate an event
const annotation = await service.annotateEvent(event, {
  recentEvents: [...]
});

// Classify intent
const classification = await service.classifyIntent(events);

// Generate state summary
const summary = await service.generateStateSummary(events, fileChanges);
```

### State Manager

Manages development states with fork/merge capabilities:

```javascript
const StateManager = require('./services/state-manager');
const manager = new StateManager(persistentDB);

// Create state
const state = await manager.createState('Feature: Auth', 'Authentication implementation');

// Fork state
const forked = await manager.forkState(sourceId, 'Experiment: JWT', 'Testing JWT approach');

// Merge states
const mergePlan = await manager.mergeStates([sourceId1, sourceId2], targetId);

// List states
const states = await manager.listStates({ intent: 'experiment' }, 'authentication');
```

### Natural Language Parser

Parses natural language commands into structured actions:

```javascript
const NaturalLanguageParser = require('./services/natural-language-parser');
const parser = new NaturalLanguageParser();

// Parse command
const parsed = await parser.parseCommand('Fork a state for trying authentication');
// Returns: { action: 'fork', intent: 'experiment', topic: 'authentication' }
```

## Database Schema

### Events Table
- `id` - Unique identifier
- `session_id` - Session identifier
- `workspace_path` - Workspace path
- `timestamp` - Event timestamp
- `type` - Event type (file_change, state_fork, etc.)
- `details` - JSON details
- `annotation` - AI-generated annotation
- `intent` - Classified intent
- `tags` - JSON array of tags
- `ai_generated` - Boolean flag
- `annotation_id` - Foreign key to annotations table

### States Table
- `id` - Unique identifier
- `name` - State name
- `description` - State description
- `parent_id` - Parent state (for forks)
- `created_at` - Creation timestamp
- `workspace_path` - Workspace path
- `snapshot_hash` - Snapshot identifier
- `metadata` - JSON metadata (intent, tags, etc.)

### Annotations Table
- `id` - Unique identifier
- `event_id` - Foreign key to events
- `type` - Annotation type (event_summary, intent_classification, state_summary)
- `content` - Annotation content
- `ai_generated` - Boolean flag
- `model_name` - AI model used
- `confidence` - Confidence score
- `tags` - JSON array of tags
- `created_at` - Creation timestamp

## Development

### Adding New Services

1. Create service file in `src/services/`
2. Export service class
3. Initialize in `src/index.js`
4. Create routes in `src/routes/` if needed

### Adding New Routes

1. Create route file in `src/routes/`
2. Export route creation function
3. Register in `src/index.js`:
   ```javascript
   const createMyRoutes = require('./routes/my-routes');
   createMyRoutes({ app, persistentDB });
   ```

## Deployment

### Docker

```bash
docker build -f infra/docker/Dockerfile.companion -t cursor-companion .
docker run -d \
  --name cursor-companion \
  -p 43917:43917 \
  -e OPENROUTER_API_KEY=your_key \
  -v $(pwd)/data:/app/data \
  cursor-companion
```

### Environment Variables for Production

```bash
PORT=43917
HOST=0.0.0.0
NODE_ENV=production
OPENROUTER_API_KEY=your_api_key
```

## Architecture

```
Companion Service
├── Data Capture
│   ├── File Watcher (Chokidar)
│   ├── Cursor DB Parser
│   ├── Terminal Monitor
│   └── System Metrics
├── AI Services
│   ├── Event Annotation Service
│   ├── Natural Language Parser
│   └── Embedding Service (OpenRouter)
├── State Management
│   ├── State Manager
│   ├── State Recommender
│   └── State Graph Generator
├── Database
│   ├── SQLite (persistent-db.js)
│   └── Schema Migrations
└── API Routes
    ├── Core Data Routes
    ├── AI Routes
    ├── Annotation Routes
    └── State Routes
```

## Privacy & Security

- All data stays local by default (127.0.0.1)
- SQLite database stored locally
- OpenRouter API calls made from server (API key required)
- No cloud communication unless explicitly configured
- Optional authentication for production deployments

## Troubleshooting

### AI Features Not Working

1. Check OpenRouter API key is set:
   ```bash
   echo $OPENROUTER_API_KEY
   ```

2. Verify API status:
   ```bash
   curl http://localhost:43917/api/ai/status
   ```

3. Check logs for API errors

### States Not Appearing

1. Verify database schema is initialized
2. Check `data/companion.db` exists
3. Review logs for state creation errors

### Database Issues

1. Check database file permissions
2. Verify SQLite is installed
3. Review migration logs in console

## Related Documentation

- Main README: `../../README.md`
- Dashboard README: `../README.md`
- API Documentation: Available at `http://localhost:43917/dashboard.html#api-docs`
