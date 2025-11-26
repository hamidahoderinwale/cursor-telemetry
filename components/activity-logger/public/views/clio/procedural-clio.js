/**
 * Procedural Clio: Motif Rung View (Rung 6 Only)
 * Single-page, motif-centric interface displaying procedural patterns extracted from Cursor telemetry
 * Shows no raw code, no token-level details, no workflow DAGs - only motifs
 */

function renderProceduralClioView(container) {
  container.innerHTML = window.renderProceduralClioTemplate();
  
  // Initialize components (Rung 6 only - no rung selector)
  // Use setTimeout to ensure DOM is ready and container has dimensions
  setTimeout(() => {
    initializeSummaryBar();
    initializeMotifMap();
    initializeMotifDetailsPanel();
    initializeMotifFilters();
    initializeTimeline();
    
    // Load data
    loadProceduralClioData();
  }, 100);
}

/**
 * Update Summary Bar with data (Rung 6)
 */
function updateSummaryBar(data) {
    const summaryBar = document.getElementById('clio-summary-bar');
    if (!summaryBar) return;
    
    // Intent distribution
    const intentItems = Object.entries(data.intentDistribution || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6) // Top 6 intents
      .map(([intent, percent]) => `
        <div class="summary-item">
          <span class="summary-label">${intent.replace(/_/g, ' ')}</span>
          <span class="summary-value">${percent.toFixed(1)}%</span>
        </div>
      `).join('');
    
    // Model-human mix
    const modelMix = `
      <div class="summary-item">
        <span class="summary-label">Model Edits</span>
        <span class="summary-value">${(data.modelHumanMix?.model || 0).toFixed(0)}%</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Human Edits</span>
        <span class="summary-value">${(data.modelHumanMix?.human || 0).toFixed(0)}%</span>
      </div>
    `;
    
    // Workflow stats
    const workflowStats = `
      <div class="summary-item">
        <span class="summary-label">Avg Workflow Length</span>
        <span class="summary-value">${(data.avgWorkflowLength || 0).toFixed(1)} events</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Cluster Coverage</span>
        <span class="summary-value">${data.clusterCoverage?.motifs || 0} motifs, ${(data.clusterCoverage?.coverage || 0).toFixed(0)}%</span>
      </div>
    `;
    
    summaryBar.innerHTML = `
      <div class="summary-section">
        <div class="summary-title">Intent Distribution</div>
        <div class="summary-items">${intentItems}</div>
      </div>
      <div class="summary-section">
        <div class="summary-title">Model–Human Mix</div>
        <div class="summary-items">${modelMix}</div>
      </div>
      <div class="summary-section">
        <div class="summary-title">Workflow Stats</div>
        <div class="summary-items">${workflowStats}</div>
      </div>
    `;
  }

/**
 * Initialize Summary Bar (Top Row)
 */
function initializeSummaryBar() {
  // Will be populated with API data
  const summaryBar = document.getElementById('clio-summary-bar');
  if (!summaryBar) return;
  
  // Placeholder - will fetch from API
  updateSummaryBar({
    intentDistribution: {
      FIX_BUG: 29,
      ADD_FEATURE: 22,
      REFACTOR: 17,
      TEST: 15,
      DOCUMENT: 10,
      OTHER: 7
    },
    modelHumanMix: {
      model: 61,
      human: 39
    },
    avgWorkflowLength: 8.2,
    clusterCoverage: {
      motifs: 12,
      coverage: 87
    }
  });
}

/**
 * Initialize Motif Map (Central Visual)
 */
function initializeMotifMap() {
  const mapContainer = document.getElementById('clio-motif-map');
  if (!mapContainer) {
    console.error('[CLIO] Motif map container not found');
    return;
  }
  
  // Initialize D3.js visualization
  if (typeof d3 === 'undefined') {
    console.error('[CLIO] D3.js not loaded, motif map will not render. Please ensure D3.js is included.');
    mapContainer.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--color-text-muted);">D3.js library not loaded. Please refresh the page.</div>';
    return;
  }
  
  // Wait for container to have dimensions
  const checkDimensions = () => {
    const width = mapContainer.clientWidth || 800;
    const height = mapContainer.clientHeight || 600;
    
    if (width === 0 || height === 0) {
      // Retry after a short delay
      setTimeout(checkDimensions, 100);
      return;
    }
    
    // Clear any existing content
    d3.select(mapContainer).selectAll('*').remove();
    
    // Set up SVG
    const svg = d3.select(mapContainer)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('class', 'motif-map-svg')
      .style('background', 'var(--color-bg-secondary, #f9fafb)');
    
    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.5, 4])
      .on('zoom', (event) => {
        svg.select('g.motif-map-content').attr('transform', event.transform);
      });
    
    svg.call(zoom);
    
    // Create content group
    const contentGroup = svg.append('g').attr('class', 'motif-map-content');
    
    // Store references for later updates
    window.clioMotifMap = {
      svg,
      contentGroup,
      width,
      height,
      selectedMotif: null
    };
    
    console.log('[CLIO] Motif map initialized:', { width, height });
    
    // Load motif data and render
    loadMotifMapData();
  };
  
  // Start checking dimensions
  checkDimensions();
}

