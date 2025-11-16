/**
 * Module Graph View
 * Main entry point for the Module Graph view
 */

// Load templates first
if (!window.renderModuleGraphTemplate) {
  const templatesScript = document.createElement('script');
  templatesScript.src = 'views/module-graph/templates.js';
  templatesScript.async = false;
  document.head.appendChild(templatesScript);
}

function renderModuleGraphView(container) {
  // Ensure D3.js is loaded
  if (typeof d3 === 'undefined') {
    const d3Script = document.createElement('script');
    d3Script.src = 'https://d3js.org/d3.v7.min.js';
    d3Script.onload = () => {
      initializeModuleGraphView(container);
    };
    document.head.appendChild(d3Script);
  } else {
    initializeModuleGraphView(container);
  }
}

function initializeModuleGraphView(container) {
  // Load visualization script if not already loaded
  if (!window.initializeModuleGraphVisualization) {
      const vizScript = document.createElement('script');
      vizScript.src = 'views/module-graph/module-graph-visualization.js';
    vizScript.onload = () => {
      renderModuleGraphViewContent(container);
    };
    document.head.appendChild(vizScript);
  } else {
    renderModuleGraphViewContent(container);
  }
}

function renderModuleGraphViewContent(container) {
  // Render template
  container.innerHTML = window.renderModuleGraphTemplate();

  // Initialize visualization
  if (window.initializeModuleGraphVisualization) {
    window.initializeModuleGraphVisualization();
  }

  // Load data
  loadModuleGraphData();

  // Initialize timeline
  loadModuleGraphTimeline();
}

/**
 * Load Module Graph data
 */
async function loadModuleGraphData() {
  const graphContainer = document.getElementById('module-graph-graph');
  if (!graphContainer) return;

  try {
    graphContainer.innerHTML = '<div class="module-graph-loading">Loading module graph...</div>';

    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const workspace = getCurrentWorkspace();
    const url = workspace 
      ? `${apiBase}/api/module-graph/graph?workspace=${encodeURIComponent(workspace)}`
      : `${apiBase}/api/module-graph/graph`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success && data.graph) {
      // Store graph data globally for details panel
      window.moduleGraphData = data.graph;
      
      // Render graph
      if (window.renderModuleGraph) {
        window.renderModuleGraph(data.graph);
      }
    } else {
      throw new Error(data.error || 'Failed to load graph data');
    }
    } catch (error) {
    console.error('[MODULE-GRAPH] Error loading graph data:', error);
    const graphContainer = document.getElementById('module-graph-graph');
    if (graphContainer) {
      graphContainer.innerHTML = `
        <div class="module-graph-loading" style="color: var(--color-error, #ef4444);">
          Error loading module graph: ${error.message}
        </div>
      `;
    }
  }
}

/**
 * Load structural events timeline
 */
async function loadModuleGraphTimeline() {
  const timelineContainer = document.getElementById('module-graph-timeline');
  if (!timelineContainer) return;

  try {
    timelineContainer.innerHTML = '<div class="module-graph-timeline-loading">Loading events...</div>';

    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const workspace = getCurrentWorkspace();
    const eventType = document.getElementById('module-graph-event-filter')?.value || '';
    
    let url = workspace 
      ? `${apiBase}/api/module-graph/events?workspace=${encodeURIComponent(workspace)}`
      : `${apiBase}/api/module-graph/events`;
    
    if (eventType) {
      url += `&event_type=${encodeURIComponent(eventType)}`;
    }

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success && data.events) {
      renderModuleGraphTimeline(data.events);
    } else {
      throw new Error(data.error || 'Failed to load events');
    }
  } catch (error) {
    console.error('[MODULE-GRAPH] Error loading timeline:', error);
    const timelineContainer = document.getElementById('module-graph-timeline');
    if (timelineContainer) {
      timelineContainer.innerHTML = `
        <div class="module-graph-timeline-loading" style="color: var(--color-error, #ef4444);">
          Error loading events: ${error.message}
        </div>
      `;
    }
  }
}

