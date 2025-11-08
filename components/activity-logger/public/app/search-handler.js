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
    
    await searchEngine.initialize(searchData);
    console.log(`[SUCCESS] Search engine initialized with ${totalItems} items (${events.length} events, ${prompts.length} prompts, ${conversations.length} conversations, ${terminalCommands.length} terminal commands)`);
    
    // Update semantic status after initialization
    setTimeout(() => {
      updateSemanticStatus();
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
  if (examples && input) {
    if (input.value.trim().length === 0) {
      examples.style.display = 'block';
    } else {
      examples.style.display = 'none';
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
      resultsEl.innerHTML = '<div class="search-empty">Type to search events, prompts, and files...</div>';
    }
    searchResults = [];
    searchSelectedIndex = -1;
    return;
  }
  
  try {
    // Hide examples when searching
    const examples = document.getElementById('searchExamples');
    if (examples) {
      examples.style.display = 'none';
    }
    
    // Search is now async (supports Hugging Face semantic search)
    const results = await searchEngine.search(query, { limit: 20 });
    searchResults = results;
    searchSelectedIndex = -1;
    renderSearchResults(results);
  } catch (error) {
    console.error('[ERROR] Search failed:', error);
    const resultsEl = document.getElementById('searchResults');
    if (resultsEl) {
      resultsEl.innerHTML = '<div class="search-error">Search error: ' + error.message + '</div>';
    }
  }
}

/**
 * Render search results
 */
function renderSearchResults(results) {
  const resultsEl = document.getElementById('searchResults');
  if (!resultsEl) return;
  
  if (results.length === 0) {
    resultsEl.innerHTML = '<div class="search-empty">No results found<br><small>Try different keywords or filters</small></div>';
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
  
  const html = results.map((result, index) => {
    const type = result.type || 'unknown';
    const title = result.title || result.content?.substring(0, 80) || 'Untitled';
    const snippet = result.snippet || result.content?.substring(0, 150) || '';
    const time = result.timestamp ? formatTimeAgo(result.timestamp) : '';
    
    return `
      <div class="search-result-item ${index === searchSelectedIndex ? 'selected' : ''}" 
           data-index="${index}" 
           onclick="window.selectSearchResult(${index})"
           onmouseenter="window.searchSelectedIndex = ${index}; window.renderSearchResults(window.searchResults)">
        <div class="search-result-header">
          <span class="search-result-type badge badge-${type}">${type}</span>
          <span class="search-result-title">${escapeHtml(title)}</span>
          ${time ? `<span class="search-result-time">${time}</span>` : ''}
        </div>
        ${snippet ? `<div class="search-result-snippet">${escapeHtml(snippet)}</div>` : ''}
      </div>
    `;
  }).join('');
  
  resultsEl.innerHTML = html;
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
  
  // Close search palette
  closeSearchPalette();
  
  // Navigate to the result based on type
  if (result.type === 'event' && result.id) {
    if (window.showEventModal) {
      window.showEventModal(result.id);
    }
  } else if (result.type === 'prompt' && result.id) {
    if (window.showPromptInModal) {
      window.showPromptInModal(result.id);
    }
  } else if (result.type === 'conversation' && result.id) {
    // Switch to activity view and highlight conversation
    if (window.switchView) {
      window.switchView('activity');
      // Could scroll to conversation in timeline
    }
  } else if (result.file_path) {
    // Could open file in editor or show file graph
    console.log('[SEARCH] Selected file:', result.file_path);
  }
}

// Export search functions to window
window.initializeSearch = initializeSearch;
window.reinitializeSearch = reinitializeSearch;
window.openSearchPalette = openSearchPalette;
window.closeSearchPalette = closeSearchPalette;
window.performSearch = performSearch;
window.navigateSearchResults = navigateSearchResults;
window.selectSearchResult = selectSearchResult;
window.renderSearchResults = renderSearchResults;
window.setSearchQuery = setSearchQuery;
window.updateSearchExamples = updateSearchExamples;
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
