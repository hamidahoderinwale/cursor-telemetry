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

**[Go to Companion Service Setup](#companion-service-setup)**

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

**[Go to Full Dashboard Setup](#full-dashboard-setup)**

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
- Optional: Rust & Cargo (for native module)
- Optional: Redis (for caching)
- Optional: PostgreSQL (recommended for production)
- Optional: OpenRouter API key (for AI features)

### Quick Start

```bash
# 1. Clone repository
git clone https://github.com/hamidahoderinwale/cursor-telemetry.git
cd cursor-telemetry/components/activity-logger/companion

# 2. Install dependencies
npm install

# 3. Install CLI globally (optional but recommended)
npm link

# 4. Start the service
npm start
```

Service will start on **http://localhost:43917**

### CLI Tool

The companion service includes a powerful CLI for data export and management:

```bash
# After npm link, use anywhere:
cursor-telemetry --help

# Check service health
cursor-telemetry health

# View database stats  
cursor-telemetry stats

# Export data as JSON
cursor-telemetry export json --limit 1000 -o mydata.json

# Export data as CSV
cursor-telemetry export csv -o data.csv

# Export to Hugging Face (with privacy controls)
cursor-telemetry hf export --privacy clio --max 10000

# Quick upload to Hugging Face Hub
cursor-telemetry hf quick-upload --repo username/my-dataset --privacy clio

# Export at specific privacy level
cursor-telemetry rungs export clio -o workflows.json

# List all privacy levels
cursor-telemetry rungs list

# Open dashboard in browser
cursor-telemetry open

# Show examples
cursor-telemetry examples
```

**Privacy Levels for Export:**
- `clio` - Workflow patterns only (safest for public sharing)
- `module_graph` - File dependencies
- `functions` - Function-level changes
- `semantic_edits` - Semantic edit operations
- `tokens` - Tokens with PII redaction

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
# Development
npm start

# Or use PM2 for production
pm2 start src/index.js --name cursor-companion

# Or use the CLI
cursor-telemetry start
```

### API Usage

**Using CLI (Recommended):**

```bash
# Export all data
cursor-telemetry export json -o data.json

# Export with high privacy
cursor-telemetry hf export --privacy clio

# Get stats
cursor-telemetry stats
```

**Using curl:**

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

### Hugging Face Integration

Export and share your developer workflow data as datasets:

```bash
# 1. Export data in HF format
cursor-telemetry hf export --privacy clio --max 10000 -o ./my-dataset

# 2. Install Hugging Face CLI
pip install huggingface_hub
huggingface-cli login

# 3. Upload to Hugging Face Hub
cursor-telemetry hf upload ./my-dataset --repo username/my-workflows

# Or do it all in one command:
cursor-telemetry hf quick-upload \
  --repo username/my-workflows \
  --privacy clio \
  --max 10000 \
  --private
```

Your dataset will be available at: `https://huggingface.co/datasets/username/my-workflows`

Use it in Python:
```python
from datasets import load_dataset
dataset = load_dataset("username/my-workflows")
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

# Functions - Function-level changes (medium privacy)
curl "http://localhost:43917/api/export/data?rung=functions" > functions.json

# Semantic Edits - Edit scripts (low privacy)
curl "http://localhost:43917/api/export/data?rung=semantic_edits" > edits.json

# Tokens - Tokens (lowest privacy, PII redacted)
curl "http://localhost:43917/api/export/data?rung=tokens" > tokens.json
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
| `/api/huggingface/export` | GET | Export in Hugging Face format |
| `/api/huggingface/info` | GET | HF export configuration |
| `/api/share/create` | POST | Create shareable link |
| `/api/historical/commits` | GET | Git commit history |
| `/api/historical/commands` | GET | Shell command history |
| `/api/mining/workspace` | POST | Trigger historical mining |
| `/api/analytics/productivity` | GET | Productivity metrics |
| `/api/analytics/context` | GET | Context window usage |
| `/health` | GET | Service health & cache stats |

**CLI Commands:** Use `cursor-telemetry --help` for all available commands

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

#### Views
- Overview, Activity, Analytics, File Graph, Module Graph
- States, Navigator, System, Historical Mining
- Privacy-preserving abstractions (5 levels), API Docs

#### AI Features
- Event annotations, intent classification
- Semantic search, natural language interface

#### Sharing & Export
- Shareable links with privacy controls
- Export at 5 privacy levels

---

## Environment Variables

```bash
# Database (choose one)
DATABASE_TYPE=sqlite              # Default, good for local use
DATABASE_TYPE=postgres            # Recommended for production
DATABASE_URL=postgresql://...     # Required if using PostgreSQL

# Redis Cache (optional)
REDIS_URL=redis://localhost:6379

# OpenRouter API (required for AI features)
OPENROUTER_API_KEY=your_api_key_here
OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small
OPENROUTER_CHAT_MODEL=microsoft/phi-3-mini-128k-instruct:free

# Mining configuration
AUTO_MINING_ENABLED=true
MINING_GIT_HISTORY_DAYS=365
MINING_WEEKLY_BACKFILL=true

# Server configuration
PORT=43917
HOST=0.0.0.0                      # For cloud deployments
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
3. **Functions** - Function signatures and changes
4. **Semantic Edits** - Semantic edit operations
5. **Tokens** - Token-level with PII redaction

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

- Track productivity and coding patterns
- Export data for AI training datasets (Hugging Face integration)
- Share workflow insights with privacy controls
- Analyze development processes and patterns
- Build training datasets for code models

---

## Architecture

### Companion Service (Backend)

```
Port 43917
├── HTTP REST API (Express)
├── WebSocket Server (Socket.IO)
├── Database Layer (SQLite/PostgreSQL)
├── Cache Layer (Optional Redis)
├── Native Module (Optional Rust)
├── Data Capture (File watcher, Cursor miner, Terminal)
├── Historical Mining (Git, Shell history, Logs)
├── Analytics Engine
├── Privacy Engine (5-Level abstraction system)
├── Export System (JSON/CSV/SQLite/Hugging Face)
└── AI Services (OpenRouter)
```

### Dashboard (Frontend)

```
Static Files served by Companion
├── Vanilla JavaScript
├── D3.js (visualizations)
├── Chart.js (analytics)
├── Socket.IO Client (real-time)
└── Views (20+ pages)
```

---

## Troubleshooting

### Companion Service Won't Start

```bash
# Check if port is in use
lsof -i :43917

# Kill existing process if needed
pkill -f "node src/index.js"

# Check logs
tail -f companion/companion.log
tail -f companion/companion.error.log

# Test database
sqlite3 companion/data/companion.db "SELECT COUNT(*) FROM entries;"
```

### Database Locked (SQLite)

```bash
# Kill all Node processes
pkill node

# Remove lock files
cd companion/data
rm -f *.db-wal *.db-shm

# Restart service
npm start
```


### CLI Not Working

```bash
# Reinstall CLI
cd companion
npm link

# Verify installation
which cursor-telemetry
cursor-telemetry --version

# Check if service is running
cursor-telemetry health
```

### Native Module Won't Build

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install build tools (macOS)
xcode-select --install

# Install build tools (Linux)
sudo apt install build-essential

# Build native module
cd native
npm install
npm run build

# Service will fallback to JavaScript if build fails
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
