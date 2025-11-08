/**
 * Search and Discovery Handler for Activity Timeline
 * Provides full-text search, filtering, and discovery features
 */

// Search state
let searchQuery = '';
let activitySearchResults = []; // Renamed to avoid conflict with app/search-handler.js
let currentSearchIndex = -1;
let searchFilters = {
  type: 'all', // all, event, prompt, terminal
  file: '',
  error: false,
  linked: null, // null = all, true = linked only, false = unlinked only
  model: '',
  workspace: 'all'
};

/**
 * Initialize search functionality
 */
function initializeActivitySearch() {
  const searchInput = document.getElementById('activitySearchInput');
  if (!searchInput) return;
  
  // Debounce search
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      performActivitySearch(e.target.value);
    }, 300);
  });
  
  // Keyboard shortcuts
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activitySearchResults.length > 0) {
        selectSearchResult(currentSearchIndex >= 0 ? currentSearchIndex : 0);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateSearchResults(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateSearchResults(-1);
    } else if (e.key === 'Escape') {
      clearActivitySearch();
    }
  });
  
  // Focus shortcut (Cmd/Ctrl + F)
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'f' && window.state?.currentView === 'activity') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
}

/**
 * Perform search across timeline items
 */
function performActivitySearch(query) {
  searchQuery = query.toLowerCase().trim();
  
  if (!searchQuery) {
    clearActivitySearch();
    return;
  }
  
  const events = window.state?.data?.events || [];
  const prompts = window.state?.data?.prompts || [];
  const terminalCommands = window.state?.data?.terminalCommands || [];
  
  // Combine all items
  const allItems = [
    ...events.map(e => ({ ...e, itemType: 'event', searchableText: getEventSearchableText(e) })),
    ...prompts.map(p => ({ ...p, itemType: 'prompt', searchableText: getPromptSearchableText(p) })),
    ...terminalCommands.map(c => ({ ...c, itemType: 'terminal', searchableText: getTerminalSearchableText(c) }))
  ];
  
  // Filter by search filters first
  let filtered = applySearchFilters(allItems);
  
  // Then search
  activitySearchResults = filtered.filter(item => {
    if (!searchQuery) return true;
    
    // Search in text content
    if (item.searchableText.toLowerCase().includes(searchQuery)) {
      return true;
    }
    
    // Search in file paths
    const filePath = item.file_path || item.filePath || item.path || '';
    if (filePath.toLowerCase().includes(searchQuery)) {
      return true;
    }
    
    // Search in workspace
    const workspace = item.workspace_path || item.workspacePath || item.workspaceName || item.workspace || '';
    if (workspace.toLowerCase().includes(searchQuery)) {
      return true;
    }
    
    return false;
  });
  
  // Sort by relevance (exact matches first, then partial)
  activitySearchResults.sort((a, b) => {
    const aExact = a.searchableText.toLowerCase() === searchQuery;
    const bExact = b.searchableText.toLowerCase() === searchQuery;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    
    const aStarts = a.searchableText.toLowerCase().startsWith(searchQuery);
    const bStarts = b.searchableText.toLowerCase().startsWith(searchQuery);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    
    return 0;
  });
  
  currentSearchIndex = -1;
  updateSearchResultsDisplay();
}

/**
 * Apply search filters
 */