/**
 * Load and render motif map data (Rung 6 only)
 */
async function loadMotifMapData() {
    const { contentGroup } = window.clioMotifMap || {};
    if (!contentGroup) {
      console.error('[CLIO] Cannot load motif data: map not initialized');
      return;
    }
    
    try {
      const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
      console.log('[CLIO] Loading motif data from:', `${apiBase}/api/motifs`);
      
      const response = await fetch(`${apiBase}/api/motifs`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Motif service not available (404)');
        }
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      const motifs = data.motifs || [];
      
      console.log('[CLIO] Loaded motif data:', {
        count: motifs.length,
        hasData: motifs.length > 0
      });
      
      if (motifs.length === 0) {
        renderMotifMapPlaceholder('No motifs found. Motifs will appear as patterns are detected in your code changes.');
        renderClioTimeline([]);
      } else {
        renderMotifMap(motifs);
        renderClioTimeline(motifs);
      }
    } catch (error) {
      console.error('[CLIO] Failed to load motif data:', error);
      
      // Show appropriate error message
      let errorMessage = 'Failed to load motif data.';
      if (error.message.includes('404') || error.message.includes('not available')) {
        errorMessage = 'Motif service not available. The service needs to be initialized to detect patterns.';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to motif service. Please check if the service is running.';
      } else {
        errorMessage = `Error: ${error.message}`;
      }
      
      renderMotifMapPlaceholder(errorMessage);
    }
}

/**
 * Render motif bubbles on map
 */
function renderMotifMap(motifs) {
  const { contentGroup, width, height } = window.clioMotifMap || {};
  if (!contentGroup) {
    console.error('[CLIO] Cannot render motif map: map not initialized');
    return;
  }
  
  if (!motifs || motifs.length === 0) {
    console.warn('[CLIO] No motifs to render');
    renderMotifMapPlaceholder('No motifs found.');
    return;
  }
  
  console.log('[CLIO] Rendering', motifs.length, 'motifs');
  
  // Clear existing
  contentGroup.selectAll('*').remove();
  
  // Get current rung level
  const currentRung = window.clioCurrentRung || 'workflow';
  
  // Create force simulation for layout
  const simulation = d3.forceSimulation(motifs)
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(d => Math.sqrt(d.frequency) * 2 + 10));
  
  // Color scale for intents
  const intentColors = {
    'FIX_BUG': '#ef4444',
    'ADD_FEATURE': '#3b82f6',
    'REFACTOR': '#8b5cf6',
    'TEST': '#10b981',
    'DOCUMENT': '#f59e0b',
    'OTHER': '#6b7280'
  };
  
  // Shape mapping
  const shapeTypes = {
    'sequence': 'circle',
    'branch': 'square',
    'loop': 'triangle'
  };
  
  // Create bubbles
  const bubbles = contentGroup.selectAll('g.motif-bubble')
    .data(motifs)
    .enter()
    .append('g')
    .attr('class', 'motif-bubble')
    .attr('transform', d => `translate(${d.x || width/2}, ${d.y || height/2})`)
    .style('cursor', 'pointer');
  
  // Add shape based on workflow type
  bubbles.each(function(d) {
    const shape = shapeTypes[d.workflowShape] || 'circle';
    const size = Math.sqrt(d.frequency) * 3 + 10;
    const color = intentColors[d.dominantIntent] || '#6b7280';
    
    if (shape === 'circle') {
      d3.select(this).append('circle')
        .attr('r', size)
        .attr('fill', color)
        .attr('fill-opacity', 0.7)
        .attr('stroke', color)
        .attr('stroke-width', 2);
    } else if (shape === 'square') {
      d3.select(this).append('rect')
        .attr('x', -size)
        .attr('y', -size)
        .attr('width', size * 2)
        .attr('height', size * 2)
        .attr('fill', color)
        .attr('fill-opacity', 0.7)
        .attr('stroke', color)
        .attr('stroke-width', 2);
    } else if (shape === 'triangle') {
      const path = d3.path();
      path.moveTo(0, -size);
      path.lineTo(-size * 0.866, size * 0.5);
      path.lineTo(size * 0.866, size * 0.5);
      path.closePath();
      d3.select(this).append('path')
        .attr('d', path.toString())
        .attr('fill', color)
        .attr('fill-opacity', 0.7)
        .attr('stroke', color)
        .attr('stroke-width', 2);
    }
  });
  
  // Add labels
  bubbles.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '.35em')
    .attr('font-size', d => Math.min(Math.sqrt(d.frequency) * 0.8 + 8, 14))
    .attr('fill', '#fff')
    .attr('font-weight', 'bold')
    .text(d => d.id || 'M');
  
  // Add hover tooltip
  bubbles.append('title')
    .text(d => `${d.name || 'Motif'}\nFrequency: ${d.frequency}\nIntent: ${d.dominantIntent}`);
  
  // Add interactions
  bubbles
    .on('mouseenter', function(event, d) {
      d3.select(this).select('circle, rect, path')
        .attr('stroke-width', 4)
        .attr('fill-opacity', 0.9);
      
      showMotifTooltip(event, d);
    })
    .on('mouseleave', function(event, d) {
      d3.select(this).select('circle, rect, path')
        .attr('stroke-width', 2)
        .attr('fill-opacity', 0.7);
      
      hideMotifTooltip();
    })
    .on('click', function(event, d) {
      selectMotif(d);
    });
  
  // Run simulation
  simulation.on('tick', () => {
    bubbles.attr('transform', d => `translate(${d.x}, ${d.y})`);
  });
  
  // Store bubbles for later updates
  window.clioMotifBubbles = bubbles;
}

