/**
 * AI Query Generator - Converts natural language to SQL
 */

class AIQueryGenerator {
  constructor() {
    this.apiBase = window.CONFIG?.API_BASE_URL || 'http://localhost:43917';
    this.schema = this.getSchema();
  }

  getSchema() {
    return {
      events: {
        columns: ['id', 'timestamp', 'type', 'file_path', 'workspace_path', 'session_id', 'details'],
        description: 'File change events and activity'
      },
      prompts: {
        columns: ['id', 'timestamp', 'text', 'workspace_id', 'workspace_path', 'model_name', 'context_file_count', 'lines_added', 'lines_removed'],
        description: 'AI prompts and interactions'
      },
      entries: {
        columns: ['id', 'session_id', 'workspace_path', 'file_path', 'before_code', 'after_code', 'timestamp'],
        description: 'Code change entries with before/after'
      },
      conversations: {
        columns: ['id', 'workspace_id', 'title', 'created_at', 'message_count'],
        description: 'AI conversation threads'
      },
      terminal: {
        columns: ['id', 'command', 'workspace', 'timestamp', 'exit_code', 'duration'],
        description: 'Terminal command history'
      }
    };
  }

  async generateSQL(naturalQuery) {
    // Simple rule-based query generation (can be enhanced with actual AI)
    const query = naturalQuery.toLowerCase();
    
    // Pattern matching for common queries
    if (query.includes('file') && (query.includes('edit') || query.includes('change') || query.includes('modify'))) {
      return this.generateFileEditQuery(query);
    }
    
    if (query.includes('prompt') || query.includes('ai') || query.includes('model')) {
      return this.generatePromptQuery(query);
    }
    
    if (query.includes('time') || query.includes('hour') || query.includes('day') || query.includes('when')) {
      return this.generateTimeQuery(query);
    }
    
    if (query.includes('workspace') || query.includes('project')) {
      return this.generateWorkspaceQuery(query);
    }
    
    // Default: try to extract entities and create basic query
    return this.generateDefaultQuery(query);
  }

  generateFileEditQuery(query) {
    let sql = 'SELECT file_path, COUNT(*) as edit_count FROM events';
    
    // Add time filter
    if (query.includes('today')) {
      sql += " WHERE timestamp > datetime('now', '-1 day')";
    } else if (query.includes('week') || query.includes('7 day')) {
      sql += " WHERE timestamp > datetime('now', '-7 days')";
    } else if (query.includes('month') || query.includes('30 day')) {
      sql += " WHERE timestamp > datetime('now', '-30 days')";
    } else {
      sql += ' WHERE 1=1';
    }
    
    sql += ' GROUP BY file_path ORDER BY edit_count DESC LIMIT 20';
    return sql;
  }

  generatePromptQuery(query) {
    let sql = 'SELECT ';
    
    if (query.includes('model')) {
      sql += 'model_name, COUNT(*) as count';
    } else if (query.includes('context')) {
      sql += 'DATE(timestamp) as date, AVG(context_file_count) as avg_context';
    } else {
      sql += 'DATE(timestamp) as date, COUNT(*) as prompt_count';
    }
    
    sql += ' FROM prompts';
    
    if (query.includes('today')) {
      sql += " WHERE timestamp > datetime('now', '-1 day')";
    } else if (query.includes('week')) {
      sql += " WHERE timestamp > datetime('now', '-7 days')";
    }
    
    if (query.includes('model')) {
      sql += ' GROUP BY model_name';
    } else {
      sql += ' GROUP BY date ORDER BY date DESC';
    }
    
    sql += ' LIMIT 50';
    return sql;
  }

  generateTimeQuery(query) {
    let sql = "SELECT strftime('%H', timestamp) as hour, COUNT(*) as activity_count FROM events";
    
    if (query.includes('today')) {
      sql += " WHERE DATE(timestamp) = DATE('now')";
    } else if (query.includes('week')) {
      sql += " WHERE timestamp > datetime('now', '-7 days')";
    } else {
      sql += " WHERE timestamp > datetime('now', '-30 days')";
    }
    
    sql += " GROUP BY hour ORDER BY hour";
    return sql;
  }

  generateWorkspaceQuery(query) {
    let sql = 'SELECT workspace_path, COUNT(*) as activity_count FROM events';
    
    if (query.includes('today')) {
      sql += " WHERE timestamp > datetime('now', '-1 day')";
    } else if (query.includes('week')) {
      sql += " WHERE timestamp > datetime('now', '-7 days')";
    }
    
    sql += ' GROUP BY workspace_path ORDER BY activity_count DESC LIMIT 20';
    return sql;
  }

  generateDefaultQuery(query) {
    // Try to extract key entities
    const words = query.split(/\s+/);
    const entities = words.filter(w => 
      ['file', 'prompt', 'event', 'workspace', 'model', 'time', 'day', 'hour'].includes(w)
    );
    
    if (entities.includes('file')) {
      return this.generateFileEditQuery(query);
    }
    
    if (entities.includes('prompt')) {
      return this.generatePromptQuery(query);
    }
    
    // Fallback: simple event count
    return "SELECT DATE(timestamp) as date, COUNT(*) as count FROM events WHERE timestamp > datetime('now', '-30 days') GROUP BY date ORDER BY date DESC LIMIT 30";
  }
}

