/**
 * File Metrics Visualizations
 * File dependency strength, complexity trends, and related metrics
 */

class FileMetricsVisualizations {
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
   * Calculate file dependency strength
   * Based on co-occurrence in prompts, temporal proximity, and edit patterns
   */
  async calculateFileDependencyStrength() {
    const prompts = this.state?.data?.prompts || [];
    const events = this.state?.data?.events || [];

    // Build file co-occurrence matrix
    const coOccurrence = new Map(); // file1 -> file2 -> count
    const fileEditTimes = new Map(); // file -> [timestamps]

    // Track files mentioned together in prompts
    prompts.forEach(prompt => {
      const files = new Set();
      
      // Extract files from context
      if (prompt.contextFilesJson) {
        try {
          const contextFiles = JSON.parse(prompt.contextFilesJson);
          contextFiles.forEach(file => {
            const filePath = file.path || file.filePath || file;
            if (filePath) files.add(filePath);
          });
        } catch (e) {}
      }
      
      // Extract @ mentions
      const text = prompt.text || prompt.prompt || '';
      const atMatches = text.match(/@[\w\-\.\/]+/g);
      if (atMatches) {
        atMatches.forEach(match => {
          const file = match.substring(1);
          if (file.includes('/') || file.includes('\\')) {
            files.add(file);
          }
        });
      }

      // Record co-occurrences
      const fileArray = Array.from(files);
      for (let i = 0; i < fileArray.length; i++) {
        for (let j = i + 1; j < fileArray.length; j++) {
          const file1 = fileArray[i];
          const file2 = fileArray[j];
          
          if (!coOccurrence.has(file1)) coOccurrence.set(file1, new Map());
          if (!coOccurrence.has(file2)) coOccurrence.set(file2, new Map());
          
          coOccurrence.get(file1).set(file2, (coOccurrence.get(file1).get(file2) || 0) + 1);
          coOccurrence.get(file2).set(file1, (coOccurrence.get(file2).get(file1) || 0) + 1);
        }
      }
    });

    // Track temporal proximity (files edited close in time)
    events.filter(e => e.type === 'file-change' || e.type === 'file-edit').forEach(e => {
      const file = e.file || e.filePath || e.details?.file_path;
      if (!file) return;
      
      const timestamp = new Date(e.timestamp).getTime();
      if (!fileEditTimes.has(file)) {
        fileEditTimes.set(file, []);
      }
      fileEditTimes.get(file).push(timestamp);
    });

    // Calculate temporal dependencies (files edited within 5 minutes)
    const temporalWindow = 5 * 60 * 1000; // 5 minutes
    const temporalDeps = new Map();
    
    fileEditTimes.forEach((timestamps, file) => {
      if (!temporalDeps.has(file)) temporalDeps.set(file, new Map());
      
      fileEditTimes.forEach((otherTimestamps, otherFile) => {
        if (file === otherFile) return;
        
        let temporalCount = 0;
        timestamps.forEach(ts => {
          otherTimestamps.forEach(ots => {
            if (Math.abs(ts - ots) < temporalWindow) {
              temporalCount++;
            }
          });
        });
        
        if (temporalCount > 0) {
          temporalDeps.get(file).set(otherFile, temporalCount);
        }
      });
    });

    // Combine co-occurrence and temporal dependencies
    const dependencies = new Map();
    const allFiles = new Set([
      ...Array.from(coOccurrence.keys()),
      ...Array.from(temporalDeps.keys())
    ]);

    allFiles.forEach(file => {
      const deps = new Map();
      
      // Add co-occurrence dependencies
      if (coOccurrence.has(file)) {
        coOccurrence.get(file).forEach((count, otherFile) => {
          deps.set(otherFile, (deps.get(otherFile) || 0) + count * 2); // Weight co-occurrence higher
        });
      }
      
      // Add temporal dependencies
      if (temporalDeps.has(file)) {
        temporalDeps.get(file).forEach((count, otherFile) => {
          deps.set(otherFile, (deps.get(otherFile) || 0) + count);
        });
      }
      
      if (deps.size > 0) {
        dependencies.set(file, deps);
      }
    });

    return dependencies;
  }

