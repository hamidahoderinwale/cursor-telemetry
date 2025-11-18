/**
 * Dashboard Search Module
 * Handles search functionality for the dashboard
 * Extracted from dashboard.js for better organization
 */

let searchEngine = null;
// Use window properties if available (from search-handler.js), otherwise use local variables
// Access via window to avoid redeclaration errors - don't try to define properties here
// since search-handler.js already defines them
const getSearchSelectedIndex = () => {
  if (typeof window !== 'undefined') {
    try {
      return window.searchSelectedIndex !== undefined ? window.searchSelectedIndex : -1;
    } catch (e) {
      return -1;
    }
  }
  return -1;
};

const setSearchSelectedIndex = (val) => {
  if (typeof window !== 'undefined') {
    try {
      window.searchSelectedIndex = val;
    } catch (e) {
      // Property might be read-only, ignore
      // Could not set searchSelectedIndex
    }
  }
};

const getSearchResults = () => {
  if (typeof window !== 'undefined') {
    try {
      return window.searchResults !== undefined ? window.searchResults : [];
    } catch (e) {
      return [];
    }
  }
  return [];
};

const setSearchResults = (val) => {
  if (typeof window !== 'undefined') {
    try {
      window.searchResults = val;
    } catch (e) {
      // Property might be read-only, ignore
      // Could not set searchResults
    }
  }
};

/**
 * Initialize the semantic search engine with current data
 */
async function initializeSearch() {
  if (!window.SearchEngine) {
    console.warn('[SEARCH] SearchEngine class not available');
    return;
  }
  
  try {
    searchEngine = new window.SearchEngine();
    
    // Get current data from state
    const state = window.state || {};
    const events = state.data?.events || [];
    const prompts = state.data?.prompts || [];
    const conversations = state.data?.conversations || [];
    
    // Prepare data for search engine
    const searchData = {
      events,
      prompts,
      conversations,
      workspaces: state.data?.workspaces || []
    };
    
    await searchEngine.initialize(searchData);
  } catch (error) {
    console.error('[ERROR] Failed to initialize search engine:', error);
  }
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
    setSearchSelectedIndex(-1);
    setSearchResults([]);
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
    setSearchSelectedIndex(-1);
    setSearchResults([]);
}

/**
 * Perform search query
 */
async function performSearch(query) {
  if (!searchEngine || !searchEngine.initialized) {
    // Show message that search is not ready
    const resultsEl = document.getElementById('searchResults');
    if (resultsEl) {
      if (window.safeSetHTML) {
        window.safeSetHTML(resultsEl, '<div class="search-empty">Search engine initializing...</div>');
      } else {
        resultsEl.innerHTML = '<div class="search-empty">Search engine initializing...</div>';
      }
    }
    return;
  }
  
  if (!query || query.trim().length === 0) {
    const resultsEl = document.getElementById('searchResults');
    if (resultsEl) {
      const emptyMsg = '<div class="search-empty">Type to search events, prompts, and files...</div>';
      if (window.safeSetHTML) {
        window.safeSetHTML(resultsEl, emptyMsg);
      } else {
        resultsEl.innerHTML = emptyMsg;
      }
    }
    setSearchResults([]);
    setSearchSelectedIndex(-1);
    return;
  }
  
  try {
    const results = searchEngine.search(query, { limit: 20 });
    setSearchResults(results);
    setSearchSelectedIndex(-1);
    renderSearchResults(results);
  } catch (error) {
    console.error('[ERROR] Search failed:', error);
    const resultsEl = document.getElementById('searchResults');
    if (resultsEl) {
      const errorMsg = '<div class="search-error">Search error: ' + (window.escapeHtml ? window.escapeHtml(error.message) : error.message) + '</div>';
      if (window.safeSetHTML) {
        window.safeSetHTML(resultsEl, errorMsg);
      } else {
        resultsEl.innerHTML = errorMsg;
      }
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
    const emptyMsg = '<div class="search-empty">No results found</div>';
    if (window.safeSetHTML) {
      window.safeSetHTML(resultsEl, emptyMsg);
    } else {
      resultsEl.innerHTML = emptyMsg;
    }
    return;
  }
  
  const escapeHtml = window.escapeHtml || ((text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  });
  
  const formatTimeAgo = window.formatTimeAgo || ((timestamp) => {
    return new Date(timestamp).toLocaleString();
  });
  
  const html = results.map((result, index) => {
    const type = result.type || 'unknown';
    const title = result.title || result.content?.substring(0, 80) || 'Untitled';
    const snippet = result.snippet || result.content?.substring(0, 150) || '';
    const time = result.timestamp ? formatTimeAgo(result.timestamp) : '';
    
    return `
      <div class="search-result-item ${index === getSearchSelectedIndex() ? 'selected' : ''}" 
           data-index="${index}"
           onclick="selectSearchResult(${index})"
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
  
  if (window.safeSetHTML) {
    window.safeSetHTML(resultsEl, html);
  } else {
    resultsEl.innerHTML = html;
  }
}

/**
 * Navigate search results with arrow keys
 */
function navigateSearchResults(direction) {
  const results = getSearchResults();
  if (results.length === 0) return;
  
  let currentIndex = getSearchSelectedIndex();
  if (direction === 'down') {
    currentIndex = Math.min(currentIndex + 1, results.length - 1);
  } else if (direction === 'up') {
    currentIndex = Math.max(currentIndex - 1, -1);
  }
  setSearchSelectedIndex(currentIndex);
  
  renderSearchResults(results);
  
  // Scroll to selected item
  const selectedEl = document.querySelector(`.search-result-item[data-index="${currentIndex}"]`);
  if (selectedEl) {
    selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

/**
 * Select a search result
 */
function selectSearchResult(index) {
  const results = getSearchResults();
  if (index < 0 || index >= results.length) return;
  
  const result = results[index];
  
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
  }
}

// Export search functions to window
window.initializeSearch = initializeSearch;
window.openSearchPalette = openSearchPalette;
window.closeSearchPalette = closeSearchPalette;
window.performSearch = performSearch;
window.navigateSearchResults = navigateSearchResults;
window.selectSearchResult = selectSearchResult;