/**
 * Render timeline events
 */
function renderModuleGraphTimeline(events) {
  const timelineContainer = document.getElementById('module-graph-timeline');
  if (!timelineContainer) return;

  if (!events || events.length === 0) {
    timelineContainer.innerHTML = '<div class="module-graph-timeline-loading">No events found</div>';
    return;
  }

  // Sort events by timestamp (most recent first)
  const sortedEvents = [...events].sort((a, b) => b.timestamp - a.timestamp);

  const eventsHTML = sortedEvents.slice(0, 100).map(event => {
    const date = new Date(event.timestamp);
    const timeStr = date.toLocaleTimeString();
    const dateStr = date.toLocaleDateString();

    return `
      <div class="module-graph-event-item" onclick="selectModuleGraphEvent('${event.id}')">
        <span class="module-graph-event-time">${timeStr} ${dateStr}</span>
        <span class="module-graph-event-type">${event.event_type}</span>
        <span class="module-graph-event-file">${event.metadata?.file_path || event.file || 'Unknown'}</span>
      </div>
    `;
  }).join('');

  timelineContainer.innerHTML = eventsHTML;
}

/**
 * Apply filters and refresh graph
 */
window.applyModuleGraphFilters = function() {
  if (window.moduleGraphData && window.renderModuleGraph) {
    window.renderModuleGraph(window.moduleGraphData);
  }
};

/**
 * Change layout
 */
window.changeModuleGraphLayout = function() {
  const layout = document.getElementById('module-graph-layout')?.value;
  console.log('[MODULE-GRAPH] Layout changed to:', layout);
  // Layout change logic would go here
  // For now, just re-render with current layout
  if (window.moduleGraphData && window.renderModuleGraph) {
    window.renderModuleGraph(window.moduleGraphData);
  }
};

/**
 * Update time range
 */
window.updateModuleGraphTimeRange = function(value) {
  const display = document.getElementById('module-graph-time-display');
  if (display) {
    if (value >= 100) {
      display.textContent = 'All Time';
    } else {
      const days = Math.floor((100 - value) * 30 / 100);
      display.textContent = `Last ${days} days`;
    }
  }
  // Time range filtering would go here
  loadModuleGraphTimeline();
};

/**
 * Update timeline
 */
window.updateModuleGraphTimeline = function() {
  loadModuleGraphTimeline();
};

/**
 * Refresh graph
 */
window.refreshModuleGraph = async function() {
  const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
  const workspace = getCurrentWorkspace();
  
  try {
    // Clear cache
    await fetch(`${apiBase}/api/module-graph/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace })
    });

    // Reload data
    loadModuleGraphData();
    loadModuleGraphTimeline();
  } catch (error) {
    console.error('[MODULE-GRAPH] Error refreshing graph:', error);
  }
};

/**
 * Export graph
 */
window.exportModuleGraph = async function() {
  if (!window.moduleGraphData) {
    alert('No graph data to export');
    return;
  }

  const dataStr = JSON.stringify(window.moduleGraphData, null, 2);
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
window.closeModuleGraphDetails = function() {
  const detailsPanel = document.getElementById('module-graph-details-content');
  if (detailsPanel) {
    detailsPanel.innerHTML = `
      <div class="module-graph-details-placeholder">
        <p>Click a node or edge to view details</p>
      </div>
    `;
  }
  window.moduleGraphSelectedNode = null;
};

/**
 * Select event
 */
window.selectModuleGraphEvent = function(eventId) {
  // Find event in graph data
  if (window.moduleGraphData && window.moduleGraphData.events) {
    const event = window.moduleGraphData.events.find(e => e.id === eventId);
    if (event && window.moduleGraphData.nodes) {
      const node = window.moduleGraphData.nodes.find(n => n.id === event.file);
      if (node && window.selectModuleGraphNode) {
        window.selectModuleGraphNode(node);
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
window.renderModuleGraphView = renderModuleGraphView;

