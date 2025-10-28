#!/usr/bin/env node

/**
 * Productivity Tracker
 * Tracks time-to-first-edit, active coding time, prompt iterations, code churn, and debug frequency
 */

class ProductivityTracker {
  constructor() {
    this.promptPending = new Map(); // promptId -> { timestamp, waitingForEdit: true }
    this.activityIntervals = [];
    this.promptIterations = [];
    this.codeChurn = [];
    this.debugActivity = [];
    this.aiGeneratedCodeMap = new Map(); // file -> { content, hash, timestamp, modifications }
    
    this.lastActivityTimestamp = Date.now();
    this.currentSessionActive = true;
    this.currentSessionStartTime = Date.now();
    this.activeTime = 0;
    this.waitingTime = 0;
  }

  /**
   * Track prompt creation (start timer for time-to-first-edit)
   */
  trackPromptCreated(prompt) {
    this.promptPending.set(prompt.id, {
      timestamp: Date.now(),
      waitingForEdit: true,
      promptText: prompt.text || prompt.content
    });

    console.log(`⏱️  Started timer for prompt ${prompt.id}`);
  }

  /**
   * Track file edit (calculate time-to-first-edit)
   */
  trackFileEdit(fileChange) {
    const editTimestamp = new Date(fileChange.timestamp).getTime();
    const results = [];

    // Find pending prompts
    this.promptPending.forEach((promptData, promptId) => {
      if (promptData.waitingForEdit) {
        const timeToEdit = editTimestamp - promptData.timestamp;

        // Only count if within reasonable time (< 10 minutes)
        if (timeToEdit < 10 * 60 * 1000 && timeToEdit > 0) {
          const metric = {
            id: `tte_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            promptId: promptId,
            fileChangeId: fileChange.id,
            metric: 'time_to_first_edit',
            value: timeToEdit,  // milliseconds
            valueSec: Math.round(timeToEdit / 1000),
            filePath: fileChange.file_path,
            timestamp: editTimestamp
          };

          results.push(metric);
          promptData.waitingForEdit = false;

          console.log(`[FAST] Time-to-first-edit: ${metric.valueSec}s for prompt ${promptId}`);
        }
      }
    });

    // Clean up old pending prompts (> 10 minutes)
    const cutoff = Date.now() - (10 * 60 * 1000);
    this.promptPending.forEach((data, id) => {
      if (data.timestamp < cutoff) {
        this.promptPending.delete(id);
      }
    });

    return results;
  }

  /**
   * Track activity (for active time vs waiting time)
   */
  trackActivity(activityType) {
    const now = Date.now();
    const timeSinceLastActivity = now - this.lastActivityTimestamp;

    // If inactive for > 30 seconds, consider it "waiting"
    if (timeSinceLastActivity > 30000 && this.currentSessionActive) {
      this.currentSessionActive = false;
      this.activeTime += timeSinceLastActivity;
    } else if (activityType === 'keystroke' || activityType === 'file_change') {
      if (!this.currentSessionActive) {
        this.waitingTime += timeSinceLastActivity;
      }
      this.currentSessionActive = true;
      this.activeTime += timeSinceLastActivity;
    }

    this.lastActivityTimestamp = now;

    // Log activity interval every 5 minutes
    if (now - this.currentSessionStartTime > 5 * 60 * 1000) {
      const interval = {
        id: `interval_${Date.now()}`,
        startTime: this.currentSessionStartTime,
        endTime: now,
        activeTime: this.activeTime,
        waitingTime: this.waitingTime,
        ratio: this.activeTime / (this.activeTime + this.waitingTime),
        timestamp: now
      };

      this.activityIntervals.push(interval);

      // Keep only last 500 intervals
      if (this.activityIntervals.length > 500) {
        this.activityIntervals = this.activityIntervals.slice(-500);
      }

      // Reset counters
      this.currentSessionStartTime = now;
      this.activeTime = 0;
      this.waitingTime = 0;
    }
  }

  /**
   * Detect prompt iterations (refinements)
   */
  detectPromptIteration(newPrompt, allPrompts) {
    // Look for similar recent prompts
    const recentPrompts = allPrompts
      .filter(p => {
        const timeDiff = new Date(newPrompt.timestamp) - new Date(p.timestamp);
        return timeDiff > 0 && timeDiff < 5 * 60 * 1000; // within 5 minutes
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    for (const prevPrompt of recentPrompts) {
      const similarity = this.calculateTextSimilarity(
        newPrompt.text || newPrompt.content || '',
        prevPrompt.text || prevPrompt.content || ''
      );

      // High similarity = likely iteration
      if (similarity > 0.6) {
        const iteration = {
          id: `iter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          originalPromptId: prevPrompt.id,
          iterationPromptId: newPrompt.id,
          similarity: similarity,
          timeBetween: new Date(newPrompt.timestamp) - new Date(prevPrompt.timestamp),
          reason: this.classifyIteration(prevPrompt, newPrompt),
          timestamp: Date.now()
        };

        this.promptIterations.push(iteration);

        // Keep only last 300 iterations
        if (this.promptIterations.length > 300) {
          this.promptIterations = this.promptIterations.slice(-300);
        }

        console.log(`[SYNC] Detected prompt iteration: ${iteration.reason}`);
        return iteration;
      }
    }

    return null;
  }

  /**
   * Calculate text similarity (Jaccard similarity)
   */
  calculateTextSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Classify iteration type
   */
  classifyIteration(original, refined) {
    const origText = (original.text || original.content || '').toLowerCase();
    const refinedText = (refined.text || refined.content || '').toLowerCase();

    if (refinedText.length > origText.length * 1.5) return 'clarification';
    if (refinedText.includes('actually') || refinedText.includes('instead')) return 'correction';
    if (refinedText.includes('also') || refinedText.includes('and')) return 'expansion';
    if (refinedText.includes('but') || refinedText.includes('however')) return 'modification';
    return 'refinement';
  }

  /**
   * Track AI-generated code (for churn detection)
   */
  markAIGeneratedCode(fileChange) {
    const crypto = require('crypto');
    const { file_path, after_code, promptId } = fileChange;

    if (!file_path || !after_code) return;

    const hash = crypto.createHash('md5').update(after_code).digest('hex');

    this.aiGeneratedCodeMap.set(file_path, {
      content: after_code,
      contentHash: hash,
      promptId: promptId || fileChange.linkedPromptId,
      generatedAt: Date.now(),
      modificationCount: 0
    });

    console.log(`[SPARKLE] Marked AI-generated code in ${file_path}`);
  }

  /**
   * Track code churn (modifications to AI-generated code)
   */
  trackCodeChurn(fileChange) {
    const crypto = require('crypto');
    const aiGenerated = this.aiGeneratedCodeMap.get(fileChange.file_path);

    if (!aiGenerated) return null;

    const newHash = crypto.createHash('md5')
      .update(fileChange.after_code || '')
      .digest('hex');

    if (newHash !== aiGenerated.contentHash) {
      aiGenerated.modificationCount++;

      // Calculate diff
      const linesChanged = Math.abs(
        (fileChange.after_code || '').split('\n').length -
        aiGenerated.content.split('\n').length
      );

      const churn = {
        id: `churn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        originalPromptId: aiGenerated.promptId,
        fileChangeId: fileChange.id,
        filePath: fileChange.file_path,
        modificationNumber: aiGenerated.modificationCount,
        timeSinceGeneration: Date.now() - aiGenerated.generatedAt,
        linesChanged: linesChanged,
        churnRate: linesChanged / aiGenerated.content.split('\n').length,
        timestamp: Date.now()
      };

      this.codeChurn.push(churn);

      // Keep only last 500 churn records
      if (this.codeChurn.length > 500) {
        this.codeChurn = this.codeChurn.slice(-500);
      }

      // Update hash
      aiGenerated.contentHash = newHash;
      aiGenerated.content = fileChange.after_code;

      console.log(`[NOTE] Code churn detected in ${fileChange.file_path}: mod #${aiGenerated.modificationCount}`);
      return churn;
    }

    return null;
  }

  /**
   * Detect debug activity
   */
  detectDebugActivity(fileChange) {
    const debugIndicators = [
      { pattern: /console\.(log|error|warn|debug|info)/g, type: 'console_log' },
      { pattern: /debugger;/g, type: 'breakpoint' },
      { pattern: /@ts-ignore|@ts-expect-error|@ts-nocheck/g, type: 'type_suppression' },
      { pattern: /\/\/ TODO:|\/\/ FIXME:|\/\/ HACK:|\/\/ XXX:/g, type: 'todo_comment' },
      { pattern: /print\(|pprint\(|pp\(/g, type: 'print_debug' }
    ];

    const addedLines = (fileChange.after_code || '')
      .split('\n')
      .filter((line, i) => {
        const beforeLines = (fileChange.before_code || '').split('\n');
        return !beforeLines[i] || beforeLines[i] !== line;
      });

    const debugActivities = [];

    debugIndicators.forEach(indicator => {
      const matches = addedLines.filter(line => indicator.pattern.test(line));

      if (matches.length > 0) {
        const activity = {
          id: `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          promptId: fileChange.linkedPromptId || fileChange.prompt_id,
          fileChangeId: fileChange.id,
          filePath: fileChange.file_path,
          debugType: indicator.type,
          occurrences: matches.length,
          wasAfterAIChange: !!fileChange.linkedPromptId,
          timestamp: Date.now()
        };

        debugActivities.push(activity);
        this.debugActivity.push(activity);

        console.log(`🐛 Debug activity detected: ${indicator.type} (${matches.length}x)`);
      }
    });

    // Keep only last 500 debug activities
    if (this.debugActivity.length > 500) {
      this.debugActivity = this.debugActivity.slice(-500);
    }

    return debugActivities;
  }

  /**
   * Get productivity statistics
   */
  getProductivityStats() {
    const now = Date.now();
    const last24h = now - (24 * 60 * 60 * 1000);

    // Time-to-first-edit metrics (from activity intervals)
    const recentIntervals = this.activityIntervals.filter(i => i.timestamp > last24h);
    const totalActive = recentIntervals.reduce((sum, i) => sum + i.activeTime, 0);
    const totalWaiting = recentIntervals.reduce((sum, i) => sum + i.waitingTime, 0);

    // Prompt iteration stats
    const recentIterations = this.promptIterations.filter(i => i.timestamp > last24h);
    const iterationsByReason = {};
    recentIterations.forEach(iter => {
      iterationsByReason[iter.reason] = (iterationsByReason[iter.reason] || 0) + 1;
    });

    // Code churn stats
    const recentChurn = this.codeChurn.filter(c => c.timestamp > last24h);
    const avgChurnRate = recentChurn.length > 0
      ? recentChurn.reduce((sum, c) => sum + c.churnRate, 0) / recentChurn.length
      : 0;

    // Debug activity stats
    const recentDebug = this.debugActivity.filter(d => d.timestamp > last24h);
    const debugByType = {};
    recentDebug.forEach(debug => {
      debugByType[debug.debugType] = (debugByType[debug.debugType] || 0) + 1;
    });

    return {
      activity: {
        totalActiveTime: totalActive,
        totalWaitingTime: totalWaiting,
        activeRatio: totalActive / (totalActive + totalWaiting),
        intervals: recentIntervals.length
      },
      promptIterations: {
        total: this.promptIterations.length,
        last24h: recentIterations.length,
        byReason: iterationsByReason,
        avgIterationsPerPrompt: recentIterations.length > 0 ? 
          recentIterations.length / new Set(recentIterations.map(i => i.originalPromptId)).size : 0
      },
      codeChurn: {
        total: this.codeChurn.length,
        last24h: recentChurn.length,
        avgChurnRate: avgChurnRate,
        mostChurnedFiles: this.getMostChurnedFiles()
      },
      debugActivity: {
        total: this.debugActivity.length,
        last24h: recentDebug.length,
        byType: debugByType,
        afterAIChanges: recentDebug.filter(d => d.wasAfterAIChange).length
      },
      pendingPrompts: this.promptPending.size
    };
  }

  /**
   * Get most churned files
   */
  getMostChurnedFiles() {
    const fileChurn = new Map();

    this.codeChurn.forEach(churn => {
      const file = churn.filePath;
      if (!fileChurn.has(file)) {
        fileChurn.set(file, { file, churnCount: 0, totalChurnRate: 0 });
      }
      const data = fileChurn.get(file);
      data.churnCount++;
      data.totalChurnRate += churn.churnRate;
    });

    return Array.from(fileChurn.values())
      .map(f => ({ ...f, avgChurnRate: f.totalChurnRate / f.churnCount }))
      .sort((a, b) => b.churnCount - a.churnCount)
      .slice(0, 10);
  }

  /**
   * Cleanup old data
   */
  cleanup() {
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days
    
    this.activityIntervals = this.activityIntervals.filter(i => i.timestamp > cutoff);
    this.promptIterations = this.promptIterations.filter(i => i.timestamp > cutoff);
    this.codeChurn = this.codeChurn.filter(c => c.timestamp > cutoff);
    this.debugActivity = this.debugActivity.filter(d => d.timestamp > cutoff);
  }
}

module.exports = ProductivityTracker;

