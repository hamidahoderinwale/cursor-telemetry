/**
 * Search Handler Module
 * Handles search palette, search engine initialization, and result navigation
 */

// Wrap in IIFE to avoid global scope conflicts
(function() {
'use strict';

// Search state
let searchEngine = null;
let searchSelectedIndex = -1;
let searchResults = [];

/**
 * Initialize the semantic search engine with current data
 */
async function initializeSearch() {
  if (!window.SearchEngine) {
    console.warn('[SEARCH] SearchEngine class not available');
    return false;
  }
  
  if (!window.state || !window.state.data) {
    console.warn('[SEARCH] State data not available yet, will retry...');
    // Retry after a short delay
    setTimeout(() => initializeSearch(), 1000);
    return false;
  }
  
  // Load HF preference before initializing
  if (window.loadHuggingFacePreference) {
    loadHuggingFacePreference();
  }
  
  try {
    console.log('[SEARCH] Initializing search engine...');
    searchEngine = new window.SearchEngine();
    
    // Get current data from state
    const events = window.state.data.events || [];
    const prompts = window.state.data.prompts || [];
    const conversations = window.state.data.conversations || [];
    const terminalCommands = window.state.data.terminalCommands || [];
    
    // Prepare data for search engine
    const searchData = {
      events,
      prompts,
      conversations,
      terminalCommands,
      workspaces: window.state.data.workspaces || []
    };
    
    const totalItems = events.length + prompts.length + conversations.length + terminalCommands.length;
    
    if (totalItems === 0) {
      console.log('[SEARCH] No data available yet, search will be available once data loads');
      // Set a flag so we can retry later
      searchEngine = null;
      return false;
    }
    
    // Initialize search engine with timeout protection
    try {
      // Use Promise.race to timeout after 30 seconds
      const initPromise = searchEngine.initialize(searchData);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Search initialization timeout')), 30000)
      );
      
      await Promise.race([initPromise, timeoutPromise]);
      console.log(`[SUCCESS] Search engine initialized with ${totalItems} items (${events.length} events, ${prompts.length} prompts, ${conversations.length} conversations, ${terminalCommands.length} terminal commands)`);
    } catch (timeoutError) {
      console.warn('[SEARCH] Search initialization timed out or failed, using fallback search:', timeoutError.message);
      // Continue without full search - basic search will still work
      searchEngine = null;
      return false;
    }
    
    // Update semantic status after initialization
    setTimeout(() => {
      updateSemanticStatus();
      // Also update the toggle status
      if (searchEngine && searchEngine.useHuggingFace && searchEngine.hfSemanticSearch?.isInitialized) {
        const statusEl = document.getElementById('hfSearchStatus');
        if (statusEl) {
          statusEl.textContent = 'Enabled';
          statusEl.className = 'hf-status-indicator enabled';
        }
        const toggle = document.getElementById('hfSemanticSearchToggle');
        if (toggle) {
          toggle.checked = true;
        }
      }
    }, 3000); // Wait a bit for HF to initialize
    
    return true;
  } catch (error) {
    console.error('[ERROR] Failed to initialize search engine:', error);
    searchEngine = null;
    return false;
  }
}

/**
 * Re-initialize search engine with updated data (called after data refresh)
 */
async function reinitializeSearch() {
  // Only reinitialize if we have significantly more data or search is not initialized
  if (searchEngine && searchEngine.initialized) {
    const currentEvents = window.state?.data?.events?.length || 0;
    const currentPrompts = window.state?.data?.prompts?.length || 0;
    
    // Get previous counts from search engine if available
    const previousCount = searchEngine.documents?.length || 0;
    const currentCount = currentEvents + currentPrompts;
    
    // Only reinitialize if we have 20% more data
    if (currentCount < previousCount * 1.2) {
      return; // Not enough new data to warrant reindexing
    }
  }
  
  console.log('[SEARCH] Re-initializing search engine with updated data...');
  await initializeSearch();
}

/**
 * Open the search palette
 */
function openSearchPalette() {
  const palette = document.getElementById('searchPalette');
  if (palette) {
    palette.classList.add('active');
    const input = document.getElementById('searchInput');
    if (input) {
      input.focus();
      input.select();
    }
    searchSelectedIndex = -1;
    searchResults = [];
    
    // Show example queries if search is empty and HF is available
    updateSearchExamples();
    updateSemanticStatus();
    updateRecentSearches();
    updateClearButton();
    
    // Add input listener for clear button
    const input = document.getElementById('searchInput');
    if (input) {
      input.addEventListener('input', updateClearButton);
    }
  }
}

/**
 * Set search query from example
 */
function setSearchQuery(query) {
  const input = document.getElementById('searchInput');
  if (input) {
    input.value = query;
    input.focus();
    performSearch(query);
  }
}

/**
 * Update search examples visibility
 */
function updateSearchExamples() {
  const input = document.getElementById('searchInput');
  const examples = document.getElementById('searchExamples');
  const recentSearches = document.getElementById('recentSearches');
  if (examples && input) {
    const hasQuery = input.value.trim().length > 0;
    if (hasQuery) {
      examples.style.display = 'none';
      if (recentSearches) recentSearches.style.display = 'none';
    } else {
      examples.style.display = 'block';
      updateRecentSearches(); // Show recent searches when empty
    }
  }
}

/**
 * Update semantic search status indicator
 */
function updateSemanticStatus() {
  const statusEl = document.getElementById('searchSemanticStatus');
  if (!statusEl) return;
  
  // Check if Hugging Face search is available
  if (searchEngine && searchEngine.useHuggingFace && searchEngine.hfSemanticSearch && searchEngine.hfSemanticSearch.isInitialized) {
    statusEl.style.display = 'flex';
    statusEl.title = 'Hugging Face semantic search enabled - Ask natural language questions!';
  } else {
    statusEl.style.display = 'none';
  }
}

/**
 * Close the search palette
 */
function closeSearchPalette() {
  const palette = document.getElementById('searchPalette');
  if (palette) {
    palette.classList.remove('active');
  }
  searchSelectedIndex = -1;
  searchResults = [];
  window.currentSearchQuery = '';
  
  // Hide loading state
  const loading = document.getElementById('searchLoading');
  if (loading) loading.style.display = 'none';
}

/**
 * Clear search input
 */
function clearSearchInput() {
  const input = document.getElementById('searchInput');
  if (input) {
    input.value = '';
    input.focus();
    updateClearButton();
    performSearch('');
  }
}

/**
 * Update clear button visibility
 */
function updateClearButton() {
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearSearchBtn');
  if (input && clearBtn) {
    clearBtn.style.display = input.value.trim().length > 0 ? 'flex' : 'none';
  }
}

/**
 * Apply quick filter
 */
function applyQuickFilter(filter) {
  const input = document.getElementById('searchInput');
  if (input) {
    const currentValue = input.value.trim();
    // Remove existing filter if present
    const filterType = filter.split(':')[0];
    const cleaned = currentValue.replace(new RegExp(`${filterType}:[^\\s]+`, 'gi'), '').trim();
    input.value = cleaned ? `${filter} ${cleaned}` : filter;
    input.focus();
    performSearch(input.value);
    
    // Update active state of filter chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.classList.remove('active');
      if (chip.dataset.filter === filter) {
        chip.classList.add('active');
      }
    });
  }
}