function applySearchFilters(items) {
  return items.filter(item => {
    // Type filter
    if (searchFilters.type !== 'all' && item.itemType !== searchFilters.type) {
      return false;
    }
    
    // File filter
    if (searchFilters.file) {
      const filePath = item.file_path || item.filePath || item.path || '';
      if (!filePath.toLowerCase().includes(searchFilters.file.toLowerCase())) {
        return false;
      }
    }
    
    // Error filter
    if (searchFilters.error) {
      if (item.itemType === 'terminal') {
        const exitCode = item.exit_code;
        if (!(exitCode !== null && exitCode !== undefined && exitCode !== 0)) {
          return false;
        }
      } else if (item.itemType === 'event') {
        // Check if event is related to an error (would need error detection)
        // For now, skip this filter for events
      } else {
        return false; // Only terminals and events can have errors
      }
    }
    
    // Linked filter
    if (searchFilters.linked !== null) {
      if (item.itemType === 'event') {
        const hasLink = !!(item.prompt_id || item.linked_prompt_id);
        if (hasLink !== searchFilters.linked) return false;
      } else if (item.itemType === 'prompt') {
        const hasLink = !!(item.linked_entry_id || item.linkedEntryId);
        if (hasLink !== searchFilters.linked) return false;
      }
    }
    
    // Model filter
    if (searchFilters.model && item.itemType === 'prompt') {
      const model = item.model_name || item.modelName || item.model_type || item.modelType || '';
      if (!model.toLowerCase().includes(searchFilters.model.toLowerCase())) {
        return false;
      }
    }
    
    // Workspace filter
    if (searchFilters.workspace !== 'all') {
      const workspace = item.workspace_path || item.workspacePath || item.workspaceName || item.workspace || '';
      if (workspace !== searchFilters.workspace && !workspace.includes(searchFilters.workspace)) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Get searchable text for event
 */
function getEventSearchableText(event) {
  try {
    const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
    const filePath = details?.file_path || event.file_path || event.path || '';
    const fileName = filePath.split('/').pop() || '';
    return `${fileName} ${filePath} ${event.type || ''}`.toLowerCase();
  } catch {
    const filePath = event.file_path || event.path || '';
    return filePath.toLowerCase();
  }
}

/**
 * Get searchable text for prompt
 */
function getPromptSearchableText(prompt) {
  const text = prompt.text || prompt.prompt || prompt.preview || prompt.content || '';
  return text.toLowerCase();
}

/**
 * Get searchable text for terminal command
 */
function getTerminalSearchableText(cmd) {
  const command = cmd.command || '';
  const output = cmd.output || cmd.stdout || cmd.stderr || '';
  return `${command} ${output}`.toLowerCase();
}

/**
 * Update search results display
 */
function updateSearchResultsDisplay() {
  const resultsContainer = document.getElementById('activitySearchResults');
  if (!resultsContainer) return;
  
  if (!searchQuery) {
    resultsContainer.innerHTML = '';
    resultsContainer.style.display = 'none';
    return;
  }
  
  if (activitySearchResults.length === 0) {
    resultsContainer.innerHTML = '<div class="search-results-empty">No results found</div>';
    resultsContainer.style.display = 'block';
    return;
  }
  
  const maxResults = 10;
  const displayResults = activitySearchResults.slice(0, maxResults);
  
  let html = `<div class="search-results-header">${activitySearchResults.length} result${activitySearchResults.length !== 1 ? 's' : ''}</div>`;
  
  html += displayResults.map((item, index) => {
    const isSelected = index === currentSearchIndex;
    const time = window.formatTimeAgo ? window.formatTimeAgo(item.timestamp || item.sortTime) : new Date(item.timestamp).toLocaleString();
    
    let preview = '';
    if (item.itemType === 'prompt') {
      const text = item.text || item.prompt || item.preview || item.content || '';
      preview = text.length > 60 ? text.substring(0, 60) + '...' : text;
    } else if (item.itemType === 'event') {
      const filePath = item.file_path || item.filePath || item.path || '';
      preview = filePath.split('/').pop() || 'File change';
    } else if (item.itemType === 'terminal') {
      const command = item.command || '';
      preview = command.length > 60 ? command.substring(0, 60) + '...' : command;
    }
    
    return `
      <div class="search-result-item ${isSelected ? 'selected' : ''}" 
           onclick="selectSearchResult(${index})"
           onmouseenter="highlightSearchResult(${index})">
        <div class="search-result-type">${item.itemType}</div>
        <div class="search-result-content">
          <div class="search-result-preview">${window.escapeHtml ? window.escapeHtml(preview) : preview}</div>
          <div class="search-result-meta">${time}</div>
        </div>
      </div>
    `;
  }).join('');
  
  if (activitySearchResults.length > maxResults) {
    html += `<div class="search-results-more">+${activitySearchResults.length - maxResults} more results</div>`;
  }
  
  resultsContainer.innerHTML = html;
  resultsContainer.style.display = 'block';
}

/**
 * Navigate search results
 */
function navigateSearchResults(direction) {
  if (activitySearchResults.length === 0) return;
  
  currentSearchIndex += direction;
  if (currentSearchIndex < 0) currentSearchIndex = activitySearchResults.length - 1;
  if (currentSearchIndex >= activitySearchResults.length) currentSearchIndex = 0;
  
  updateSearchResultsDisplay();
  
  // Scroll selected item into view
  const selected = document.querySelector(`.search-result-item.selected`);
  if (selected) {
    selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

/**
 * Highlight search result on hover
 */
function highlightSearchResult(index) {
  currentSearchIndex = index;
  updateSearchResultsDisplay();
}

/**
 * Select search result and navigate to it
 */
function selectSearchResult(index) {
  if (index < 0 || index >= activitySearchResults.length) return;
  
  const item = activitySearchResults[index];
  
  // Show modal or scroll to item in timeline
  if (item.itemType === 'event') {
    if (window.showEventModal) {
      window.showEventModal(item.id || item.timestamp);
    }
  } else if (item.itemType === 'prompt') {
    if (window.showEventModal) {
      window.showEventModal(item.id);
    }
  } else if (item.itemType === 'terminal') {
    if (window.showTerminalModal) {
      window.showTerminalModal(item.id);
    }
  }
  
  // Clear search
  clearActivitySearch();
}

/**
 * Clear search
 */
function clearActivitySearch() {
  searchQuery = '';
  activitySearchResults = [];
  currentSearchIndex = -1;
  
  const searchInput = document.getElementById('activitySearchInput');
  if (searchInput) searchInput.value = '';
  
  const resultsContainer = document.getElementById('activitySearchResults');
  if (resultsContainer) {
    resultsContainer.innerHTML = '';
    resultsContainer.style.display = 'none';
  }
  
  // Re-render timeline without search
  if (window.renderActivityView) {
    const container = document.getElementById('viewContainer');
    if (container) {
      window.renderActivityView(container);
    }
  }
}

/**
 * Update search filters
 */
function updateSearchFilters(newFilters) {
  searchFilters = { ...searchFilters, ...newFilters };
  
  // Re-run search if there's a query
  if (searchQuery) {
    performActivitySearch(searchQuery);
  } else {
    // Re-render timeline with filters
    if (window.renderActivityView) {
      const container = document.getElementById('viewContainer');
      if (container) {
        window.renderActivityView(container);
      }
    }
  }
}

// Export to window for global access
window.initializeActivitySearch = initializeActivitySearch;
window.performActivitySearch = performActivitySearch;
window.clearActivitySearch = clearActivitySearch;
window.updateSearchFilters = updateSearchFilters;
window.navigateSearchResults = navigateSearchResults;
window.highlightSearchResult = highlightSearchResult;
window.selectSearchResult = selectSearchResult;