  /**
   * Render file dependency strength visualization
   */
  async renderFileDependencyStrength() {
    const container = document.getElementById('fileDependencyStrength');
    if (!container) return;

    try {
      const dependencies = await this.calculateFileDependencyStrength();

      if (dependencies.size === 0) {
        container.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; padding: var(--space-xl); text-align: center;">
            <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Dependencies Found</div>
            <div style="font-size: var(--text-sm); color: var(--color-text-muted);">File dependencies will appear as you work with related files</div>
          </div>
        `;
        return;
      }

      // Calculate strongest dependencies
      const allDeps = [];
      dependencies.forEach((deps, file) => {
        deps.forEach((strength, otherFile) => {
          allDeps.push({
            file1: file,
            file2: otherFile,
            strength
          });
        });
      });

      // Sort by strength
      allDeps.sort((a, b) => b.strength - a.strength);
      const topDeps = allDeps.slice(0, 30);

      // Calculate statistics
      const avgStrength = allDeps.length > 0
        ? allDeps.reduce((sum, d) => sum + d.strength, 0) / allDeps.length
        : 0;
      const maxStrength = allDeps.length > 0
        ? Math.max(...allDeps.map(d => d.strength))
        : 0;

      container.innerHTML = `
        <div style="margin-bottom: var(--space-lg);">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-md);">
            <div class="stat-card">
              <div class="stat-label">Total Dependencies</div>
              <div class="stat-value">${allDeps.length}</div>
              <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
                Between ${dependencies.size} files
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Avg Strength</div>
              <div class="stat-value">${avgStrength.toFixed(1)}</div>
              <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
                Max: ${maxStrength}
              </div>
            </div>
          </div>
        </div>

        <div style="margin-bottom: var(--space-md);">
          <h4 style="margin-bottom: var(--space-sm); color: var(--color-text); font-size: var(--text-md);">Strongest File Dependencies</h4>
          <div style="display: flex; flex-direction: column; gap: var(--space-xs); max-height: 400px; overflow-y: auto;">
            ${topDeps.map(dep => {
              const intensity = (dep.strength / maxStrength) * 100;
              const color = intensity > 70 ? '#ef4444' : intensity > 40 ? '#f59e0b' : '#10b981';
              
              return `
                <div style="padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid ${color};">
                  <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-size: var(--text-sm); color: var(--color-text); font-family: var(--font-mono); margin-bottom: var(--space-xs);">
                        ${this.escapeHtml(dep.file1)}
                      </div>
                      <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-left: var(--space-md);">
                        → ${this.escapeHtml(dep.file2)}
                      </div>
                    </div>
                    <div style="margin-left: var(--space-sm); display: flex; flex-direction: column; align-items: end;">
                      <div style="font-size: var(--text-sm); color: var(--color-text); font-weight: 600;">
                        ${dep.strength}
                      </div>
                      <div style="width: 60px; height: 6px; background: var(--color-bg-alt); border-radius: 3px; overflow: hidden; margin-top: var(--space-xs);">
                        <div style="width: ${intensity}%; height: 100%; background: ${color}; border-radius: 3px;"></div>
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } catch (error) {
      console.warn('[DEPENDENCY] Could not calculate dependencies:', error.message);
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; padding: var(--space-xl); text-align: center;">
          <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">Error Loading Dependencies</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted);">${error.message}</div>
        </div>
      `;
    }
  }

  /**
   * Calculate file complexity trends
   */
  async calculateFileComplexityTrends() {
    const events = this.state?.data?.events || [];

    // Group events by file and time
    const fileEvents = new Map(); // file -> [{timestamp, linesAdded, linesRemoved, ...}]

    // Filter for file change events (support both underscore and hyphen variants)
    const fileChangeEvents = events.filter(e => {
      const type = e.type || '';
      return type === 'file-change' || type === 'file_change' || 
             type === 'code-change' || type === 'code_change' || 
             type === 'file-edit' || type === 'file_edit';
    });

    fileChangeEvents.forEach(e => {
      const file = e.file || e.filePath || e.details?.file_path;
      if (!file) return;

      // Parse details safely
      let details = {};
      try {
        details = typeof e.details === 'string' ? JSON.parse(e.details) : (e.details || {});
      } catch (err) {
        console.warn('[COMPLEXITY] Failed to parse event details:', err.message);
        return;
      }

      const timestamp = new Date(e.timestamp).getTime();
      if (isNaN(timestamp)) {
        console.warn('[COMPLEXITY] Invalid timestamp for event:', e.id);
        return;
      }

      const linesAdded = details?.lines_added || details?.linesAdded || 0;
      const linesRemoved = details?.lines_removed || details?.linesRemoved || 0;

      if (!fileEvents.has(file)) {
        fileEvents.set(file, []);
      }

      fileEvents.get(file).push({
        timestamp,
        linesAdded,
        linesRemoved,
        netChange: linesAdded - linesRemoved
      });
    });

    // Calculate complexity metrics per file
    const complexityTrends = [];
    
    fileEvents.forEach((events, file) => {
      if (events.length === 0) return;

      // Sort by timestamp
      events.sort((a, b) => a.timestamp - b.timestamp);

      // Calculate metrics
      const totalEdits = events.length;
      const totalLinesAdded = events.reduce((sum, e) => sum + e.linesAdded, 0);
      const totalLinesRemoved = events.reduce((sum, e) => sum + e.linesRemoved, 0);
      const netChange = totalLinesAdded - totalLinesRemoved;
      const churnRate = totalLinesAdded + totalLinesRemoved; // Total lines touched
      
      // Calculate time span
      const timeSpan = events[events.length - 1].timestamp - events[0].timestamp;
      const daysSpan = timeSpan / (24 * 60 * 60 * 1000);
      
      // Calculate edit frequency
      const editFrequency = daysSpan > 0 ? totalEdits / daysSpan : totalEdits;
      
      // Complexity score: combines edit frequency, churn rate, and edit count
      const complexityScore = (editFrequency * 10) + (churnRate / 100) + (totalEdits * 2);

      complexityTrends.push({
        file,
        totalEdits,
        totalLinesAdded,
        totalLinesRemoved,
        netChange,
        churnRate,
        editFrequency: editFrequency.toFixed(2),
        daysSpan: daysSpan.toFixed(1),
        complexityScore,
        firstEdit: new Date(events[0].timestamp),
        lastEdit: new Date(events[events.length - 1].timestamp),
        timeline: events.map(e => ({
          timestamp: e.timestamp,
          netChange: e.netChange,
          churn: e.linesAdded + e.linesRemoved
        }))
      });
    });

    // Sort by complexity score
    complexityTrends.sort((a, b) => b.complexityScore - a.complexityScore);

    return complexityTrends;
  }

  /**
   * Render file complexity trends
   */
  async renderFileComplexityTrends() {
    const container = document.getElementById('fileComplexityTrends');
    if (!container) {
      console.warn('[COMPLEXITY] Container #fileComplexityTrends not found');
      return;
    }

    try {
      const trends = await this.calculateFileComplexityTrends();
      
      // Debug logging
      if (trends.length > 0) {
        console.log(`[COMPLEXITY] Calculated trends for ${trends.length} files`);
      } else {
        const events = this.state?.data?.events || [];
        const fileChangeCount = events.filter(e => {
          const type = e.type || '';
          return type === 'file-change' || type === 'file_change' || 
                 type === 'code-change' || type === 'code_change' || 
                 type === 'file-edit' || type === 'file_edit';
        }).length;
        console.log(`[COMPLEXITY] No trends calculated. Total events: ${events.length}, File change events: ${fileChangeCount}`);
      }

      if (trends.length === 0) {
        container.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; padding: var(--space-xl); text-align: center;">
            <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Complexity Data</div>
            <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Complexity trends will appear as files are edited</div>
          </div>
        `;
        return;
      }

      const topComplex = trends.slice(0, 15);
      const maxComplexity = Math.max(...trends.map(t => t.complexityScore));

      container.innerHTML = `
        <div style="margin-bottom: var(--space-lg);">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-md);">
            <div class="stat-card">
              <div class="stat-label">Files Tracked</div>
              <div class="stat-value">${trends.length}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Avg Complexity</div>
              <div class="stat-value">${(trends.reduce((sum, t) => sum + t.complexityScore, 0) / trends.length).toFixed(1)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total Churn</div>
              <div class="stat-value">${trends.reduce((sum, t) => sum + t.churnRate, 0).toLocaleString()}</div>
              <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
                Lines touched
              </div>
            </div>
          </div>
        </div>

        <div style="margin-bottom: var(--space-md);">
          <h4 style="margin-bottom: var(--space-sm); color: var(--color-text); font-size: var(--text-md);">Most Complex Files (by Edit Frequency & Churn)</h4>
          <div style="display: flex; flex-direction: column; gap: var(--space-xs); max-height: 400px; overflow-y: auto;">
            ${topComplex.map(trend => {
              const intensity = (trend.complexityScore / maxComplexity) * 100;
              const color = intensity > 70 ? '#ef4444' : intensity > 40 ? '#f59e0b' : '#10b981';
              
              return `
                <div style="padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid ${color};">
                  <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-xs);">
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-size: var(--text-sm); color: var(--color-text); font-weight: 500; font-family: var(--font-mono); margin-bottom: var(--space-xs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${this.escapeHtml(trend.file)}
                      </div>
                      <div style="display: flex; gap: var(--space-md); font-size: var(--text-xs); color: var(--color-text-muted);">
                        <span>${trend.totalEdits} edits</span>
                        <span>${trend.churnRate} churn</span>
                        <span>${trend.editFrequency} edits/day</span>
                      </div>
                    </div>
                    <div style="margin-left: var(--space-sm); display: flex; flex-direction: column; align-items: end;">
                      <div style="font-size: var(--text-sm); color: var(--color-text); font-weight: 600;">
                        ${trend.complexityScore.toFixed(1)}
                      </div>
                      <div style="width: 60px; height: 6px; background: var(--color-bg-alt); border-radius: 3px; overflow: hidden; margin-top: var(--space-xs);">
                        <div style="width: ${intensity}%; height: 100%; background: ${color}; border-radius: 3px;"></div>
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } catch (error) {
      console.warn('[COMPLEXITY] Could not calculate complexity:', error.message);
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; padding: var(--space-xl); text-align: center;">
          <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">Error Loading Complexity</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted);">${error.message}</div>
        </div>
      `;
    }
  }
}

// Create global instance
window.FileMetricsVisualizations = FileMetricsVisualizations;
window.fileMetricsVisualizations = new FileMetricsVisualizations();

// Export functions
window.renderFileDependencyStrength = () => window.fileMetricsVisualizations.renderFileDependencyStrength();
window.renderFileComplexityTrends = () => window.fileMetricsVisualizations.renderFileComplexityTrends();