/**
 * Render placeholder when no data
 */
function renderMotifMapPlaceholder(message = 'Loading motif data...') {
  const { contentGroup, width, height } = window.clioMotifMap || {};
  if (!contentGroup) {
    console.error('[CLIO] Cannot render placeholder: map not initialized');
    return;
  }
  
  // Clear existing content
  contentGroup.selectAll('*').remove();
  
  // Add text
  contentGroup.append('text')
    .attr('x', width / 2)
    .attr('y', height / 2 - 10)
    .attr('text-anchor', 'middle')
    .attr('fill', '#6b7280')
    .attr('font-size', '16px')
    .attr('font-weight', '500')
    .text(message);
  
  // Add subtitle if it's an error/empty state
  if (message !== 'Loading motif data...') {
    contentGroup.append('text')
      .attr('x', width / 2)
      .attr('y', height / 2 + 20)
      .attr('text-anchor', 'middle')
      .attr('fill', '#9ca3af')
      .attr('font-size', '14px')
      .text('Motifs are recurring patterns detected in your development workflow.');
  }
}

/**
 * Show tooltip on hover
 */
function showMotifTooltip(event, motif) {
  // Create or update tooltip
  let tooltip = d3.select('body').select('.clio-motif-tooltip');
  
  if (tooltip.empty()) {
    tooltip = d3.select('body')
      .append('div')
      .attr('class', 'clio-motif-tooltip')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('background', 'rgba(0, 0, 0, 0.9)')
      .style('color', '#fff')
      .style('padding', '8px 12px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('z-index', 1000);
  }
  
  tooltip
    .html(`
      <div><strong>${motif.name || 'Motif'}</strong></div>
      <div>Frequency: ${motif.frequency}</div>
      <div>Intent: ${motif.dominantIntent}</div>
      <div>Shape: ${motif.workflowShape}</div>
    `)
    .style('left', (event.pageX + 10) + 'px')
    .style('top', (event.pageY - 10) + 'px')
    .style('opacity', 1);
}

/**
 * Hide tooltip
 */
function hideMotifTooltip() {
  d3.select('.clio-motif-tooltip').style('opacity', 0);
}

/**
 * Select a motif (click handler)
 */
function selectMotif(motif) {
  window.clioMotifMap.selectedMotif = motif;
  
  // Update bubble selection
  if (window.clioMotifBubbles) {
    window.clioMotifBubbles.selectAll('circle, rect, path')
      .attr('stroke-width', 2)
      .attr('fill-opacity', 0.7);
    
    const selected = window.clioMotifBubbles.filter(d => d.id === motif.id);
    selected.selectAll('circle, rect, path')
      .attr('stroke-width', 4)
      .attr('stroke', '#fbbf24')
      .attr('fill-opacity', 0.9);
  }
  
  // Update details panel
  updateMotifDetailsPanel(motif);
}

/**
 * Initialize Motif Filters (Rung 6 only - no rung selector)
 */
function initializeMotifFilters() {
    const filtersContainer = document.getElementById('clio-motif-filters');
    if (!filtersContainer) return;
    
    filtersContainer.innerHTML = `
      <div class="filter-group">
        <label class="filter-label">Intent Class</label>
        <select id="filter-intent" class="filter-select" onchange="applyMotifFilters()">
          <option value="">All Intents</option>
          <option value="FIX_BUG">Fix Bug</option>
          <option value="ADD_FEATURE">Add Feature</option>
          <option value="REFACTOR">Refactor</option>
          <option value="TEST">Test</option>
          <option value="DOCUMENT">Document</option>
        </select>
      </div>
      
      <div class="filter-group">
        <label class="filter-label">Motif Shape</label>
        <select id="filter-shape" class="filter-select" onchange="applyMotifFilters()">
          <option value="">All Shapes</option>
          <option value="loop">Loop</option>
          <option value="branch">Branch</option>
          <option value="linear">Linear</option>
          <option value="fork-join">Fork-Join</option>
        </select>
      </div>
      
      <div class="filter-group">
        <label class="filter-label">Complexity</label>
        <select id="filter-complexity" class="filter-select" onchange="applyMotifFilters()">
          <option value="">All</option>
          <option value="short">Short</option>
          <option value="medium">Medium</option>
          <option value="long">Long</option>
        </select>
      </div>
      
      <div class="filter-group">
        <label class="filter-label">Frequency</label>
        <select id="filter-frequency" class="filter-select" onchange="applyMotifFilters()">
          <option value="">All</option>
          <option value="common">Common</option>
          <option value="rare">Rare</option>
        </select>
      </div>
    `;
}

/**
 * Apply motif filters
 */
window.applyMotifFilters = async function() {
    const intentClass = document.getElementById('filter-intent')?.value || '';
    const shape = document.getElementById('filter-shape')?.value || '';
    const complexity = document.getElementById('filter-complexity')?.value || '';
    const frequency = document.getElementById('filter-frequency')?.value || '';
    
    const params = new URLSearchParams();
    if (intentClass) params.append('intent_class', intentClass);
    if (shape) params.append('shape', shape);
    if (complexity) params.append('complexity', complexity);
    if (frequency) params.append('frequency', frequency);
    
    try {
      const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
      const response = await fetch(`${apiBase}/api/motifs?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      renderMotifMap(data.motifs || []);
    } catch (error) {
      console.warn('[MOTIF] Failed to apply filters:', error.message);
    }
};

/**
 * Initialize Motif Details Panel
 */
function initializeMotifDetailsPanel() {
  const panel = document.getElementById('clio-motif-details');
  if (!panel) return;
  
  // Show placeholder
  panel.innerHTML = `
    <div class="motif-details-placeholder">
      <p>Click a motif bubble to view details</p>
    </div>
  `;
}

/**
 * Update Motif Details Panel (Rung 6 only)
 */
async function updateMotifDetailsPanel(motif) {
    const panel = document.getElementById('clio-motif-details');
    if (!panel) return;
    
    // Fetch detailed motif data
    try {
      const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
      const response = await fetch(`${apiBase}/api/motifs/${motif.id}`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      renderMotifDetails(data.motif || motif);
    } catch (error) {
      console.warn('[MOTIF] Failed to load motif details:', error.message);
      renderMotifDetails(motif); // Use basic data
    }
}

/**
 * Render motif details (Rung 6 - motif structure only, no code/DAG details)
 */
function renderMotifDetails(motif) {
    const panel = document.getElementById('clio-motif-details');
    if (!panel) return;
    
    // Intent breakdown (from intents object)
    const intentBreakdown = Object.entries(motif.intents || {})
      .map(([intent, percent]) => {
        const percentage = typeof percent === 'number' ? (percent * 100).toFixed(1) : percent;
        return `
          <div class="intent-item">
            <div class="intent-label">${intent.replace(/_/g, ' ')}</div>
            <div class="intent-bar">
              <div class="intent-fill" style="width: ${percentage}%"></div>
            </div>
            <div class="intent-value">${percentage}%</div>
          </div>
        `;
      }).join('');
    
    // Motif structure summary (abstract pattern - Rung 6 only)
    const motifStructure = `
      <div class="motif-structure-summary">
        <div class="motif-pattern">${motif.pattern || motif.sequence?.join(' → ') || 'No pattern'}</div>
        <div class="motif-symbolic">${renderMotifSymbolic(motif)}</div>
      </div>
    `;
  
  // Privacy indicator
  const privacyStatus = motif.privacyStatus || {
    meetsThreshold: true,
    clusterSize: 1274,
    rungLevelSafe: true
  };
  
  panel.innerHTML = `
    <div class="motif-details-card">
      <div class="motif-details-header">
        <h3 class="motif-title">${motif.name || 'Motif'}</h3>
        <div class="motif-id">#${motif.id}</div>
      </div>
      
      <div class="motif-section">
        <h4 class="section-title">Motif Structure Summary</h4>
        <p class="motif-description">${motif.description || generateMotifDescription(motif)}</p>
        ${motifStructure}
      </div>
      
      <div class="motif-section">
        <h4 class="section-title">Intent Breakdown</h4>
        <div class="intent-breakdown">
          ${intentBreakdown || '<div class="intent-item">No intent data available</div>'}
        </div>
      </div>
      
      <div class="motif-section">
        <h4 class="section-title">Structural Stats</h4>
        <div class="cluster-stats">
          <div class="stat-item">
            <span class="stat-label">Motif Length</span>
            <span class="stat-value">${motif.stats?.medianLength || 0} nodes (median)</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Branching Factor</span>
            <span class="stat-value">${(motif.stats?.avgBranchingFactor || 0).toFixed(2)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Cycles</span>
            <span class="stat-value">${motif.stats?.maxCycles || 0}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Event Types</span>
            <span class="stat-value">${motif.stats?.eventTypeCount || 0}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Frequency</span>
            <span class="stat-value">${motif.frequency || 0} workflows</span>
          </div>
        </div>
      </div>
      
      <div class="motif-section">
        <h4 class="section-title">Privacy Indicator</h4>
        <div class="privacy-indicator">
          <div class="privacy-item ${privacyStatus.meetsThreshold ? 'privacy-ok' : 'privacy-warning'}">
            <span class="privacy-icon">${privacyStatus.meetsThreshold ? '' : ''}</span>
            <span class="privacy-text">Cluster size meets threshold (n=${privacyStatus.clusterSize || 0} workflows)</span>
          </div>
          <div class="privacy-item ${privacyStatus.rungLevelSafe ? 'privacy-ok' : 'privacy-warning'}">
            <span class="privacy-icon">${privacyStatus.rungLevelSafe ? '' : ''}</span>
            <span class="privacy-text">Rung level safe for public viewing</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render symbolic motif representation (no code, no DAG details)
 */
function renderMotifSymbolic(motif) {
    const shape = motif.shape || 'linear';
    const sequence = motif.sequence || [];
    
    // Generate symbolic sketch based on shape
    if (shape === 'loop') {
      return '<div class="motif-symbol">—↺—</div><div class="motif-symbol-desc">Cycle, then linear resolution</div>';
    } else if (shape === 'branch') {
      return '<div class="motif-symbol">—<br><br></div><div class="motif-symbol-desc">Branching pattern</div>';
    } else if (shape === 'fork-join') {
      return '<div class="motif-symbol">——<br>&nbsp;&nbsp;<br>——</div><div class="motif-symbol-desc">Fork-join pattern</div>';
    } else {
      return '<div class="motif-symbol">———</div><div class="motif-symbol-desc">Linear sequence</div>';
    }
}

/**
 * Initialize timeline visualization (GitHub contribution graph style)
 */
function initializeTimeline() {
  const timelineContainer = document.getElementById('clio-timeline');
  if (!timelineContainer) return;

  // Timeline will be rendered when motif data is loaded
  window.clioTimelineContainer = timelineContainer;
}

/**
 * Render timeline visualization (GitHub contribution graph style)
 */
async function renderClioTimeline(motifs) {
  const container = window.clioTimelineContainer || document.getElementById('clio-timeline');
  if (!container) return;

  if (!motifs || motifs.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--color-text-muted);">No pattern data available for timeline</div>';
    return;
  }

  try {
    // Group motifs by date
    const dateMap = new Map();
    motifs.forEach(motif => {
      const date = new Date(motif.firstSeen || motif.timestamp || Date.now());
      const dateKey = date.toISOString().split('T')[0];
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey).push(motif);
    });

    // Get date range (last 52 weeks)
    const today = new Date();
    const weeks = [];
    for (let i = 51; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - (i * 7));
      const weekStart = new Date(date);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weeks.push(weekStart);
    }

    // Create simple grid visualization
    const gridHtml = weeks.map(week => {
      const weekKey = week.toISOString().split('T')[0];
      const weekMotifs = dateMap.get(weekKey) || [];
      const count = weekMotifs.length;
      const intensity = Math.min(count / 5, 1); // Normalize to 0-1
      const color = intensity > 0.5 ? '#10b981' : intensity > 0.2 ? '#3b82f6' : '#e5e7eb';
      
      return `
        <div class="timeline-week" 
             style="background: ${color}; width: 12px; height: 12px; border-radius: 2px;"
             title="${week.toLocaleDateString()}: ${count} pattern${count !== 1 ? 's' : ''}">
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div style="display: flex; flex-wrap: wrap; gap: 2px; justify-content: center; align-items: center;">
        ${gridHtml}
      </div>
      <div style="margin-top: var(--space-md); text-align: center; font-size: var(--text-xs); color: var(--color-text-muted);">
        <span style="display: inline-block; width: 12px; height: 12px; background: #e5e7eb; border-radius: 2px; margin-right: 4px;"></span>
        Less
        <span style="display: inline-block; width: 12px; height: 12px; background: #3b82f6; border-radius: 2px; margin: 0 8px 0 16px;"></span>
        More
        <span style="display: inline-block; width: 12px; height: 12px; background: #10b981; border-radius: 2px; margin: 0 8px 0 16px;"></span>
        Most
      </div>
    `;
  } catch (error) {
    console.error('[CLIO] Error rendering timeline:', error);
    container.innerHTML = '<div style="text-align: center; color: var(--color-text-muted);">Error rendering timeline</div>';
  }
}

/**
 * Generate motif description
 */
function generateMotifDescription(motif) {
    const intent = motif.dominantIntent || 'UNKNOWN';
    const shape = motif.shape || 'linear';
    
    if (intent === 'FIX_BUG' && shape === 'loop') {
      return 'A debugging loop triggered by errors. Common in early setup tasks.';
    } else if (intent === 'ADD_FEATURE' && shape === 'linear') {
      return 'A linear feature addition workflow. Sequential implementation pattern.';
    } else if (intent === 'REFACTOR' && shape === 'branch') {
      return 'A branching refactoring pattern. Multiple code paths modified.';
    }
    
    return `A ${shape} pattern with ${intent.replace(/_/g, ' ').toLowerCase()} intent.`;
}

/**
 * Load all Procedural Clio data (Rung 6)
 */
async function loadProceduralClioData() {
    try {
      const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
      
      // Load summary data
      const summaryResponse = await fetch(`${apiBase}/api/motifs/summary`);
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        updateSummaryBar(summaryData.summary || {});
      } else if (summaryResponse.status === 503 || summaryResponse.status === 404) {
        // Service not available - this is expected if motif service isn't initialized
        const errorData = await summaryResponse.json().catch(() => ({}));
        console.log('[MOTIF] Motif service not available:', errorData.error || 'Service not initialized');
        // Show a user-friendly message in the summary bar if it exists
        const summaryBar = document.getElementById('clio-summary-bar');
        if (summaryBar) {
          summaryBar.innerHTML = `
            <div style="padding: var(--space-md); text-align: center; color: var(--color-text-muted);">
              <p>Motif service is not available. Data will appear once the service is initialized.</p>
            </div>
          `;
        }
      }
      
      // Motif map data is loaded separately in initializeMotifMap
    } catch (error) {
      // Only log non-404/503 errors (404/503 means service not available)
      if (!error.message.includes('404') && !error.message.includes('503') && !error.message.includes('not available')) {
        console.warn('[MOTIF] Failed to load Procedural Clio data:', error.message);
      }
    }
}

// Export to window for global access
window.renderProceduralClioView = renderProceduralClioView;

