/**
 * Advanced Visualizations Module
 * Context evolution timeline, prompt-to-code correlations, git commits, file hotspots, etc.
 */

class AdvancedVisualizations {
  constructor() {
    this.state = window.state;
    this.CONFIG = window.CONFIG;
    this.APIClient = window.APIClient;
    this.escapeHtml = window.escapeHtml || ((text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    });
  }

  /**
   * Render context evolution timeline
   */
  async renderContextEvolutionTimeline() {
    const container = document.getElementById('contextEvolutionTimeline');
    if (!container) return;

    try {
      // Check if service is online before making request
      if (window.state && window.state.companionServiceOnline === false) {
        container.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; padding: var(--space-xl); text-align: center;">
            <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">Companion Service Offline</div>
            <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Context evolution data will appear when service is available</div>
          </div>
        `;
        return;
      }
      
      const response = await this.APIClient.get('/api/analytics/context/changes?limit=500', { silent: true });
      const changes = response?.data || [];

      if (changes.length === 0) {
        container.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; padding: var(--space-xl); text-align: center;">
            <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Context Changes Tracked</div>
            <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Context evolution data will appear as you work with Cursor</div>
          </div>
        `;
        return;
      }

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
  async renderPromptToCodeCorrelation() {
    const container = document.getElementById('promptToCodeCorrelation');
    if (!container) return;

    const prompts = this.state?.data?.prompts || [];
    const events = this.state?.data?.events || [];

    if (prompts.length === 0) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; padding: var(--space-xl); text-align: center;">
          <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Prompt Data</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Prompt-to-code correlation will appear as you use AI features</div>
        </div>
      `;
      return;
    }

    // Match prompts to code changes within time windows
    const codeEvents = events.filter(e => 
      e.type === 'file-change' || e.type === 'code-change' || e.type === 'file-edit'
    );

    // Group by time windows (15-minute intervals)
    const timeWindow = 15 * 60 * 1000; // 15 minutes
    const correlations = [];
    
    prompts.forEach(prompt => {
      const promptTime = new Date(prompt.timestamp).getTime();
      const windowStart = promptTime;
      const windowEnd = promptTime + (30 * 60 * 1000); // 30 minute window
      
      // Find code changes within window
      const relatedChanges = codeEvents.filter(e => {
        const eventTime = new Date(e.timestamp).getTime();
        return eventTime >= windowStart && eventTime <= windowEnd;
      });

      if (relatedChanges.length > 0) {
        const totalLinesChanged = relatedChanges.reduce((sum, e) => {
          const details = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
          return sum + (details?.lines_added || 0) + (details?.lines_removed || 0);
        }, 0);

        correlations.push({
          promptTime,
          promptId: prompt.id,
          promptText: (prompt.text || prompt.prompt || '').substring(0, 100),
          changesCount: relatedChanges.length,
          linesChanged: totalLinesChanged,
          timeToFirstChange: relatedChanges.length > 0 
            ? new Date(relatedChanges[0].timestamp).getTime() - promptTime
            : null
        });
      }
    });

    // Calculate statistics
    const successfulPrompts = correlations.length;
    const successRate = prompts.length > 0 ? (successfulPrompts / prompts.length * 100).toFixed(1) : 0;
    const avgTimeToChange = correlations.filter(c => c.timeToFirstChange !== null).length > 0
      ? correlations
          .filter(c => c.timeToFirstChange !== null)
          .reduce((sum, c) => sum + c.timeToFirstChange, 0) / correlations.filter(c => c.timeToFirstChange !== null).length
      : 0;
    const avgChangesPerPrompt = successfulPrompts > 0
      ? correlations.reduce((sum, c) => sum + c.changesCount, 0) / successfulPrompts
      : 0;

    // Prepare chart data
    const sortedCorrelations = correlations.sort((a, b) => a.promptTime - b.promptTime).slice(-50);
    
    container.innerHTML = `
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
            <div class="stat-value">${(avgTimeToChange / 1000 / 60).toFixed(1)}m</div>
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
    if (!container) return;

    try {
      // Try to fetch git data from raw-data endpoint
      const response = await this.APIClient.get('/raw-data/git?limit=100', { silent: true });
      const gitData = response?.gitData || response?.data || [];

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
              <div class="stat-label">Current Branch</div>
              <div class="stat-value" style="font-size: var(--text-md);">${gitData[gitData.length - 1]?.branch || 'Unknown'}</div>
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

    const events = this.state?.data?.events || [];
    
    if (events.length === 0) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 250px; padding: var(--space-xl); text-align: center;">
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

// Export functions for backward compatibility
window.renderContextEvolutionTimeline = () => window.advancedVisualizations.renderContextEvolutionTimeline();
window.renderPromptToCodeCorrelation = () => window.advancedVisualizations.renderPromptToCodeCorrelation();
window.renderGitCommitTimeline = () => window.advancedVisualizations.renderGitCommitTimeline();
window.renderFileHotspots = () => window.advancedVisualizations.renderFileHotspots();

