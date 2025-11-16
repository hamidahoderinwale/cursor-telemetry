/**
 * Rung 4 File Graph View (Module Graph)
 * Main entry point for the Module Graph view
 */

// Load templates first
if (!window.renderRung4FileGraphTemplate) {
  const templatesScript = document.createElement('script');
  templatesScript.src = 'views/rung4-file-graph/templates.js';
  templatesScript.async = false;
  document.head.appendChild(templatesScript);
}

function renderRung4FileGraphView(container) {
  // Ensure D3.js is loaded
  if (typeof d3 === 'undefined') {
    const d3Script = document.createElement('script');
    d3Script.src = 'https://d3js.org/d3.v7.min.js';
    d3Script.onload = () => {
      initializeRung4View(container);
    };
    document.head.appendChild(d3Script);
  } else {
    initializeRung4View(container);
  }
}

function initializeRung4View(container) {
  // Load visualization script if not already loaded
  if (!window.initializeRung4Visualization) {
    const vizScript = document.createElement('script');
    vizScript.src = 'views/rung4-file-graph/rung4-visualization.js';
    vizScript.onload = () => {
      renderRung4ViewContent(container);
    };
    document.head.appendChild(vizScript);
  } else {
    renderRung4ViewContent(container);
  }
}

function renderRung4ViewContent(container) {
  // Render template
  container.innerHTML = window.renderRung4FileGraphTemplate();

  // Initialize visualization
  if (window.initializeRung4Visualization) {
    window.initializeRung4Visualization();
  }

  // Load data
  loadRung4Data();

  // Initialize timeline
  loadRung4Timeline();
}

/**
 * Load Rung 4 graph data
 */
async function loadRung4Data() {
  const graphContainer = document.getElementById('rung4-graph');
  if (!graphContainer) return;

  try {
    graphContainer.innerHTML = '<div class="rung4-loading">Loading module graph...</div>';

    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const workspace = getCurrentWorkspace();
    const url = workspace 
      ? `${apiBase}/api/rung4/graph?workspace=${encodeURIComponent(workspace)}`
      : `${apiBase}/api/rung4/graph`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success && data.graph) {
      // Store graph data globally for details panel
      window.rung4GraphData = data.graph;
      
      // Render graph
      if (window.renderRung4Graph) {
        window.renderRung4Graph(data.graph);
      }
    } else {
      throw new Error(data.error || 'Failed to load graph data');
    }
  } catch (error) {
    console.error('[RUNG4] Error loading graph data:', error);
    const graphContainer = document.getElementById('rung4-graph');
    if (graphContainer) {
      graphContainer.innerHTML = `
        <div class="rung4-loading" style="color: var(--color-error, #ef4444);">
          Error loading module graph: ${error.message}
        </div>
      `;
    }
  }
}

/**
 * Load structural events timeline
 */
async function loadRung4Timeline() {
  const timelineContainer = document.getElementById('rung4-timeline');
  if (!timelineContainer) return;

  try {
    timelineContainer.innerHTML = '<div class="rung4-timeline-loading">Loading events...</div>';

    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const workspace = getCurrentWorkspace();
    const eventType = document.getElementById('rung4-event-filter')?.value || '';
    
    let url = workspace 
      ? `${apiBase}/api/rung4/events?workspace=${encodeURIComponent(workspace)}`
      : `${apiBase}/api/rung4/events`;
    
    if (eventType) {
      url += `&event_type=${encodeURIComponent(eventType)}`;
    }

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success && data.events) {
      renderRung4Timeline(data.events);
    } else {
      throw new Error(data.error || 'Failed to load events');
    }
  } catch (error) {
    console.error('[RUNG4] Error loading timeline:', error);
    const timelineContainer = document.getElementById('rung4-timeline');
    if (timelineContainer) {
      timelineContainer.innerHTML = `
        <div class="rung4-timeline-loading" style="color: var(--color-error, #ef4444);">
          Error loading events: ${error.message}
        </div>
      `;
    }
  }
}

/**
 * Render timeline events
 */
