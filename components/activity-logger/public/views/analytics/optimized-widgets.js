/**
 * Optimized Analytics Widgets
 * Streamlined version with only high-value insights
 * Reduces cognitive load and rendering time
 */

/**
 * Generate streamlined quick insights HTML
 * Reduces 8 widgets down to 4 high-value ones
 */
function generateOptimizedQuickInsights() {
  return `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Key Metrics</h3>
        <p class="card-subtitle">High-impact development insights</p>
      </div>
      <div class="card-body">
        <div class="quick-wins-grid quick-wins-grid-optimized">
          
          <!-- Prompt Success Rate - KEEP (High Value) -->
          <div class="quick-win-card">
            <h4 class="quick-win-title" title="Percentage of prompts that resulted in code changes">
              Prompt Success Rate
            </h4>
            <div id="promptSuccessRate" class="quick-win-value" style="color: var(--color-primary, #3b82f6);">
              Calculating...
            </div>
            <div class="quick-win-description">
              Prompts with code changes / Total prompts
            </div>
          </div>

          <!-- Context Efficiency Score - KEEP (High Value) -->
          <div class="quick-win-card">
            <h4 class="quick-win-title" title="Average lines of code added per context file">
              Context Efficiency
            </h4>
            <div id="contextEfficiencyScore" class="quick-win-value" style="color: var(--color-accent, #10b981);">
              Calculating...
            </div>
            <div class="quick-win-description">
              Lines added / Context files used
            </div>
          </div>

          <!-- Model Usage - KEEP but simplified -->
          <div class="quick-win-card">
            <h4 class="quick-win-title" title="Most used AI model">
              Top Model
            </h4>
            <div id="topModelUsage" class="quick-win-value" style="color: var(--color-secondary, #8b5cf6);">
              Calculating...
            </div>
            <div class="quick-win-description" id="topModelDetails">
              Analyzing model usage...
            </div>
          </div>

          <!-- Peak Productivity Time - SIMPLIFIED from 24-hour chart -->
          <div class="quick-win-card">
            <h4 class="quick-win-title" title="Your most productive hour of the day">
              Peak Hour
            </h4>
            <div id="peakProductivityTime" class="quick-win-value" style="color: var(--color-warning, #f59e0b);">
              Calculating...
            </div>
            <div class="quick-win-description" id="peakProductivityDetails">
              Based on activity patterns
            </div>
          </div>

          <!-- Thinking Time Stats - SIMPLIFIED from histogram -->
          <div class="quick-win-card">
            <h4 class="quick-win-title" title="AI response time statistics">
              AI Response Time
            </h4>
            <div id="thinkingTimeStats" class="quick-win-value" style="color: var(--color-success, #10b981);">
              Calculating...
            </div>
            <div class="quick-win-description" id="thinkingTimeDetails">
              Median response time
            </div>
          </div>

          <!-- Most Referenced File - SIMPLIFIED from context file chart -->
          <div class="quick-win-card">
            <h4 class="quick-win-title" title="Your most referenced context file">
              Top Context File
            </h4>
            <div id="topContextFile" class="quick-win-value file-name-truncate" style="color: var(--color-primary, #3b82f6); font-size: 0.9rem;">
              Calculating...
            </div>
            <div class="quick-win-description" id="topContextFileDetails">
              Most frequently referenced
            </div>
          </div>

        </div>
      </div>
    </div>
  `;
}

/**
 * Calculate and render optimized quick insights
 * Replaces heavy chart rendering with simple stats
 */
async function renderOptimizedQuickInsights() {
  const prompts = window.state?.data?.prompts || [];
  const events = window.state?.data?.events || [];
  
  if (prompts.length === 0 && events.length === 0) {
    return;
  }

  // 1. Top Model Usage (simplified - no chart)
  const modelCounts = {};
  prompts.forEach(p => {
    const model = p.model_name || p.model || 'Unknown';
    modelCounts[model] = (modelCounts[model] || 0) + 1;
  });
  
  const topModel = Object.entries(modelCounts)
    .sort(([,a], [,b]) => b - a)[0];
  
  if (topModel) {
    const [modelName, count] = topModel;
    const percentage = ((count / prompts.length) * 100).toFixed(0);
    document.getElementById('topModelUsage').textContent = modelName;
    document.getElementById('topModelDetails').textContent = `${percentage}% of ${prompts.length} prompts`;
  }

  // 2. Peak Productivity Time (simplified - no 24-hour chart)
  const hourCounts = {};
  [...events, ...prompts].forEach(item => {
    try {
      const date = new Date(item.timestamp || item.created_at);
      const hour = date.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    } catch (e) {}
  });
  
  const peakHour = Object.entries(hourCounts)
    .sort(([,a], [,b]) => b - a)[0];
  
  if (peakHour) {
    const [hour, count] = peakHour;
    const hourNum = parseInt(hour);
    const timeStr = `${hourNum % 12 || 12}${hourNum >= 12 ? 'PM' : 'AM'}`;
    document.getElementById('peakProductivityTime').textContent = timeStr;
    document.getElementById('peakProductivityDetails').textContent = `${count} activities during this hour`;
  }

  // 3. Thinking Time Stats (simplified - no histogram)
  const thinkingTimes = prompts
    .map(p => p.thinking_time_seconds)
    .filter(t => t && t > 0)
    .sort((a, b) => a - b);
  
  if (thinkingTimes.length > 0) {
    const median = thinkingTimes[Math.floor(thinkingTimes.length / 2)];
    const p95 = thinkingTimes[Math.floor(thinkingTimes.length * 0.95)];
    document.getElementById('thinkingTimeStats').textContent = `${median.toFixed(1)}s`;
    document.getElementById('thinkingTimeDetails').textContent = `P95: ${p95.toFixed(1)}s`;
  }

  // 4. Top Context File (simplified - no chart)
  const contextFileCounts = {};
  prompts.forEach(p => {
    try {
      const contextFiles = typeof p.context_files === 'string' 
        ? JSON.parse(p.context_files) 
        : p.context_files;
      
      if (Array.isArray(contextFiles)) {
        contextFiles.forEach(file => {
          const fileName = file.split('/').pop() || file;
          contextFileCounts[fileName] = (contextFileCounts[fileName] || 0) + 1;
        });
      }
    } catch (e) {}
  });
  
  const topFile = Object.entries(contextFileCounts)
    .sort(([,a], [,b]) => b - a)[0];
  
  if (topFile) {
    const [fileName, count] = topFile;
    document.getElementById('topContextFile').textContent = fileName;
    document.getElementById('topContextFileDetails').textContent = `Referenced ${count} times`;
  }
}

// Export for use in analytics view
if (typeof window !== 'undefined') {
  window.generateOptimizedQuickInsights = generateOptimizedQuickInsights;
  window.renderOptimizedQuickInsights = renderOptimizedQuickInsights;
}


