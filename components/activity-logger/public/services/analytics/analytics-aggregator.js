/**
 * Analytics Aggregator
 * Computes time-series analytics from events and prompts
 */

class AnalyticsAggregator {
  constructor(storage) {
    this.storage = storage;
    this.lastAggregation = 0;
    this.aggregationInterval = 60 * 60 * 1000; // 1 hour
  }

  /**
   * Aggregate all analytics
   */
  async aggregateAll() {
    console.log('[DATA] Starting analytics aggregation...');
    
    const now = Date.now();
    
    // Get all data
    const [events, prompts] = await Promise.all([
      this.storage.getAllEvents(),
      this.storage.getAllPrompts()
    ]);

    // Aggregate metrics
    await Promise.all([
      this.aggregateFileActivity(events),
      this.aggregatePromptActivity(prompts),
      this.aggregateProductivity(events, prompts),
      this.aggregateComplexity(events),
      this.aggregateLanguageDistribution(events),
      this.aggregateSessionMetrics(events),
      this.aggregateWorkspaceMetrics(events, prompts)
    ]);

    this.lastAggregation = now;
    
    console.log('[SUCCESS] Analytics aggregation complete');
  }

  /**
   * Aggregate file activity over time
   */
  async aggregateFileActivity(events) {
    const fileChanges = events.filter(e => 
      e.type === 'code_change' || e.type === 'file_change'
    );

    // Group by hour
    const hourlyActivity = this.groupByHour(fileChanges);
    
    for (const [timestamp, eventsInHour] of Object.entries(hourlyActivity)) {
      const files = new Set(eventsInHour.map(e => {
        try {
          const details = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
          return details?.file_path;
        } catch {
          return null;
        }
      }).filter(Boolean));

      const totalChanges = eventsInHour.length;
      const uniqueFiles = files.size;
      
      let totalLinesAdded = 0;
      let totalLinesRemoved = 0;
      let totalCharsAdded = 0;
      
      eventsInHour.forEach(e => {
        try {
          const details = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
          totalLinesAdded += details?.lines_added || 0;
          totalLinesRemoved += details?.lines_removed || 0;
          totalCharsAdded += details?.chars_added || 0;
        } catch {}
      });

      await this.storage.storeTimeSeriesPoint('fileActivity', {
        totalChanges,
        uniqueFiles,
        linesAdded: totalLinesAdded,
        linesRemoved: totalLinesRemoved,
        charsAdded: totalCharsAdded,
        avgChangesPerFile: uniqueFiles > 0 ? totalChanges / uniqueFiles : 0
      }, null, { period: 'hourly', timestamp: parseInt(timestamp) });
    }
  }

  /**
   * Aggregate prompt activity over time
   */
  async aggregatePromptActivity(prompts) {
    // Group by hour
    const hourlyPrompts = this.groupByHour(prompts);
    
    for (const [timestamp, promptsInHour] of Object.entries(hourlyPrompts)) {
      const workspaces = new Set(promptsInHour.map(p => p.workspaceId).filter(Boolean));
      const composers = new Set(promptsInHour.map(p => p.composerId).filter(Boolean));
      
      let totalLinesAdded = 0;
      let totalLinesRemoved = 0;
      let totalContextUsage = 0;
      let contextUsageCount = 0;
      
      promptsInHour.forEach(p => {
        totalLinesAdded += p.linesAdded || 0;
        totalLinesRemoved += p.linesRemoved || 0;
        if (p.contextUsage !== undefined) {
          totalContextUsage += p.contextUsage;
          contextUsageCount++;
        }
      });

      await this.storage.storeTimeSeriesPoint('promptActivity', {
        totalPrompts: promptsInHour.length,
        uniqueWorkspaces: workspaces.size,
        uniqueComposers: composers.size,
        linesAdded: totalLinesAdded,
        linesRemoved: totalLinesRemoved,
        avgContextUsage: contextUsageCount > 0 ? totalContextUsage / contextUsageCount : 0,
        promptsPerWorkspace: workspaces.size > 0 ? promptsInHour.length / workspaces.size : 0
      }, null, { period: 'hourly', timestamp: parseInt(timestamp) });
    }
  }

