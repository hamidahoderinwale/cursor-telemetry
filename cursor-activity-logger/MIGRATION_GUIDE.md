# Migration Guide: Current Implementation → Target Architecture

This guide explains how to migrate from the current browser-based implementation to the target companion service architecture.

## Current State vs Target State

### Current Implementation
- **Detection**: Browser-based DOM watching and clipboard monitoring
- **Storage**: IndexedDB in browser
- **Integration**: Direct DOM manipulation
- **Privacy**: Fully local, but limited by browser APIs

### Target Architecture
- **Detection**: File watcher + MCP integration
- **Storage**: IndexedDB in browser + companion queue
- **Integration**: MCP server for first-class Cursor integration
- **Privacy**: Fully local with better data capture

## Migration Steps

### Phase 1: Deploy Companion Service

1. **Install Companion Service**:
   ```bash
   cd companion
   npm install
   npm start
   ```

2. **Configure Cursor MCP**:
   ```bash
   # Copy MCP config to Cursor directory
   cp .cursor/mcp.json ~/.cursor/mcp.json
   # Restart Cursor
   ```

3. **Test Companion API**:
   ```bash
   curl http://127.0.0.1:43917/health
   curl http://127.0.0.1:43917/queue
   ```

### Phase 2: Update SPA Integration

1. **Add Companion Integration**:
   - Include `spa-integration.js` in your HTML
   - Replace direct DOM detection with companion polling

2. **Update Data Model**:
   - Add `source` field to entries
   - Update export functions to include source information

3. **Modify Initialization**:
   ```javascript
   // Replace direct detection with companion integration
   const companion = new CompanionIntegration();
   const companionAvailable = await companion.start();
   
   if (!companionAvailable) {
     // Fallback to direct detection
     startDOMWatcher();
     startDiffPoller();
   }
   ```

### Phase 3: Gradual Migration

1. **Keep Both Systems Running**:
   - Companion service for file watching
   - Browser detection as fallback

2. **Monitor Data Quality**:
   - Compare companion vs browser detection
   - Adjust thresholds and filters

3. **Remove Browser Detection**:
   - Once companion is stable, remove DOM watchers
   - Keep only companion integration

## Data Model Changes

### New Entry Fields
```javascript
{
  // Existing fields
  id: "uuid",
  session_id: "uuid", 
  timestamp: "ISO8601",
  file_path: "string",
  prompt: "text",
  response: "text",
  before_code: "text",
  after_code: "text",
  notes: "text",
  
  // New field
  source: "filewatcher" | "mcp" | "clipboard" | "preload"
}
```

### Updated Export Format
- CSV includes `source` column
- JSON includes source metadata
- Statistics by source type

## Configuration Migration

### Companion Config
```json
{
  "root_dir": "/path/to/project",
  "ignore": ["node_modules/**", "dist/**"],
  "diff_threshold": 12,
  "enable_clipboard": false,
  "enable_preload": false
}
```

### SPA Config
```javascript
{
  "companion_url": "http://127.0.0.1:43917",
  "polling_interval": 2000,
  "fallback_detection": true
}
```

## Testing Migration

### 1. Test File Watching
- Edit a file in your project
- Check companion logs for file change detection
- Verify entry appears in SPA

### 2. Test MCP Integration
- Use Cursor with MCP enabled
- Trigger MCP commands
- Verify data flows to SPA

### 3. Test Fallback
- Stop companion service
- Verify SPA falls back to browser detection
- Restart companion and verify it resumes

## Rollback Plan

If issues arise:

1. **Stop Companion Service**:
   ```bash
   # Kill companion process
   pkill -f "node.*companion"
   ```

2. **Revert SPA Changes**:
   - Remove companion integration
   - Re-enable direct DOM detection

3. **Restore Original State**:
   - Use git to revert changes
   - Restart with original implementation

## Performance Considerations

### Companion Service
- File watcher uses minimal CPU
- Queue system prevents data loss
- HTTP API adds minimal overhead

### SPA
- Polling every 2 seconds is efficient
- IndexedDB handles large datasets
- UI remains responsive

## Security Considerations

- Companion only binds to 127.0.0.1
- No external network calls
- Optional authentication token
- All data stays local

## Troubleshooting

### Companion Not Starting
- Check port 43917 is available
- Verify Node.js version compatibility
- Check file permissions

### MCP Not Working
- Verify `.cursor/mcp.json` is correct
- Restart Cursor after config changes
- Check companion logs for errors

### Data Not Appearing
- Check companion health endpoint
- Verify file watcher is monitoring correct directory
- Check browser console for errors

## Next Steps

1. **Deploy Phase 1** (Companion Service)
2. **Test File Watching** (Core functionality)
3. **Deploy Phase 2** (MCP Integration)
4. **Test End-to-End** (Complete workflow)
5. **Optimize Performance** (Fine-tuning)
6. **Remove Legacy Code** (Cleanup)

This migration provides a path to the target architecture while maintaining backward compatibility and allowing for gradual adoption.
