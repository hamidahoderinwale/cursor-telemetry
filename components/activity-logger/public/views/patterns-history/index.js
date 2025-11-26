/**
 * Patterns History View - GitHub-style commit history for procedural knowledge
 * Shows motifs and edit scripts as commits in a timeline
 */

let currentPatternType = 'all'; // 'all', 'motifs', 'edit-scripts'
let currentWorkspace = 'all';

function renderPatternsHistoryView(container) {
  if (!container) {
    console.error('[PATTERNS-HISTORY] Container not provided');
    return;
  }
  
  container.innerHTML = `
    <div class="patterns-history-view">
      <div class="view-header">
        <div class="view-header-content">
          <h1 class="view-title">Patterns History</h1>
          <p class="view-description">
            Procedural knowledge extracted from your development workflow - like GitHub commits, but for patterns
          </p>
        </div>
        <div class="view-header-actions">
          <div class="pattern-type-selector">
            <button class="pattern-type-btn ${currentPatternType === 'all' ? 'active' : ''}" 
                    onclick="switchPatternType('all')" data-type="all">
              All Patterns
            </button>
            <button class="pattern-type-btn ${currentPatternType === 'motifs' ? 'active' : ''}" 
                    onclick="switchPatternType('motifs')" data-type="motifs">
              Motifs (Rung 6)
            </button>
            <button class="pattern-type-btn ${currentPatternType === 'edit-scripts' ? 'active' : ''}" 
                    onclick="switchPatternType('edit-scripts')" data-type="edit-scripts">
              Edit Scripts (Rung 2)
            </button>
          </div>
        </div>
      </div>

      <div class="patterns-history-content">
        <div id="patterns-history-list" class="patterns-history-list">
          <div class="loading-state">Loading patterns...</div>
        </div>
      </div>
    </div>
  `;

  loadPatternsHistory();
}