  /**
   * Aggregate productivity metrics
   */
  async aggregateProductivity(events, prompts) {
    const hourlyEvents = this.groupByHour(events);
    const hourlyPrompts = this.groupByHour(prompts);
    
    // Combine timestamps
    const allTimestamps = new Set([
      ...Object.keys(hourlyEvents),
      ...Object.keys(hourlyPrompts)
    ]);

    for (const timestamp of allTimestamps) {
      const eventsInHour = hourlyEvents[timestamp] || [];
      const promptsInHour = hourlyPrompts[timestamp] || [];
      
      const fileChanges = eventsInHour.filter(e => 
        e.type === 'code_change' || e.type === 'file_change'
      ).length;
      
      const aiInteractions = promptsInHour.length;
      
      // Calculate velocity (changes per hour)
      const velocity = fileChanges;
      
      // Calculate AI efficiency (file changes per AI interaction)
      const aiEfficiency = aiInteractions > 0 ? fileChanges / aiInteractions : 0;
      
      // Calculate total output (chars added)
      let totalOutput = 0;
      eventsInHour.forEach(e => {
        try {
          const details = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
          totalOutput += details?.chars_added || 0;
        } catch {}
      });

      await this.storage.storeTimeSeriesPoint('productivity', {
        velocity,
        aiEfficiency,
        totalOutput,
        fileChanges,
        aiInteractions,
        outputPerChange: fileChanges > 0 ? totalOutput / fileChanges : 0
      }, null, { period: 'hourly', timestamp: parseInt(timestamp) });
    }
  }

  /**
   * Aggregate code complexity metrics
   */
  async aggregateComplexity(events) {
    const hourlyEvents = this.groupByHour(events);
    
    for (const [timestamp, eventsInHour] of Object.entries(hourlyEvents)) {
      let totalComplexity = 0;
      let complexityCount = 0;
      let refactoringCount = 0;
      
      eventsInHour.forEach(e => {
        try {
          const details = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
          const content = details?.after_content || '';
          
          if (content) {
            // Simple complexity heuristic
            const complexity = this.calculateCodeComplexity(content);
            totalComplexity += complexity;
            complexityCount++;
          }
          
          // Detect refactoring
          if (this.isRefactoring(details)) {
            refactoringCount++;
          }
        } catch {}
      });

      if (complexityCount > 0) {
        await this.storage.storeTimeSeriesPoint('complexity', {
          avgComplexity: totalComplexity / complexityCount,
          refactoringCount,
          totalFiles: complexityCount
        }, null, { period: 'hourly', timestamp: parseInt(timestamp) });
      }
    }
  }

  /**
   * Aggregate language distribution
   */
  async aggregateLanguageDistribution(events) {
    const fileChanges = events.filter(e => 
      e.type === 'code_change' || e.type === 'file_change'
    );

    // Group by day for language stats
    const dailyFiles = this.groupByDay(fileChanges);
    
    for (const [timestamp, eventsInDay] of Object.entries(dailyFiles)) {
      const languageCount = {};
      const languageLines = {};
      
      eventsInDay.forEach(e => {
        try {
          const details = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
          const filePath = details?.file_path || '';
          const ext = filePath.split('.').pop()?.toLowerCase();
          
          if (ext) {
            languageCount[ext] = (languageCount[ext] || 0) + 1;
            languageLines[ext] = (languageLines[ext] || 0) + (details?.lines_added || 0);
          }
        } catch {}
      });

      // Convert to array and sort
      const languages = Object.entries(languageCount).map(([lang, count]) => ({
        language: lang,
        files: count,
        lines: languageLines[lang] || 0
      })).sort((a, b) => b.files - a.files);

      await this.storage.storeTimeSeriesPoint('languageDistribution', languages, null, {
        period: 'daily',
        timestamp: parseInt(timestamp)
      });
    }
  }

