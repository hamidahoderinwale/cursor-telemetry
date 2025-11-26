# Cursor Companion Service

> **APPLICATION 1: Backend Data Collection & Export API**
> 
> This is the **standalone companion service** - a headless backend that captures development data and provides a complete REST API for export and analysis. **No dashboard UI is required to run this service.**

---

## What You Get

**Real-time Data Capture**
- File changes with full diffs
- AI prompts from Cursor
- Terminal commands
- System metrics (CPU, memory)
- IDE state tracking

**Historical Mining**
- Git commit history
- Shell history (.bash_history, .zsh_history)
- Cursor log parsing
- File timeline reconstruction

**Complete REST API**
- 50+ endpoints for data access
- Export in JSON, CSV, SQLite formats
- Privacy-preserving rungs system
- Shareable links with controls

**AI-Powered Features** (Optional)
- Event annotations
- Intent classification
- State management
- Semantic search
- Natural language interface

**What's NOT Included**
- No dashboard UI
- No visualizations
- No web interface

---

## Quick Start

### Prerequisites
- Node.js 16+
- Cursor IDE (for prompt mining)
- Optional: OpenRouter API key (for AI features)

### Installation

```bash
# 1. Navigate to companion directory
cd cursor-telemetry/components/activity-logger/companion

# 2. Install dependencies
npm install

# 3. Configure (optional)
cp env.example .env
# Edit .env to add OPENROUTER_API_KEY if you want AI features
```

### Configuration

Edit `config.json`:

```json
{
  "workspace_roots": ["/path/to/your/projects"],
  "auto_detect_workspaces": true,
  "port": 43917,
  "enable_clipboard": true,
  "ignore": ["node_modules", ".git", "dist"]
}
```

### Start the Service

```bash
# Start the service
node src/index.js

# Service will start on http://localhost:43917
```

The service runs as a background process with:
- HTTP REST API on port 43917
- SQLite database at `data/companion.db`
- Automatic workspace monitoring
- Cursor prompt mining (every 10 seconds)

---

## Usage Examples

### Export All Data

```bash
# Export everything as JSON
curl http://localhost:43917/api/export/data > export.json

# Export as CSV
curl http://localhost:43917/api/export/csv > entries.csv

# Download SQLite database
curl http://localhost:43917/api/export/database --output companion.db
```

### Export with Privacy Rungs

```bash
# Clio - Workflow patterns only (highest privacy)
curl "http://localhost:43917/api/export/data?rung=clio" > clio.json

# Module Graph - File dependencies (high privacy)
curl "http://localhost:43917/api/export/data?rung=module_graph" > modules.json

# Rung 3 - Function-level changes (medium privacy)
curl "http://localhost:43917/api/export/data?rung=rung3" > functions.json

# Rung 2 - Edit scripts (low privacy)
curl "http://localhost:43917/api/export/data?rung=rung2" > edits.json

# Rung 1 - Tokens (lowest privacy, PII redacted)
curl "http://localhost:43917/api/export/data?rung=rung1" > tokens.json
```

### Query Real-Time Data

```bash
# Get recent file changes
curl "http://localhost:43917/api/entries?limit=100"

# Get AI prompts
curl "http://localhost:43917/api/prompts?limit=50"

# Get activity timeline
curl "http://localhost:43917/api/events?limit=100"

# Get terminal commands
curl "http://localhost:43917/api/terminal/commands?limit=50"
```

### Historical Mining

```bash
# Mine git history for a workspace
curl -X POST http://localhost:43917/api/mining/workspace \
  -H "Content-Type: application/json" \
  -d '{
    "workspace": "/path/to/your/project",
    "includeGit": true,
    "includeShell": true,
    "includeCursorLogs": true,
    "sinceDays": 365
  }'

# Get mined commits
curl "http://localhost:43917/api/historical/commits?limit=100"

# Get mined shell commands
curl "http://localhost:43917/api/historical/commands?limit=100"

# Get mining statistics
curl "http://localhost:43917/api/historical/stats"
```

### Create Shareable Links

```bash
# Create a time-limited share link
curl -X POST http://localhost:43917/api/share/create \
  -H "Content-Type: application/json" \
  -d '{
    "workspaces": ["/path/to/workspace"],
    "abstractionLevel": 1,
    "expirationDays": 7,
    "name": "Project Alpha - Q4 2024",
    "filters": {
      "dateFrom": "2024-01-01",
      "dateTo": "2024-12-31"
    }
  }'

# Returns: { "success": true, "shareId": "abc123", "url": "http://..." }

# Access shared data (send this URL to others)
curl "http://localhost:43917/api/share/abc123"
```

---

## Complete API Reference

