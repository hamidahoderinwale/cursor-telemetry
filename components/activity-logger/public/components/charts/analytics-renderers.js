/**
 * Analytics Renderers Module
 * Extracted from dashboard.js
 * Handles HTML-based analytics sections (not Chart.js charts)
 */

export class AnalyticsRenderers {
  constructor() {
    this.state = window.state;
    this.CONFIG = window.CONFIG;
    this.escapeHtml = window.escapeHtml || ((text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    });
  }

  /**
   * Helper: Format duration in ms to human-readable string
   */
  formatDuration(ms) {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Render model usage analytics
   */
  renderModelUsageAnalytics() {
    const container = document.getElementById('modelUsageAnalytics');
    if (!container) return;

    const prompts = this.state?.data?.prompts || [];
    
    if (prompts.length === 0) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 250px; padding: var(--space-xl); text-align: center;">
          <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Data Available</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Model usage data will appear as you use AI features</div>
        </div>
      `;
      return;
    }

    // Parse model names from prompts
    const modelCounts = new Map();
    const modeCounts = new Map();
    
    prompts.forEach(p => {
      // Extract model name - check multiple fields
      const modelName = p.modelName || p.model_name || p.model || 
                        p.modelInfo?.model || p.metadata?.model || 
                        (p.modelType && p.modelName ? `${p.modelType}/${p.modelName}` : null) ||
                        (p.model_type && p.model_name ? `${p.model_type}/${p.model_name}` : null) ||
                        null;
      const model = modelName || 'Unknown';
      modelCounts.set(model, (modelCounts.get(model) || 0) + 1);
      
      // Extract mode (composer/chat/inline/user-prompt)
      const rawMode = p.type || p.mode || p.metadata?.mode || null;
      let mode;
      if (!rawMode) {
        mode = 'Not Specified'; // Not to be confused with "Auto" mode
      } else {
        mode = String(rawMode)
          .replace('user-prompt', 'User Prompt')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
        // Check if it's auto mode (case-insensitive)
        if (mode.toLowerCase().includes('auto')) {
          mode = 'Auto';
        }
      }
      modeCounts.set(mode, (modeCounts.get(mode) || 0) + 1);
    });

    // Sort by frequency
    const sortedModels = Array.from(modelCounts.entries()).sort((a, b) => b[1] - a[1]);
    const sortedModes = Array.from(modeCounts.entries()).sort((a, b) => b[1] - a[1]);

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-lg);">
        <!-- Models -->
        <div>
          <h4 style="margin-bottom: var(--space-md); color: var(--color-text); font-size: var(--text-md);">Models Used</h4>
          <div style="display: flex; flex-direction: column; gap: var(--space-sm);">
            ${sortedModels.map(([model, count]) => {
              const percentage = ((count / prompts.length) * 100).toFixed(1);
              return `
                <div style="display: flex; align-items: center; gap: var(--space-md);">
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-size: var(--text-sm); color: var(--color-text); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      ${this.escapeHtml(model)}
                    </div>
                    <div style="font-size: var(--text-xs); color: var(--color-text-muted);">
                      ${count} prompts (${percentage}%)
                    </div>
                  </div>
                  <div style="width: 100px; height: 8px; background: var(--color-bg); border-radius: 4px; overflow: hidden;">
                    <div style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, #6366f1, #8b5cf6); border-radius: 4px;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Modes -->
        <div>
          <h4 style="margin-bottom: var(--space-md); color: var(--color-text); font-size: var(--text-md);">Usage by Mode</h4>
          <div style="display: flex; flex-direction: column; gap: var(--space-sm);">
            ${sortedModes.map(([mode, count]) => {
              const percentage = ((count / prompts.length) * 100).toFixed(1);
              const modeColors = {
                'composer': '#10b981',
                'chat': '#3b82f6',
                'inline': '#f59e0b',
                'auto': '#06b6d4',
                'not specified': '#6b7280'
              };
              const color = modeColors[mode.toLowerCase()] || modeColors['not specified'];
              
              return `
                <div style="display: flex; align-items: center; gap: var(--space-md);">
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-size: var(--text-sm); color: var(--color-text); font-weight: 500;">
                      ${this.escapeHtml(mode.charAt(0).toUpperCase() + mode.slice(1))}
                    </div>
                    <div style="font-size: var(--text-xs); color: var(--color-text-muted);">
                      ${count} prompts (${percentage}%)
                    </div>
                  </div>
                  <div style="width: 100px; height: 8px; background: var(--color-bg); border-radius: 4px; overflow: hidden;">
                    <div style="width: ${percentage}%; height: 100%; background: ${color}; border-radius: 4px;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render context file analytics
   */
  async renderContextFileAnalytics() {
    const container = document.getElementById('contextFileAnalytics');
    if (!container) return;

    const prompts = this.state?.data?.prompts || [];
    
    if (prompts.length === 0) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; padding: var(--space-xl); text-align: center;">
          <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Data Available</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Context file data will appear as you reference files with @</div>
        </div>
      `;
      return;
    }

    // Extract @ referenced files
    const fileReferences = new Map();
    
    // Patterns to exclude (node_modules, build artifacts, etc.)
    const excludePatterns = [
      /^webpack-internal$/,
      /^node_modules/,
      /^\.next/,
      /^dist/,
      /^build/,
      /^\.cache/,
      /^\d+\.\d+\.\d+/,  // Version numbers
      /^HUAWEI/,
      /^react$/,
      /^react-dom$/,
      /^babel$/,
      /^playwright$/,
      /^sass$/,
      /_react$/,
      /__react$/,
      /__react-dom$/,
      /\.(js|ts|jsx|tsx|css|scss|json)$/  // Generic extensions without path
    ];
    
    const shouldExclude = (file) => {
      // Exclude if matches any pattern
      if (excludePatterns.some(pattern => pattern.test(file))) {
        return true;
      }
      // Exclude if it looks like a version number or package name without path
      if (!file.includes('/') && !file.includes('\\') && (file.match(/^\d+\.\d+/) || file.length < 3)) {
        return true;
      }
      return false;
    };
    
    prompts.forEach(p => {
      // Try multiple field names for prompt text
      const text = p.text || p.prompt || p.content || p.preview || p.message || '';
      
      // Match @filename patterns - be more lenient to catch more references
      // Match @ followed by word characters, dots, slashes, hyphens, underscores
      const atMatches = text.match(/@[\w\-\.\/\\_]+/g);
      if (atMatches) {
        atMatches.forEach(match => {
          const file = match.substring(1); // Remove @
          // Be more lenient: count if it's not excluded and has at least 3 characters
          // (reduced from 10 to catch shorter file names like @app.js, @config, etc.)
          if (!shouldExclude(file) && (file.includes('/') || file.includes('\\') || file.length >= 3)) {
            fileReferences.set(file, (fileReferences.get(file) || 0) + 1);
          }
        });
      }
      
      // Also check context metadata - try multiple field name variations
      const context = p.context || p.composerData || p.metadata || {};
      if (context.atFiles && Array.isArray(context.atFiles)) {
        context.atFiles.forEach(file => {
          const fileName = typeof file === 'string' ? file : (file.reference || file.fileName || file.filePath || file.path || file.name);
          if (fileName && !shouldExclude(fileName)) {
            fileReferences.set(fileName, (fileReferences.get(fileName) || 0) + 1);
          }
        });
      }
      
      // Check contextFilesJson if available (try multiple field names)
      const contextFilesJson = p.contextFilesJson || p.context_files_json || p.contextFiles || p.context_files;
      if (contextFilesJson) {
        try {
          const contextFiles = typeof contextFilesJson === 'string' ? JSON.parse(contextFilesJson) : contextFilesJson;
          if (Array.isArray(contextFiles)) {
            contextFiles.forEach(file => {
              const fileName = typeof file === 'string' ? file : (file.path || file.filePath || file.name || file.fileName);
              if (fileName && !shouldExclude(fileName)) {
                fileReferences.set(fileName, (fileReferences.get(fileName) || 0) + 1);
              }
            });
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      // Check for context file count to determine if context was used
      const contextFileCount = p.contextFileCount || p.context_file_count || p.contextFilesCount || 
                               (contextFilesJson ? (Array.isArray(contextFilesJson) ? contextFilesJson.length : 0) : 0);
      if (contextFileCount > 0 && !fileReferences.has('_hasContext')) {
        // Mark that we found context data
        fileReferences.set('_hasContext', 1);
      }
    });

    // Remove the internal marker if it exists
    fileReferences.delete('_hasContext');
    
    if (fileReferences.size === 0) {
      // Debug: Show what we found
      const totalPrompts = prompts.length;
      const promptsWithText = prompts.filter(p => {
        const text = p.text || p.prompt || p.content || p.preview || p.message || '';
        return text.length > 0;
      }).length;
      const promptsWithAt = prompts.filter(p => {
        const text = p.text || p.prompt || p.content || p.preview || p.message || '';
        return text.includes('@');
      }).length;
      
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; padding: var(--space-xl); text-align: center;">
          <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No @ References Found</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-sm);">Reference files in prompts with @ to see analytics</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); opacity: 0.7;">
            Debug: ${totalPrompts} prompts, ${promptsWithText} with text, ${promptsWithAt} with @ symbol
          </div>
        </div>
      `;
      return;
    }

    // Sort by frequency
    const sortedFiles = Array.from(fileReferences.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // Top 10

    const totalReferences = Array.from(fileReferences.values()).reduce((a, b) => a + b, 0);

    container.innerHTML = `
      <div style="margin-bottom: var(--space-lg);">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-md);">
          <div class="stat-card">
            <div class="stat-label">Total @ References</div>
            <div class="stat-value">${totalReferences}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Unique Files</div>
            <div class="stat-value">${fileReferences.size}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Prompts with @</div>
            <div class="stat-value">${prompts.filter(p => (p.text || '').includes('@')).length}</div>
          </div>
        </div>
      </div>

      <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Most Referenced Files</h4>
      <div style="display: flex; flex-direction: column; gap: var(--space-sm);">
        ${sortedFiles.map(([file, count]) => {
          const percentage = ((count / totalReferences) * 100).toFixed(1);
          return `
            <div style="display: flex; align-items: center; gap: var(--space-md); padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
              <div style="flex: 1; min-width: 0;">
                <div style="font-size: var(--text-sm); color: var(--color-text); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${this.escapeHtml(file)}
                </div>
                <div style="font-size: var(--text-xs); color: var(--color-text-muted);">
                  Referenced ${count} times (${percentage}%)
                </div>
              </div>
              <div style="width: 120px; height: 8px; background: var(--color-bg-alt); border-radius: 4px; overflow: hidden;">
                <div style="width: ${percentage}%; height: 100%; background: #10b981; border-radius: 4px;"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * Render enhanced context analytics
   */
  async renderEnhancedContextAnalytics() {
    const container = document.getElementById('enhancedContextAnalytics');
    if (!container) return;

    const prompts = this.state?.data?.prompts || [];
    
    if (prompts.length === 0) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; padding: var(--space-xl); text-align: center;">
          <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Data Available</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Context analytics will appear as you use AI features</div>
        </div>
      `;
      return;
    }

    // Calculate metrics
    // Try to get actual tokens, but fall back to estimating from context file count or text length
    const promptsWithTokens = prompts.filter(p => {
      const tokens = p.promptTokens || p.estimatedTokens || 0;
      const contextFileCount = p.contextFileCount || p.context_file_count || 0;
      const text = p.text || p.prompt || '';
      // Estimate tokens: roughly 250 tokens per 1000 chars, or ~500 tokens per context file
      const estimatedFromText = text.length > 0 ? Math.round(text.length / 4) : 0;
      const estimatedFromFiles = contextFileCount * 500;
      return tokens > 0 || estimatedFromText > 0 || estimatedFromFiles > 0;
    });
    
    const avgTokens = promptsWithTokens.length > 0
      ? promptsWithTokens.reduce((sum, p) => {
          const tokens = p.promptTokens || p.estimatedTokens || 0;
          const text = p.text || p.prompt || '';
          const contextFileCount = p.contextFileCount || p.context_file_count || 0;
          // Use actual tokens if available, otherwise estimate
          if (tokens > 0) return sum + tokens;
          // Estimate from text length (rough: 1 token = 4 chars) or file count
          const estimated = tokens || Math.round((text.length / 4) + (contextFileCount * 500));
          return sum + estimated;
        }, 0) / promptsWithTokens.length
      : 0;

    const promptsWithFiles = prompts.filter(p => {
      // Try multiple field names for prompt text
      const text = p.text || p.prompt || p.content || p.preview || p.message || '';
      const hasAtRef = text.includes('@');
      
      // Try multiple field names for context file count
      const contextFileCount = p.contextFileCount || p.context_file_count || p.contextFilesCount || 0;
      
      // Also check if context data exists in other formats
      const context = p.context || p.composerData || p.metadata || {};
      const hasContextFiles = contextFileCount > 0 || 
                             (context.atFiles && Array.isArray(context.atFiles) && context.atFiles.length > 0) ||
                             (p.contextFilesJson && p.contextFilesJson.length > 0) ||
                             (p.contextFiles && Array.isArray(p.contextFiles) && p.contextFiles.length > 0);
      
      return hasAtRef || hasContextFiles;
    });
    const adoptionRate = prompts.length > 0 ? ((promptsWithFiles.length / prompts.length) * 100).toFixed(1) : 0;

    // Find most mentioned files (using same filtering as context file analytics)
    const fileMentions = new Map();
    const excludePatterns = [
      /^webpack-internal$/,
      /^node_modules/,
      /^\.next/,
      /^dist/,
      /^build/,
      /^\d+\.\d+\.\d+/,
    ];
    const shouldExclude = (file) => {
      if (excludePatterns.some(pattern => pattern.test(file))) return true;
      if (!file.includes('/') && !file.includes('\\') && (file.match(/^\d+\.\d+/) || file.length < 3)) return true;
      return false;
    };
    
    prompts.forEach(p => {
      // Try multiple field names for prompt text
      const text = p.text || p.prompt || p.content || p.preview || p.message || '';
      const matches = text.match(/@[\w\-\.\/\\]+/g);
      if (matches) {
        matches.forEach(match => {
          const file = match.substring(1);
          if (!shouldExclude(file) && (file.includes('/') || file.includes('\\') || file.length > 10)) {
            fileMentions.set(file, (fileMentions.get(file) || 0) + 1);
          }
        });
      }
      
      // Also check context metadata
      const context = p.context || p.composerData || p.metadata || {};
      if (context.atFiles && Array.isArray(context.atFiles)) {
        context.atFiles.forEach(file => {
          const fileName = typeof file === 'string' ? file : (file.reference || file.fileName || file.filePath || file.path || file.name);
          if (fileName && !shouldExclude(fileName)) {
            fileMentions.set(fileName, (fileMentions.get(fileName) || 0) + 1);
          }
        });
      }
    });

    const topFiles = Array.from(fileMentions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-md); margin-bottom: var(--space-lg);">
        <div class="stat-card">
          <div class="stat-label">Avg Tokens/Prompt</div>
          <div class="stat-value">${avgTokens.toFixed(0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Context Adoption</div>
          <div class="stat-value">${adoptionRate}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Prompts with @</div>
          <div class="stat-value">${promptsWithFiles.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Unique Files</div>
          <div class="stat-value">${fileMentions.size}</div>
        </div>
      </div>

      ${topFiles.length > 0 ? `
        <h4 style="margin-bottom: var(--space-md); color: var(--color-text); font-size: var(--text-md);">Most Mentioned Files</h4>
        <div style="display: flex; flex-wrap: wrap; gap: var(--space-sm);">
          ${topFiles.map(([file, count]) => `
            <div style="padding: var(--space-sm) var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); display: flex; align-items: center; gap: var(--space-xs);">
              <span style="font-family: var(--font-mono); font-size: var(--text-sm); color: var(--color-text);">${this.escapeHtml(file)}</span>
              <span style="font-size: var(--text-xs); color: var(--color-text-muted); background: var(--color-bg-alt); padding: 2px 6px; border-radius: 4px;">${count}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  /**
   * Render productivity insights
   */
  async renderProductivityInsights() {
    const container = document.getElementById('productivityInsights');
    if (!container) return;

    const prompts = this.state?.data?.prompts || [];
    const events = this.state?.data?.events || [];
    
    if (prompts.length === 0 && events.length === 0) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; padding: var(--space-xl); text-align: center;">
          <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Data Available</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Productivity data will accumulate as you work with Cursor</div>
        </div>
      `;
      return;
    }

    // Calculate productivity metrics
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const last7days = now - 7 * 24 * 60 * 60 * 1000;
    
    // File edit activity
    const fileEditEvents = events.filter(e => e.type === 'file-change' || e.type === 'file-edit');
    const recentFileEdits = fileEditEvents.filter(e => new Date(e.timestamp).getTime() >= last24h);
    
    // Calculate active coding time (based on event density)
    let activeCodingTime = 0;
    const sortedEvents = [...events].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    for (let i = 1; i < sortedEvents.length; i++) {
      const timeDiff = new Date(sortedEvents[i].timestamp) - new Date(sortedEvents[i - 1].timestamp);
      // Count as active if events are within 5 minutes of each other
      if (timeDiff < 5 * 60 * 1000) {
        activeCodingTime += timeDiff;
      }
    }
    
    // Prompt metrics - try multiple field names
    const userPrompts = prompts.filter(p => {
      const role = p.messageRole || p.role || p.type || '';
      return role === 'user' || role === '' || !role;
    });
    const aiResponses = prompts.filter(p => {
      const role = p.messageRole || p.role || p.type || '';
      return role === 'assistant' || role === 'ai';
    });
    const recentPrompts = userPrompts.filter(p => {
      const time = new Date(p.timestamp).getTime();
      return !isNaN(time) && time >= last24h;
    });
    const weekPrompts = userPrompts.filter(p => {
      const time = new Date(p.timestamp).getTime();
      return !isNaN(time) && time >= last7days;
    });
    
    // Calculate thinking time for AI responses - try multiple field names
    const aiResponsesWithTime = aiResponses.filter(p => {
      const thinkingTime = p.thinkingTimeSeconds || p.thinking_time_seconds || p.thinkingTime || 0;
      return thinkingTime > 0;
    });
    const avgThinkingTime = aiResponsesWithTime.length > 0 
      ? aiResponsesWithTime.reduce((sum, p) => {
          const thinkingTime = p.thinkingTimeSeconds || p.thinking_time_seconds || p.thinkingTime || 0;
          return sum + parseFloat(thinkingTime);
        }, 0) / aiResponsesWithTime.length 
      : 0;
    
    // Lines changed analysis - try multiple field names
    const totalLinesAdded = prompts.reduce((sum, p) => {
      return sum + (p.linesAdded || p.lines_added || p.linesAdded || 0);
    }, 0);
    const totalLinesRemoved = prompts.reduce((sum, p) => {
      return sum + (p.linesRemoved || p.lines_removed || p.linesRemoved || 0);
    }, 0);
    const netLinesChanged = totalLinesAdded - totalLinesRemoved;
    
    // Code churn (high churn = editing same files repeatedly)
    const fileEditCounts = new Map();
    const fileChurnData = new Map(); // Track churn per file: { edits: count, churn: total }
    
    events.forEach(e => {
      // Try multiple field names for file path
      let filePath = e.file || e.file_path || e.filePath || '';
      
      // If no file path found, check details
      if (!filePath && e.details) {
        try {
          const details = typeof e.details === 'string' ? JSON.parse(e.details || '{}') : (e.details || {});
          filePath = details.file_path || details.filePath || '';
        } catch (err) {
          // Ignore parse errors
        }
      }
      
      if (filePath) {
        fileEditCounts.set(filePath, (fileEditCounts.get(filePath) || 0) + 1);
        
        // Calculate churn for this event (lines added + lines removed)
        let churn = 0;
        if (e.details) {
          try {
            const details = typeof e.details === 'string' ? JSON.parse(e.details || '{}') : (e.details || {});
            const linesAdded = details.lines_added || details.linesAdded || 0;
            const linesRemoved = details.lines_removed || details.linesRemoved || 0;
            churn = linesAdded + linesRemoved;
          } catch (err) {
            // Ignore parse errors
          }
        }
        
        // Track churn data per file
        if (!fileChurnData.has(filePath)) {
          fileChurnData.set(filePath, { edits: 0, churn: 0 });
        }
        const data = fileChurnData.get(filePath);
        data.edits += 1;
        data.churn += churn;
      }
    });
    
    const highChurnFiles = Array.from(fileEditCounts.entries())
      .filter(([_, count]) => count >= 5)
      .sort((a, b) => b[1] - a[1]);
    
    // Calculate churn per edit for files with substantial modifications
    const highChurnPerEditFiles = Array.from(fileChurnData.entries())
      .map(([filePath, data]) => {
        const churnPerEdit = data.edits > 0 ? data.churn / data.edits : 0;
        return {
          filePath,
          edits: data.edits,
          churn: data.churn,
          churnPerEdit: churnPerEdit
        };
      })
      .filter(f => f.edits > 0 && f.churnPerEdit >= 100) // Only show files with 100+ lines per edit on average
      .sort((a, b) => b.churnPerEdit - a.churnPerEdit)
      .slice(0, 10); // Top 10
    
    // Conversation length (prompts per conversation)
    const conversationMap = new Map();
    prompts.forEach(p => {
      const convId = p.parentConversationId || p.composerId || 'default';
      conversationMap.set(convId, (conversationMap.get(convId) || 0) + 1);
    });
    const avgPromptsPerConversation = conversationMap.size > 0 
      ? Array.from(conversationMap.values()).reduce((a, b) => a + b, 0) / conversationMap.size 
      : 0;
    
    // Calculate prompts per day
    const promptsPerDay = weekPrompts.length > 0 ? (weekPrompts.length / 7).toFixed(1) : '0.0';
      
    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-md); margin-bottom: var(--space-lg);">
        <div class="stat-card">
          <div class="stat-label" title="Estimated active coding time based on event density">Active Time (Est.)</div>
          <div class="stat-value">${this.formatDuration(activeCodingTime)}</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
            Based on ${events.length.toLocaleString()} events
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-label" title="Total user prompts to AI">Total Prompts</div>
          <div class="stat-value">${userPrompts.length.toLocaleString()}</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
            ${recentPrompts.length} in last 24h
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-label" title="Average prompts per conversation thread">Avg Iteration Depth</div>
          <div class="stat-value">${avgPromptsPerConversation.toFixed(1)}</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
            ${conversationMap.size} conversations
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-label" title="Average AI thinking time">Avg AI Response Time</div>
          <div class="stat-value">${avgThinkingTime.toFixed(1)}s</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
            ${aiResponsesWithTime.length} responses tracked
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-label" title="Net lines changed">Code Changes</div>
          <div class="stat-value" style="color: ${netLinesChanged >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">
            ${netLinesChanged >= 0 ? '+' : ''}${netLinesChanged.toLocaleString()}
          </div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
            <span style="color: var(--color-success);">+${totalLinesAdded.toLocaleString()}</span> /
            <span style="color: var(--color-error);">-${totalLinesRemoved.toLocaleString()}</span>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-label" title="Daily average over last 7 days">Prompts/Day</div>
          <div class="stat-value">${promptsPerDay}</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
            ${weekPrompts.length} in last 7 days
          </div>
        </div>
      </div>

      ${highChurnFiles.length > 0 ? `
        <h4 style="margin-bottom: var(--space-md); color: var(--color-text); font-size: var(--text-md);">High Churn Files (5+ edits)</h4>
        <div style="display: flex; flex-direction: column; gap: var(--space-xs); max-height: 200px; overflow-y: auto;">
          ${highChurnFiles.slice(0, 10).map(([file, count]) => `
            <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-sm);">
              <span style="font-family: var(--font-mono); font-size: var(--text-sm); color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${this.escapeHtml(file)}
              </span>
              <span style="font-size: var(--text-sm); color: var(--color-warning); font-weight: 600;">
                ${count} edits
              </span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${highChurnPerEditFiles.length > 0 ? `
        <h4 style="margin-top: var(--space-lg); margin-bottom: var(--space-md); color: var(--color-text); font-size: var(--text-md);">Substantial Modifications (High Churn per Edit)</h4>
        <p style="font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-md);">
          Files with high average lines changed per edit, indicating substantial modifications per session.
        </p>
        <div style="display: flex; flex-direction: column; gap: var(--space-xs); max-height: 300px; overflow-y: auto;">
          ${highChurnPerEditFiles.map(f => {
            const avgLines = Math.round(f.churnPerEdit);
            return `
            <div style="display: flex; flex-direction: column; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-sm); border-left: 3px solid var(--color-warning);">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-xs);">
                <span style="font-family: var(--font-mono); font-size: var(--text-sm); color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
                  ${this.escapeHtml(f.filePath)}
                </span>
                <span style="font-size: var(--text-sm); color: var(--color-warning); font-weight: 600; margin-left: var(--space-sm); white-space: nowrap;">
                  ~${avgLines} lines/edit
                </span>
              </div>
              <div style="font-size: var(--text-xs); color: var(--color-text-muted);">
                ${f.churn.toLocaleString()} total churn from ${f.edits} edit${f.edits !== 1 ? 's' : ''} = average of ~${avgLines} lines changed per edit
              </div>
            </div>
          `;
          }).join('')}
        </div>
      ` : ''}
    `;
  }
}

// Export as global
window.AnalyticsRenderers = AnalyticsRenderers;

// Create global instance
window.analyticsRenderers = new AnalyticsRenderers();

// Export functions for backward compatibility
window.renderModelUsageAnalytics = () => window.analyticsRenderers.renderModelUsageAnalytics();
window.renderContextFileAnalytics = () => window.analyticsRenderers.renderContextFileAnalytics();
window.renderEnhancedContextAnalytics = () => window.analyticsRenderers.renderEnhancedContextAnalytics();
window.renderProductivityInsights = () => window.analyticsRenderers.renderProductivityInsights();