  /**
   * Aggregate session metrics
   */
  async aggregateSessionMetrics(events) {
    // Group events by session
    const sessionMap = new Map();
    
    events.forEach(e => {
      const sessionId = e.session_id;
      if (!sessionId) return;
      
      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, {
          sessionId,
          events: [],
          startTime: e.timestamp,
          endTime: e.timestamp
        });
      }
      
      const session = sessionMap.get(sessionId);
      session.events.push(e);
      session.startTime = Math.min(session.startTime, e.timestamp);
      session.endTime = Math.max(session.endTime, e.timestamp);
    });

    // Aggregate session stats
    for (const session of sessionMap.values()) {
      const duration = session.endTime - session.startTime;
      const eventCount = session.events.length;
      const avgEventInterval = eventCount > 1 ? duration / (eventCount - 1) : 0;
      
      await this.storage.storeTimeSeriesPoint('sessionMetrics', {
        sessionId: session.sessionId,
        duration,
        eventCount,
        avgEventInterval,
        eventsPerMinute: duration > 0 ? (eventCount / (duration / 60000)) : 0
      }, null, { timestamp: session.startTime });
    }
  }

  /**
   * Aggregate workspace metrics
   */
  async aggregateWorkspaceMetrics(events, prompts) {
    const workspaceMap = new Map();
    
    // Process events
    events.forEach(e => {
      const workspace = e.workspace_path;
      if (!workspace) return;
      
      if (!workspaceMap.has(workspace)) {
        workspaceMap.set(workspace, {
          workspace,
          fileChanges: 0,
          prompts: 0,
          totalOutput: 0,
          lastActivity: e.timestamp
        });
      }
      
      const ws = workspaceMap.get(workspace);
      ws.fileChanges++;
      ws.lastActivity = Math.max(ws.lastActivity, e.timestamp);
      
      try {
        const details = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
        ws.totalOutput += details?.chars_added || 0;
      } catch {}
    });

    // Process prompts
    prompts.forEach(p => {
      const workspace = p.workspacePath || p.workspaceId;
      if (!workspace) return;
      
      if (!workspaceMap.has(workspace)) {
        workspaceMap.set(workspace, {
          workspace,
          fileChanges: 0,
          prompts: 0,
          totalOutput: 0,
          lastActivity: p.timestamp
        });
      }
      
      const ws = workspaceMap.get(workspace);
      ws.prompts++;
      ws.lastActivity = Math.max(ws.lastActivity, p.timestamp);
    });

    // Store workspace metrics
    for (const metrics of workspaceMap.values()) {
      await this.storage.storeTimeSeriesPoint('workspaceMetrics', {
        fileChanges: metrics.fileChanges,
        prompts: metrics.prompts,
        totalOutput: metrics.totalOutput,
        productivity: metrics.fileChanges + metrics.prompts
      }, metrics.workspace, { timestamp: metrics.lastActivity });
    }
  }

  /**
   * Helper: Group items by hour
   */
  groupByHour(items) {
    const groups = {};
    
    items.forEach(item => {
      const timestamp = new Date(item.timestamp);
      timestamp.setMinutes(0, 0, 0);
      const hourKey = timestamp.getTime();
      
      if (!groups[hourKey]) {
        groups[hourKey] = [];
      }
      groups[hourKey].push(item);
    });
    
    return groups;
  }

  /**
   * Helper: Group items by day
   */
  groupByDay(items) {
    const groups = {};
    
    items.forEach(item => {
      const timestamp = new Date(item.timestamp);
      timestamp.setHours(0, 0, 0, 0);
      const dayKey = timestamp.getTime();
      
      if (!groups[dayKey]) {
        groups[dayKey] = [];
      }
      groups[dayKey].push(item);
    });
    
    return groups;
  }

  /**
   * Helper: Calculate code complexity (simple heuristic)
   */
  calculateCodeComplexity(code) {
    if (!code) return 0;
    
    let complexity = 1; // base complexity
    
    // Count control structures
    const controlStructures = (code.match(/\b(if|else|for|while|switch|case)\b/g) || []).length;
    complexity += controlStructures;
    
    // Count function definitions
    const functions = (code.match(/\bfunction\b|\b=>\b/g) || []).length;
    complexity += functions * 2;
    
    // Count nested levels (rough estimate)
    const maxNesting = Math.max(...code.split('\n').map(line => {
      const leadingSpaces = line.match(/^\s*/)[0].length;
      return Math.floor(leadingSpaces / 2);
    }));
    complexity += maxNesting;
    
    return complexity;
  }

  /**
   * Helper: Detect refactoring
   */
  isRefactoring(details) {
    if (!details) return false;
    
    const before = details.before_content || '';
    const after = details.after_content || '';
    
    // Heuristic: similar length but different content suggests refactoring
    const lengthDiff = Math.abs(after.length - before.length);
    const lengthRatio = lengthDiff / Math.max(before.length, 1);
    
    return lengthRatio < 0.2 && before.length > 100;
  }
}