### Data Export Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/data` | GET | Complete dataset |
| `/api/export/data` | GET | Export with privacy controls (`?rung=`) |
| `/api/export/csv` | GET | Export entries as CSV |
| `/api/export/database` | GET | Download SQLite database |
| `/api/entries` | GET | File change history |
| `/api/prompts` | GET | AI prompts with metadata |
| `/api/events` | GET | Activity timeline |
| `/api/terminal/commands` | GET | Terminal command history |

### Historical Mining Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mining/workspace` | POST | Mine all data for workspace |
| `/api/mining/git-history` | POST | Mine git history only |
| `/api/mining/shell-history` | POST | Mine shell history only |
| `/api/mining/cursor-logs` | POST | Mine Cursor logs only |
| `/api/mining/file-timeline` | POST | Mine file timestamps only |
| `/api/mining/status` | GET | Get current mining status |
| `/api/historical/commits` | GET | Get mined git commits |
| `/api/historical/commands` | GET | Get mined shell commands |
| `/api/historical/prompts` | GET | Get recovered prompts |
| `/api/historical/stats` | GET | Get historical statistics |
| `/api/historical/mining-runs` | GET | Get mining history |

### Sharing Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/share/create` | POST | Create shareable link |
| `/api/share/:shareId` | GET | Access shared data |
| `/api/share/:shareId/info` | GET | Get share metadata |
| `/api/share` | GET | List all share links |
| `/api/share/:shareId` | DELETE | Delete share link |

### Analytics Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analytics/productivity` | GET | Productivity metrics |
| `/api/analytics/context` | GET | Context window usage |
| `/api/analytics/errors` | GET | Error tracking |
| `/api/analytics/combined` | GET | Combined real-time + historical |

### AI Endpoints (requires OpenRouter API key)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/embeddings` | POST | Generate embeddings |
| `/api/ai/chat` | POST | Chat completions |
| `/api/ai/status` | GET | Check AI availability |
| `/api/annotations/event` | POST | Annotate event |
| `/api/annotations/intent` | POST | Classify intent |
| `/api/states/parse-command` | POST | Parse natural language |
| `/api/states/search` | POST | Semantic state search |

### Health & Status

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/stats` | GET | Activity statistics |
| `/config` | GET | Current configuration |
| `/config` | POST | Update configuration |

---

## Production Deployment

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start service
pm2 start src/index.js --name cursor-companion

# Enable auto-start on reboot
pm2 save
pm2 startup

# Monitor logs
pm2 logs cursor-companion

# Manage service
pm2 stop cursor-companion
pm2 restart cursor-companion
pm2 delete cursor-companion
```

### Using Docker

```bash
# Build image
docker build -f ../../../infra/docker/Dockerfile.companion -t cursor-companion .

# Run container
docker run -d \
  --name cursor-companion \
  -p 43917:43917 \
  -e OPENROUTER_API_KEY=your_key_here \
  -v $(pwd)/data:/app/data \
  cursor-companion

# View logs
docker logs -f cursor-companion

# Stop container
docker stop cursor-companion
```

### Using systemd (Linux)

```bash
# Create service file: /etc/systemd/system/cursor-companion.service
[Unit]
Description=Cursor Companion Service
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/cursor-telemetry/components/activity-logger/companion
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
Environment="OPENROUTER_API_KEY=your_key_here"

[Install]
WantedBy=multi-user.target

# Enable and start
sudo systemctl enable cursor-companion
sudo systemctl start cursor-companion
sudo systemctl status cursor-companion
```

### Environment Variables for Production

```bash
# Server configuration
PORT=43917
HOST=0.0.0.0  # Allow external connections
NODE_ENV=production

# AI features (optional)
OPENROUTER_API_KEY=your_api_key_here
OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small
OPENROUTER_CHAT_MODEL=microsoft/phi-3-mini-128k-instruct:free

# Mining configuration
AUTO_MINING_ENABLED=true
MINING_GIT_HISTORY_DAYS=365
MINING_WEEKLY_BACKFILL=true
MINING_BACKFILL_DAY=0  # 0=Sunday
MINING_BACKFILL_HOUR=2  # 2 AM

# Logging
LOG_LEVEL=info
```

---

## Privacy & Rungs System

### 5 Levels of Privacy-Preserving Abstraction

1. **Clio (Motifs)** - Highest Privacy
   - Workflow patterns only
   - No code, no file names
   - Use case: Share with anyone, public

2. **Module Graph** - High Privacy
   - File-level dependencies
   - No code content
   - Use case: Architecture overview

3. **Rung 3 (Functions)** - Medium Privacy
   - Function signatures and changes
   - No implementation details
   - Use case: Technical reviews

4. **Rung 2 (Edit Scripts)** - Low Privacy
   - Semantic edit operations
   - AST-based transformations
   - Use case: Code review without full code

5. **Rung 1 (Tokens)** - Lowest Privacy
   - Token-level changes
   - PII redacted
   - Use case: AI training datasets

