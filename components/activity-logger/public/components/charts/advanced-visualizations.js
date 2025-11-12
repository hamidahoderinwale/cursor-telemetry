/**
 * Advanced Visualizations Module
 * Context evolution timeline, prompt-to-code correlations, git commits, file hotspots, etc.
 */

class AdvancedVisualizations {
  constructor() {
    this.state = window.state;
    this.CONFIG = window.CONFIG;
    // APIClient might not be available immediately, so we'll get it when needed
    this.getAPIClient = () => window.APIClient || this.APIClient;
    this.APIClient = window.APIClient;
    this.escapeHtml = window.escapeHtml || ((text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    });
  }
  
  // Update APIClient reference (call this if APIClient is loaded later)
  updateAPIClient() {
    this.APIClient = window.APIClient;
    // Also update state reference to ensure we have latest data
    this.state = window.state;
  }

  /**
   * Render context evolution timeline
   */
  async renderContextEvolutionTimeline() {
    const container = document.getElementById('contextEvolutionTimeline');
    if (!container) return;

    const prompts = this.state?.data?.prompts || [];
    
    // Try to fetch from API first, but fall back to extracting from prompts
    let changes = [];
    try {
      if (window.state && window.state.companionServiceOnline !== false && window.APIClient) {
        const response = await window.APIClient.get('/api/analytics/context/changes?limit=500', { silent: true });
        changes = response?.data || [];
      }
    } catch (error) {
      // Silently fail and fall back to prompt-based extraction
      console.log('[CONTEXT] API fetch failed, extracting from prompts:', error.message);
    }
    
    // Fallback: Extract context changes from prompts and events
    if (changes.length === 0) {
      const contextChanges = new Map(); // timestamp -> context data
      const events = this.state?.data?.events || [];
      
      // Try to enhance a sample of prompts with context if available
      // (only enhance first 20 to avoid performance issues)
      const promptsToEnhance = prompts.slice(0, 20).filter(p => 
        !p.contextChange && !p.contextChanges && window.enhancePromptWithContext
      );
      
      if (promptsToEnhance.length > 0) {
        try {
          await Promise.all(
            promptsToEnhance.map(p => 
              window.enhancePromptWithContext(p).catch(() => p)
            )
          );
        } catch (error) {
          console.log('[CONTEXT] Error enhancing prompts:', error.message);
        }
      }
      
      // First, check if prompts have contextChange or contextChanges already attached
      prompts.forEach(p => {
        const promptTime = new Date(p.timestamp).getTime();
        if (isNaN(promptTime)) return;
        
        // Check for pre-computed context changes
        if (p.contextChange) {
          const change = p.contextChange;
          const timestamp = change.timestamp || promptTime;
          contextChanges.set(timestamp, {
            timestamp: timestamp,
            currentFileCount: change.currentFileCount || 0,
            addedFiles: change.addedFiles || [],
            removedFiles: change.removedFiles || [],
            netChange: change.netChange || 0
          });
          return;
        }
        
        if (p.contextChanges && Array.isArray(p.contextChanges) && p.contextChanges.length > 0) {
          p.contextChanges.forEach(change => {
            const timestamp = change.timestamp || promptTime;
            contextChanges.set(timestamp, {
              timestamp: timestamp,
              currentFileCount: change.currentFileCount || 0,
              addedFiles: change.addedFiles || [],
              removedFiles: change.removedFiles || [],
              netChange: change.netChange || 0
            });
          });
          return;
        }
        
        // Extract context file count from various sources
        const contextFileCount = p.contextFileCount || p.context_file_count || p.contextFilesCount || 0;
        
        // Extract @ mentions from prompt text
        const text = p.text || p.prompt || p.content || p.preview || p.message || '';
        const atMatches = text.match(/@[\w\-\.\/\\]+/g) || [];
        const atFileCount = atMatches.length;
        
        // Extract from context metadata
        const context = p.context || p.composerData || p.metadata || {};
        const contextFilesJson = p.contextFilesJson || p.context_files_json || p.contextFiles || p.context_files;
        let contextFilesCount = 0;
        let addedFiles = [];
        let removedFiles = [];
        
        if (context.atFiles && Array.isArray(context.atFiles)) {
          contextFilesCount = context.atFiles.length;
          addedFiles = context.atFiles.map(f => f.reference || f.fileName || f.filePath || f);
        } else if (contextFilesJson) {
          try {
            const files = typeof contextFilesJson === 'string' ? JSON.parse(contextFilesJson) : contextFilesJson;
            if (Array.isArray(files)) {
              contextFilesCount = files.length;
              addedFiles = files.map(f => f.reference || f.fileName || f.filePath || f);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
        
        // Check context.contextFiles structure
        if (context.contextFiles) {
          const cf = context.contextFiles;
          if (cf.attachedFiles && Array.isArray(cf.attachedFiles)) {
            contextFilesCount = Math.max(contextFilesCount, cf.attachedFiles.length);
            addedFiles = [...addedFiles, ...cf.attachedFiles.map(f => f.name || f.path || f)];
          }
          if (cf.codebaseFiles && Array.isArray(cf.codebaseFiles)) {
            contextFilesCount = Math.max(contextFilesCount, cf.codebaseFiles.length);
            addedFiles = [...addedFiles, ...cf.codebaseFiles.map(f => f.name || f.path || f)];
          }
        }
        
        // Use the highest count found
        const totalFileCount = Math.max(contextFileCount, atFileCount, contextFilesCount);
        
        if (totalFileCount > 0) {
          // Round timestamp to 5-minute intervals to group similar times
          const roundedTime = Math.floor(promptTime / (5 * 60 * 1000)) * (5 * 60 * 1000);
          
          if (!contextChanges.has(roundedTime)) {
            contextChanges.set(roundedTime, {
              timestamp: roundedTime,
              currentFileCount: totalFileCount,
              addedFiles: addedFiles.length > 0 ? addedFiles : [],
              removedFiles: removedFiles,
              netChange: 0
            });
          } else {
            // Update if this has more files or more detailed info
            const existing = contextChanges.get(roundedTime);
            if (totalFileCount > existing.currentFileCount) {
              existing.currentFileCount = totalFileCount;
            }
            if (addedFiles.length > existing.addedFiles.length) {
              existing.addedFiles = addedFiles;
            }
          }
        }
      });
      
      // Also check events for context information
      events.forEach(e => {
        if (e.contextChange || e.context) {
          const eventTime = new Date(e.timestamp).getTime();
          if (isNaN(eventTime)) return;
          
          const change = e.contextChange || {};
          const context = e.context || {};
          
          const fileCount = change.currentFileCount || 
                          (context.contextFiles ? 
                            ((context.contextFiles.attachedFiles?.length || 0) + 
                             (context.contextFiles.codebaseFiles?.length || 0)) : 0) ||
                          (context.atFiles?.length || 0) || 0;
          
          if (fileCount > 0) {
            const roundedTime = Math.floor(eventTime / (5 * 60 * 1000)) * (5 * 60 * 1000);
            
            if (!contextChanges.has(roundedTime)) {
              contextChanges.set(roundedTime, {
                timestamp: roundedTime,
                currentFileCount: fileCount,
                addedFiles: change.addedFiles || [],
                removedFiles: change.removedFiles || [],
                netChange: change.netChange || 0
              });
            }
          }
        }
      });
      
      // Convert to array and calculate net changes
      const sortedContexts = Array.from(contextChanges.values())
        .sort((a, b) => a.timestamp - b.timestamp);
      
      // Calculate net changes between consecutive contexts
      for (let i = 1; i < sortedContexts.length; i++) {
        const prev = sortedContexts[i - 1];
        const curr = sortedContexts[i];
        curr.netChange = curr.currentFileCount - prev.currentFileCount;
        if (curr.netChange > 0 && curr.addedFiles.length === 0) {
          curr.addedFiles = Array(curr.netChange).fill('file');
        } else if (curr.netChange < 0 && curr.removedFiles.length === 0) {
          curr.removedFiles = Array(Math.abs(curr.netChange)).fill('file');
        }
      }
      
      changes = sortedContexts;
      
      // Debug logging
      if (changes.length === 0 && prompts.length > 0) {
        console.log('[CONTEXT] No context changes extracted. Sample prompt structure:', {
          hasContext: !!prompts[0].context,
          hasContextChange: !!prompts[0].contextChange,
          hasContextFiles: !!prompts[0].contextFiles,
          hasContextFileCount: !!prompts[0].contextFileCount,
          hasAtFiles: !!(prompts[0].context?.atFiles),
          samplePrompt: {
            id: prompts[0].id,
            hasText: !!(prompts[0].text || prompts[0].prompt),
            contextKeys: prompts[0].context ? Object.keys(prompts[0].context) : []
          }
        });
      }
    }

    if (changes.length === 0) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; padding: var(--space-xl); text-align: center;">
          <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Context Changes Tracked</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Context evolution data will appear as you work with Cursor</div>
        </div>
      `;
      return;
    }

    try {
      // Sort by timestamp
      const sortedChanges = changes.sort((a, b) => a.timestamp - b.timestamp);
      
      // Group by time periods for visualization
      const now = Date.now();
      const last24h = now - 24 * 60 * 60 * 1000;
      const last7d = now - 7 * 24 * 60 * 60 * 1000;
      
      const recentChanges = sortedChanges.filter(c => c.timestamp >= last24h);
      const weekChanges = sortedChanges.filter(c => c.timestamp >= last7d);
      
      // Calculate statistics
      const avgFileCount = sortedChanges.length > 0
        ? sortedChanges.reduce((sum, c) => sum + (c.currentFileCount || 0), 0) / sortedChanges.length
        : 0;
      
      const maxFileCount = Math.max(...sortedChanges.map(c => c.currentFileCount || 0), 0);
      const totalContextSwitches = sortedChanges.length;
      
      // Calculate context volatility (how much files change)
      const avgNetChange = sortedChanges.length > 0
        ? sortedChanges.reduce((sum, c) => sum + Math.abs(c.netChange || 0), 0) / sortedChanges.length
        : 0;

      // Prepare timeline data for chart
      const timelineData = sortedChanges.slice(-100).map(c => ({
        timestamp: c.timestamp,
        fileCount: c.currentFileCount || 0,
        netChange: c.netChange || 0,
        added: c.addedFiles?.length || 0,
        removed: c.removedFiles?.length || 0
      }));

      container.innerHTML = `
        <div style="margin-bottom: var(--space-lg);">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-md);">
            <div class="stat-card">
              <div class="stat-label">Total Context Switches</div>
              <div class="stat-value">${totalContextSwitches.toLocaleString()}</div>
              <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
                ${recentChanges.length} in last 24h
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Avg Files in Context</div>
              <div class="stat-value">${avgFileCount.toFixed(1)}</div>
              <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
                Max: ${maxFileCount}
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Context Volatility</div>
              <div class="stat-value">${avgNetChange.toFixed(1)}</div>
              <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
                Avg files changed per switch
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Week Activity</div>
              <div class="stat-value">${weekChanges.length}</div>
              <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
                Context switches
              </div>
            </div>
          </div>
        </div>

        <div style="margin-bottom: var(--space-md);">
          <h4 style="margin-bottom: var(--space-sm); color: var(--color-text); font-size: var(--text-md);">Context Evolution Timeline</h4>
          <canvas id="contextTimelineChart" style="max-height: 300px;"></canvas>
        </div>
      `;

      // Render timeline chart
      setTimeout(() => {
        this.renderContextTimelineChart(timelineData);
      }, 100);
    } catch (error) {
      console.warn('[CONTEXT] Could not load context evolution:', error.message);
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; padding: var(--space-xl); text-align: center;">
          <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">Unable to Load Data</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted);">${error.message}</div>
        </div>
      `;
    }
  }

  /**
   * Render context timeline chart using Chart.js
   */
  renderContextTimelineChart(data) {
    const canvas = document.getElementById('contextTimelineChart');
    if (!canvas || !window.Chart) return;

    // Destroy existing chart
    if (canvas.chart) {
      canvas.chart.destroy();
    }

    const labels = data.map(d => {
      const date = new Date(d.timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });

    canvas.chart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Files in Context',
            data: data.map(d => d.fileCount),
            borderColor: '#3b82f6',
            backgroundColor: '#3b82f615',
            tension: 0.4,
            fill: true,
            yAxisID: 'y-files'
          },
          {
            label: 'Net Change',
            data: data.map(d => d.netChange),
            borderColor: '#10b981',
            backgroundColor: '#10b98115',
            tension: 0.4,
            fill: false,
            yAxisID: 'y-change',
            borderDash: [5, 5]
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          'y-files': {
            type: 'linear',
            position: 'left',
            title: {
              display: true,
              text: 'File Count'
            }
          },
          'y-change': {
            type: 'linear',
            position: 'right',
            title: {
              display: true,
              text: 'Net Change'
            }
          }
        }
      }
    });
  }

  /**
   * Render prompt-to-code correlation visualization
   */
  async renderPromptToCodeCorrelation(timeSpan = null) {
    const container = document.getElementById('promptToCodeCorrelation');
    if (!container) return;

    // Get or initialize time span from stored value or default
    if (!timeSpan) {
      timeSpan = window.promptToCodeTimeSpan || 'all';
    }
    window.promptToCodeTimeSpan = timeSpan;

    let prompts = this.state?.data?.prompts || [];
    let events = this.state?.data?.events || [];
    let entries = this.state?.data?.entries || [];

    // Apply time span filter
    const now = Date.now();
    let timeFilter = null;
    
    if (timeSpan !== 'all') {
      let days = 0;
      switch (timeSpan) {
        case 'today':
          days = 1;
          break;
        case 'week':
          days = 7;
          break;
        case 'month':
          days = 30;
          break;
        case '3months':
          days = 90;
          break;
        case 'year':
          days = 365;
          break;
        default:
          days = 0;
      }
      
      if (days > 0) {
        const cutoff = now - (days * 24 * 60 * 60 * 1000);
        prompts = prompts.filter(p => {
          const promptTime = new Date(p.timestamp).getTime();
          return !isNaN(promptTime) && promptTime >= cutoff;
        });
        events = events.filter(e => {
          const eventTime = new Date(e.timestamp).getTime();
          return !isNaN(eventTime) && eventTime >= cutoff;
        });
        entries = entries.filter(e => {
          const entryTime = new Date(e.timestamp).getTime();
          return !isNaN(entryTime) && entryTime >= cutoff;
        });
      }
    }

    if (prompts.length === 0) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; padding: var(--space-xl); text-align: center;">
          <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Prompt Data</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Prompt-to-code correlation will appear as you use AI features</div>
        </div>
      `;
      return;
    }

    // Match prompts to code changes - check multiple event type variations
    // Also check entries that might be code changes
    const codeEvents = [
      ...events.filter(e => {
        const type = (e.type || '').toLowerCase();
        return type === 'file-change' || type === 'file_change' || 
               type === 'code-change' || type === 'code_change' || 
               type === 'file-edit' || type === 'file_edit' ||
               type === 'filechange' || type === 'codechange' ||
               type === 'fileedit' ||
               (type.includes('file') && type.includes('change')) ||
               (type.includes('code') && type.includes('change'));
      }),
      // Also check entries that have code change indicators
      ...entries.filter(e => {
        // Check if entry has before_code/after_code or is tagged as code-change
        const hasCodeDiff = (e.before_code && e.after_code) || 
                           (e.beforeCode && e.afterCode) ||
                           (e.before_content && e.after_content);
        const tags = (e.tags || []).map(t => String(t).toLowerCase());
        const isCodeChangeTag = tags.includes('code-change') || 
                               tags.includes('code_change') ||
                               tags.includes('file-change') ||
                               tags.includes('file_change');
        return hasCodeDiff || isCodeChangeTag;
      })
    ];

    // Debug: Log event types found
    if (codeEvents.length === 0 && (events.length > 0 || entries.length > 0)) {
      const uniqueEventTypes = [...new Set(events.map(e => e.type).filter(Boolean))];
      const uniqueEntryTags = [...new Set(entries.flatMap(e => e.tags || []).filter(Boolean))];
      console.log('[Prompt-to-Code] No code events found. Available event types:', uniqueEventTypes);
      console.log('[Prompt-to-Code] Available entry tags:', uniqueEntryTags);
      console.log('[Prompt-to-Code] Total events:', events.length, 'Total entries:', entries.length, 'Total prompts:', prompts.length);
    }

    // Group by time windows (15-minute intervals)
    const timeWindow = 15 * 60 * 1000; // 15 minutes
    const correlations = [];
    
    prompts.forEach(prompt => {
      const promptTime = new Date(prompt.timestamp).getTime();
      if (isNaN(promptTime)) return; // Skip invalid timestamps
      
      // Use a wider window: 5 minutes before to 30 minutes after (to catch changes that might have happened slightly before prompt)
      const windowStart = promptTime - (5 * 60 * 1000); // 5 minutes before
      const windowEnd = promptTime + (30 * 60 * 1000); // 30 minutes after
      
      // Find code changes within window
      const relatedChanges = codeEvents.filter(e => {
        const eventTime = new Date(e.timestamp).getTime();
        if (isNaN(eventTime)) return false;
        return eventTime >= windowStart && eventTime <= windowEnd;
      });
      
      // Also check for direct links via prompt_id
      const promptId = prompt.id || prompt.prompt_id;
      const directlyLinkedChanges = codeEvents.filter(e => {
        const eventPromptId = e.prompt_id || e.promptId;
        if (!eventPromptId) return false;
        return String(eventPromptId) === String(promptId) || parseInt(eventPromptId) === parseInt(promptId);
      });
      
      // Combine both methods
      const allRelatedChanges = [...new Set([...relatedChanges, ...directlyLinkedChanges])];

      if (allRelatedChanges.length > 0) {
        // Sort by timestamp to get first change
        const sortedChanges = allRelatedChanges.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        
        const totalLinesChanged = allRelatedChanges.reduce((sum, e) => {
          try {
            const details = typeof e.details === 'string' ? JSON.parse(e.details || '{}') : (e.details || {});
            return sum + (details?.lines_added || details?.linesAdded || 0) + (details?.lines_removed || details?.linesRemoved || 0);
          } catch (err) {
            return sum;
          }
        }, 0);

        const firstChangeTime = new Date(sortedChanges[0].timestamp).getTime();
        const timeToFirstChange = firstChangeTime - promptTime; // Can be negative if change happened before prompt

        correlations.push({
          promptTime,
          promptId: prompt.id || prompt.prompt_id,
          promptText: (prompt.text || prompt.prompt || prompt.content || prompt.preview || '').substring(0, 100),
          changesCount: allRelatedChanges.length,
          linesChanged: totalLinesChanged,
          timeToFirstChange: timeToFirstChange / 1000 / 60 // Convert to minutes
        });
      }
    });

    // Calculate statistics
    const successfulPrompts = correlations.length;
    const successRate = prompts.length > 0 ? (successfulPrompts / prompts.length * 100).toFixed(1) : 0;
    const correlationsWithTime = correlations.filter(c => c.timeToFirstChange !== null && !isNaN(c.timeToFirstChange));
    const avgTimeToChange = correlationsWithTime.length > 0
      ? correlationsWithTime.reduce((sum, c) => sum + c.timeToFirstChange, 0) / correlationsWithTime.length
      : 0;
    const avgChangesPerPrompt = successfulPrompts > 0
      ? correlations.reduce((sum, c) => sum + c.changesCount, 0) / successfulPrompts
      : 0;

    // Prepare chart data
    const sortedCorrelations = correlations.sort((a, b) => a.promptTime - b.promptTime).slice(-50);
    
    container.innerHTML = `
      <div style="margin-bottom: var(--space-md); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-md);">
        <h4 style="margin: 0; color: var(--color-text); font-size: var(--text-md);">Prompt-to-Code Correlation</h4>
        <div style="display: flex; align-items: center; gap: var(--space-sm);">
          <label for="promptToCodeTimeSpan" style="font-size: var(--text-sm); color: var(--color-text-muted);">Time Span:</label>
          <select id="promptToCodeTimeSpan" style="
            padding: var(--space-xs) var(--space-sm);
            background: var(--color-bg);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            color: var(--color-text);
            font-size: var(--text-sm);
            cursor: pointer;
          " onchange="if(window.advancedVisualizations){window.advancedVisualizations.renderPromptToCodeCorrelation(this.value);}">
            <option value="all" ${timeSpan === 'all' ? 'selected' : ''}>All Time</option>
            <option value="today" ${timeSpan === 'today' ? 'selected' : ''}>Today</option>
            <option value="week" ${timeSpan === 'week' ? 'selected' : ''}>Last 7 Days</option>
            <option value="month" ${timeSpan === 'month' ? 'selected' : ''}>Last 30 Days</option>
            <option value="3months" ${timeSpan === '3months' ? 'selected' : ''}>Last 3 Months</option>
            <option value="year" ${timeSpan === 'year' ? 'selected' : ''}>Last Year</option>
          </select>
        </div>
      </div>
      
      <div style="margin-bottom: var(--space-lg);">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-md);">
          <div class="stat-card">
            <div class="stat-label">Success Rate</div>
            <div class="stat-value">${successRate}%</div>
            <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
              ${successfulPrompts} of ${prompts.length} prompts led to changes
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Avg Time to Change</div>
            <div class="stat-value">${avgTimeToChange.toFixed(1)}m</div>
            <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
              From prompt to first code change
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Avg Changes/Prompt</div>
            <div class="stat-value">${avgChangesPerPrompt.toFixed(1)}</div>
            <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
              Code changes per successful prompt
            </div>
          </div>
        </div>
      </div>

      <div style="margin-bottom: var(--space-md);">
        <h4 style="margin-bottom: var(--space-sm); color: var(--color-text); font-size: var(--text-md);">Prompt-to-Code Correlation Over Time</h4>
        <canvas id="promptCodeCorrelationChart" style="max-height: 300px;"></canvas>
      </div>
    `;

    // Render correlation chart
    setTimeout(() => {
      this.renderPromptCodeCorrelationChart(sortedCorrelations);
    }, 100);
  }

  /**
   * Render prompt-to-code correlation chart
   */
  renderPromptCodeCorrelationChart(data) {
    const canvas = document.getElementById('promptCodeCorrelationChart');
    if (!canvas || !window.Chart) return;

    if (canvas.chart) {
      canvas.chart.destroy();
    }

    const labels = data.map(d => {
      const date = new Date(d.promptTime);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });

    canvas.chart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Code Changes',
            data: data.map(d => d.changesCount),
            backgroundColor: '#10b981',
            yAxisID: 'y-changes'
          },
          {
            label: 'Time to Change (min)',
            data: data.map(d => d.timeToFirstChange ? d.timeToFirstChange / 1000 / 60 : 0),
            type: 'line',
            borderColor: '#3b82f6',
            backgroundColor: '#3b82f615',
            tension: 0.4,
            fill: false,
            yAxisID: 'y-time'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          'y-changes': {
            type: 'linear',
            position: 'left',
            title: {
              display: true,
              text: 'Changes Count'
            }
          },
          'y-time': {
            type: 'linear',
            position: 'right',
            title: {
              display: true,
              text: 'Time (minutes)'
            }
          }
        }
      }
    });
  }

  /**
   * Render git commit timeline
   */
  async renderGitCommitTimeline() {
    const container = document.getElementById('gitCommitTimeline');
    if (!container) {
      console.warn('[GIT] Container #gitCommitTimeline not found');
      return;
    }

    try {
      // Show loading state
      if (container.innerHTML.trim() === '' || container.innerHTML.includes('Loading')) {
        container.innerHTML = '<div style="padding: var(--space-lg); text-align: center; color: var(--color-text-muted);">Loading git data...</div>';
      }

      // Try to fetch git data from raw-data endpoint
      let gitData = [];
      const apiClient = this.APIClient || window.APIClient;
      if (apiClient) {
        try {
          const response = await apiClient.get('/raw-data/git?limit=100', { silent: true, timeout: 5000 });
          gitData = response?.gitData || response?.data || [];
        } catch (apiError) {
          console.warn('[GIT] API fetch failed, trying alternative methods:', apiError.message);
          // Try alternative: check if git data is in state
          if (window.state?.data?.gitCommits) {
            gitData = window.state.data.gitCommits;
          }
        }
      } else {
        // Fallback: check state for git data
        if (window.state?.data?.gitCommits) {
          gitData = window.state.data.gitCommits;
        }
      }

      if (gitData.length === 0) {
        container.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 250px; padding: var(--space-xl); text-align: center;">
            <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Git Data Available</div>
            <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Git commit timeline will appear when commits are detected</div>
          </div>
        `;
        return;
      }

      // Parse git log data
      const commits = [];
      gitData.forEach(entry => {
        if (entry.recentCommits && Array.isArray(entry.recentCommits)) {
          entry.recentCommits.forEach(commitLine => {
            if (commitLine && commitLine.trim()) {
              const parts = commitLine.trim().split(' ');
              if (parts.length >= 2) {
                commits.push({
                  hash: parts[0],
                  message: parts.slice(1).join(' '),
                  timestamp: entry.timestamp,
                  branch: entry.branch
                });
              }
            }
          });
        }
      });

      // Remove duplicates and sort by timestamp
      const uniqueCommits = Array.from(
        new Map(commits.map(c => [c.hash, c])).values()
      ).sort((a, b) => b.timestamp - a.timestamp);

      if (uniqueCommits.length === 0) {
        container.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 250px; padding: var(--space-xl); text-align: center;">
            <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Commits Found</div>
            <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Commits will appear when detected in git log</div>
          </div>
        `;
        return;
      }

      // Calculate statistics
      const now = Date.now();
      const last24h = now - 24 * 60 * 60 * 1000;
      const last7d = now - 7 * 24 * 60 * 60 * 1000;
      
      const recentCommits = uniqueCommits.filter(c => c.timestamp >= last24h);
      const weekCommits = uniqueCommits.filter(c => c.timestamp >= last7d);

      container.innerHTML = `
        <div style="margin-bottom: var(--space-lg);">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-md);">
            <div class="stat-card">
              <div class="stat-label">Total Commits</div>
              <div class="stat-value">${uniqueCommits.length}</div>
              <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
                ${recentCommits.length} in last 24h
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Week Activity</div>
              <div class="stat-value">${weekCommits.length}</div>
              <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
                Commits in last 7 days
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-label" style="margin-bottom: var(--space-xs);">Current Branch</div>
              <div class="stat-value" style="font-size: var(--text-md); margin-top: var(--space-xs);">${gitData[gitData.length - 1]?.branch || 'Unknown'}</div>
            </div>
          </div>
        </div>

        <div style="margin-bottom: var(--space-md);">
          <h4 style="margin-bottom: var(--space-sm); color: var(--color-text); font-size: var(--text-md);">Recent Commits</h4>
          <div style="max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-xs);">
            ${uniqueCommits.slice(0, 20).map(commit => {
              const date = new Date(commit.timestamp);
              return `
                <div style="padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid #10b981;">
                  <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-xs);">
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-size: var(--text-sm); color: var(--color-text); font-weight: 500; margin-bottom: var(--space-xs);">
                        ${this.escapeHtml(commit.message)}
                      </div>
                      <div style="font-size: var(--text-xs); color: var(--color-text-muted); font-family: var(--font-mono);">
                        ${commit.hash.substring(0, 7)}
                      </div>
                    </div>
                    <div style="font-size: var(--text-xs); color: var(--color-text-muted); white-space: nowrap; margin-left: var(--space-sm);">
                      ${date.toLocaleString()}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } catch (error) {
      console.warn('[GIT] Could not load git data:', error.message);
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 250px; padding: var(--space-xl); text-align: center;">
          <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">Unable to Load Git Data</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted);">${error.message}</div>
        </div>
      `;
    }
  }

  /**
   * Render file hotspots visualization
   */
  async renderFileHotspots() {
    const container = document.getElementById('fileHotspots');
    if (!container) {
      console.warn('[HOTSPOTS] Container #fileHotspots not found');
      return;
    }

    // Show loading state
    if (container.innerHTML.trim() === '' || container.innerHTML.includes('Loading')) {
      container.innerHTML = '<div style="padding: var(--space-lg); text-align: center; color: var(--color-text-muted);">Analyzing file activity...</div>';
    }

    // Get events from multiple sources - always check window.state for latest data
    let events = window.state?.data?.events || this.state?.data?.events || [];
    if (!Array.isArray(events) || events.length === 0) {
      // Try alternative data sources
      if (window.state?.data?.events) {
        events = window.state.data.events;
      } else if (window.state?.events) {
        events = window.state.events;
      } else if (this.state?.data?.events) {
        events = this.state.data.events;
      }
    }
    
    if (!Array.isArray(events) || events.length === 0) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 250px; padding: var(--space-xl); text-align: center;">
          <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Event Data</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted);">File hotspots will appear as you edit files</div>
        </div>
      `;
      return;
    }

    // Debug: Log event type distribution
    const eventTypes = new Map();
    events.forEach(e => {
      const type = e.type || 'unknown';
      eventTypes.set(type, (eventTypes.get(type) || 0) + 1);
    });
    console.log('[HOTSPOTS] Event type distribution:', Object.fromEntries(eventTypes));

    // Count edits per file
    const fileEditCounts = new Map();
    const fileLineCounts = new Map();
    const fileTimeRanges = new Map();

    // Filter for file change events (support both underscore and hyphen variants)
    const fileChangeEvents = events.filter(e => {
      const type = e.type || '';
      return type === 'file-change' || type === 'file_change' || 
             type === 'code-change' || type === 'code_change' || 
             type === 'file-edit' || type === 'file_edit';
    });
    
    console.log(`[HOTSPOTS] Found ${fileChangeEvents.length} file change events out of ${events.length} total events`);

    let filesWithPaths = 0;
    let filesWithoutPaths = 0;
    
    fileChangeEvents.forEach(e => {
      // Parse details first (needed for file path extraction)
      let details = {};
      try {
        details = typeof e.details === 'string' ? JSON.parse(e.details) : (e.details || {});
      } catch (err) {
        console.warn('[HOTSPOTS] Failed to parse event details:', err.message);
        filesWithoutPaths++;
        return;
      }
      
      // Try multiple locations for file path
      let filePath = e.file || e.filePath || details?.file_path || details?.filePath;
      
      if (!filePath) {
        filesWithoutPaths++;
        return;
      }
      
      filesWithPaths++;

      const eventTime = new Date(e.timestamp).getTime();
      if (isNaN(eventTime)) {
        console.warn('[HOTSPOTS] Invalid timestamp for event:', e.id);
        return;
      }
      
      fileEditCounts.set(filePath, (fileEditCounts.get(filePath) || 0) + 1);
      
      const linesChanged = (details?.lines_added || details?.linesAdded || 0) + 
                          (details?.lines_removed || details?.linesRemoved || 0);
      fileLineCounts.set(filePath, (fileLineCounts.get(filePath) || 0) + linesChanged);

      if (!fileTimeRanges.has(filePath)) {
        fileTimeRanges.set(filePath, { first: eventTime, last: eventTime });
      } else {
        const range = fileTimeRanges.get(filePath);
        range.first = Math.min(range.first, eventTime);
        range.last = Math.max(range.last, eventTime);
      }
    });

    // Calculate hotspot scores (combining edit count, lines changed, and recency)
    const now = Date.now();
    const hotspots = Array.from(fileEditCounts.entries()).map(([file, editCount]) => {
      const linesChanged = fileLineCounts.get(file) || 0;
      const timeRange = fileTimeRanges.get(file);
      const recency = timeRange ? (now - timeRange.last) / (24 * 60 * 60 * 1000) : 999; // days since last edit
      const recencyScore = Math.max(0, 10 - recency); // Higher score for recent edits
      
      // Hotspot score: weighted combination
      const score = (editCount * 2) + (linesChanged / 10) + (recencyScore * 3);
      
      return {
        file,
        editCount,
        linesChanged,
        recency: recency.toFixed(1),
        score,
        lastEdit: timeRange ? new Date(timeRange.last) : null
      };
    }).sort((a, b) => b.score - a.score).slice(0, 20);

    if (hotspots.length === 0) {
      // Debug logging
      console.log(`[HOTSPOTS] No hotspots calculated. Total events: ${events.length}, File change events: ${fileChangeEvents.length}, Files with paths: ${filesWithPaths}, Files without paths: ${filesWithoutPaths}`);
      
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 250px; padding: var(--space-xl); text-align: center;">
          <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No File Hotspots</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Hotspots appear when files are frequently edited</div>
        </div>
      `;
      return;
    }
    
    // Debug logging
    console.log(`[HOTSPOTS] Calculated ${hotspots.length} file hotspots`);

    const maxScore = Math.max(...hotspots.map(h => h.score));

    container.innerHTML = `
      <div style="margin-bottom: var(--space-md);">
        <h4 style="margin-bottom: var(--space-sm); color: var(--color-text); font-size: var(--text-md);">File Hotspots (Most Active Files)</h4>
        <div style="display: flex; flex-direction: column; gap: var(--space-xs); max-height: 400px; overflow-y: auto;">
          ${hotspots.map((hotspot, index) => {
            const intensity = (hotspot.score / maxScore) * 100;
            const color = intensity > 70 ? '#ef4444' : intensity > 40 ? '#f59e0b' : '#10b981';
            
            return `
              <div style="padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid ${color};">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-xs);">
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-size: var(--text-sm); color: var(--color-text); font-weight: 500; font-family: var(--font-mono); margin-bottom: var(--space-xs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      ${this.escapeHtml(hotspot.file)}
                    </div>
                    <div style="display: flex; gap: var(--space-md); font-size: var(--text-xs); color: var(--color-text-muted);">
                      <span>${hotspot.editCount} edits</span>
                      <span>${hotspot.linesChanged} lines</span>
                      <span>${hotspot.lastEdit ? hotspot.lastEdit.toLocaleDateString() : 'Unknown'}</span>
                    </div>
                  </div>
                  <div style="margin-left: var(--space-sm);">
                    <div style="width: 60px; height: 8px; background: var(--color-bg-alt); border-radius: 4px; overflow: hidden;">
                      <div style="width: ${intensity}%; height: 100%; background: ${color}; border-radius: 4px;"></div>
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
}

