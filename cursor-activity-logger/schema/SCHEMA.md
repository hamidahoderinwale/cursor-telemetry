# Database Schema - Cursor Activity Logger

This document describes the database schema used by the Cursor Activity Logger application.

## Overview

The application uses IndexedDB (via Dexie.js) to store activity data locally. The schema consists of three main tables: `sessions`, `entries`, and `attachments`.

## Tables

### `sessions` Table

Stores information about work sessions.

| Field        | Type                             | Description                    |
| ------------ | -------------------------------- | ------------------------------ |
| `id`         | `string (UUID or ISO timestamp)` | Primary key, unique session ID |
| `name`       | `string`                         | Human-friendly session label   |
| `created_at` | `datetime (ISO8601)`             | Session start time             |

**Indexes:**
- Primary: `id`
- Secondary: `created_at` (for chronological ordering)

### `entries` Table

Stores individual activity entries within sessions.

| Field         | Type                   | Description                           |
| ------------- | ---------------------- | ------------------------------------- |
| `id`          | `autoincrement / uuid` | Primary key                           |
| `session_id`  | `string (FK)`          | References `sessions.id`              |
| `timestamp`   | `datetime`             | When the entry was created            |
| `file_path`   | `string`               | File or context (optional)            |
| `prompt`      | `text`                 | User input                            |
| `response`    | `text`                 | AI or code response                   |
| `notes`       | `text`                 | Any additional notes / rationale      |
| `tags`        | `array<string>`        | Optional keywords for later filtering |
| `before_code` | `text`                 | Code before edit (for diffs)          |
| `after_code`  | `text`                 | Code after edit (for diffs)           |

**Indexes:**
- Primary: `id`
- Foreign Key: `session_id` (references `sessions.id`)
- Secondary: `timestamp` (for chronological ordering)
- Secondary: `file_path` (for filtering by file)

### `attachments` Table

Stores file attachments linked to entries.

| Field       | Type            | Description       |
| ----------- | --------------- | ----------------- |
| `id`        | `autoincrement` | Primary key       |
| `entry_id`  | `int (FK)`      | References `entries.id` |
| `name`      | `string`        | Original filename |
| `mime_type` | `string`        | File MIME type    |
| `data`      | `string`        | File data (base64)|

**Indexes:**
- Primary: `id`
- Foreign Key: `entry_id` (references `entries.id`)

## Relationships

```
SESSIONS (1) -----> (many) ENTRIES (1) -----> (many) ATTACHMENTS
```

- One session can have many entries
- Each entry belongs to exactly one session
- Each entry can have many attachments
- When a session is deleted, all associated entries and attachments should be deleted (cascade delete)
- When an entry is deleted, all associated attachments should be deleted (cascade delete)

## Data Types

### String Fields
- `id`: Unique identifier, typically generated using timestamp + random string
- `name`: Human-readable session name
- `file_path`: File system path (optional)
- `prompt`: User input text
- `response`: AI response or code text
- `notes`: Additional context text
- `before_code`: Code before edit (for diffs)
- `after_code`: Code after edit (for diffs)
- `name`: Attachment filename
- `mime_type`: Attachment MIME type
- `data`: Attachment data (base64 encoded)

### DateTime Fields
- `created_at`: ISO8601 formatted datetime string
- `timestamp`: ISO8601 formatted datetime string

### Array Fields
- `tags`: Array of string tags for categorization

## Constraints

1. **Primary Keys**: All tables have unique primary keys
2. **Foreign Keys**: `entries.session_id` must reference an existing `sessions.id`
3. **Required Fields**: 
   - Sessions: `id`, `name`, `created_at`
   - Entries: `id`, `session_id`, `timestamp`
4. **Optional Fields**: All other fields can be null/empty

## Indexing Strategy

- Primary indexes on all `id` fields for fast lookups
- Secondary index on `sessions.created_at` for chronological session ordering
- Secondary index on `entries.timestamp` for chronological entry ordering
- Secondary index on `entries.session_id` for efficient session-based queries
- Secondary index on `entries.file_path` for file-based filtering

## Data Retention

- No automatic data expiration
- Users can manually clear all data via the "Clear Database" button
- Data persists in browser's IndexedDB until manually cleared

## Privacy Considerations

- All data is stored locally in the browser
- No data is transmitted to external servers
- Data is not synchronized across devices
- Users have full control over their data

## Implemented Extensions

The following extensions have been implemented:

- **Code Diffs**: `before_code` and `after_code` fields for tracking code changes
- **File Attachments**: `attachments` table for storing file attachments linked to entries
- **Full-Text Search**: MiniSearch integration for searching across prompts, responses, and notes

## Future Extensions

Additional potential future additions include:

- `author` field for multi-user scenarios
- `collaboration` features for team environments
- `export` formats beyond CSV/JSON
- `sync` capabilities for multi-device usage
