/**
 * Pattern Discovery & Behavioral Library View
 * Interactive pattern explorer
 */

async function renderPatternsView(container) {
  container.innerHTML = `
    <div class="patterns-view">
      <!-- Header -->
      <div class="view-header">
        <div>
          <h1 class="view-title">Pattern Discovery</h1>
          <p class="view-subtitle">Discover recurring patterns in your workflow</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-secondary btn-sm" onclick="refreshPatterns()">
            Refresh Patterns
          </button>
          <button class="btn btn-primary btn-sm" onclick="discoverNewPatterns()">
            Discover New
          </button>
        </div>
      </div>

      <!-- Pattern Stats -->
      <div class="pattern-stats">
        <div class="metric-card card">
          <div class="metric-label">Total Patterns</div>
          <div class="metric-value" id="pattern-total">-</div>
        </div>
        <div class="metric-card card">
          <div class="metric-label">Pattern Categories</div>
          <div class="metric-value" id="pattern-categories">-</div>
        </div>
        <div class="metric-card card">
          <div class="metric-label">Workspaces</div>
          <div class="metric-value" id="pattern-workspaces">-</div>
        </div>
        <div class="metric-card card">
          <div class="metric-label">High Fidelity</div>
          <div class="metric-value" id="pattern-high-fidelity">-</div>
        </div>
      </div>

      <!-- Pattern Filters -->
      <div class="card">
        <div class="pattern-filters">
          <input type="text" id="pattern-search" class="input" placeholder="Search patterns..." oninput="filterPatterns()">
          <select id="pattern-category-filter" class="input" onchange="filterPatterns()">
            <option value="">All Categories</option>
          </select>
          <select id="pattern-sort" class="input" onchange="sortPatterns()">
            <option value="frequency">Sort by Frequency</option>
            <option value="recent">Sort by Recent</option>
            <option value="cp">Sort by CP Score</option>
          </select>
        </div>
      </div>

      <!-- Pattern Gallery -->
      <div class="pattern-gallery" id="pattern-gallery">
        <div class="pattern-card-skeleton">
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        </div>
      </div>
    </div>
  `;

  await loadPatterns();
}

async function loadPatterns() {
  try {
    // Try to load from API
    const response = await window.APIClient.get('/api/patterns');
    const data = await response.json();
    renderPatterns(data);
  } catch (error) {
    console.warn('Patterns API not available, using local data:', error);
    // Fallback: use local data or show empty state
    renderPatternsFromLocal();
  }
}

function renderPatterns(data) {
  const patterns = data.patterns || data.behavioral_library || [];
  const taxonomy = data.taxonomy || {};
  
  // Update stats
  document.getElementById('pattern-total').textContent = patterns.length;
  document.getElementById('pattern-categories').textContent = Object.keys(taxonomy).length;
  
  const workspaces = new Set();
  patterns.forEach(p => {
    if (p.workspaces) {
      p.workspaces.forEach(w => workspaces.add(w));
    }
  });
  document.getElementById('pattern-workspaces').textContent = workspaces.size;
  
  const highFidelity = patterns.filter(p => p.avgContextPrecision && p.avgContextPrecision > 0.7).length;
  document.getElementById('pattern-high-fidelity').textContent = highFidelity;
  
  // Populate category filter
  const categorySelect = document.getElementById('pattern-category-filter');
  Object.keys(taxonomy).forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    categorySelect.appendChild(option);
  });
  
  // Store patterns globally for filtering
  window.allPatterns = patterns;
  window.patternTaxonomy = taxonomy;
  
  renderPatternGallery(patterns);
}

function renderPatternsFromLocal() {
  // Create sample patterns from local data
  const state = window.state || {};
  const events = state.data?.events || [];
  const prompts = state.data?.prompts || [];
  
  // Simple pattern detection: group by similar event types
  const patternMap = new Map();
  
  events.forEach(event => {
    const type = event.type || 'unknown';
    if (!patternMap.has(type)) {
      patternMap.set(type, {
        id: type,
        name: type,
        frequency: 0,
        workspaces: new Set(),
        events: []
      });
    }
    const pattern = patternMap.get(type);
    pattern.frequency++;
    if (event.workspace_path) {
      pattern.workspaces.add(event.workspace_path);
    }
    pattern.events.push(event);
  });
  
  const patterns = Array.from(patternMap.values()).map(p => ({
    ...p,
    workspaces: Array.from(p.workspaces),
    category: categorizePattern(p.name)
  }));
  
  renderPatterns({ patterns, taxonomy: {} });
}

