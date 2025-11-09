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
    // Cache for expensive calculations
    this.complexityCache = null;
    this.complexityCacheTimestamp = 0;
    this.complexityCacheTTL = 60000; // 1 minute cache
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

      // Helper function to format file paths for display
      const formatFilePath = (path) => {
        if (!path) return '';
        const parts = path.split('/');
        const filename = parts[parts.length - 1];
        
        // For node_modules, extract package name
        if (path.includes('node_modules/')) {
          const nodeModulesIndex = path.indexOf('node_modules/');
          const afterNodeModules = path.substring(nodeModulesIndex + 'node_modules/'.length);
          const packageParts = afterNodeModules.split('/');
          if (packageParts.length > 0) {
            // Extract package name (handle scoped packages like @apollo/client)
            let packageName = packageParts[0];
            
            // Handle scoped packages (@scope/package)
            if (packageParts.length > 1 && packageParts[0].startsWith('@')) {
              packageName = `${packageParts[0]}/${packageParts[1]}`;
            } else {
              // Remove version suffix if present (e.g., "next@14.0.0" -> "next")
              packageName = packageName.split('@')[0];
            }
            
            // Show package name and filename
            const displayPath = `${packageName}/.../${filename}`;
            // Truncate if too long (max 55 chars)
            if (displayPath.length > 55) {
              const maxPackageLen = Math.max(15, 55 - filename.length - 5);
              return `${packageName.substring(0, maxPackageLen)}.../${filename}`;
            }
            return displayPath;
          }
        }
        
        // For other paths, show last 2-3 directory levels + filename
        if (parts.length > 4) {
          const shortPath = `.../${parts.slice(-3).join('/')}`;
          return shortPath.length > 55 ? `.../${parts.slice(-2).join('/')}` : shortPath;
        }
        return path.length > 55 ? `.../${filename}` : path;
      };

      // Helper to get full path on hover
      const getFullPath = (path) => {
        return this.escapeHtml(path);
      };

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
          <h4 style="margin-bottom: var(--space-md); color: var(--color-text); font-size: var(--text-md); font-weight: 600;">Strongest File Dependencies</h4>
          <div style="display: grid; gap: var(--space-xs); max-height: 500px; overflow-y: auto; padding-right: var(--space-xs);">
            ${topDeps.map((dep, index) => {
              const intensity = (dep.strength / maxStrength) * 100;
              const color = intensity > 70 ? '#ef4444' : intensity > 40 ? '#f59e0b' : '#10b981';
              const file1Formatted = formatFilePath(dep.file1);
              const file2Formatted = formatFilePath(dep.file2);
              
              return `
                <div style="padding: var(--space-sm) var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border-left: 4px solid ${color}; display: flex; align-items: center; gap: var(--space-md); transition: background 0.2s;" 
                     onmouseover="this.style.background='var(--color-bg-alt, #f5f5f5)'" 
                     onmouseout="this.style.background='var(--color-bg)'"
                     title="${index + 1}. ${getFullPath(dep.file1)} → ${getFullPath(dep.file2)} (Strength: ${dep.strength})">
                  <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px;">
                    <div style="font-size: var(--text-sm); color: var(--color-text); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${getFullPath(dep.file1)}">
                      ${this.escapeHtml(file1Formatted)}
                    </div>
                    <div style="font-size: var(--text-xs); color: var(--color-text-muted); display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${getFullPath(dep.file2)}">
                      <span style="color: ${color}; font-weight: 600;">→</span>
                      <span>${this.escapeHtml(file2Formatted)}</span>
                    </div>
                  </div>
                  <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; min-width: 80px;">
                    <div style="font-size: var(--text-base); color: var(--color-text); font-weight: 700; line-height: 1.2;">
                      ${dep.strength}
                    </div>
                    <div style="width: 70px; height: 4px; background: var(--color-bg-alt); border-radius: 2px; overflow: hidden;">
                      <div style="width: ${intensity}%; height: 100%; background: ${color}; border-radius: 2px; transition: width 0.3s;"></div>
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
   * Optimized with caching and efficient data structures
   */
  async calculateFileComplexityTrends() {
    // Check cache
    const now = Date.now();
    if (this.complexityCache && (now - this.complexityCacheTimestamp) < this.complexityCacheTTL) {
      return this.complexityCache;
    }

    const events = this.state?.data?.events || [];
    if (events.length === 0) {
      return [];
    }

    // Group events by file and time
    const fileEvents = new Map(); // file -> [{timestamp, linesAdded, linesRemoved, ...}]

    // Pre-compile type check for better performance
    const fileChangeTypes = new Set(['file-change', 'file_change', 'code-change', 'code_change', 'file-edit', 'file_edit']);

    // Filter for file change events (optimized with Set lookup)
    const fileChangeEvents = events.filter(e => {
      const type = e.type || '';
      return fileChangeTypes.has(type);
    });

    // Process events in batches for large datasets
    const batchSize = 1000;
    for (let i = 0; i < fileChangeEvents.length; i += batchSize) {
      const batch = fileChangeEvents.slice(i, i + batchSize);
      
      for (const e of batch) {
        // Parse details first (needed for file path extraction)
        let details = {};
        try {
          details = typeof e.details === 'string' ? JSON.parse(e.details) : (e.details || {});
        } catch (err) {
          console.warn('[COMPLEXITY] Failed to parse event details:', err.message);
          continue;
        }
        
        // Try multiple locations for file path (same pattern as hotspots)
        const file = e.file || e.filePath || details?.file_path || details?.filePath;
        if (!file) {
          continue;
        }

        const timestamp = new Date(e.timestamp).getTime();
        if (isNaN(timestamp)) {
          console.warn('[COMPLEXITY] Invalid timestamp for event:', e.id);
          continue;
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
      }
      
      // Yield to event loop periodically for large datasets
      if (i + batchSize < fileChangeEvents.length && fileChangeEvents.length > 5000) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

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

    // Cache results
    this.complexityCache = complexityTrends;
    this.complexityCacheTimestamp = now;

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
        
        // Debug: Check why file paths aren't being extracted
        let filesWithPaths = 0;
        let filesWithoutPaths = 0;
        const sampleEvents = events.slice(0, 10);
        sampleEvents.forEach(e => {
          let details = {};
          try {
            details = typeof e.details === 'string' ? JSON.parse(e.details) : (e.details || {});
          } catch (err) {
            filesWithoutPaths++;
            return;
          }
          const file = e.file || e.filePath || details?.file_path || details?.filePath;
          if (file) {
            filesWithPaths++;
          } else {
            filesWithoutPaths++;
          }
        });
        
        console.log(`[COMPLEXITY] No trends calculated. Total events: ${events.length}, File change events: ${fileChangeCount}, Sample with paths: ${filesWithPaths}, without: ${filesWithoutPaths}`);
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
      
      // Prepare timeline data for chart (aggregate all files over time)
      const timelineDataMap = new Map(); // timestamp -> {churn, edits, fileCount}
      trends.forEach(trend => {
        trend.timeline.forEach(point => {
          if (!timelineDataMap.has(point.timestamp)) {
            timelineDataMap.set(point.timestamp, { churn: 0, edits: 0, fileCount: 0 });
          }
          const data = timelineDataMap.get(point.timestamp);
          data.churn += point.churn;
          data.edits += 1;
          data.fileCount += 1;
        });
      });
      
      // Convert to array and sort by timestamp
      const timelineData = Array.from(timelineDataMap.entries())
        .map(([timestamp, data]) => ({ timestamp, ...data }))
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-100); // Last 100 data points

      // Calculate statistics
      const totalEdits = trends.reduce((sum, t) => sum + t.totalEdits, 0);
      const totalChurn = trends.reduce((sum, t) => sum + t.churnRate, 0);
      const avgComplexity = trends.length > 0 
        ? trends.reduce((sum, t) => sum + t.complexityScore, 0) / trends.length 
        : 0;
      const avgEditFrequency = trends.length > 0
        ? trends.reduce((sum, t) => sum + parseFloat(t.editFrequency), 0) / trends.length
        : 0;

      container.innerHTML = `
        <div style="margin-bottom: var(--space-lg);">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-md);">
            <div class="stat-card">
              <div class="stat-label">Files Tracked</div>
              <div class="stat-value">${trends.length}</div>
              <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
                With edit history
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Avg Complexity</div>
              <div class="stat-value">${avgComplexity.toFixed(1)}</div>
              <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
                ${avgEditFrequency.toFixed(2)} edits/day avg
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total Churn</div>
              <div class="stat-value">${totalChurn.toLocaleString()}</div>
              <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
                ${totalEdits} total edits
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Most Complex</div>
              <div class="stat-value" style="font-size: var(--text-md);">${topComplex[0]?.complexityScore.toFixed(1) || '0'}</div>
              <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${this.escapeHtml(topComplex[0]?.file || '')}">
                ${this.escapeHtml((topComplex[0]?.file || '').split('/').pop() || 'N/A')}
              </div>
            </div>
          </div>
        </div>

        ${timelineData.length > 0 ? `
          <div style="margin-bottom: var(--space-md);">
            <h4 style="margin-bottom: var(--space-sm); color: var(--color-text); font-size: var(--text-md);">Complexity Trends Over Time</h4>
            <canvas id="complexityTimelineChart" style="max-height: 300px;"></canvas>
          </div>
        ` : ''}

        <div style="margin-bottom: var(--space-md);">
          <h4 style="margin-bottom: var(--space-sm); color: var(--color-text); font-size: var(--text-md);">Most Complex Files (by Edit Frequency & Churn)</h4>
          <div style="display: flex; flex-direction: column; gap: var(--space-xs); max-height: 400px; overflow-y: auto;">
            ${topComplex.map(trend => {
              const intensity = (trend.complexityScore / maxComplexity) * 100;
              const color = intensity > 70 ? '#ef4444' : intensity > 40 ? '#f59e0b' : '#10b981';
              const fileName = trend.file.split('/').pop();
              const fileDir = trend.file.substring(0, trend.file.length - fileName.length);
              
              return `
                <div style="padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid ${color}; transition: background 0.2s;"
                     onmouseover="this.style.background='var(--color-bg-alt, #f5f5f5)'" 
                     onmouseout="this.style.background='var(--color-bg)'"
                     title="${this.escapeHtml(trend.file)}">
                  <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-xs);">
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-size: var(--text-sm); color: var(--color-text); font-weight: 500; font-family: var(--font-mono); margin-bottom: var(--space-xs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${this.escapeHtml(fileName)}
                      </div>
                      ${fileDir ? `
                        <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-xs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                          ${this.escapeHtml(fileDir)}
                        </div>
                      ` : ''}
                      <div style="display: flex; gap: var(--space-md); font-size: var(--text-xs); color: var(--color-text-muted); flex-wrap: wrap;">
                        <span title="Total number of edits">${trend.totalEdits} edits</span>
                        <span title="Total lines added + removed">${trend.churnRate} churn</span>
                        <span title="Edits per day">${trend.editFrequency} edits/day</span>
                        ${trend.daysSpan !== '0.0' ? `<span title="Time span">${trend.daysSpan} days</span>` : ''}
                      </div>
                    </div>
                    <div style="margin-left: var(--space-sm); display: flex; flex-direction: column; align-items: end; flex-shrink: 0;">
                      <div style="font-size: var(--text-sm); color: var(--color-text); font-weight: 600;">
                        ${trend.complexityScore.toFixed(1)}
                      </div>
                      <div style="width: 60px; height: 6px; background: var(--color-bg-alt); border-radius: 3px; overflow: hidden; margin-top: var(--space-xs);">
                        <div style="width: ${intensity}%; height: 100%; background: ${color}; border-radius: 3px; transition: width 0.3s;"></div>
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
      
      // Render timeline chart if data available
      if (timelineData.length > 0 && window.Chart) {
        setTimeout(() => {
          this.renderComplexityTimelineChart(timelineData);
        }, 100);
      }
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

  /**
   * Render complexity timeline chart using Chart.js
   */
  renderComplexityTimelineChart(data) {
    const canvas = document.getElementById('complexityTimelineChart');
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
            label: 'Code Churn (lines touched)',
            data: data.map(d => d.churn),
            borderColor: '#ef4444',
            backgroundColor: '#ef444415',
            tension: 0.4,
            fill: true,
            yAxisID: 'y-churn'
          },
          {
            label: 'Files Edited',
            data: data.map(d => d.fileCount),
            borderColor: '#3b82f6',
            backgroundColor: '#3b82f615',
            tension: 0.4,
            fill: false,
            yAxisID: 'y-files',
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
            intersect: false,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  if (context.datasetIndex === 0) {
                    label += context.parsed.y.toLocaleString() + ' lines';
                  } else {
                    label += context.parsed.y + ' files';
                  }
                }
                return label;
              }
            }
          }
        },
        scales: {
          'y-churn': {
            type: 'linear',
            position: 'left',
            title: {
              display: true,
              text: 'Code Churn (lines)'
            },
            beginAtZero: true
          },
          'y-files': {
            type: 'linear',
            position: 'right',
            title: {
              display: true,
              text: 'Files Edited'
            },
            beginAtZero: true,
            grid: {
              drawOnChartArea: false
            }
          }
        }
      }
    });
  }
}

// Create global instance
window.FileMetricsVisualizations = FileMetricsVisualizations;
window.fileMetricsVisualizations = new FileMetricsVisualizations();

// Export functions
window.renderFileDependencyStrength = () => window.fileMetricsVisualizations.renderFileDependencyStrength();
window.renderFileComplexityTrends = () => window.fileMetricsVisualizations.renderFileComplexityTrends();


