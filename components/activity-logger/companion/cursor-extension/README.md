# Cursor Telemetry Extension

Real-time prompt capture extension for Cursor AI.

## Installation

1. **Copy extension to Cursor:**
   ```bash
   cp -r cursor-extension ~/.cursor/extensions/cursor-telemetry
   ```

2. **Reload Cursor:**
   - Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
   - Type "Developer: Reload Window"
   - Press Enter

3. **Verify installation:**
   - Open Command Palette again
   - Type "Cursor Telemetry"
   - You should see the extension commands

## Usage

### Automatic Capture (Clipboard Monitoring)
The extension automatically monitors your clipboard every 5 seconds. When you copy a prompt, it's automatically captured.

### Manual Capture
1. Select text in editor
2. Press `Cmd+Shift+P` / `Ctrl+Shift+P`
3. Type "Cursor Telemetry: Capture Current Prompt"
4. Enter optional conversation title
5. Done!

### Toggle Monitoring
- Command: "Cursor Telemetry: Toggle Monitoring"
- Turns automatic capture on/off

## Configuration

Open Settings (`Cmd+,` / `Ctrl+,`) and search for "Cursor Telemetry":

```json
{
  "cursorTelemetry.apiEndpoint": "http://localhost:43917",
  "cursorTelemetry.autoCapture": true
}
```

## What It Captures

✅ User prompts (from clipboard or manual)  
✅ Conversation titles  
✅ Timestamps  
⚠️ AI responses (requires Cursor API access - not available yet)  
⚠️ Attachments (requires Cursor API access - not available yet)  

## Troubleshooting

### "Cannot connect to telemetry API"
- Ensure companion service is running: `http://localhost:43917`
- Check firewall settings

### "Extension not showing in commands"
- Reload Cursor window
- Check extension is in `~/.cursor/extensions/cursor-telemetry/`

### "Prompts not being captured"
- Check if monitoring is enabled (toggle command)
- Try manual capture to test API connection
- Check companion service logs: `/tmp/companion.log`

## API Endpoint

The extension sends data to:
```
POST http://localhost:43917/api/prompts/manual
Content-Type: application/json

{
  "text": "Your prompt text",
  "conversationTitle": "Optional thread title",
  "messageRole": "user",
  "hasAttachments": false
}
```

## Development

To modify the extension:
1. Edit `extension.js`
2. Reload Cursor window to test changes
3. Check Cursor's Developer Tools console for logs