function categorizePattern(name) {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('auth') || nameLower.includes('login')) return 'authentication';
  if (nameLower.includes('refactor')) return 'refactoring';
  if (nameLower.includes('bug') || nameLower.includes('fix')) return 'bug-fix';
  if (nameLower.includes('test')) return 'testing';
  if (nameLower.includes('api') || nameLower.includes('endpoint')) return 'api';
  return 'other';
}

function renderPatternGallery(patterns) {
  const container = document.getElementById('pattern-gallery');
  
  if (patterns.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-title">No patterns found</div>
        <div class="empty-state-message">Start discovering patterns by clicking "Discover New"</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = patterns.map(pattern => `
    <div class="pattern-card card" onclick="showPatternDetails('${pattern.cluster_id || pattern.id}')">
      <div class="pattern-card-header">
        <div class="pattern-badge">${pattern.category || 'Pattern'}</div>
        <div class="pattern-frequency">${pattern.frequency || pattern.sequence_indices?.length || 0} occurrences</div>
      </div>
      <div class="pattern-card-body">
        <h3 class="pattern-name">${pattern.name || pattern.intent || 'Unnamed Pattern'}</h3>
        <p class="pattern-description">${getPatternDescription(pattern)}</p>
        <div class="pattern-meta">
          <span class="pattern-meta-item">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
            </svg>
            ${pattern.workspaces?.length || 0} workspaces
          </span>
          ${pattern.avgContextPrecision ? `
            <span class="pattern-meta-item">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
              </svg>
              CP: ${pattern.avgContextPrecision.toFixed(2)}
            </span>
          ` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function getPatternDescription(pattern) {
  if (pattern.metadata?.event_types) {
    return pattern.metadata.event_types.slice(0, 3).join(' → ');
  }
  if (pattern.intent) {
    return `Pattern related to ${pattern.intent}`;
  }
  return 'Recurring workflow pattern';
}

function filterPatterns() {
  const search = document.getElementById('pattern-search').value.toLowerCase();
  const category = document.getElementById('pattern-category-filter').value;
  const patterns = window.allPatterns || [];
  
  const filtered = patterns.filter(pattern => {
    const matchesSearch = !search || 
      (pattern.name || '').toLowerCase().includes(search) ||
      (pattern.intent || '').toLowerCase().includes(search) ||
      (pattern.category || '').toLowerCase().includes(search);
    
    const matchesCategory = !category || pattern.category === category;
    
    return matchesSearch && matchesCategory;
  });
  
  renderPatternGallery(filtered);
}

function sortPatterns() {
  const sortBy = document.getElementById('pattern-sort').value;
  const patterns = [...(window.allPatterns || [])];
  
  patterns.sort((a, b) => {
    switch (sortBy) {
      case 'frequency':
        return (b.frequency || 0) - (a.frequency || 0);
      case 'cp':
        return (b.avgContextPrecision || 0) - (a.avgContextPrecision || 0);
      case 'recent':
        return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
      default:
        return 0;
    }
  });
  
  renderPatternGallery(patterns);
}

function showPatternDetails(patternId) {
  // Navigate to pattern detail view or show modal
  console.log('Show pattern details:', patternId);
  // TODO: Implement pattern detail view
}

async function refreshPatterns() {
  await loadPatterns();
}

async function discoverNewPatterns() {
  try {
    const response = await window.APIClient.post('/api/patterns/discover');
    const data = await response.json();
    await loadPatterns();
  } catch (error) {
    console.error('Failed to discover patterns:', error);
    alert('Pattern discovery failed. Check console for details.');
  }
}

// Export for view router
if (typeof window !== 'undefined') {
  window.renderPatternsView = renderPatternsView;
}

