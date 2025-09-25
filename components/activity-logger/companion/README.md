# Cursor Companion Service

A local-first companion service for the Cursor Activity Logger that provides file watching, diff detection, and MCP integration.

## Features

- **File Watcher**: Monitors code changes using chokidar
- **Diff Engine**: Detects and processes code differences
- **Idle Detection**: Automatically pauses logging when user is idle
- **MCP Server**: JSON-RPC integration with Cursor
- **HTTP API**: RESTful API for the SPA to consume data
- **Queue System**: Reliable data queuing and acknowledgment

## Quick Start

1. **Install dependencies**:
   ```bash
   cd companion
   npm install
   ```

2. **Start the service**:
   ```bash
   npm start
   ```

3. **Configure Cursor MCP**:
   - Copy `.cursor/mcp.json` to your Cursor config directory
   - Restart Cursor to load the MCP server

## API Endpoints

### Health Check
- `GET /health` - Service health status

### Queue Management
- `GET /queue?since=<ISO>` - Get new entries since timestamp
- `POST /ack` - Acknowledge processed entries

### Configuration
- `GET /config` - Get current configuration
- `POST /config` - Update configuration

## Configuration

The service uses `config.json` for persistent configuration:

```json
{
  "root_dir": "/path/to/your/project",
  "ignore": [
    "node_modules/**",
    "dist/**",
    "build/**",
    ".git/**"
  ],
  "diff_threshold": 12,
  "enable_clipboard": false,
  "enable_preload": false,
  "strict_auth": true
}
```

## MCP Commands

The service exposes these MCP commands to Cursor:

- `logPromptResponse({session_id?, timestamp, file_path?, prompt, response})`
- `logCodeChange({session_id?, timestamp, file_path, before_code, after_code})`
- `logEvent({session_id?, timestamp, type, details?})`
- `getSessionInfo() -> {session_id, name, created_at}`
- `setConfig({root_dir, ignore[], diff_threshold})`

## Development

- `npm run dev` - Start with file watching
- `npm test` - Run tests

## Architecture

```
┌─────────────────┐    JSON-RPC     ┌──────────────────┐
│     Cursor      │◄──────────────►│   MCP Handler    │
└─────────────────┘                 └─────────┬────────┘
                                              │ HTTP
                                              ▼
┌─────────────────┐    HTTP API     ┌──────────────────┐
│      SPA        │◄──────────────►│  Companion API   │
└─────────────────┘                 └─────────┬────────┘
                                              │
                                              ▼
                                    ┌──────────────────┐
                                    │  File Watcher    │
                                    │  + Diff Engine   │
                                    │  + Queue         │
                                    └──────────────────┘
```

## Privacy & Security

- All data stays local (127.0.0.1 only)
- No cloud communication
- Optional authentication token
- One-click data purge
