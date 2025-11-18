/**
 * Enhanced Prompt Display System
 * Comprehensive prompt display with modals, threading, and analytics
 */

class PromptDisplaySystem {
  constructor() {
    this.activeModals = new Map();
    this.promptCache = new Map();
    this.threadCache = new Map();
    this.analytics = {
      views: 0,
      interactions: 0,
      searches: 0
    };
    
    this.initializeDisplaySystem();
  }

  /**
   * Initialize the display system
   */
  initializeDisplaySystem() {
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.setupSearchSystem();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Global click handler for prompt elements
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('prompt-trigger')) {
        const promptId = e.target.dataset.promptId;
        this.showPromptModal(promptId);
      }
    });

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'p':
            e.preventDefault();
            this.showPromptSearch();
            break;
          case 't':
            e.preventDefault();
            this.showThreadView();
            break;
        }
      }
    });
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    // Additional keyboard shortcuts can be added here
  }

  /**
   * Setup search system
   */
  setupSearchSystem() {
    // Initialize search functionality
    this.searchIndex = new Map();
    this.searchResults = [];
  }

  /**
   * Show thread view
   */
  showThreadView() {
    if (window.switchView && typeof window.switchView === 'function') {
      window.switchView('threads');
    } else {
      console.warn('[PromptDisplaySystem] switchView not available');
    }
  }

  /**
   * Show prompt search
   */
  showPromptSearch() {
    // Open search palette if available
    if (window.openSearchPalette && typeof window.openSearchPalette === 'function') {
      window.openSearchPalette();
    } else {
      console.warn('[PromptDisplaySystem] openSearchPalette not available');
    }
  }

  /**
   * Show prompt modal with enhanced display
   */
  showPromptModal(promptId) {
    try {
      // Get prompt data
      const prompt = this.getPromptData(promptId);
      if (!prompt) {
        console.error('Prompt not found:', promptId);
        return;
      }

      // Create modal HTML
      const modalHTML = this.createPromptModalHTML(prompt);
      
      // Create and show modal
      const modal = this.createModal('prompt-modal', modalHTML);
      this.activeModals.set('prompt-modal', modal);
      
      // Update analytics
      this.analytics.views++;
      
      // Show modal
      this.showModal(modal);
      
      // Setup modal interactions
      this.setupPromptModalInteractions(modal, prompt);
      
    } catch (error) {
      console.error('Error showing prompt modal:', error);
    }
  }

  /**
   * Create prompt modal HTML
   */
  createPromptModalHTML(prompt) {
    const thread = this.getThreadData(prompt.threadId);
    const linkedEvents = this.getLinkedEvents(prompt.linkedEvents);
    const linkedFiles = this.getLinkedFiles(prompt.linkedFiles);
    
    return `
      <div class="prompt-modal-content">
        <div class="prompt-modal-header">
          <h2>Prompt Details</h2>
          <div class="prompt-meta">
            <span class="prompt-id">ID: ${prompt.id}</span>
            <span class="prompt-timestamp">${new Date(prompt.timestamp).toLocaleString()}</span>
          </div>
          <button class="close-btn" onclick="promptDisplaySystem.closeModal('prompt-modal')">&times;</button>
        </div>
        
        <div class="prompt-modal-body">
          <!-- Prompt Content -->
          <div class="prompt-content-section">
            <h3>Prompt Content</h3>
            <div class="prompt-content">
              <pre class="prompt-text">${this.escapeHtml(prompt.content)}</pre>
            </div>
          </div>
          
          <!-- Prompt Analysis -->
          <div class="prompt-analysis-section">
            <h3>Analysis</h3>
            <div class="analysis-grid">
              <div class="analysis-item">
                <label>Intent:</label>
                <span class="intent-badge intent-${prompt.metadata.intent}">${prompt.metadata.intent}</span>
              </div>
              <div class="analysis-item">
                <label>Complexity:</label>
                <span class="complexity-badge complexity-${prompt.metadata.complexity}">${prompt.metadata.complexity}</span>
              </div>
              <div class="analysis-item">
                <label>Method:</label>
                <span class="method-badge">${prompt.metadata.method}</span>
              </div>
              <div class="analysis-item">
                <label>Source:</label>
                <span class="source-badge">${prompt.metadata.source}</span>
              </div>
            </div>
          </div>
          
          <!-- Keywords -->
          <div class="keywords-section">
            <h3>Keywords</h3>
            <div class="keywords-list">
              ${prompt.metadata.keywords.map(keyword => 
                `<span class="keyword-tag">${keyword}</span>`
              ).join('')}
            </div>
          </div>
          
          <!-- Patterns -->
          <div class="patterns-section">
            <h3>Patterns</h3>
            <div class="patterns-list">
              ${prompt.metadata.patterns.map(pattern => 
                `<span class="pattern-tag">${pattern}</span>`
              ).join('')}
            </div>
          </div>
          
          <!-- Thread Information -->
          ${thread ? `
            <div class="thread-section">
              <h3>Thread Information</h3>
              <div class="thread-info">
                <div class="thread-meta">
                  <span>Thread ID: ${thread.id}</span>
                  <span>Total Prompts: ${thread.metadata.totalPrompts}</span>
                  <span>Last Activity: ${new Date(thread.metadata.lastActivity).toLocaleString()}</span>
                </div>
                <button class="btn btn-secondary" onclick="promptDisplaySystem.showThreadModal('${thread.id}')">
                  View Thread
                </button>
              </div>
            </div>
          ` : ''}
          
          <!-- Linked Events -->
          ${linkedEvents.length > 0 ? `
            <div class="linked-events-section">
              <h3>Linked Events</h3>
              <div class="events-list">
                ${linkedEvents.map(event => `
                  <div class="event-item">
                    <span class="event-type">${event.type}</span>
                    <span class="event-timestamp">${new Date(event.timestamp).toLocaleString()}</span>
                    <button class="btn btn-sm" onclick="promptDisplaySystem.showEventModal('${event.id}')">
                      View Event
                    </button>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          <!-- Linked Files -->
          ${linkedFiles.length > 0 ? `
            <div class="linked-files-section">
              <h3>Linked Files</h3>
              <div class="files-list">
                ${linkedFiles.map(file => `
                  <div class="file-item">
                    <span class="file-path">${file}</span>
                    <button class="btn btn-sm" onclick="promptDisplaySystem.showFileModal('${file}')">
                      View File
                    </button>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          <!-- Context Information -->
          <div class="context-section">
            <h3>Context</h3>
            <div class="context-info">
              <pre class="context-json">${JSON.stringify(prompt.context, null, 2)}</pre>
            </div>
          </div>
        </div>
        
        <div class="prompt-modal-footer">
          <button class="btn btn-primary" onclick="promptDisplaySystem.exportPrompt('${prompt.id}')">
            Export Prompt
          </button>
          <button class="btn btn-secondary" onclick="promptDisplaySystem.sharePrompt('${prompt.id}')">
            Share Prompt
          </button>
          <button class="btn btn-secondary" onclick="promptDisplaySystem.analyzePrompt('${prompt.id}')">
            Analyze Prompt
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Show thread modal
   */
  showThreadModal(threadId) {
    const thread = this.getThreadData(threadId);
    if (!thread) {
      console.error('Thread not found:', threadId);
      return;
    }

    const modalHTML = this.createThreadModalHTML(thread);
    const modal = this.createModal('thread-modal', modalHTML);
    this.activeModals.set('thread-modal', modal);
    this.showModal(modal);
  }

  /**
   * Create thread modal HTML
   */
  createThreadModalHTML(thread) {
    return `
      <div class="thread-modal-content">
        <div class="thread-modal-header">
          <h2>Thread: ${thread.id}</h2>
          <button class="close-btn" onclick="promptDisplaySystem.closeModal('thread-modal')">&times;</button>
        </div>
        
        <div class="thread-modal-body">
          <div class="thread-info">
            <div class="thread-meta">
              <span>Session ID: ${thread.sessionId}</span>
              <span>Start Time: ${new Date(thread.startTime).toLocaleString()}</span>
              <span>Status: ${thread.status}</span>
            </div>
          </div>
          
          <div class="thread-prompts">
            <h3>Prompts in Thread</h3>
            <div class="prompts-list">
              ${thread.prompts.map(prompt => `
                <div class="thread-prompt-item">
                  <div class="prompt-preview">
                    <span class="prompt-timestamp">${new Date(prompt.timestamp).toLocaleString()}</span>
                    <span class="prompt-intent">${prompt.metadata.intent}</span>
                    <span class="prompt-complexity">${prompt.metadata.complexity}</span>
                  </div>
                  <div class="prompt-content-preview">
                    ${this.truncateText(prompt.content, 100)}
                  </div>
                  <button class="btn btn-sm" onclick="promptDisplaySystem.showPromptModal('${prompt.id}')">
                    View Full Prompt
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Show prompt search
   */
  showPromptSearch() {
    const searchHTML = `
      <div class="prompt-search-modal">
        <div class="search-header">
          <h2>Search Prompts</h2>
          <button class="close-btn" onclick="promptDisplaySystem.closeModal('search-modal')">&times;</button>
        </div>
        
        <div class="search-body">
          <div class="search-input">
            <input type="text" id="prompt-search-input" placeholder="Search prompts..." />
            <button class="btn btn-primary" onclick="promptDisplaySystem.performSearch()">Search</button>
          </div>
          
          <div class="search-filters">
            <select id="intent-filter">
              <option value="">All Intents</option>
              <option value="data_visualization">Data Visualization</option>
              <option value="data_analysis">Data Analysis</option>
              <option value="code_implementation">Code Implementation</option>
              <option value="debugging">Debugging</option>
            </select>
            
            <select id="complexity-filter">
              <option value="">All Complexity</option>
              <option value="simple">Simple</option>
              <option value="medium">Medium</option>
              <option value="complex">Complex</option>
            </select>
          </div>
          
          <div class="search-results" id="search-results">
            <!-- Search results will be populated here -->
          </div>
        </div>
      </div>
    `;
    
    const modal = this.createModal('search-modal', searchHTML);
    this.activeModals.set('search-modal', modal);
    this.showModal(modal);
    
    // Focus search input
    setTimeout(() => {
      document.getElementById('prompt-search-input').focus();
    }, 100);
  }

  /**
   * Perform prompt search
   */
  performSearch() {
    const query = document.getElementById('prompt-search-input').value;
    const intentFilter = document.getElementById('intent-filter').value;
    const complexityFilter = document.getElementById('complexity-filter').value;
    
    // Perform search logic here
    this.analytics.searches++;
    
    // Update search results
    this.updateSearchResults(query, intentFilter, complexityFilter);
  }

  /**
   * Update search results
   */
  updateSearchResults(query, intentFilter, complexityFilter) {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;
    
    // Mock search results - replace with actual search logic
    const mockResults = [
      {
        id: 'prompt-1',
        content: 'Create a data visualization for sales data',
        intent: 'data_visualization',
        complexity: 'medium',
        timestamp: new Date().toISOString()
      }
    ];
    
    const resultsHTML = mockResults.map(result => `
      <div class="search-result-item">
        <div class="result-content">
          <div class="result-preview">${this.truncateText(result.content, 150)}</div>
          <div class="result-meta">
            <span class="result-intent">${result.intent}</span>
            <span class="result-complexity">${result.complexity}</span>
            <span class="result-timestamp">${new Date(result.timestamp).toLocaleString()}</span>
          </div>
        </div>
        <button class="btn btn-sm" onclick="promptDisplaySystem.showPromptModal('${result.id}')">
          View Prompt
        </button>
      </div>
    `).join('');
    
    resultsContainer.innerHTML = resultsHTML;
  }

  /**
   * Create modal
   */
  createModal(modalId, content) {
    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'prompt-modal';
    modal.innerHTML = content;
    return modal;
  }

  /**
   * Show modal
   */
  showModal(modal) {
    document.body.appendChild(modal);
    modal.style.display = 'block';
    
    // Add animation
    setTimeout(() => {
      modal.classList.add('modal-show');
    }, 10);
  }

  /**
   * Close modal
   */
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('modal-show');
      setTimeout(() => {
        modal.remove();
        this.activeModals.delete(modalId);
      }, 300);
    }
  }

  /**
   * Setup prompt modal interactions
   */
  setupPromptModalInteractions(modal, prompt) {
    // Add any specific interactions for the prompt modal
  }

  /**
   * Get prompt data (mock implementation)
   */
  getPromptData(promptId) {
    // Mock data - replace with actual data retrieval
    return {
      id: promptId,
      correlationId: 'corr-123',
      timestamp: new Date().toISOString(),
      content: 'Create a data visualization for sales data using matplotlib',
      context: {
        source: 'clipboard',
        filePath: '/path/to/file.py'
      },
      metadata: {
        method: 'clipboard',
        source: 'clipboard',
        filePath: '/path/to/file.py',
        sessionId: 'session-123',
        intent: 'data_visualization',
        complexity: 'medium',
        keywords: ['data', 'visualization', 'matplotlib', 'sales'],
        patterns: ['direct_prompt', 'code_block']
      },
      status: 'captured',
      linkedEvents: ['event-1', 'event-2'],
      linkedFiles: ['/path/to/file.py'],
      threadId: 'thread-123'
    };
  }

  /**
   * Get thread data (mock implementation)
   */
  getThreadData(threadId) {
    return {
      id: threadId,
      sessionId: 'session-123',
      startTime: new Date().toISOString(),
      prompts: [],
      events: [],
      status: 'active',
      metadata: {
        totalPrompts: 3,
        lastActivity: new Date().toISOString()
      }
    };
  }

  /**
   * Get linked events (mock implementation)
   */
  getLinkedEvents(eventIds) {
    return eventIds.map(id => ({
      id: id,
      type: 'code_change',
      timestamp: new Date().toISOString()
    }));
  }

  /**
   * Get linked files (mock implementation)
   */
  getLinkedFiles(filePaths) {
    return filePaths;
  }

  /**
   * Utility functions
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Export prompt
   */
  exportPrompt(promptId) {
    const prompt = this.getPromptData(promptId);
    const exportData = {
      prompt: prompt,
      exportedAt: new Date().toISOString(),
      format: 'json'
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-${promptId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Share prompt
   */
  sharePrompt(promptId) {
    const prompt = this.getPromptData(promptId);
    const shareText = `Prompt: ${prompt.content}\nIntent: ${prompt.metadata.intent}\nComplexity: ${prompt.metadata.complexity}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Prompt Share',
        text: shareText
      });
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(shareText);
      alert('Prompt copied to clipboard');
    }
  }

  /**
   * Analyze prompt
   */
  analyzePrompt(promptId) {
    const prompt = this.getPromptData(promptId);
    
    // Perform analysis
    const analysis = {
      wordCount: prompt.content.split(/\s+/).length,
      sentenceCount: prompt.content.split(/[.!?]+/).length,
      readabilityScore: this.calculateReadability(prompt.content),
      sentimentScore: this.calculateSentiment(prompt.content),
      technicalTerms: this.extractTechnicalTerms(prompt.content)
    };
    
    // Show analysis results
    alert(`Analysis Results:\nWord Count: ${analysis.wordCount}\nSentences: ${analysis.sentenceCount}\nReadability: ${analysis.readabilityScore}`);
  }

  calculateReadability(text) {
    // Simple readability calculation
    const words = text.split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).length;
    return Math.round((0.39 * (words / sentences)) + (11.8 * (words / sentences)) - 15.59);
  }

  calculateSentiment(text) {
    // Simple sentiment analysis
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'disappointing'];
    
    const words = text.toLowerCase().split(/\s+/);
    const positiveCount = words.filter(word => positiveWords.includes(word)).length;
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;
    
    return positiveCount - negativeCount;
  }

  extractTechnicalTerms(text) {
    const technicalTerms = ['function', 'class', 'method', 'variable', 'array', 'object', 'API', 'database', 'algorithm'];
    const words = text.toLowerCase().split(/\s+/);
    return words.filter(word => technicalTerms.includes(word));
  }
}

// Initialize global instance
window.promptDisplaySystem = new PromptDisplaySystem();
