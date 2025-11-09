/**
 * Context Visualization Helpers
 * Visualizes context changes and structure in timeline and other views
 */

/**
 * Fetch context changes for a prompt
 */
async function fetchContextChanges(promptId) {
  try {
    const apiBase = window.CONFIG?.API_BASE_URL || 'http://localhost:43917';
    const response = await fetch(`${apiBase}/api/prompts/${promptId}/context-changes`);
    const result = await response.json();
    return result.success ? result.data : [];
  } catch (error) {
    console.error('Error fetching context changes:', error);
    return [];
  }
}

/**
 * Render context change indicator for timeline items
 */
function renderContextChangeIndicator(contextChange, compact = false) {
  if (!contextChange) return '';
  
  const { addedFiles, removedFiles, netChange, currentFileCount } = contextChange;
  
  if (compact) {
    // Compact version for timeline badges
    if (addedFiles.length === 0 && removedFiles.length === 0) {
      return '';
    }
    
    const changeText = netChange > 0 ? `+${netChange}` : netChange < 0 ? `${netChange}` : '±0';
    const changeClass = netChange > 0 ? 'context-added' : netChange < 0 ? 'context-removed' : 'context-unchanged';
    
    return `
      <span class="context-change-badge ${changeClass}" 
            title="${addedFiles.length} added, ${removedFiles.length} removed (${currentFileCount} total)">
        ${changeText}
      </span>
    `;
  }
  
  // Full version for modals/details
  return `
    <div class="context-change-details">
      <div class="context-change-header">
        <h4>Context Changes</h4>
        <span class="context-file-count">${currentFileCount} files in context</span>
      </div>
      
      ${addedFiles.length > 0 ? `
        <div class="context-change-section context-added">
          <div class="context-change-label">
            <span class="context-change-icon">[Add]</span>
            <strong>Added (${addedFiles.length})</strong>
          </div>
          <div class="context-file-list">
            ${addedFiles.map(file => `
              <div class="context-file-item">
                <code>${window.escapeHtml(file)}</code>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      ${removedFiles.length > 0 ? `
        <div class="context-change-section context-removed">
          <div class="context-change-label">
            <span class="context-change-icon">➖</span>
            <strong>Removed (${removedFiles.length})</strong>
          </div>
          <div class="context-file-list">
            ${removedFiles.map(file => `
              <div class="context-file-item">
                <code>${window.escapeHtml(file)}</code>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      ${netChange !== 0 ? `
        <div class="context-change-summary">
          <span class="net-change ${netChange > 0 ? 'positive' : 'negative'}">
            Net change: ${netChange > 0 ? '+' : ''}${netChange}
          </span>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Render context structure visualization
 */
function renderContextStructure(contextAnalysis, contextChange = null) {
  if (!contextAnalysis && !contextChange) return '';
  
  const contextFiles = contextAnalysis?.contextFiles || [];
  const fileCount = contextFiles.length || contextChange?.currentFileCount || 0;
  
  if (fileCount === 0) return '';
  
  // Group files by type/source
  const filesBySource = {
    explicit: [], // @ mentions
    implicit: [], // Auto-added
    response: []  // AI-generated
  };
  
  contextFiles.forEach(file => {
    const source = file.source || file.type || 'implicit';
    if (source.includes('at_mention') || source.includes('explicit')) {
      filesBySource.explicit.push(file);
    } else if (source.includes('response') || source.includes('ai_generated')) {
      filesBySource.response.push(file);
    } else {
      filesBySource.implicit.push(file);
    }
  });
  
  return `
    <div class="context-structure">
      <div class="context-structure-header">
        <h5>Context Structure</h5>
        <span class="context-total-files">${fileCount} files</span>
      </div>
      
      <div class="context-structure-breakdown">
        ${filesBySource.explicit.length > 0 ? `
          <div class="context-source-group">
            <span class="context-source-label explicit">
              <span class="context-source-icon">@</span>
              Explicit: ${filesBySource.explicit.length}
            </span>
          </div>
        ` : ''}
        
        ${filesBySource.implicit.length > 0 ? `
          <div class="context-source-group">
            <span class="context-source-label implicit">
              <span class="context-source-icon">[Search]</span>
              Auto-added: ${filesBySource.implicit.length}
            </span>
          </div>
        ` : ''}
        
        ${filesBySource.response.length > 0 ? `
          <div class="context-source-group">
            <span class="context-source-label response">
              <span class="context-source-icon">[AI]</span>
              Generated: ${filesBySource.response.length}
            </span>
          </div>
        ` : ''}
      </div>
      
      ${contextChange ? renderContextChangeIndicator(contextChange, false) : ''}
      
      ${contextAnalysis && contextAnalysis.contextFiles && contextAnalysis.contextFiles.length > 0 ? `
        <div class="context-files-preview">
          <h6>Files in Context</h6>
          <div class="context-files-list">
            ${contextAnalysis.contextFiles.slice(0, 10).map(file => `
              <div class="context-file-preview">
                <code>${window.escapeHtml ? window.escapeHtml(file.path || file.fileName || '') : (file.path || file.fileName || '')}</code>
                <span class="context-file-source">${file.source || file.type || 'unknown'}</span>
              </div>
            `).join('')}
            ${contextAnalysis.contextFiles.length > 10 ? `
              <div class="context-files-more">+${contextAnalysis.contextFiles.length - 10} more files</div>
            ` : ''}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Enhance prompt timeline item with context information
 */
async function enhancePromptWithContext(prompt) {
  if (!prompt.id) return prompt;
  
  try {
    // Fetch context changes
    const contextChanges = await fetchContextChanges(prompt.id);
    const latestChange = contextChanges.length > 0 ? contextChanges[0] : null;
    
    // Add context information to prompt
    prompt.contextChange = latestChange;
    prompt.contextChanges = contextChanges;
    
    // Fetch related status messages (within 10 seconds)
    if (window.fetchStatusMessages && prompt.timestamp) {
      // Check if service is available
      if (window.state && window.state.companionServiceOnline === false) {
        // Skip if service is offline
      } else {
        try {
          const promptTime = typeof prompt.timestamp === 'number' 
            ? prompt.timestamp 
            : new Date(prompt.timestamp).getTime();
          
          // Validate timestamp is reasonable (not from year 2000 or invalid)
          const MIN_VALID_TIMESTAMP = 1577836800000; // 2020-01-01
          const MAX_VALID_TIMESTAMP = Date.now() + (24 * 60 * 60 * 1000); // 1 day in future max
          
          if (!isNaN(promptTime) && 
              promptTime >= MIN_VALID_TIMESTAMP && 
              promptTime <= MAX_VALID_TIMESTAMP) {
            const statusMessages = await window.fetchStatusMessages(
              promptTime - 10000,
              promptTime + 10000
            );
            prompt.relatedStatusMessages = statusMessages || [];
          }
        } catch (error) {
          // Silently fail if status messages not available
        }
      }
    }
    
    // If we have context analysis, add it
    if (prompt.contextAnalysis) {
      prompt.contextStructure = renderContextStructure(prompt.contextAnalysis, latestChange);
    }
    
    return prompt;
  } catch (error) {
    console.error('Error enhancing prompt with context:', error);
    return prompt;
  }
}

/**
 * Render context evolution timeline
 */
function renderContextEvolutionTimeline(contextChanges) {
  if (!contextChanges || contextChanges.length === 0) return '';
  
  // Sort by timestamp (oldest first for evolution)
  const sorted = [...contextChanges].sort((a, b) => a.timestamp - b.timestamp);
  
  return `
    <div class="context-evolution-timeline">
      <h4>Context Evolution</h4>
      <div class="evolution-steps">
        ${sorted.map((change, index) => {
          const prevCount = index > 0 ? sorted[index - 1].currentFileCount : 0;
          const currentCount = change.currentFileCount;
          const trend = currentCount > prevCount ? 'up' : currentCount < prevCount ? 'down' : 'stable';
          
          return `
            <div class="evolution-step ${trend}">
              <div class="evolution-time">${new Date(change.timestamp).toLocaleTimeString()}</div>
              <div class="evolution-count">
                <span class="count-badge">${currentCount} files</span>
                ${change.netChange !== 0 ? `
                  <span class="change-indicator ${change.netChange > 0 ? 'positive' : 'negative'}">
                    ${change.netChange > 0 ? '+' : ''}${change.netChange}
                  </span>
                ` : ''}
              </div>
              ${change.addedFiles.length > 0 || change.removedFiles.length > 0 ? `
                <div class="evolution-details">
                  ${change.addedFiles.length > 0 ? `
                    <span class="evolution-added">+${change.addedFiles.length}</span>
                  ` : ''}
                  ${change.removedFiles.length > 0 ? `
                    <span class="evolution-removed">-${change.removedFiles.length}</span>
                  ` : ''}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/**
 * Get context change summary for a prompt
 */
function getContextChangeSummary(contextChange) {
  if (!contextChange) return null;
  
  return {
    added: contextChange.addedFiles?.length || 0,
    removed: contextChange.removedFiles?.length || 0,
    net: contextChange.netChange || 0,
    total: contextChange.currentFileCount || 0,
    hasChanges: (contextChange.addedFiles?.length || 0) > 0 || (contextChange.removedFiles?.length || 0) > 0
  };
}

// Export functions
if (typeof window !== 'undefined') {
  window.fetchContextChanges = fetchContextChanges;
  window.renderContextChangeIndicator = renderContextChangeIndicator;
  window.renderContextStructure = renderContextStructure;
  window.enhancePromptWithContext = enhancePromptWithContext;
  window.renderContextEvolutionTimeline = renderContextEvolutionTimeline;
  window.getContextChangeSummary = getContextChangeSummary;
}

