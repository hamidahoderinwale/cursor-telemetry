/**
 * Real-Time Search Component with Dynamic Results and Ranking
 * Integrates with AdvancedSearchEngine for intelligent search
 */

class RealTimeSearch {
    constructor(options = {}) {
        this.container = options.container || document.getElementById('search-container');
        this.searchEngine = options.searchEngine;
        this.onResults = options.onResults || (() => {});
        this.onSuggestion = options.onSuggestion || (() => {});
        
        // Search configuration
        this.config = {
            minQueryLength: 2,
            debounceDelay: 300,
            maxSuggestions: 10,
            maxResults: 50,
            showRanking: true,
            showSearchTime: true,
            highlightMatches: true,
            enablePromptExtraction: true
        };
        
        // State
        this.currentQuery = '';
        this.isSearching = false;
        this.lastSearchTime = 0;
        this.searchTimeout = null;
        this.results = [];
        this.suggestions = [];
        this.extractedPrompts = [];
        
        // Enhanced prompt extraction patterns
        this.promptPatterns = [
            { pattern: /(?:prompt|question|ask|request):\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'direct_prompt' },
            { pattern: /(?:user|you):\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'user_directive' },
            { pattern: /(?:please|can you|help me):\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'request' },
            { pattern: /@cursor\s+(.+?)(?:\n\n|\n$|$)/gi, type: 'cursor_directive' },
            { pattern: /@ai\s+(.+?)(?:\n\n|\n$|$)/gi, type: 'ai_directive' },
            { pattern: /\/\/\s*prompt:\s*(.+?)(?:\n|$)/gi, type: 'code_comment_prompt' },
            { pattern: /#\s*prompt:\s*(.+?)(?:\n|$)/gi, type: 'python_comment_prompt' },
            { pattern: /Task:\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'task_definition' },
            { pattern: /Goal:\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'goal_definition' }
        ];
        
        this.initializeUI();
        this.setupEventListeners();
    }

    /**
     * Initialize the search UI
     */
    initializeUI() {
        if (!this.container) {
            console.error('RealTimeSearch: Container not found');
            return;
        }

        this.container.innerHTML = `
            <div class="real-time-search-container">
                <div class="search-input-container">
                    <div class="search-input-wrapper">
                        <input 
                            type="text" 
                            id="real-time-search-input" 
                            class="search-input" 
                            placeholder="Search sessions, files, code..."
                            autocomplete="off"
                        />
                        <div class="search-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="11" cy="11" r="8"></circle>
                                <path d="m21 21-4.35-4.35"></path>
                            </svg>
                        </div>
                        <div class="search-loading" style="display: none;">
                            <div class="loading-spinner"></div>
                        </div>
                        <button class="search-clear" style="display: none;" title="Clear search">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    
                    <!-- Search Suggestions Dropdown -->
                    <div class="search-suggestions" id="search-suggestions" style="display: none;">
                        <div class="suggestions-header">
                            <span>Suggestions</span>
                            <button class="suggestions-clear" title="Clear suggestions">×</button>
                        </div>
                        <div class="suggestions-list" id="suggestions-list"></div>
                    </div>
                </div>
                
                <!-- Search Results -->
                <div class="search-results" id="search-results" style="display: none;">
                    <div class="results-header">
                        <div class="results-info">
                            <span class="results-count" id="results-count">0 results</span>
                            <span class="search-time" id="search-time" style="display: none;">0ms</span>
                        </div>
                        <div class="results-controls">
                            <button class="results-clear" title="Clear results">×</button>
                        </div>
                    </div>
                    
                    <div class="results-list" id="results-list"></div>
                    
                    <div class="results-footer">
                        <div class="ranking-info" id="ranking-info" style="display: none;">
                            <span>Ranked by relevance using FTS + HNSW algorithms</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Get references to elements
        this.searchInput = this.container.querySelector('#real-time-search-input');
        this.searchIcon = this.container.querySelector('.search-icon');
        this.searchLoading = this.container.querySelector('.search-loading');
        this.searchClear = this.container.querySelector('.search-clear');
        this.suggestionsContainer = this.container.querySelector('#search-suggestions');
        this.suggestionsList = this.container.querySelector('#suggestions-list');
        this.resultsContainer = this.container.querySelector('#search-results');
        this.resultsList = this.container.querySelector('#results-list');
        this.resultsCount = this.container.querySelector('#results-count');
        this.searchTime = this.container.querySelector('#search-time');
        this.rankingInfo = this.container.querySelector('#ranking-info');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        if (!this.searchInput) return;

        // Input events
        this.searchInput.addEventListener('input', (e) => {
            this.handleInput(e.target.value);
        });

        this.searchInput.addEventListener('focus', () => {
            this.showSuggestions();
        });

        this.searchInput.addEventListener('blur', () => {
            // Delay hiding suggestions to allow clicking on them
            setTimeout(() => this.hideSuggestions(), 200);
        });

        this.searchInput.addEventListener('keydown', (e) => {
            this.handleKeydown(e);
        });

        // Clear button
        this.searchClear.addEventListener('click', () => {
            this.clearSearch();
        });

        // Suggestions clear button
        const suggestionsClear = this.container.querySelector('.suggestions-clear');
        if (suggestionsClear) {
            suggestionsClear.addEventListener('click', () => {
                this.hideSuggestions();
            });
        }

        // Results clear button
        const resultsClear = this.container.querySelector('.results-clear');
        if (resultsClear) {
            resultsClear.addEventListener('click', () => {
                this.clearResults();
            });
        }

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.hideSuggestions();
            }
        });
    }

    /**
     * Handle input changes
     */
    handleInput(value) {
        this.currentQuery = value.trim();
        
        // Clear previous timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        // Show/hide clear button
        this.searchClear.style.display = this.currentQuery ? 'block' : 'none';

        if (this.currentQuery.length === 0) {
            this.clearResults();
            this.hideSuggestions();
            return;
        }

        if (this.currentQuery.length < this.config.minQueryLength) {
            this.hideSuggestions();
            return;
        }

        // Debounced search
        this.searchTimeout = setTimeout(() => {
            this.performSearch();
            this.updateSuggestions();
        }, this.config.debounceDelay);
    }

    /**
     * Handle keyboard navigation
     */
    handleKeydown(e) {
        const suggestions = this.suggestionsList.querySelectorAll('.suggestion-item');
        const activeSuggestion = this.suggestionsList.querySelector('.suggestion-item.active');
        let activeIndex = -1;

        if (activeSuggestion) {
            activeIndex = Array.from(suggestions).indexOf(activeSuggestion);
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (suggestions.length > 0) {
                    const nextIndex = (activeIndex + 1) % suggestions.length;
                    this.setActiveSuggestion(nextIndex);
                }
                break;

            case 'ArrowUp':
                e.preventDefault();
                if (suggestions.length > 0) {
                    const prevIndex = activeIndex <= 0 ? suggestions.length - 1 : activeIndex - 1;
                    this.setActiveSuggestion(prevIndex);
                }
                break;

            case 'Enter':
                e.preventDefault();
                if (activeSuggestion) {
                    this.selectSuggestion(activeSuggestion.textContent);
                } else {
                    this.performSearch();
                }
                break;

            case 'Escape':
                this.hideSuggestions();
                this.searchInput.blur();
                break;
        }
    }

    /**
     * Set active suggestion
     */
    setActiveSuggestion(index) {
        const suggestions = this.suggestionsList.querySelectorAll('.suggestion-item');
        suggestions.forEach((item, i) => {
            item.classList.toggle('active', i === index);
        });
    }

    /**
     * Select a suggestion
     */
    selectSuggestion(suggestion) {
        this.searchInput.value = suggestion;
        this.currentQuery = suggestion;
        this.hideSuggestions();
        this.performSearch();
    }

    /**
     * Perform search with enhanced prompt extraction
     */
    async performSearch() {
        if (!this.searchEngine || this.isSearching) return;

        this.isSearching = true;
        this.showLoading(true);
        this.hideSuggestions();

        try {
            const startTime = performance.now();
            
            // Extract prompts from query if enabled
            if (this.config.enablePromptExtraction) {
                this.extractedPrompts = this.extractPromptsFromQuery(this.currentQuery);
                if (this.extractedPrompts.length > 0) {
                    this.displayExtractedPrompts(this.extractedPrompts);
                }
            }
            
            const searchResults = await this.searchEngine.search(this.currentQuery, {
                limit: this.config.maxResults,
                includeFTS: true,
                includeVectorSearch: true,
                boostRecent: true,
                extractedPrompts: this.extractedPrompts
            });

            const searchTime = performance.now() - startTime;
            this.lastSearchTime = searchTime;

            this.results = searchResults.results || [];
            this.displayResults(searchResults, searchTime);
            this.onResults(this.results, searchResults);

        } catch (error) {
            console.error('Search error:', error);
            this.showError('Search failed. Please try again.');
        } finally {
            this.isSearching = false;
            this.showLoading(false);
        }
    }

    /**
     * Extract prompts from search query using comprehensive patterns
     */
    extractPromptsFromQuery(query) {
        const prompts = [];
        
        this.promptPatterns.forEach(({ pattern, type }) => {
            const matches = [...query.matchAll(pattern)];
            matches.forEach(match => {
                prompts.push({
                    type: type,
                    content: match[1]?.trim(),
                    fullMatch: match[0],
                    timestamp: new Date().toISOString(),
                    source: 'search_query'
                });
            });
        });
        
        return prompts;
    }

    /**
     * Display extracted prompts in the search interface
     */
    displayExtractedPrompts(prompts) {
        let promptContainer = this.container.querySelector('.extracted-prompts');
        if (!promptContainer) {
            const searchContainer = this.container.querySelector('.search-input-container');
            if (searchContainer) {
                const promptDiv = document.createElement('div');
                promptDiv.className = 'extracted-prompts';
                promptDiv.innerHTML = `
                    <div class="prompts-header">
                        <span class="prompts-title">Extracted Prompts (${prompts.length})</span>
                    </div>
                    <div class="prompts-list"></div>
                `;
                searchContainer.appendChild(promptDiv);
            }
            promptContainer = this.container.querySelector('.extracted-prompts');
        }
        
        const promptsList = promptContainer?.querySelector('.prompts-list');
        if (promptsList) {
            promptsList.innerHTML = prompts.map(prompt => `
                <div class="prompt-item" data-type="${prompt.type}">
                    <div class="prompt-type">${this.getPromptTypeLabel(prompt.type)}</div>
                    <div class="prompt-content">${this.escapeHtml(prompt.content)}</div>
                    <div class="prompt-actions">
                        <button class="btn btn-sm btn-primary" onclick="realTimeSearch.searchPrompt('${this.escapeHtml(prompt.content)}')">
                            Search This
                        </button>
                    </div>
                </div>
            `).join('');
        }
    }

    /**
     * Get user-friendly label for prompt type
     */
    getPromptTypeLabel(type) {
        const labels = {
            'direct_prompt': 'Direct Prompt',
            'user_directive': 'User Directive',
            'request': 'Request',
            'cursor_directive': 'Cursor Directive',
            'ai_directive': 'AI Directive',
            'code_comment_prompt': 'Code Comment',
            'python_comment_prompt': 'Python Comment',
            'task_definition': 'Task Definition',
            'goal_definition': 'Goal Definition'
        };
        return labels[type] || type;
    }

    /**
     * Escape HTML for safe display
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Search for a specific prompt
     */
    searchPrompt(promptContent) {
        const searchInput = this.container.querySelector('.search-input');
        if (searchInput) {
            searchInput.value = promptContent;
            this.currentQuery = promptContent;
            this.performSearch();
        }
    }

    /**
     * Update suggestions
     */
    async updateSuggestions() {
        if (!this.searchEngine) return;

        try {
            this.suggestions = this.searchEngine.getSearchSuggestions(this.currentQuery);
            this.displaySuggestions();
        } catch (error) {
            console.error('Error updating suggestions:', error);
        }
    }

    /**
     * Display search results
     */
    displayResults(searchResults, searchTime) {
        if (!this.resultsContainer || !this.resultsList) return;

        // Safely handle searchResults structure
        const totalResults = searchResults?.total || this.results?.length || 0;
        const actualSearchTime = searchTime || searchResults?.searchTime || 0;

        // Update results count
        if (this.resultsCount) {
            this.resultsCount.textContent = `${totalResults} result${totalResults !== 1 ? 's' : ''}`;
        }

        // Update search time
        if (this.config.showSearchTime && actualSearchTime > 0 && this.searchTime) {
            this.searchTime.textContent = `${actualSearchTime.toFixed(0)}ms`;
            this.searchTime.style.display = 'inline';
        }

        // Show ranking info
        if (this.config.showRanking) {
            this.rankingInfo.style.display = 'block';
        }

        // Clear previous results
        this.resultsList.innerHTML = '';

        // Display results
        if (this.results.length === 0) {
            this.resultsList.innerHTML = `
                <div class="no-results">
                    <div class="no-results-icon"></div>
                    <div class="no-results-text">No results found for "${this.currentQuery}"</div>
                    <div class="no-results-suggestions">
                        <p>Try:</p>
                        <ul>
                            <li>Different keywords</li>
                            <li>More general terms</li>
                            <li>Checking spelling</li>
                        </ul>
                    </div>
                </div>
            `;
        } else {
            this.results.forEach((result, index) => {
                const resultElement = this.createResultElement(result, index);
                this.resultsList.appendChild(resultElement);
            });
        }

        // Show results container
        this.resultsContainer.style.display = 'block';
    }

    /**
     * Create result element
     */
    createResultElement(result, index) {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'result-item';
        resultDiv.dataset.docId = result.docId;

        // Calculate relevance percentage
        const relevancePercent = Math.min(Math.round((result.finalScore || result.combinedScore || result.score) * 100), 100);

        // Highlight matched fields
        const matchedFieldsText = result.matchedFields && result.matchedFields.length > 0 
            ? ` • Matched: ${result.matchedFields.join(', ')}` 
            : '';

        resultDiv.innerHTML = `
            <div class="result-header">
                <div class="result-title">
                    <span class="result-rank">#${index + 1}</span>
                    <span class="result-doc-id">${result.docId}</span>
                    <span class="result-relevance">${relevancePercent}% match</span>
                </div>
                <div class="result-score">
                    <div class="score-bar">
                        <div class="score-fill" style="width: ${relevancePercent}%"></div>
                    </div>
                </div>
            </div>
            <div class="result-content">
                <div class="result-meta">
                    <span class="search-type ${result.searchType}">${result.searchType.toUpperCase()}</span>
                    ${matchedFieldsText}
                </div>
                <div class="result-actions">
                    <button class="result-action" onclick="viewResult('${result.docId}')">View</button>
                    <button class="result-action" onclick="highlightResult('${result.docId}')">Highlight</button>
                </div>
            </div>
        `;

        // Add click handler
        resultDiv.addEventListener('click', (e) => {
            if (!e.target.closest('.result-action')) {
                this.selectResult(result);
            }
        });

        return resultDiv;
    }

    /**
     * Display suggestions
     */
    displaySuggestions() {
        if (!this.suggestionsContainer || !this.suggestionsList) return;

        if (this.suggestions.length === 0) {
            this.hideSuggestions();
            return;
        }

        // Clear previous suggestions
        this.suggestionsList.innerHTML = '';

        // Add suggestions
        this.suggestions.slice(0, this.config.maxSuggestions).forEach(suggestion => {
            const suggestionDiv = document.createElement('div');
            suggestionDiv.className = 'suggestion-item';
            suggestionDiv.textContent = suggestion;
            suggestionDiv.addEventListener('click', () => {
                this.selectSuggestion(suggestion);
            });
            this.suggestionsList.appendChild(suggestionDiv);
        });

        // Show suggestions
        this.suggestionsContainer.style.display = 'block';
    }

    /**
     * Show/hide loading state
     */
    showLoading(show) {
        if (this.searchLoading) {
            this.searchLoading.style.display = show ? 'block' : 'none';
        }
        if (this.searchIcon) {
            this.searchIcon.style.display = show ? 'none' : 'block';
        }
    }

    /**
     * Show suggestions
     */
    showSuggestions() {
        if (this.suggestions.length > 0) {
            this.suggestionsContainer.style.display = 'block';
        }
    }

    /**
     * Hide suggestions
     */
    hideSuggestions() {
        if (this.suggestionsContainer) {
            this.suggestionsContainer.style.display = 'none';
        }
    }

    /**
     * Clear search
     */
    clearSearch() {
        this.searchInput.value = '';
        this.currentQuery = '';
        this.searchClear.style.display = 'none';
        this.clearResults();
        this.hideSuggestions();
    }

    /**
     * Clear results
     */
    clearResults() {
        if (this.resultsContainer) {
            this.resultsContainer.style.display = 'none';
        }
        this.results = [];
        this.onResults([], null);
    }

    /**
     * Show error message
     */
    showError(message) {
        if (this.resultsList) {
            this.resultsList.innerHTML = `
                <div class="search-error">
                    <div class="error-icon"></div>
                    <div class="error-message">${message}</div>
                </div>
            `;
        }
        if (this.resultsContainer) {
            this.resultsContainer.style.display = 'block';
        }
    }

    /**
     * Select a result
     */
    selectResult(result) {
        console.log('Selected result:', result);
        // This can be customized based on the application needs
        this.onResults([result], { selected: result });
    }

    /**
     * Update search engine
     */
    setSearchEngine(searchEngine) {
        this.searchEngine = searchEngine;
    }

    /**
     * Get current query
     */
    getCurrentQuery() {
        return this.currentQuery;
    }

    /**
     * Get current results
     */
    getCurrentResults() {
        return this.results;
    }

    /**
     * Focus search input
     */
    focus() {
        if (this.searchInput) {
            this.searchInput.focus();
        }
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
}

// Global functions for result actions
window.viewResult = function(docId) {
    console.log('View result:', docId);
    // Implement view functionality
};

window.highlightResult = function(docId) {
    console.log('Highlight result:', docId);
    // Implement highlight functionality
};

// Export for browser environment
if (typeof window !== 'undefined') {
    window.RealTimeSearch = RealTimeSearch;
}