function switchPatternType(type) {
  currentPatternType = type;
  document.querySelectorAll('.pattern-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  loadPatternsHistory();
}

async function loadPatternsHistory() {
  const container = document.getElementById('patterns-history-list');
  if (!container) return;

  try {
    container.innerHTML = '<div class="loading-state">Loading patterns...</div>';

    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const patterns = [];

    // Load motifs if needed
    if (currentPatternType === 'all' || currentPatternType === 'motifs') {
      try {
        const motifsResponse = await fetch(`${apiBase}/api/motifs`);
        if (motifsResponse.ok) {
          const motifsData = await motifsResponse.json();
          if (motifsData.success && motifsData.motifs) {
            motifsData.motifs.forEach(motif => {
              patterns.push({
                type: 'motif',
                id: motif.id,
                name: motif.name || `Motif ${motif.id}`,
                message: motif.description || `Pattern: ${motif.dominantIntent || 'Unknown'}`,
                timestamp: motif.firstSeen || motif.timestamp || Date.now(),
                frequency: motif.frequency || 0,
                intent: motif.dominantIntent || 'OTHER',
                shape: motif.workflowShape || 'sequence',
                files: motif.relatedFiles || [],
                author: 'Pattern Extractor',
                hash: `motif-${motif.id}`,
                metadata: motif
              });
            });
          }
        }
      } catch (error) {
        console.warn('[PATTERNS] Failed to load motifs:', error);
      }
    }

    // Load edit scripts if needed
    if (currentPatternType === 'all' || currentPatternType === 'edit-scripts') {
      try {
        const workspace = currentWorkspace !== 'all' ? currentWorkspace : null;
        const scriptsUrl = workspace 
          ? `${apiBase}/api/rung2/edit-scripts?workspace=${encodeURIComponent(workspace)}`
          : `${apiBase}/api/rung2/edit-scripts`;
        
        console.log('[PATTERNS] Fetching edit scripts from:', scriptsUrl);
        const scriptsResponse = await fetch(scriptsUrl);
        if (scriptsResponse.ok) {
          const scriptsData = await scriptsResponse.json();
          console.log('[PATTERNS] Edit scripts response:', scriptsData);
          
          // Handle both response formats
          const scriptsList = scriptsData.success && scriptsData.scripts 
            ? scriptsData.scripts 
            : (Array.isArray(scriptsData) ? scriptsData : []);
          
          if (scriptsList.length > 0) {
            scriptsList.forEach(script => {
              const operationTypes = script.operationTypes || {};
              const operationCount = script.operationCount || 0;
              const intent = script.intentCategory || 'OTHER';
              
              patterns.push({
                type: 'edit-script',
                id: script.id,
                name: script.filePath ? script.filePath.split('/').pop() : `Edit Script ${script.id}`,
                message: `${operationCount} operations: ${Object.keys(operationTypes).join(', ')}`,
                timestamp: script.timestamp || Date.now(),
                frequency: 1,
                intent: intent,
                shape: script.changeStyle || 'sequence',
                files: script.filePath ? [script.filePath] : [],
                author: 'Edit Script Extractor',
                hash: `script-${script.id}`,
                metadata: script
              });
            });
          } else {
            console.log('[PATTERNS] No edit scripts found in response');
          }
        } else {
          console.warn('[PATTERNS] Edit scripts request failed:', scriptsResponse.status);
        }
      } catch (error) {
        console.warn('[PATTERNS] Failed to load edit scripts:', error);
      }
    }

    // Sort by timestamp (newest first)
    patterns.sort((a, b) => b.timestamp - a.timestamp);

    if (patterns.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3v18h18"/>
              <path d="M18 17V9"/>
              <path d="M13 17v-6"/>
              <path d="M8 17v-4"/>
            </svg>
          </div>
          <div class="empty-state-text">No patterns found</div>
          <div class="empty-state-hint">
            Patterns will appear here as procedural knowledge is extracted from your code changes.
            ${currentPatternType === 'motifs' ? '<br>Try switching to "Edit Scripts" or "All Patterns", or extract data from the Rung 2 view.' : ''}
            ${currentPatternType === 'edit-scripts' ? '<br>Try switching to "Motifs" or "All Patterns", or extract edit scripts from the Rung 2 view.' : ''}
            ${currentPatternType === 'all' ? '<br>Extract data from Motifs or Rung 2 views to see patterns here.' : ''}
          </div>
          <div class="empty-state-actions" style="margin-top: 1rem;">
            <button class="btn btn-primary" onclick="window.switchView('rung2-edit-scripts')" style="margin-right: 0.5rem;">
              Go to Rung 2 (Edit Scripts)
            </button>
            <button class="btn btn-secondary" onclick="window.switchView('clio')">
              Go to Clio (Motifs)
            </button>
          </div>
        </div>
      `;
      return;
    }

    renderPatternsList(patterns, container);
  } catch (error) {
    console.error('[PATTERNS] Error loading patterns:', error);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-text">Error loading patterns</div>
        <div class="empty-state-hint">${error.message}</div>
      </div>
    `;
  }
}

function renderPatternsList(patterns, container) {
  const intentColors = {
    'FIX_BUG': '#ef4444',
    'ADD_FEATURE': '#3b82f6',
    'REFACTOR': '#8b5cf6',
    'TEST': '#10b981',
    'DOCUMENT': '#f59e0b',
    'OTHER': '#6b7280'
  };

  const intentLabels = {
    'FIX_BUG': 'Bug Fix',
    'ADD_FEATURE': 'Feature',
    'REFACTOR': 'Refactor',
    'TEST': 'Test',
    'DOCUMENT': 'Document',
    'OTHER': 'Other'
  };

  container.innerHTML = patterns.map((pattern, index) => {
    const date = new Date(pattern.timestamp);
    const timeAgo = window.formatTimeAgo ? window.formatTimeAgo(pattern.timestamp) : date.toLocaleDateString();
    const intentColor = intentColors[pattern.intent] || intentColors.OTHER;
    const intentLabel = intentLabels[pattern.intent] || 'Other';
    const typeBadge = pattern.type === 'motif' ? 'Motif' : 'Edit Script';
    const typeColor = pattern.type === 'motif' ? '#8b5cf6' : '#3b82f6';

    // Format files list
    const filesDisplay = pattern.files.length > 0 
      ? pattern.files.slice(0, 3).map(f => {
          const fileName = f.split('/').pop();
          return `<span class="pattern-file-badge">${window.escapeHtml ? window.escapeHtml(fileName) : fileName}</span>`;
        }).join('')
      : '';

    const moreFiles = pattern.files.length > 3 
      ? `<span class="pattern-file-more">+${pattern.files.length - 3} more</span>`
      : '';

    return `
      <div class="pattern-commit-item" data-pattern-id="${pattern.id}" data-pattern-type="${pattern.type}">
        <div class="pattern-commit-header">
          <div class="pattern-commit-avatar">
            <div class="pattern-avatar-icon" style="background: ${typeColor}">
              ${pattern.type === 'motif' ? '[Pattern]' : '[Note]'}
            </div>
          </div>
          <div class="pattern-commit-info">
            <div class="pattern-commit-message">
              <span class="pattern-commit-hash">${pattern.hash.substring(0, 8)}</span>
              <span class="pattern-commit-title">${window.escapeHtml ? window.escapeHtml(pattern.message) : pattern.message}</span>
            </div>
            <div class="pattern-commit-meta">
              <span class="pattern-commit-author">${pattern.author}</span>
              <span class="pattern-commit-time">${timeAgo}</span>
              <span class="pattern-commit-type-badge" style="background: ${typeColor}20; color: ${typeColor}">
                ${typeBadge}
              </span>
              <span class="pattern-commit-intent-badge" style="background: ${intentColor}20; color: ${intentColor}">
                ${intentLabel}
              </span>
              ${pattern.frequency > 1 ? `
                <span class="pattern-commit-frequency">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"/>
                  </svg>
                  ${pattern.frequency}x
                </span>
              ` : ''}
            </div>
          </div>
        </div>
        ${pattern.files.length > 0 ? `
          <div class="pattern-commit-files">
            ${filesDisplay}${moreFiles}
          </div>
        ` : ''}
        <div class="pattern-commit-actions">
          <button class="pattern-action-btn" onclick="viewPatternDetails('${pattern.type}', '${pattern.id}')">
            View Details
          </button>
          ${pattern.type === 'motif' ? `
            <button class="pattern-action-btn" onclick="viewPatternInClio('${pattern.id}')">
              View in Clio
            </button>
          ` : ''}
          <button class="pattern-action-btn" onclick="viewPatternInActivity('${pattern.id}')">
            View Source Events
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function viewPatternDetails(type, id) {
  // Open modal with pattern details
  if (window.openPatternModal) {
    window.openPatternModal(type, id);
  } else {
    console.warn('Pattern modal not available');
  }
}

function viewPatternInClio(motifId) {
  window.switchView('clio');
  // TODO: Highlight specific motif in Clio view
  setTimeout(() => {
    if (window.highlightMotifInClio) {
      window.highlightMotifInClio(motifId);
    }
  }, 500);
}

function viewPatternInActivity(patternId) {
  window.switchView('activity');
  // TODO: Filter activity timeline to show related events
  setTimeout(() => {
    if (window.filterActivityByPattern) {
      window.filterActivityByPattern(patternId);
    }
  }, 500);
}

// Export to window
window.renderPatternsHistoryView = renderPatternsHistoryView;
window.switchPatternType = switchPatternType;
window.viewPatternDetails = viewPatternDetails;
window.viewPatternInClio = viewPatternInClio;
window.viewPatternInActivity = viewPatternInActivity;