// Create global instance
window.AdvancedVisualizations = AdvancedVisualizations;
window.advancedVisualizations = new AdvancedVisualizations();

// Export functions for backward compatibility with error handling
window.renderContextEvolutionTimeline = () => {
  try {
    if (window.advancedVisualizations) {
      return window.advancedVisualizations.renderContextEvolutionTimeline();
    } else {
      console.warn('[VISUALIZATIONS] advancedVisualizations not initialized yet');
      return Promise.resolve();
    }
  } catch (error) {
    console.error('[VISUALIZATIONS] Error rendering context evolution timeline:', error);
    return Promise.reject(error);
  }
};

window.renderPromptToCodeCorrelation = (timeSpan) => {
  try {
    if (window.advancedVisualizations) {
      return window.advancedVisualizations.renderPromptToCodeCorrelation(timeSpan);
    } else {
      console.warn('[VISUALIZATIONS] advancedVisualizations not initialized yet');
      return Promise.resolve();
    }
  } catch (error) {
    console.error('[VISUALIZATIONS] Error rendering prompt-to-code correlation:', error);
    return Promise.reject(error);
  }
};

window.renderGitCommitTimeline = () => {
  try {
    if (window.advancedVisualizations) {
      return window.advancedVisualizations.renderGitCommitTimeline();
    } else {
      console.warn('[VISUALIZATIONS] advancedVisualizations not initialized yet');
      return Promise.resolve();
    }
  } catch (error) {
    console.error('[VISUALIZATIONS] Error rendering git commit timeline:', error);
    return Promise.reject(error);
  }
};

window.renderFileHotspots = () => {
  try {
    if (window.advancedVisualizations) {
      return window.advancedVisualizations.renderFileHotspots();
    } else {
      console.warn('[VISUALIZATIONS] advancedVisualizations not initialized yet');
      return Promise.resolve();
    }
  } catch (error) {
    console.error('[VISUALIZATIONS] Error rendering file hotspots:', error);
    return Promise.reject(error);
  }
};