/**
 * Update recent searches display
 */
function updateRecentSearches() {
  const recentContainer = document.getElementById('recentSearches');
  const recentList = document.getElementById('recentSearchesList');
  if (!recentContainer || !recentList) return;
  
  const recent = getRecentSearches();
  if (recent.length === 0) {
    recentContainer.style.display = 'none';
    return;
  }
  
  recentContainer.style.display = 'block';
  recentList.innerHTML = recent.slice(0, 5).map((query, index) => `
    <button class="recent-search-item" onclick="if(window.setSearchQuery) window.setSearchQuery('${query.replace(/'/g, "\\'")}')">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor">
        <path d="M8 2L2 7l6 5 6-5-6-5z" stroke-width="1.5"/>
      </svg>
      <span>${window.escapeHtml ? window.escapeHtml(query) : query}</span>
    </button>
  `).join('');
}

/**
 * Get recent searches from localStorage
 */
function getRecentSearches() {
  try {
    const stored = localStorage.getItem('recentSearches');
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Save search to recent searches
 */
function saveRecentSearch(query) {
  if (!query || query.trim().length === 0) return;
  
  try {
    const recent = getRecentSearches();
    // Remove if already exists
    const filtered = recent.filter(q => q !== query);
    // Add to front
    filtered.unshift(query);
    // Keep only last 10
    const limited = filtered.slice(0, 10);
    localStorage.setItem('recentSearches', JSON.stringify(limited));
  } catch (e) {
    console.warn('[SEARCH] Failed to save recent search:', e);
  }
}

/**
 * Clear recent searches
 */
function clearRecentSearches() {
  try {
    localStorage.removeItem('recentSearches');
    updateRecentSearches();
  } catch (e) {
    console.warn('[SEARCH] Failed to clear recent searches:', e);
  }
}

/**
 * Perform search query
 */
async function performSearch(query) {
  if (!searchEngine || !searchEngine.initialized) {
    // Try to initialize if not ready
    if (!searchEngine && window.SearchEngine) {
      const initialized = await initializeSearch();
      if (!initialized) {
        const resultsEl = document.getElementById('searchResults');
        if (resultsEl) {
          resultsEl.innerHTML = '<div class="search-empty">Search engine initializing...<br><small>Waiting for data to load</small></div>';
        }
        return;
      }
    } else {
      // Show message that search is not ready
      const resultsEl = document.getElementById('searchResults');
      if (resultsEl) {
        resultsEl.innerHTML = '<div class="search-empty">Search engine initializing...</div>';
      }
      return;
    }
  }
  
  if (!query || query.trim().length === 0) {
    const resultsEl = document.getElementById('searchResults');
    if (resultsEl) {
      resultsEl.innerHTML = '<div class="search-empty">Type to search events, prompts, and files...<br><small>Or try: "Fork a state for trying authentication"</small></div>';
    }
    searchResults = [];
    searchSelectedIndex = -1;
    return;
  }

  // Hide examples when searching
  const examples = document.getElementById('searchExamples');
  if (examples) {
    examples.style.display = 'none';
  }

  // Check if this looks like a state command
  const stateCommandKeywords = ['fork', 'merge', 'switch', 'state', 'create state', 'show states', 'find states'];
  const isStateCommand = stateCommandKeywords.some(keyword => 
    query.toLowerCase().includes(keyword)
  );

  if (isStateCommand && window.stateService) {
    try {
      // Parse and execute state command
      const result = await window.stateService.executeCommand(query, {
        events: window.state?.data?.events || [],
        fileChanges: (window.state?.data?.events || []).filter(e => 
          e.type === 'file_change' || e.type === 'code_change'
        )
      });

      if (result.success) {
        renderStateCommandResult(result);
        return;
      }
    } catch (error) {
      console.warn('[SEARCH] State command failed, trying regular search:', error.message);
      // Fall through to regular search
    }
  }
  
  // Regular search
  try {
    // Store current query for highlighting
    window.currentSearchQuery = query;
    
    // Show loading state
    const loading = document.getElementById('searchLoading');
    const resultsEl = document.getElementById('searchResults');
    if (loading) loading.style.display = 'flex';
    if (resultsEl) resultsEl.style.display = 'none';
    
    // Save to recent searches if query is meaningful
    if (query.trim().length > 2) {
      saveRecentSearch(query.trim());
    }
    
    // Search is now async (supports Hugging Face semantic search)
    const results = await searchEngine.search(query, { limit: 30 }); // Increased limit for better results
    searchResults = results;
    searchSelectedIndex = -1;
    
    // Hide loading, show results
    if (loading) loading.style.display = 'none';
    if (resultsEl) resultsEl.style.display = 'block';
    
    renderSearchResults(results);
    updateResultCount(results.length);
  } catch (error) {
    console.error('[ERROR] Search failed:', error);
    const loading = document.getElementById('searchLoading');
    const resultsEl = document.getElementById('searchResults');
    if (loading) loading.style.display = 'none';
    if (resultsEl) {
      resultsEl.style.display = 'block';
      resultsEl.innerHTML = '<div class="search-error" style="padding: var(--space-md); text-align: center; color: var(--color-error);">Search error: ' + error.message + '</div>';
    }
  }
}

/**
 * Render state command result
 */
function renderStateCommandResult(result) {
  const resultsEl = document.getElementById('searchResults');
  if (!resultsEl) return;

  const escapeHtml = window.escapeHtml || ((str) => {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  });

  let html = `<div class="state-command-result" style="padding: var(--space-md);">`;
  html += `<div class="state-command-header" style="margin-bottom: var(--space-md);">`;
  html += `<h3 style="margin: 0 0 var(--space-xs) 0; font-size: 1.1em;">${result.action.charAt(0).toUpperCase() + result.action.slice(1)} Command</h3>`;
  html += `<div class="state-command-message" style="color: var(--color-text-secondary); font-size: 0.9em;">${escapeHtml(result.result?.message || 'Command executed')}</div>`;
  html += `</div>`;

  if (result.result?.state) {
    const state = result.result.state;
    html += `<div class="state-card" style="background: var(--color-bg-alt); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-md); margin-bottom: var(--space-sm);">`;
    html += `<div class="state-name" style="font-weight: 600; margin-bottom: var(--space-xs);">${escapeHtml(state.name)}</div>`;
    html += `<div class="state-description" style="color: var(--color-text-secondary); font-size: 0.9em; margin-bottom: var(--space-xs);">${escapeHtml(state.description || '')}</div>`;
    html += `<div class="state-meta" style="display: flex; gap: var(--space-xs); flex-wrap: wrap;">`;
    html += `<span class="state-intent badge" style="background: var(--color-primary); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8em;">${escapeHtml(state.metadata?.intent || 'general')}</span>`;
    if (state.metadata?.tags && state.metadata.tags.length > 0) {
      state.metadata.tags.forEach(tag => {
        html += `<span class="state-tag badge" style="background: var(--color-bg); border: 1px solid var(--color-border); padding: 2px 8px; border-radius: 4px; font-size: 0.8em;">#${escapeHtml(tag)}</span>`;
      });
    }
    html += `</div>`;
    html += `</div>`;
  }

  if (result.result?.states && result.result.states.length > 0) {
    html += `<div class="state-list">`;
    result.result.states.forEach(state => {
      html += `<div class="state-card" style="background: var(--color-bg-alt); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-md); margin-bottom: var(--space-sm); cursor: pointer; transition: all 0.2s;" onclick="window.stateService && window.stateService.executeCommand('switch to ${state.name}', {}).then(r => { if(r.success) window.location.reload(); })" onmouseover="this.style.borderColor='var(--color-primary)'" onmouseout="this.style.borderColor='var(--color-border)'">`;
      html += `<div class="state-name" style="font-weight: 600; margin-bottom: var(--space-xs);">${escapeHtml(state.name)}</div>`;
      html += `<div class="state-description" style="color: var(--color-text-secondary); font-size: 0.9em; margin-bottom: var(--space-xs);">${escapeHtml(state.description || '')}</div>`;
      html += `<div class="state-meta" style="display: flex; gap: var(--space-xs); flex-wrap: wrap;">`;
      html += `<span class="state-intent badge" style="background: var(--color-primary); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8em;">${escapeHtml(state.metadata?.intent || 'general')}</span>`;
      html += `</div>`;
      html += `</div>`;
    });
    html += `</div>`;
  }

  html += `</div>`;
  resultsEl.innerHTML = html;
  searchResults = [];
  searchSelectedIndex = -1;
}

/**
 * Render search results
 */
function renderSearchResults(results) {
  const resultsEl = document.getElementById('searchResults');
  if (!resultsEl) return;
  
  // Update result count
  updateResultCount(results.length);
  
  if (results.length === 0) {
    resultsEl.innerHTML = `
      <div class="search-empty" style="
        padding: var(--space-xl);
        text-align: center;
        color: var(--color-text-muted);
      ">
        <div style="display: flex; justify-content: center; margin-bottom: var(--space-md); opacity: 0.3;">
          ${window.renderLucideIcon ? window.renderLucideIcon('search', { size: 48, color: 'currentColor' }) : '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>'}
        </div>
        <div style="font-size: var(--text-lg); font-weight: 600; margin-bottom: var(--space-sm); color: var(--color-text);">No results found</div>
        <div style="font-size: var(--text-sm); margin-bottom: var(--space-md); color: var(--color-text-secondary);">
          Try different keywords or use the quick filters above
        </div>
        <div style="display: flex; gap: var(--space-xs); justify-content: center; flex-wrap: wrap; font-size: var(--text-xs);">
          <code style="padding: 4px 8px; background: var(--color-bg-alt); border-radius: var(--radius-sm);">type:prompt</code>
          <code style="padding: 4px 8px; background: var(--color-bg-alt); border-radius: var(--radius-sm);">workspace:name</code>
          <code style="padding: 4px 8px; background: var(--color-bg-alt); border-radius: var(--radius-sm);">date:today</code>
        </div>
      </div>
    `;
    return;
  }
  
  // Helper functions with fallbacks
  const escapeHtml = window.escapeHtml || ((str) => {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  });
  
  const formatTimeAgo = window.formatTimeAgo || ((timestamp) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch (e) {
      return '';
    }
  });
  
  // Group results by type for better organization
  const groupedResults = {};
  results.forEach((result, index) => {
    const type = result.type || 'other';
    if (!groupedResults[type]) {
      groupedResults[type] = [];
    }
    groupedResults[type].push({ ...result, originalIndex: index });
  });
  
  // Helper to highlight query terms in text
  const highlightQuery = (text, query) => {
    if (!query || !text) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    let highlighted = escaped;
    queryTerms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark>$1</mark>');
    });
    return highlighted;
  };
  
  // Helper to get type icon/color
  const getTypeInfo = (type) => {
    const renderIcon = (iconName, size = 14) => {
      if (window.renderLucideIcon) {
        return window.renderLucideIcon(iconName, { size, color: 'currentColor' });
      }
      // Fallback SVG if renderLucideIcon not available
      const fallbacks = {
        fileEdit: '<path d="M4 13.5V4a2 2 0 0 1 2-2h8.5L20 7.5V20a2 2 0 0 1-2 2h-5.5"/><polyline points="14 2 14 8 20 8"/><path d="M10.42 12.61a2.1 2.1 0 1 1 2.97 2.97L7.95 21 4 22l.99-3.95 5.43-5.44Z"/>',
        messageSquare: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
        messageCircle: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
        keyboard: '<rect width="20" height="16" x="2" y="4" rx="2" ry="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/><path d="M7 16h10"/>',
        file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>',
        pin: '<line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14l-1-7H6l-1 7z"/><path d="M7 11V6a5 5 0 0 1 10 0v5"/>'
      };
      const path = fallbacks[iconName] || fallbacks.pin;
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
    };
    
    const types = {
      event: { label: 'Event', color: '#3b82f6', icon: renderIcon('fileEdit', 14) },
      prompt: { label: 'Prompt', color: '#10b981', icon: renderIcon('messageSquare', 14) },
      conversation: { label: 'Conversation', color: '#8b5cf6', icon: renderIcon('messageCircle', 14) },
      terminal: { label: 'Terminal', color: '#f59e0b', icon: renderIcon('keyboard', 14) },
      file: { label: 'File', color: '#ef4444', icon: renderIcon('file', 14) },
      other: { label: 'Other', color: '#64748b', icon: renderIcon('pin', 14) }
    };
    return types[type] || types.other;
  };
  
  // Build HTML with grouping
  const html = Object.entries(groupedResults).map(([type, typeResults]) => {
    const typeInfo = getTypeInfo(type);
    const typeHeader = Object.keys(groupedResults).length > 1 ? `
      <div class="search-result-group-header" style="
        padding: var(--space-sm) var(--space-md);
        background: var(--color-bg-alt);
        border-bottom: 1px solid var(--color-border);
        font-size: var(--text-xs);
        font-weight: 600;
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      ">
        <span>${typeInfo.icon}</span>
        <span>${typeInfo.label} (${typeResults.length})</span>
      </div>
    ` : '';
    
    const itemsHtml = typeResults.map((result) => {
      const index = result.originalIndex;
      const hasAnnotation = result.annotation || (result.payload && result.payload.annotation);
      const annotation = result.annotation || (result.payload && result.payload.annotation);
      const annotationIcon = hasAnnotation && window.renderAnnotationIcon ? 
        window.renderAnnotationIcon(14, 'var(--color-primary)') : '';
      
      const title = result.title || result.content?.substring(0, 100) || 'Untitled';
      const snippet = result.snippet || result.content?.substring(0, 200) || '';
      const time = result.timestamp ? formatTimeAgo(result.timestamp) : '';
      
      // Extract metadata
      const workspace = result.workspace || result.workspace_path || result.workspacePath || '';
      const filePath = result.file_path || result.filePath || '';
      const mode = result.mode || result.model || '';
      
      return `
        <div class="search-result-item ${index === searchSelectedIndex ? 'selected' : ''}" 
             data-index="${index}" 
             data-type="${type}"
             onclick="window.selectSearchResult(${index})"
             onmouseenter="window.searchSelectedIndex = ${index}; window.renderSearchResults(window.searchResults)"
             style="
               padding: var(--space-md);
               border-bottom: 1px solid var(--color-border);
               cursor: pointer;
               transition: background-color 0.15s ease;
             ">
          <div class="search-result-header" style="
            display: flex;
            align-items: flex-start;
            gap: var(--space-sm);
            margin-bottom: var(--space-xs);
          ">
            <span class="search-result-type" style="
              display: inline-flex;
              align-items: center;
              padding: 2px 8px;
              background: ${typeInfo.color}15;
              color: ${typeInfo.color};
              border: 1px solid ${typeInfo.color}40;
              border-radius: var(--radius-sm);
              font-size: var(--text-xs);
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.3px;
              white-space: nowrap;
            ">${typeInfo.icon} ${typeInfo.label}</span>
            <div style="flex: 1; min-width: 0;">
              <div class="search-result-title" style="
                font-weight: 600;
                font-size: var(--text-sm);
                color: var(--color-text);
                margin-bottom: 2px;
                line-height: 1.4;
              ">${highlightQuery(title, window.currentSearchQuery || '')}</div>
              <div class="search-result-meta" style="
                display: flex;
                align-items: center;
                gap: var(--space-sm);
                flex-wrap: wrap;
                font-size: var(--text-xs);
                color: var(--color-text-muted);
                margin-top: 4px;
              ">
                ${time ? `<span style="display: inline-flex; align-items: center; gap: 4px;">${window.renderLucideIcon ? window.renderLucideIcon('clock', { size: 14, color: 'currentColor' }) : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'} ${time}</span>` : ''}
                ${workspace ? `<span style="display: inline-flex; align-items: center; gap: 4px;" title="${escapeHtml(workspace)}">${window.renderLucideIcon ? window.renderLucideIcon('folder', { size: 14, color: 'currentColor' }) : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>'} ${escapeHtml(workspace.split('/').pop() || workspace)}</span>` : ''}
                ${filePath ? `<span style="display: inline-flex; align-items: center; gap: 4px;" title="${escapeHtml(filePath)}">${window.renderLucideIcon ? window.renderLucideIcon('file', { size: 14, color: 'currentColor' }) : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>'} ${escapeHtml(filePath.split('/').pop() || filePath)}</span>` : ''}
                ${mode ? `<span style="display: inline-flex; align-items: center; gap: 4px;">${window.renderLucideIcon ? window.renderLucideIcon('bot', { size: 14, color: 'currentColor' }) : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>'} ${escapeHtml(mode)}</span>` : ''}
              </div>
            </div>
          </div>
          ${snippet ? `
            <div class="search-result-snippet" style="
              margin-top: var(--space-xs);
              padding: var(--space-sm);
              background: var(--color-bg-alt);
              border-radius: var(--radius-sm);
              font-size: var(--text-xs);
              color: var(--color-text-secondary);
              line-height: 1.5;
              border-left: 3px solid ${typeInfo.color}40;
            ">
              ${highlightQuery(snippet, window.currentSearchQuery || '')}
            </div>
          ` : ''}
          ${hasAnnotation && annotation ? `
            <div class="search-result-annotation" style="
              margin-top: var(--space-xs);
              padding: var(--space-xs) var(--space-sm);
              background: var(--color-primary)10;
              border-left: 3px solid var(--color-primary);
              border-radius: var(--radius-sm);
              font-size: var(--text-xs);
              color: var(--color-text-secondary);
              display: flex;
              align-items: center;
              gap: 6px;
            ">
              ${annotationIcon}
              <span style="font-style: italic;">${escapeHtml(annotation)}</span>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
    
    return typeHeader + itemsHtml;
  }).join('');
  
  resultsEl.innerHTML = html;
}

/**
 * Update result count display
 */
function updateResultCount(count) {
  const countEl = document.getElementById('searchResultCount');
  if (countEl) {
    if (count > 0) {
      countEl.style.display = 'inline';
      countEl.textContent = `${count} result${count !== 1 ? 's' : ''}`;
    } else {
      countEl.style.display = 'none';
    }
  }
}

/**
 * Navigate search results with arrow keys
 */
function navigateSearchResults(direction) {
  if (searchResults.length === 0) return;
  
  if (direction === 'down') {
    searchSelectedIndex = Math.min(searchSelectedIndex + 1, searchResults.length - 1);
  } else if (direction === 'up') {
    searchSelectedIndex = Math.max(searchSelectedIndex - 1, -1);
  }
  
  renderSearchResults(searchResults);
  
  // Scroll to selected item
  const selectedEl = document.querySelector(`.search-result-item[data-index="${searchSelectedIndex}"]`);
  if (selectedEl) {
    selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

/**
 * Select a search result
 */
function selectSearchResult(index) {
  if (index < 0 || index >= searchResults.length) return;
  
  const result = searchResults[index];
  
  // Track click for analytics
  if (searchEngine && searchEngine.trackClick) {
    searchEngine.trackClick(result.type || 'unknown', result.id || result.path);
  }
  
  // Close search palette
  closeSearchPalette();
  
  // Navigate to the result based on type
  if (result.type === 'event' && result.id) {
    if (window.showEventModal) {
      window.showEventModal(result.id);
    } else if (window.switchView) {
      window.switchView('activity');
    }
  } else if (result.type === 'prompt' && result.id) {
    if (window.showPromptInModal) {
      window.showPromptInModal(result.id);
    } else if (window.switchView) {
      window.switchView('activity');
    }
  } else if (result.type === 'conversation' && result.id) {
    // Switch to activity view and highlight conversation
    if (window.switchView) {
      window.switchView('activity');
      // Could scroll to conversation in timeline
    }
  } else if (result.type === 'terminal' && result.id) {
    if (window.switchView) {
      window.switchView('activity');
    }
  } else if (result.file_path || result.path) {
    const filePath = result.file_path || result.path;
    // Try to show in file graph or navigator
    if (window.switchView) {
      window.switchView('file-graph');
      // Could highlight file in graph
      setTimeout(() => {
        if (window.focusOnNode) {
          window.focusOnNode(filePath);
        }
      }, 300);
    }
  }
}

// Export search functions to window
window.initializeSearch = initializeSearch;
window.reinitializeSearch = reinitializeSearch;
/**
 * Toggle Hugging Face semantic search
 */
async function toggleHuggingFaceSearch(enabled) {
  // Save preference to localStorage
  if (window.LocalStorageHelper) {
    window.LocalStorageHelper.set('ENABLE_SEMANTIC_SEARCH', enabled, true);
  } else {
    localStorage.setItem('ENABLE_SEMANTIC_SEARCH', JSON.stringify(enabled));
  }
  
  // Update config
  if (window.CONFIG) {
    window.CONFIG.ENABLE_SEMANTIC_SEARCH = enabled;
  }
  if (window.DASHBOARD_CONFIG) {
    window.DASHBOARD_CONFIG.ENABLE_SEMANTIC_SEARCH = enabled;
  }
  
  // Update UI
  const statusEl = document.getElementById('hfSearchStatus');
  if (statusEl) {
    if (enabled) {
      statusEl.textContent = 'Loading...';
      statusEl.className = 'hf-status-indicator loading';
    } else {
      statusEl.textContent = 'Disabled';
      statusEl.className = 'hf-status-indicator disabled';
    }
  }
  
  // Reinitialize search engine if it exists
  if (searchEngine && searchEngine.initialized) {
    console.log(`[SEARCH] ${enabled ? 'Enabling' : 'Disabling'} Hugging Face semantic search...`);
    
    if (enabled) {
      // Initialize HF search
      try {
        const events = window.state?.data?.events || [];
        const prompts = window.state?.data?.prompts || [];
        const conversations = window.state?.data?.conversations || [];
        const terminalCommands = window.state?.data?.terminalCommands || [];
        
        const docs = [
          ...events.map((e, i) => ({
            id: `event-${e.id || i}`,
            type: 'event',
            title: e.file_path || 'File Change',
            content: JSON.stringify(e.details || {}),
            timestamp: e.timestamp,
            workspace: e.workspace || 'unknown'
          })),
          ...prompts.map((p, i) => ({
            id: `prompt-${p.id || i}`,
            type: 'prompt',
            title: p.prompt?.substring(0, 50) || 'Prompt',
            content: p.prompt || '',
            timestamp: p.timestamp,
            workspace: p.workspace || 'unknown'
          }))
        ];
        
        await searchEngine.initializeHuggingFaceSearch(docs);
        
        if (searchEngine.useHuggingFace && searchEngine.hfSemanticSearch?.isInitialized) {
          if (statusEl) {
            statusEl.textContent = 'Enabled';
            statusEl.className = 'hf-status-indicator enabled';
          }
          updateSemanticStatus();
          console.log('[SEARCH] Hugging Face semantic search enabled successfully');
        } else {
          if (statusEl) {
            statusEl.textContent = 'Failed';
            statusEl.className = 'hf-status-indicator failed';
          }
          console.warn('[SEARCH] Failed to enable Hugging Face semantic search');
        }
      } catch (error) {
        console.error('[SEARCH] Error enabling Hugging Face search:', error);
        if (statusEl) {
          statusEl.textContent = 'Error';
          statusEl.className = 'hf-status-indicator failed';
        }
      }
    } else {
      // Disable HF search
      searchEngine.useHuggingFace = false;
      if (statusEl) {
        statusEl.textContent = 'Disabled';
        statusEl.className = 'hf-status-indicator disabled';
      }
      updateSemanticStatus();
      console.log('[SEARCH] Hugging Face semantic search disabled');
    }
  } else {
    // Search engine not initialized yet, will pick up config on next init
    if (statusEl) {
      statusEl.textContent = enabled ? 'Will enable on next search' : 'Disabled';
      statusEl.className = enabled ? 'hf-status-indicator pending' : 'hf-status-indicator disabled';
    }
  }
}

/**
 * Load Hugging Face search preference and update UI
 */
function loadHuggingFacePreference() {
  let enabled = false;
  
  // Check localStorage
  if (window.LocalStorageHelper) {
    enabled = window.LocalStorageHelper.get('ENABLE_SEMANTIC_SEARCH', false, true) === true;
  } else {
    const stored = localStorage.getItem('ENABLE_SEMANTIC_SEARCH');
    if (stored) {
      try {
        enabled = JSON.parse(stored) === true;
      } catch (e) {
        enabled = false;
      }
    }
  }
  
  // Update config
  if (window.CONFIG) {
    window.CONFIG.ENABLE_SEMANTIC_SEARCH = enabled;
  }
  if (window.DASHBOARD_CONFIG) {
    window.DASHBOARD_CONFIG.ENABLE_SEMANTIC_SEARCH = enabled;
  }
  
  // Update UI
  const toggle = document.getElementById('hfSemanticSearchToggle');
  const statusEl = document.getElementById('hfSearchStatus');
  
  if (toggle) {
    toggle.checked = enabled;
  }
  
  if (statusEl) {
    if (enabled) {
      statusEl.textContent = 'Enabled';
      statusEl.className = 'hf-status-indicator enabled';
    } else {
      statusEl.textContent = 'Disabled';
      statusEl.className = 'hf-status-indicator disabled';
    }
  }
  
  return enabled;
}

window.openSearchPalette = openSearchPalette;
window.closeSearchPalette = closeSearchPalette;
window.toggleHuggingFaceSearch = toggleHuggingFaceSearch;
window.loadHuggingFacePreference = loadHuggingFacePreference;
window.performSearch = performSearch;
window.navigateSearchResults = navigateSearchResults;
window.selectSearchResult = selectSearchResult;
window.renderSearchResults = renderSearchResults;
window.renderStateCommandResult = renderStateCommandResult;
window.setSearchQuery = setSearchQuery;
window.updateSearchExamples = updateSearchExamples;

// Load preference when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(loadHuggingFacePreference, 500); // Wait for config to load
  });
} else {
  setTimeout(loadHuggingFacePreference, 500);
}
window.updateSemanticStatus = updateSemanticStatus;

// Export search state for event listeners in dashboard.js
Object.defineProperty(window, 'searchSelectedIndex', {
  get: () => searchSelectedIndex,
  set: (value) => { searchSelectedIndex = value; }
});
Object.defineProperty(window, 'searchResults', {
  get: () => searchResults,
  set: (value) => { searchResults = value; }
});

})(); // End IIFE