**Export with Rungs:**
```bash
curl "http://localhost:43917/api/export/data?rung=clio" > export.json
```

**Share with Rungs:**
```bash
curl -X POST http://localhost:43917/api/share/create \
  -H "Content-Type: application/json" \
  -d '{"abstractionLevel": 1, "workspaces": ["/path"]}'
```

---

## Data Storage

### Database Location
```
companion/data/companion.db
```

### Tables

**Real-Time Data:**
- `entries` - File changes
- `prompts` - AI prompts
- `events` - Activity timeline
- `terminal_commands` - Shell commands
- `context_snapshots` - Context at prompt time
- `conversations` - Conversation threads

**Historical Data:**
- `historical_commits` - Git commits
- `historical_branches` - Git branches
- `historical_diffs` - Commit diffs
- `historical_commands` - Shell history
- `historical_prompts` - Recovered prompts
- `file_timestamps` - File timeline
- `mining_runs` - Mining operation history

**Sharing:**
- `share_links` - Shareable link metadata

**AI & States:**
- `annotations` - AI-generated annotations
- `states` - Development states
- `embeddings` - Semantic embeddings

---

## Architecture

```
Companion Service (Port 43917)
├── HTTP REST API (Express)
├── WebSocket Server (Socket.IO)
└── Services
    ├── Data Capture
    │   ├── File Watcher (Chokidar)
    │   ├── Cursor DB Miner
    │   ├── Terminal Monitor
    │   ├── System Metrics
    │   └── IDE State (AppleScript)
    ├── Historical Mining
    │   ├── Git History Miner
    │   ├── Shell History Parser
    │   ├── Cursor Log Parser
    │   └── File Timeline Scanner
    ├── Analytics Engine
    │   ├── Productivity Metrics
    │   ├── Context Usage
    │   └── Error Tracking
    ├── Abstraction Engine
    │   ├── Rung 1-5 Processors
    │   ├── Module Graph Generator
    │   └── Clio Pattern Extractor
    └── AI Services (Optional)
        ├── Event Annotation
        ├── Intent Classification
        ├── State Management
        └── Semantic Search
```

---

## Integrating with the Dashboard

**Want the full visualization experience?** See the [main README](../../../README.md) for setting up the complete dashboard.

The companion service **automatically serves the dashboard** at:
```
http://localhost:43917/dashboard.html
```

But if you only want the API, you can ignore the dashboard entirely.

---

## Troubleshooting

### Service Won't Start

```bash
# Check if port is in use
lsof -i :43917

# Kill existing process
kill -9 $(lsof -t -i:43917)

# Check logs
tail -f companion.log
tail -f companion.error.log
```

### No Data Being Captured

```bash
# Verify workspace configuration
cat config.json

# Check file watcher is working
# Add debug logging to config.json
{
  "log_level": "debug"
}

# Verify Cursor database access
ls -la ~/Library/Application\ Support/Cursor/User/globalStorage/state.vscdb
```

### Historical Mining Fails

```bash
# Check git is installed
git --version

# Verify workspace is a git repo
cd /path/to/workspace && git status

# Check mining status
curl http://localhost:43917/api/mining/status

# View mining history
curl http://localhost:43917/api/historical/mining-runs
```

### AI Features Not Working

```bash
# Verify API key is set
echo $OPENROUTER_API_KEY

# Check AI status
curl http://localhost:43917/api/ai/status

# Expected response:
# {"success": true, "available": true}
```

### Database Errors

```bash
# Check database file permissions
ls -la data/companion.db

# Verify SQLite is working
sqlite3 data/companion.db "SELECT COUNT(*) FROM entries;"

# Reset database (WARNING: deletes all data)
rm data/companion.db
# Restart service to recreate
```

---

## Performance

### Resource Usage
- **CPU:** 1-5% idle, 10-20% during mining
- **Memory:** 100-300 MB
- **Disk:** Minimal writes (SQLite)
- **Network:** Only for AI features (if enabled)

### Optimization Tips
- Disable AI features if not needed
- Increase `cursor_db_poll_interval` for less frequent polling
- Use `.ignore` patterns to skip large directories
- Schedule mining during off-hours
- Use `includeDiffs: false` for faster git mining

---

## Related Documentation

- [Main README](../../../README.md) - Choose between companion-only or full dashboard
- [Dashboard README](../README.md) - Full dashboard features
- [Database Schema](../../../docs/DATABASE_SCHEMA.json) - Complete schema
- [Data Types](../../../docs/DATA_TYPES.json) - Privacy levels & rungs

---

## Support

- Issues: https://github.com/hamidahoderinwale/cursor-telemetry/issues
- API Docs: http://localhost:43917/dashboard.html#api-docs (if dashboard is enabled)
