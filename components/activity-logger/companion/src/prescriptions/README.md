# Prescriptions System

**Behavioral rules and instructions that guide AI behavior.**

Prescriptions are lightweight, prescriptive (not retrospective) rules that are automatically injected into AI prompts to provide consistent guidance across sessions. Unlike the Memory System (which captures workflow artifacts for replay), Prescriptions define **how the AI should behave**.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Installation](#installation)
- [API Reference](#api-reference)
- [Dashboard UI](#dashboard-ui)
- [Usage Examples](#usage-examples)
- [Pattern Detection](#pattern-detection)
- [Templates](#templates)
- [Integration](#integration)

---

## Overview

### What are Prescriptions?

Prescriptions are persistent rules that modify AI behavior without needing to repeat instructions in every prompt. They solve the problem of:

- ❌ **Before**: "Don't write markdown files... use TypeScript... follow React patterns..." (every single prompt)
- ✅ **After**: Set prescriptions once, they're auto-applied to all future prompts

### Key Characteristics

- **Prescriptive**: Define desired behavior (not retrospective captures)
- **Lightweight**: Just text rules, not full code artifacts
- **Persistent**: Survive across sessions
- **Scoped**: Apply globally, per-workspace, per-file-type, or per-file
- **Prioritized**: Higher priority rules take precedence
- **Auto-detected**: System suggests rules from repeated patterns

### Prescription Types

#### By Category
- **Formatting**: Code style, syntax preferences
- **Behavior**: How AI should act (concise, show diffs, etc.)
- **Domain**: Project type and tech stack
- **Workflow**: Process requirements (run tests, etc.)
- **Security**: Never include real credentials
- **Communication**: Response style preferences
- **Allowlist**: Preferred libraries/patterns
- **Blocklist**: Forbidden libraries/patterns
- **Constraints**: Hard limitations

#### By Scope
- **Global**: Apply to all prompts everywhere
- **Workspace**: Apply only in specific workspace
- **File-Type**: Apply when editing specific file types (.js, .py, etc.)
- **File**: Apply to specific file paths

---

## Architecture

```
prescriptions/
├── schema.js          # Database schema & validation
├── manager.js         # Core CRUD operations
├── injector.js        # Context injection & formatting
├── detector.js        # Pattern detection & suggestions
├── api.js             # Express API routes
├── index.js           # Main entry point
└── README.md          # This file

public/
├── prescriptions.html # Dashboard UI
├── prescriptions.js   # Dashboard logic
└── prescriptions.css  # Dashboard styles
```

### Database Schema

```sql
CREATE TABLE prescriptions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  prescription TEXT NOT NULL,
  category TEXT NOT NULL,
  scope TEXT DEFAULT 'global',
  scope_value TEXT,
  priority INTEGER DEFAULT 10,
  active BOOLEAN DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  applied_count INTEGER DEFAULT 0,
  last_applied INTEGER,
  source TEXT DEFAULT 'manual',
  tags TEXT,
  metadata TEXT
);
```

### Core Classes

#### `PrescriptionManager`
Handles CRUD operations, validation, conflict detection, and statistics.

#### `PrescriptionInjector`
Formats prescriptions for injection into AI prompts. Handles scope resolution and priority ordering.

#### `PrescriptionDetector`
Analyzes prompt history and code patterns to suggest new prescriptions automatically.

---

## Installation

### 1. Initialize in Companion Service

Add to `companion/src/index.js`:

```javascript
const { initializePrescriptionSystem } = require('./prescriptions');

// After database initialization
const prescriptionSystem = initializePrescriptionSystem(db, app);

// System components available:
// - prescriptionSystem.manager
// - prescriptionSystem.injector
// - prescriptionSystem.detector
```

### 2. Database Migration

The schema is automatically created on first initialization. No manual migration needed.

### 3. Access Dashboard

Open: `http://localhost:43917/prescriptions.html`

---

## API Reference

All endpoints are mounted at `/api/prescriptions`.

### CRUD Operations

#### `GET /api/prescriptions`
Get all prescriptions with optional filtering.

**Query Parameters:**
- `active` (boolean): Filter by active status
- `category` (string): Filter by category
- `scope` (string): Filter by scope
- `search` (string): Search in title and prescription text

**Response:**
```json
{
  "success": true,
  "count": 10,
  "prescriptions": [
    {
      "id": "presc-1234567890-abc123",
      "title": "No Markdown Files",
      "prescription": "Don't create markdown files unless explicitly requested",
      "category": "behavior",
      "scope": "global",
      "priority": 70,
      "active": true,
      "applied_count": 45,
      "created_at": 1729814400000,
      "updated_at": 1729814400000
    }
  ]
}
```

#### `POST /api/prescriptions`
Create new prescription.

**Body:**
```json
{
  "title": "TypeScript Project",
  "prescription": "This is a TypeScript project - use strict typing",
  "category": "domain",
  "scope": "global",
  "priority": 80
}
```

#### `PATCH /api/prescriptions/:id`
Update prescription.

#### `DELETE /api/prescriptions/:id`
Delete prescription.

#### `POST /api/prescriptions/:id/toggle`
Toggle prescription active state.

### Context Injection

#### `GET /api/prescriptions/inject`
Get formatted prescriptions for context injection.

**Query Parameters:**
- `workspace` (string): Workspace path
- `fileType` (string): File extension (e.g., '.js')
- `filePath` (string): Full file path
- `format` (string): Output format - 'prompt', 'json', 'markdown', 'plain'

**Response:**
```json
{
  "success": true,
  "formatted": "═══════════════════\n📋 ACTIVE PRESCRIPTIONS\n...",
  "count": 5,
  "prescriptions": [...],
  "context": {
    "workspace": "/path/to/project",
    "fileType": ".js"
  }
}
```

**Example formatted output:**
```
═══════════════════════════════════════
📋 ACTIVE PRESCRIPTIONS
Context: Workspace: .../my-project | File Type: .js
═══════════════════════════════════════

🏗️ DOMAIN
  • [HIGH] This is a TypeScript project - use strict typing

🎯 BEHAVIOR
  • Don't create markdown files unless explicitly requested
  • Always show code diffs, not full file rewrites

✨ FORMATTING
  • Omit semicolons in JavaScript code
  • Prefer single quotes over double quotes

═══════════════════════════════════════
↓ USER REQUEST FOLLOWS BELOW
═══════════════════════════════════════

[User's actual prompt appears here]
```

#### `GET /api/prescriptions/inject/preview`
Preview injection for given context (for testing).

### Statistics & Analytics

#### `GET /api/prescriptions/stats`
Get comprehensive statistics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 15,
    "active": 12,
    "inactive": 3,
    "byCategory": [...],
    "byScope": [...],
    "mostApplied": [...],
    "recentlyUpdated": [...],
    "conflicts": [...]
  }
}
```

#### `GET /api/prescriptions/conflicts`
Detect conflicting prescriptions.

### Auto-Detection

#### `GET /api/prescriptions/suggest`
Get prescription suggestions from patterns.

**Query Parameters:**
- `days` (number): Look back N days (default: 7)
- `minOccurrences` (number): Minimum pattern occurrences (default: 3)
- `source` (string): 'prompts', 'code', or 'all' (default: 'all')

**Response:**
```json
{
  "success": true,
  "count": 5,
  "suggestions": [
    {
      "title": "No Markdown Files",
      "prescription": "Don't create markdown files unless explicitly requested",
      "category": "behavior",
      "scope": "global",
      "priority": 70,
      "confidence": 0.85,
      "occurrences": 12,
      "reason": "Detected 12 times in last 7 days"
    }
  ]
}
```

#### `POST /api/prescriptions/suggest/accept`
Accept a suggestion and create prescription.

### Import/Export

#### `GET /api/prescriptions/export`
Export all prescriptions as JSON.

#### `POST /api/prescriptions/import`
Import prescriptions from JSON.

**Body:**
```json
{
  "prescriptions": [...],
  "overwrite": false
}
```

### Templates

#### `GET /api/prescriptions/templates`
Get predefined prescription templates.

#### `POST /api/prescriptions/templates/:templateId/apply`
Apply a template (creates multiple prescriptions).

---

## Dashboard UI

Access at: `http://localhost:43917/prescriptions.html`

### Features

1. **Visual Management**
   - View all prescriptions organized by category
   - Color-coded priority levels
   - Toggle active/inactive state
   - Quick edit and delete

2. **Filtering & Search**
   - Full-text search
   - Filter by category, scope, active status
   - Real-time filtering

3. **Statistics Dashboard**
   - Total, active, inactive counts
   - Conflict detection
   - Usage tracking

4. **Smart Suggestions**
   - Auto-detect patterns from prompt history
   - Analyze code style preferences
   - One-click acceptance

5. **Templates**
   - Pre-built prescription bundles
   - React/Next.js project
   - Python data science
   - Security-focused
   - Clean code principles

6. **Import/Export**
   - Backup prescriptions as JSON
   - Share across projects
   - Team collaboration

---

## Usage Examples

### Example 1: Create Basic Prescription

```javascript
const result = manager.create({
  title: 'No Markdown Files',
  prescription: "Don't create markdown files unless explicitly requested",
  category: 'behavior',
  scope: 'global',
  priority: 70
});
```

### Example 2: Inject Into Prompt

```javascript
const context = {
  workspace: '/Users/dev/my-project',
  fileType: '.js',
  filePath: '/Users/dev/my-project/src/auth.js'
};

const result = injector.inject(context);

// result.formatted contains the formatted prescription text
// Prepend to user's prompt:
const fullPrompt = result.formatted + userPrompt;
```

### Example 3: Get Suggestions

```javascript
const suggestions = await detector.suggestFromPrompts({
  days: 14,
  minOccurrences: 5
});

suggestions.forEach(s => {
  console.log(`${s.title} (${Math.round(s.confidence * 100)}% confidence)`);
  console.log(`  ${s.prescription}`);
});
```

### Example 4: Apply Template

```bash
curl -X POST http://localhost:43917/api/prescriptions/templates/react-nextjs/apply
```

---

## Pattern Detection

The detector automatically identifies repeated patterns in:

### 1. Prompt History Analysis

Detects phrases like:
- "don't write markdown" → No Markdown Files prescription
- "use TypeScript" → TypeScript Project prescription
- "be concise" → Concise Responses prescription
- "show diffs" → Show Code Diffs prescription

### 2. Code Style Analysis

Analyzes file changes to detect:
- Semicolon usage (or lack thereof)
- Quote style (single vs double)
- Type annotations presence
- Indentation style

### Detection Patterns Included

- ✅ Markdown avoidance
- ✅ Conciseness preferences
- ✅ Diff display preferences
- ✅ Framework identification (React, TypeScript, Python)
- ✅ Testing workflow
- ✅ Console.log cleanup
- ✅ API key security
- ✅ Module system (ESM vs CommonJS)
- ✅ Code style guides (Prettier, Airbnb)

### Confidence Scoring

Suggestions include confidence scores (0-1) based on:
- Frequency of pattern occurrence
- Consistency of pattern
- Recency of pattern

---

## Templates

### Available Templates

#### 1. React/Next.js Project
- React best practices
- Server Components preference
- TypeScript strict mode

#### 2. Python Data Science
- Python data science focus
- Type hints required
- Docstring requirements

#### 3. Security-Focused Development
- No real credentials
- Input validation
- Environment variables

#### 4. Clean Code Principles
- Descriptive naming
- Small functions
- DRY principle
- No magic numbers

### Creating Custom Templates

Add to `api.js`:

```javascript
{
  id: 'my-template',
  name: 'My Custom Template',
  description: 'Description here',
  prescriptions: [
    {
      title: 'Rule 1',
      prescription: 'Description',
      category: 'behavior',
      scope: 'global',
      priority: 70
    }
    // ... more prescriptions
  ]
}
```

---

## Integration

### With MCP (Model Context Protocol)

Automatically inject prescriptions into MCP requests:

```javascript
// In MCP handler
app.post('/mcp/prompt', async (req, res) => {
  const { prompt, context } = req.body;
  
  // Inject prescriptions
  const injection = injector.inject({
    workspace: context.workspace,
    fileType: context.fileType,
    filePath: context.filePath
  });
  
  const enhancedPrompt = injection.formatted + prompt;
  
  // Send to AI...
});
```

### With Cursor Database Mining

Learn from prompt patterns:

```javascript
// Periodically analyze and suggest
setInterval(async () => {
  const suggestions = await detector.getAllSuggestions();
  
  if (suggestions.combined.length > 0) {
    console.log(`💡 ${suggestions.combined.length} new prescription suggestions available`);
    // Notify user or auto-create with confirmation
  }
}, 24 * 60 * 60 * 1000); // Daily
```

### With Activity Logger

Track prescription effectiveness:

```javascript
// After AI response
activityLogger.logEvent({
  type: 'prescription_applied',
  prescriptions: injection.prescriptions.map(p => p.id),
  userSatisfaction: calculateSatisfaction(response)
});
```

---

## Best Practices

### 1. Start Small
Begin with 3-5 critical prescriptions, not 50.

### 2. Use Scope Wisely
- Global for universal rules
- Workspace for project-specific
- File-type for language-specific

### 3. Priority Guidelines
- **80-100**: Critical (security, project type)
- **50-79**: Important (behavior, formatting)
- **1-49**: Nice-to-have (preferences)

### 4. Be Specific
❌ "Use good code"
✅ "Use descriptive variable names (min 3 characters, no abbreviations)"

### 5. Avoid Conflicts
Check for contradictions:
- "Always use semicolons" vs "Never use semicolons"
- Use conflict detection API

### 6. Review Regularly
- Check `/stats` monthly
- Remove unused prescriptions (low `applied_count`)
- Update based on effectiveness

---

## Troubleshooting

### Prescriptions Not Applied

1. Check if prescription is `active: true`
2. Verify scope matches context
3. Check priority (higher = more important)
4. Ensure injection is actually happening in your integration

### Conflicts Detected

1. Review conflict report: `GET /api/prescriptions/conflicts`
2. Adjust priorities or disable conflicting prescriptions
3. Use more specific scopes to avoid overlap

### Suggestions Not Appearing

1. Need enough prompt history (check database)
2. Adjust `minOccurrences` threshold
3. Check `days` parameter (may need longer history)

---

## Future Enhancements

- [ ] Prescription versioning
- [ ] A/B testing for effectiveness
- [ ] Team sharing and sync
- [ ] IDE integration (VSCode extension)
- [ ] Natural language prescription creation
- [ ] Conditional prescriptions ("if X then Y")
- [ ] Prescription inheritance (child workspaces)
- [ ] Machine learning for better detection

---

## Contributing

To extend the system:

1. **New categories**: Add to `CATEGORIES` in `schema.js`
2. **New detection patterns**: Add to `getDetectionPatterns()` in `detector.js`
3. **New templates**: Add to `getPrescriptionTemplates()` in `api.js`

---

## License

Part of Cursor Telemetry Dashboard - Same license as parent project.

---

## Support

For issues or questions:
- Check the API documentation
- Review examples above
- Open an issue on GitHub