function renderRung4Timeline(events) {
  const timelineContainer = document.getElementById('rung4-timeline');
  if (!timelineContainer) return;

  if (!events || events.length === 0) {
    timelineContainer.innerHTML = '<div class="rung4-timeline-loading">No events found</div>';
    return;
  }

  // Sort events by timestamp (most recent first)
  const sortedEvents = [...events].sort((a, b) => b.timestamp - a.timestamp);

  const eventsHTML = sortedEvents.slice(0, 100).map(event => {
    const date = new Date(event.timestamp);
    const timeStr = date.toLocaleTimeString();
    const dateStr = date.toLocaleDateString();

    return `
      <div class="rung4-event-item" onclick="selectRung4Event('${event.id}')">
        <span class="rung4-event-time">${timeStr} ${dateStr}</span>
        <span class="rung4-event-type">${event.event_type}</span>
        <span class="rung4-event-file">${event.metadata?.file_path || event.file || 'Unknown'}</span>
      </div>
    `;
  }).join('');

  timelineContainer.innerHTML = eventsHTML;
}

/**
 * Apply filters and refresh graph
 */
window.applyRung4Filters = function() {
  if (window.rung4GraphData && window.renderRung4Graph) {
    window.renderRung4Graph(window.rung4GraphData);
  }
};

/**
 * Change layout
 */
window.changeRung4Layout = function() {
  const layout = document.getElementById('rung4-layout')?.value;
  console.log('[RUNG4] Layout changed to:', layout);
  // Layout change logic would go here
  // For now, just re-render with current layout
  if (window.rung4GraphData && window.renderRung4Graph) {
    window.renderRung4Graph(window.rung4GraphData);
  }
};

/**
 * Update time range
 */
window.updateRung4TimeRange = function(value) {
  const display = document.getElementById('rung4-time-display');
  if (display) {
    if (value >= 100) {
      display.textContent = 'All Time';
    } else {
      const days = Math.floor((100 - value) * 30 / 100);
      display.textContent = `Last ${days} days`;
    }
  }
  // Time range filtering would go here
  loadRung4Timeline();
};

/**
 * Update timeline
 */
window.updateRung4Timeline = function() {
  loadRung4Timeline();
};

/**
 * Refresh graph
 */
window.refreshRung4Graph = async function() {
  const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
  const workspace = getCurrentWorkspace();
  
  try {
    // Clear cache
    await fetch(`${apiBase}/api/rung4/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace })
    });

    // Reload data
    loadRung4Data();
    loadRung4Timeline();
  } catch (error) {
    console.error('[RUNG4] Error refreshing graph:', error);
  }
};

/**
 * Export graph
 */
window.exportRung4Graph = async function() {
  if (!window.rung4GraphData) {
    alert('No graph data to export');
    return;
  }

  const dataStr = JSON.stringify(window.rung4GraphData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `module-graph-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * Close details panel
 */
window.closeRung4Details = function() {
  const detailsPanel = document.getElementById('rung4-details-content');
  if (detailsPanel) {
    detailsPanel.innerHTML = `
      <div class="rung4-details-placeholder">
        <p>Click a node or edge to view details</p>
      </div>
    `;
  }
  rung4SelectedNode = null;
};

/**
 * Select event
 */
window.selectRung4Event = function(eventId) {
  // Find event in graph data
  if (window.rung4GraphData && window.rung4GraphData.events) {
    const event = window.rung4GraphData.events.find(e => e.id === eventId);
    if (event && window.rung4GraphData.nodes) {
      const node = window.rung4GraphData.nodes.find(n => n.id === event.file);
      if (node && window.selectRung4Node) {
        window.selectRung4Node(node);
      }
    }
  }
};

/**
 * Get current workspace from URL or state
 */
function getCurrentWorkspace() {
  // Try to get from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const workspace = urlParams.get('workspace');
  if (workspace) return workspace;

  // Try to get from state
  if (window.state && window.state.data && window.state.data.workspaces && window.state.data.workspaces.length > 0) {
    return window.state.data.workspaces[0];
  }

  return null;
}

// Export to window for global access
window.renderRung4FileGraphView = renderRung4FileGraphView;

