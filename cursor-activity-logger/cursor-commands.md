# Cursor Commands for Activity Logger

These commands can be used in Cursor to manually log activity via MCP integration.

## Setup

1. Ensure the companion service is running
2. Copy `.cursor/mcp.json` to your Cursor config directory
3. Restart Cursor

## Available Commands

### 1. Log Prompt/Response

Use this command in Cursor's command palette or create a custom command:

```javascript
// In Cursor, you can call this via MCP
await mcp.logPromptResponse({
    session_id: "current-session-id",
    file_path: "src/app.js",
    prompt: "How do I implement authentication?",
    response: "Here's how to implement JWT authentication..."
});
```

### 2. Log Code Change

```javascript
await mcp.logCodeChange({
    session_id: "current-session-id", 
    file_path: "src/auth.js",
    before_code: "function login() { ... }",
    after_code: "async function login() { ... }"
});
```

### 3. Log Custom Event

```javascript
await mcp.logEvent({
    session_id: "current-session-id",
    type: "feature_completed",
    details: { feature: "authentication", time_spent: "2 hours" }
});
```

### 4. Get Session Info

```javascript
const sessionInfo = await mcp.getSessionInfo();
console.log(sessionInfo);
```

## Creating Custom Cursor Commands

You can create custom commands in Cursor that automatically log activity:

### Example: Auto-log AI Conversations

Create a command that runs after each AI interaction:

```javascript
// Command: "Log AI Interaction"
const activeFile = cursor.activeFile;
const lastPrompt = cursor.lastPrompt;
const lastResponse = cursor.lastResponse;

if (lastPrompt && lastResponse) {
    await mcp.logPromptResponse({
        file_path: activeFile,
        prompt: lastPrompt,
        response: lastResponse
    });
}
```

### Example: Log Code Reviews

```javascript
// Command: "Log Code Review"
const selectedCode = cursor.selectedText;
const reviewComments = cursor.getReviewComments();

await mcp.logEvent({
    type: "code_review",
    details: {
        file: cursor.activeFile,
        code_length: selectedCode.length,
        comments: reviewComments.length
    }
});
```

## Keyboard Shortcuts

You can assign keyboard shortcuts to these commands:

1. Open Cursor Settings
2. Go to Keyboard Shortcuts
3. Add custom shortcuts for MCP commands

Example shortcuts:
- `Cmd+Shift+L` - Log current prompt/response
- `Cmd+Shift+C` - Log code change
- `Cmd+Shift+E` - Log custom event

## Integration with Cursor Workflows

### Auto-logging on Save

```javascript
// Trigger on file save
cursor.onFileSave(async (file) => {
    const changes = await cursor.getFileChanges(file);
    if (changes.length > 0) {
        await mcp.logCodeChange({
            file_path: file,
            before_code: changes[0].before,
            after_code: changes[0].after
        });
    }
});
```

### Auto-logging AI Interactions

```javascript
// Trigger on AI response
cursor.onAIResponse(async (prompt, response) => {
    await mcp.logPromptResponse({
        file_path: cursor.activeFile,
        prompt: prompt,
        response: response
    });
});
```

## Troubleshooting

### MCP Not Available

1. Check if companion service is running: `curl http://127.0.0.1:43917/health`
2. Verify MCP configuration in `~/.cursor/mcp.json`
3. Restart Cursor after configuration changes

### Commands Not Working

1. Check companion logs for errors
2. Verify MCP handler is receiving requests
3. Test with simple commands first

### Data Not Appearing

1. Check SPA is polling companion service
2. Verify queue endpoint: `curl http://127.0.0.1:43917/queue`
3. Check browser console for errors

## Advanced Usage

### Batch Logging

```javascript
// Log multiple entries at once
const entries = [
    { prompt: "Question 1", response: "Answer 1" },
    { prompt: "Question 2", response: "Answer 2" }
];

for (const entry of entries) {
    await mcp.logPromptResponse(entry);
}
```

### Conditional Logging

```javascript
// Only log if certain conditions are met
if (cursor.activeFile.includes('src/')) {
    await mcp.logPromptResponse({
        file_path: cursor.activeFile,
        prompt: prompt,
        response: response
    });
}
```

### Error Handling

```javascript
try {
    await mcp.logPromptResponse(data);
    cursor.showMessage('Activity logged successfully');
} catch (error) {
    cursor.showError('Failed to log activity: ' + error.message);
}
```
