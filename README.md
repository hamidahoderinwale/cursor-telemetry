# Cursor Telemetry

> **Two Applications in One Repository**
> 
> This project consists of two independent applications that can be deployed separately:
> 1. **Companion Service** - Backend data collection and export API (no UI)
> 2. **Dashboard** - Full visualization and analytics interface

---

## Choose Your Deployment

### Option 1: Companion Service Only (Backend + Export API)

**Perfect for:**
- Users who only need data collection and export
- Headless server deployments
- API-only integrations
- Minimal resource usage

**What you get:**
- Real-time data capture (file changes, prompts, terminal, system metrics)
- Historical mining (git history, shell history, Cursor logs)
- Complete REST API (50+ endpoints)
- Data export in multiple formats (JSON, CSV, SQLite)
- Privacy-preserving rungs system
- Shareable links with privacy controls
- No dashboard UI
- No visualizations

**Size:** ~50MB (Node.js dependencies)

👉 **[Go to Companion Service Setup](#companion-service-setup)**

---

### Option 2: Full Dashboard (Backend + Frontend)

**Perfect for:**
- Users who want complete visualization and analytics
- Local development monitoring
- Team collaboration with visual insights
- Full feature access

**What you get:**
- Everything from Companion Service
- Beautiful web-based dashboard
- Real-time visualizations (D3.js, Chart.js)
- AI-powered insights and annotations
- Natural language interface
- State management and workflow tracking
- Advanced analytics and metrics

**Size:** ~60MB (includes frontend assets)

👉 **[Go to Full Dashboard Setup](#full-dashboard-setup)**

---

## Project Structure

```
cursor-telemetry/
├── components/
│   └── activity-logger/
│       ├── companion/                    # APPLICATION 1: Backend Service
│       │   ├── src/                      #    Core backend logic
│       │   │   ├── index.js              #    Entry point
│       │   │   ├── routes/               #    API endpoints (37 files)
│       │   │   ├── services/             #    Business logic (59 files)
│       │   │   ├── database/             #    Data persistence
│       │   │   ├── monitors/             #    File/terminal watchers
│       │   │   └── analytics/            #    Data processing
│       │   ├── data/                     #    SQLite database storage
│       │   │   └── companion.db          #    Primary database
│       │   ├── package.json              #    Backend dependencies
│       │   └── config.json               #    Configuration
│       │
│       └── public/                       # APPLICATION 2: Dashboard Frontend
│           ├── dashboard.html            #    Entry point
│           ├── views/                    #    Dashboard pages (20+ views)
│           ├── services/                 #    Frontend services
│           ├── components/               #    UI components
│           ├── utils/                    #    Helper functions
│           ├── styles/                   #    CSS styling
│           └── workers/                  #    Web workers
│
├── docs/                                 # Documentation
│   ├── DATABASE_SCHEMA.json              #    Complete schema
│   └── DATA_TYPES.json                   #    Privacy levels & rungs
│
└── README.md                             # You are here
```

---

## Companion Service Setup

### Prerequisites
- Node.js 16+
- Cursor IDE (for prompt mining)
- Optional: OpenRouter API key (for AI features)

### Installation

```bash
# 1. Clone repository
git clone https://github.com/hamidahoderinwale/cursor-telemetry.git
cd cursor-telemetry

# 2. Navigate to companion service
cd components/activity-logger/companion

# 3. Install dependencies
npm install

# 4. Configure (optional)
cp env.example .env
# Edit .env with your OpenRouter API key if you want AI features
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

### Run

```bash
# Start the service
node src/index.js

# Or use PM2 for production
pm2 start src/index.js --name cursor-companion
```

Service will start on **http://localhost:43917**

### API Usage

```bash
# Export all data
curl http://localhost:43917/api/export/data > data.json

# Export with privacy level (rungs)
curl "http://localhost:43917/api/export/data?rung=clio" > clio-patterns.json

# Get real-time entries
curl http://localhost:43917/api/entries?limit=100

# Get mined prompts
curl http://localhost:43917/api/prompts?limit=50

# Get historical commits
curl http://localhost:43917/api/historical/commits?limit=100

# Create shareable link
curl -X POST http://localhost:43917/api/share/create \
  -H "Content-Type: application/json" \
  -d '{
    "workspaces": ["/path/to/workspace"],
    "abstractionLevel": 1,
    "expirationDays": 7
  }'
```

### Data Export Formats

**JSON** (full data):
```bash
curl http://localhost:43917/api/export/data > export.json
```

**CSV** (entries):
```bash
curl http://localhost:43917/api/export/csv > entries.csv
```

**SQLite** (database dump):
```bash
curl http://localhost:43917/api/export/database --output companion.db
```

**Privacy Rungs** (abstracted data):
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

### Key API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/data` | GET | Complete dataset |
| `/api/entries` | GET | File changes |
| `/api/prompts` | GET | AI prompts |
| `/api/events` | GET | Activity timeline |
| `/api/terminal/commands` | GET | Shell commands |
| `/api/export/data` | GET | Export all data (supports `?rung=` param) |
| `/api/export/csv` | GET | Export as CSV |
| `/api/export/database` | GET | Download database |
| `/api/share/create` | POST | Create shareable link |
| `/api/historical/commits` | GET | Git commit history |
| `/api/historical/commands` | GET | Shell command history |
| `/api/mining/workspace` | POST | Trigger historical mining |
| `/api/analytics/productivity` | GET | Productivity metrics |
| `/api/analytics/context` | GET | Context window usage |

**Complete API documentation:** See companion service README

---

## Full Dashboard Setup

### Prerequisites
- All Companion Service prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

```bash
# 1. Follow Companion Service setup first
cd components/activity-logger/companion
npm install

# 2. Dashboard is already included in public/
# No additional installation needed
```

### Run

```bash
# Start the companion service (includes dashboard)
cd components/activity-logger/companion
node src/index.js

# Dashboard auto-serves at:
# http://localhost:43917/dashboard.html
```

### Access Dashboard

Open your browser to:
```
http://localhost:43917/dashboard.html
```

### Dashboard Features

#### 📊 Views
- **Overview** - Real-time stats and recent activity
- **Activity** - Complete timeline with AI annotations
- **Analytics** - Productivity metrics, context usage, error tracking
- **File Graph** - Interactive dependency visualization
- **Module Graph** - High-level architectural view
- **States** - Visual state management (fork/merge workflows)
- **Navigator** - Workspace file explorer
- **System** - Resource usage and IDE monitoring
- **Historical Mining** - Mine git/shell/log history
- **Rungs** - Privacy-preserving abstractions (5 levels)
- **API Docs** - Complete API reference

#### 🤖 AI Features
- **Event Annotations** - AI-generated descriptions of code changes
- **Intent Classification** - Automatic tagging (feature, bug-fix, refactor)
- **Natural Language Interface** - Control with commands like "Fork a state for authentication"
- **Semantic Search** - Find events and states by meaning
- **State Recommendations** - Smart suggestions for workflow management

#### 🔐 Sharing & Export
- **Shareable Links** - Create time-limited links with privacy controls
- **Privacy Levels** - 4 abstraction levels (raw → workflow patterns)
- **Date Filtering** - Share specific time ranges
- **Rung Export** - Export at 5 privacy tiers

### Production Deployment

**Using PM2:**
```bash
cd components/activity-logger/companion
pm2 start src/index.js --name cursor-telemetry
pm2 save
pm2 startup  # Enable auto-start
```

**Using Docker:**
```bash
docker build -f infra/docker/Dockerfile.companion -t cursor-companion .
docker run -d -p 43917:43917 -v $(pwd)/data:/app/data cursor-companion
```

**Using systemd:**
```bash
# See infra/systemd/cursor-companion.service
sudo cp infra/systemd/cursor-companion.service /etc/systemd/system/
sudo systemctl enable cursor-companion
sudo systemctl start cursor-companion
```

---

## Environment Variables

```bash
# OpenRouter API (required for AI features)
OPENROUTER_API_KEY=your_api_key_here

# Optional: Customize AI models
OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small
OPENROUTER_CHAT_MODEL=microsoft/phi-3-mini-128k-instruct:free

# Optional: Mining configuration
AUTO_MINING_ENABLED=true
MINING_GIT_HISTORY_DAYS=365
MINING_WEEKLY_BACKFILL=true

# Optional: Server configuration
PORT=43917
LOG_LEVEL=info
```

---

## Privacy & Data

### What Data is Captured

**Companion Service captures:**
- File changes (diffs, timestamps, file paths)
- AI prompts sent to Cursor
- Terminal commands
- System metrics (CPU, memory)
- Git commits and branches
- Shell history
- File modification timestamps

**Storage:**
- SQLite database: `companion/data/companion.db`
- Plain text (unencrypted by default)
- Local storage only (no cloud upload)

### Privacy Features

**Rungs System** - 5 levels of privacy-preserving abstraction:
1. **Clio (Motifs)** - Workflow patterns only (highest privacy)
2. **Module Graph** - File-level dependencies
3. **Rung 3** - Function signatures and changes
4. **Rung 2** - Semantic edit operations
5. **Rung 1** - Token-level with PII redaction

**Shareable Links:**
- Time-limited expiration (1 day to 1 year)
- Abstraction level controls
- Date range filtering
- Revocable at any time

**Best Practices:**
- Review captured data regularly
- Use rungs when sharing
- Set short expiration for share links
- Implement data retention policies
- Consider encrypting the database for sensitive projects

---

## Use Cases

### For Individual Developers
- Track personal productivity
- Understand coding patterns
- Debug development workflow
- Export for AI training datasets
- Share progress with abstractions

### For Teams
- Collaborate with privacy controls
- Share workflow insights
- Track project velocity
- Generate development reports
- Onboard new team members

### For Researchers
- Study software development processes
- Analyze AI-assisted coding patterns
- Build training datasets for code models
- Examine developer behavior

### For Managers/Stakeholders
- View high-level progress (Clio patterns)
- Track sprint velocity
- Understand technical debt
- Get insights without seeing code

---

## Architecture

### Companion Service (Backend)

```
Port 43917
├── HTTP REST API (Express)
├── WebSocket Server (Socket.IO)
├── SQLite Database
├── Data Capture
│   ├── File Watcher (Chokidar)
│   ├── Cursor DB Miner (polls every 10s)
│   ├── Terminal Monitor
│   ├── System Metrics
│   └── IDE State (AppleScript)
├── Historical Mining
│   ├── Git History
│   ├── Shell History
│   └── Log Parsing
├── Analytics Engine
│   ├── Productivity
│   ├── Context Usage
│   └── Error Tracking
└── AI Services (OpenRouter)
    ├── Event Annotation
    ├── Intent Classification
    └── Semantic Search
```

### Dashboard (Frontend)

```
Static Files served by Companion
├── Vanilla JavaScript (no framework)
├── D3.js (visualizations)
├── Chart.js (analytics)
├── Lunr.js (full-text search)
├── Socket.IO Client (real-time)
└── Views (20+ pages)
```

---

## Performance

### Resource Usage

**Companion Service:**
- CPU: 1-5% (idle), 10-20% (active mining)
- Memory: 100-300 MB
- Disk I/O: Minimal (SQLite writes)
- Network: Minimal (API requests only)

**Dashboard:**
- Runs in browser
- No additional server overhead
- Heavy visualizations use web workers

### Optimization

- Background preloading for heavy computations
- Smart caching (10-minute expiry)
- Progressive rendering
- Web workers for CPU-intensive tasks
- Debounced file watching

---

## Troubleshooting

### Companion Service Won't Start

```bash
# Check if port is in use
lsof -i :43917

# Check logs
tail -f companion/companion.log
tail -f companion/companion.error.log

# Test database
sqlite3 companion/data/companion.db "SELECT COUNT(*) FROM entries;"
```

### No Data Captured

```bash
# Verify workspace configuration
cat companion/config.json

# Check file watcher
# Add to config.json: "log_level": "debug"

# Verify Cursor database path
ls -la ~/Library/Application\ Support/Cursor/User/globalStorage/state.vscdb
```

### Dashboard Not Loading

```bash
# Check if companion is running
curl http://localhost:43917/api/health

# Check browser console for errors
# Open: http://localhost:43917/dashboard.html
# Press F12, check Console tab

# Verify static files
ls -la companion/public/dashboard.html
```

### Historical Mining Fails

```bash
# Check git installation
git --version

# Verify workspace is a git repo
cd /path/to/workspace && git status

# Check mining logs
curl http://localhost:43917/api/mining/status
curl http://localhost:43917/api/historical/mining-runs
```

---

## Documentation

- [Companion Service README](components/activity-logger/companion/README.md) - Backend API details
- [Dashboard README](components/activity-logger/README.md) - Frontend features
- [Database Schema](docs/DATABASE_SCHEMA.json) - Complete schema
- [Data Types](docs/DATA_TYPES.json) - Privacy levels & rungs
- API Docs - Available at `http://localhost:43917/dashboard.html#api-docs`

---

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

## License

See LICENSE file for details.

---

## Support

- **Issues:** https://github.com/hamidahoderinwale/cursor-telemetry/issues
- **Discussions:** https://github.com/hamidahoderinwale/cursor-telemetry/discussions

---

**Quick Links:**
- [Companion Service Setup](#companion-service-setup)
- [Full Dashboard Setup](#full-dashboard-setup)
- [API Documentation](#key-api-endpoints)
- [Privacy & Data](#privacy--data)
- [Troubleshooting](#troubleshooting)
