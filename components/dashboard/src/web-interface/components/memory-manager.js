/**
 * Memory Manager Component
 * Handles memory creation, execution, and management in the dashboard
 */

class MemoryManager {
  constructor() {
    this.memories = [];
    this.currentMemory = null;
    this.isLoading = false;
    this.searchQuery = '';
    this.filters = {
      category: 'all',
      type: 'all',
      tags: []
    };
    
    this.initializeUI();
    this.loadMemories();
  }

  /**
   * Initialize memory management UI
   */
  initializeUI() {
    // Create memory management container
    const container = document.createElement('div');
    container.id = 'memory-manager';
    container.className = 'memory-manager-container';
    container.innerHTML = `
      <div class="memory-header">
        <h2>Memory Management</h2>
        <div class="memory-controls">
          <button id="create-memory-btn" class="btn btn-primary">Create Memory</button>
          <button id="refresh-memories-btn" class="btn btn-secondary">Refresh</button>
          <button id="export-memories-btn" class="btn btn-outline">Export</button>
        </div>
      </div>
      
      <div class="memory-filters">
        <div class="search-box">
          <input type="text" id="memory-search" placeholder="Search memories..." />
          <button id="search-memories-btn" class="btn btn-sm">Search</button>
        </div>
        
        <div class="filter-controls">
          <select id="category-filter">
            <option value="all">All Categories</option>
            <option value="session">Session</option>
            <option value="analysis">Analysis</option>
            <option value="workflow">Workflow</option>
            <option value="template">Template</option>
          </select>
          
          <select id="type-filter">
            <option value="all">All Types</option>
            <option value="integration">Integration</option>
            <option value="notebook">Notebook</option>
            <option value="session">Session</option>
            <option value="template">Template</option>
          </select>
        </div>
      </div>
      
      <div class="memory-stats">
        <div class="stat-item">
          <span class="stat-label">Total Memories:</span>
          <span class="stat-value" id="total-memories">0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Executed:</span>
          <span class="stat-value" id="executed-memories">0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Quality Score:</span>
          <span class="stat-value" id="avg-quality">0.0</span>
        </div>
      </div>
      
      <div class="memory-list" id="memory-list">
        <div class="loading-state">Loading memories...</div>
      </div>
      
      <div class="memory-detail" id="memory-detail" style="display: none;">
        <div class="memory-detail-header">
          <h3 id="memory-title">Memory Details</h3>
          <button id="close-memory-detail" class="btn btn-sm">×</button>
        </div>
        <div class="memory-detail-content" id="memory-detail-content">
          <!-- Memory details will be populated here -->
        </div>
      </div>
    `;

    // Add to dashboard
    const dashboard = document.querySelector('.main-content .container');
    if (dashboard) {
      dashboard.appendChild(container);
    }

    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Create memory button
    document.getElementById('create-memory-btn')?.addEventListener('click', () => {
      this.showCreateMemoryDialog();
    });

    // Refresh memories button
    document.getElementById('refresh-memories-btn')?.addEventListener('click', () => {
      this.loadMemories();
    });

    // Export memories button
    document.getElementById('export-memories-btn')?.addEventListener('click', () => {
      this.exportMemories();
    });

    // Search functionality
    document.getElementById('search-memories-btn')?.addEventListener('click', () => {
      this.searchMemories();
    });

    document.getElementById('memory-search')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.searchMemories();
      }
    });

    // Filter controls
    document.getElementById('category-filter')?.addEventListener('change', () => {
      this.applyFilters();
    });

    document.getElementById('type-filter')?.addEventListener('change', () => {
      this.applyFilters();
    });

    // Close memory detail
    document.getElementById('close-memory-detail')?.addEventListener('click', () => {
      this.hideMemoryDetail();
    });
  }

  /**
   * Load memories from API
   */
  async loadMemories() {
    try {
      this.isLoading = true;
      this.updateLoadingState(true);

      const response = await fetch('/api/memories');
      const data = await response.json();

      if (data.success) {
        this.memories = data.memories || [];
        this.renderMemories();
        this.updateStats();
      } else {
        this.showError('Failed to load memories: ' + data.error);
      }
    } catch (error) {
      console.error('Error loading memories:', error);
      this.showError('Error loading memories: ' + error.message);
    } finally {
      this.isLoading = false;
      this.updateLoadingState(false);
    }
  }

  /**
   * Search memories
   */
  async searchMemories() {
    try {
      const query = document.getElementById('memory-search')?.value || '';
      if (!query.trim()) {
        this.loadMemories();
        return;
      }

      this.isLoading = true;
      this.updateLoadingState(true);

      const response = await fetch(`/api/memories/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (data.success) {
        this.memories = data.memories || [];
        this.renderMemories();
        this.updateStats();
      } else {
        this.showError('Search failed: ' + data.error);
      }
    } catch (error) {
      console.error('Error searching memories:', error);
      this.showError('Search error: ' + error.message);
    } finally {
      this.isLoading = false;
      this.updateLoadingState(false);
    }
  }

  /**
   * Apply filters to memories
   */
  applyFilters() {
    const category = document.getElementById('category-filter')?.value || 'all';
    const type = document.getElementById('type-filter')?.value || 'all';

    let filteredMemories = this.memories;

    if (category !== 'all') {
      filteredMemories = filteredMemories.filter(m => m.category === category);
    }

    if (type !== 'all') {
      filteredMemories = filteredMemories.filter(m => m.type === type);
    }

    this.renderMemories(filteredMemories);
  }

  /**
   * Render memories list
   */
  renderMemories(memories = this.memories) {
    const container = document.getElementById('memory-list');
    if (!container) return;

    if (memories.length === 0) {
      container.innerHTML = '<div class="empty-state">No memories found</div>';
      return;
    }

    const memoriesHTML = memories.map(memory => this.renderMemoryCard(memory)).join('');
    container.innerHTML = memoriesHTML;

    // Add click handlers for memory cards
    container.querySelectorAll('.memory-card').forEach(card => {
      card.addEventListener('click', () => {
        const memoryId = card.dataset.memoryId;
        this.showMemoryDetail(memoryId);
      });
    });

    // Add click handlers for action buttons
    container.querySelectorAll('.memory-actions button').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = button.dataset.action;
        const memoryId = button.dataset.memoryId;
        this.handleMemoryAction(action, memoryId);
      });
    });
  }

  /**
   * Render individual memory card
   */
  renderMemoryCard(memory) {
    const quality = memory.metadata?.quality || 0;
    const qualityClass = quality > 0.7 ? 'high' : quality > 0.4 ? 'medium' : 'low';
    const executionCount = memory.executionCount || 0;
    const lastExecuted = memory.lastExecuted ? new Date(memory.lastExecuted).toLocaleDateString() : 'Never';

    return `
      <div class="memory-card" data-memory-id="${memory.id}">
        <div class="memory-card-header">
          <h4 class="memory-title">${memory.title || 'Untitled Memory'}</h4>
          <div class="memory-meta">
            <span class="memory-category">${memory.category || 'general'}</span>
            <span class="memory-type">${memory.type || 'unknown'}</span>
          </div>
        </div>
        
        <div class="memory-card-content">
          <p class="memory-description">${memory.description || 'No description available'}</p>
          
          <div class="memory-tags">
            ${(memory.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('')}
          </div>
          
          <div class="memory-stats">
            <div class="stat">
              <span class="stat-label">Quality:</span>
              <span class="stat-value quality-${qualityClass}">${(quality * 100).toFixed(1)}%</span>
            </div>
            <div class="stat">
              <span class="stat-label">Executions:</span>
              <span class="stat-value">${executionCount}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Last Executed:</span>
              <span class="stat-value">${lastExecuted}</span>
            </div>
          </div>
        </div>
        
        <div class="memory-actions">
          <button class="btn btn-sm btn-primary" data-action="execute" data-memory-id="${memory.id}">
            Execute
          </button>
          <button class="btn btn-sm btn-secondary" data-action="view" data-memory-id="${memory.id}">
            View
          </button>
          <button class="btn btn-sm btn-danger" data-action="delete" data-memory-id="${memory.id}">
            Delete
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Show memory detail
   */
  async showMemoryDetail(memoryId) {
    try {
      const memory = this.memories.find(m => m.id === memoryId);
      if (!memory) {
        this.showError('Memory not found');
        return;
      }

      this.currentMemory = memory;
      this.renderMemoryDetail(memory);
      
      const detailContainer = document.getElementById('memory-detail');
      if (detailContainer) {
        detailContainer.style.display = 'block';
      }
    } catch (error) {
      console.error('Error showing memory detail:', error);
      this.showError('Error loading memory details');
    }
  }

  /**
   * Render memory detail
   */
  renderMemoryDetail(memory) {
    const content = document.getElementById('memory-detail-content');
    if (!content) return;

    const quality = memory.metadata?.quality || 0;
    const commands = memory.executable?.commands || [];
    const executionHistory = memory.executionHistory || [];

    content.innerHTML = `
      <div class="memory-detail-info">
        <div class="info-section">
          <h4>Basic Information</h4>
          <div class="info-grid">
            <div class="info-item">
              <label>Title:</label>
              <span>${memory.title || 'Untitled Memory'}</span>
            </div>
            <div class="info-item">
              <label>Category:</label>
              <span>${memory.category || 'general'}</span>
            </div>
            <div class="info-item">
              <label>Type:</label>
              <span>${memory.type || 'unknown'}</span>
            </div>
            <div class="info-item">
              <label>Created:</label>
              <span>${new Date(memory.created).toLocaleString()}</span>
            </div>
            <div class="info-item">
              <label>Updated:</label>
              <span>${new Date(memory.updated).toLocaleString()}</span>
            </div>
            <div class="info-item">
              <label>Quality Score:</label>
              <span class="quality-${quality > 0.7 ? 'high' : quality > 0.4 ? 'medium' : 'low'}">${(quality * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div class="info-section">
          <h4>Description</h4>
          <p>${memory.description || 'No description available'}</p>
        </div>

        <div class="info-section">
          <h4>Tags</h4>
          <div class="memory-tags">
            ${(memory.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('')}
          </div>
        </div>

        <div class="info-section">
          <h4>Executable Commands (${commands.length})</h4>
          <div class="commands-list">
            ${commands.map((cmd, index) => `
              <div class="command-item">
                <div class="command-header">
                  <span class="command-type">${cmd.type}</span>
                  <span class="command-action">${cmd.action}</span>
                </div>
                <div class="command-description">${cmd.description}</div>
                <div class="command-path">${cmd.path}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="info-section">
          <h4>Execution History (${executionHistory.length})</h4>
          <div class="execution-history">
            ${executionHistory.map(exec => `
              <div class="execution-item">
                <div class="execution-header">
                  <span class="execution-date">${new Date(exec.executed).toLocaleString()}</span>
                  <span class="execution-status ${exec.success ? 'success' : 'error'}">${exec.success ? 'Success' : 'Failed'}</span>
                </div>
                <div class="execution-stats">
                  <span>Commands: ${exec.commands.length}</span>
                  <span>Results: ${exec.results.length}</span>
                  <span>Errors: ${exec.errors.length}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="memory-detail-actions">
          <button class="btn btn-primary" onclick="memoryManager.executeMemory('${memory.id}')">
            Execute Memory
          </button>
          <button class="btn btn-secondary" onclick="memoryManager.editMemory('${memory.id}')">
            Edit Memory
          </button>
          <button class="btn btn-danger" onclick="memoryManager.deleteMemory('${memory.id}')">
            Delete Memory
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Hide memory detail
   */
  hideMemoryDetail() {
    const detailContainer = document.getElementById('memory-detail');
    if (detailContainer) {
      detailContainer.style.display = 'none';
    }
    this.currentMemory = null;
  }

  /**
   * Handle memory actions
   */
  async handleMemoryAction(action, memoryId) {
    switch (action) {
      case 'execute':
        await this.executeMemory(memoryId);
        break;
      case 'view':
        await this.showMemoryDetail(memoryId);
        break;
      case 'delete':
        await this.deleteMemory(memoryId);
        break;
    }
  }

  /**
   * Execute memory
   */
  async executeMemory(memoryId) {
    try {
      this.showLoading('Executing memory...');

      const response = await fetch(`/api/memories/${memoryId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          context: {
            timestamp: new Date().toISOString(),
            user: 'dashboard'
          }
        })
      });

      const data = await response.json();

      if (data.success) {
        this.showSuccess('Memory executed successfully');
        this.loadMemories(); // Refresh to show updated execution count
      } else {
        this.showError('Memory execution failed: ' + data.error);
      }
    } catch (error) {
      console.error('Error executing memory:', error);
      this.showError('Error executing memory: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Delete memory
   */
  async deleteMemory(memoryId) {
    if (!confirm('Are you sure you want to delete this memory?')) {
      return;
    }

    try {
      this.showLoading('Deleting memory...');

      const response = await fetch(`/api/memories/${memoryId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        this.showSuccess('Memory deleted successfully');
        this.loadMemories();
        this.hideMemoryDetail();
      } else {
        this.showError('Memory deletion failed: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting memory:', error);
      this.showError('Error deleting memory: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Show create memory dialog
   */
  showCreateMemoryDialog() {
    // This would open a dialog for creating memories from current session
    // For now, we'll show a simple prompt
    const sessionId = prompt('Enter session ID to create memory from:');
    if (sessionId) {
      this.createMemoryFromSession(sessionId);
    }
  }

  /**
   * Create memory from session
   */
  async createMemoryFromSession(sessionId) {
    try {
      this.showLoading('Creating memory...');

      const response = await fetch(`/api/session/${sessionId}/create-memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          includeMemories: true,
          includeASTAnalysis: true,
          includeKuraAnalysis: true,
          includeEmbeddingsAnalysis: true
        })
      });

      const data = await response.json();

      if (data.success) {
        this.showSuccess('Memory created successfully');
        this.loadMemories();
      } else {
        this.showError('Memory creation failed: ' + data.error);
      }
    } catch (error) {
      console.error('Error creating memory:', error);
      this.showError('Error creating memory: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Export memories
   */
  async exportMemories() {
    try {
      this.showLoading('Exporting memories...');

      const response = await fetch('/api/memories/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          format: 'json',
          includeContent: true
        })
      });

      const data = await response.json();

      if (data.success) {
        // Download the export data
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `memories-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.showSuccess('Memories exported successfully');
      } else {
        this.showError('Export failed: ' + data.error);
      }
    } catch (error) {
      console.error('Error exporting memories:', error);
      this.showError('Error exporting memories: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Update statistics
   */
  async updateStats() {
    try {
      const response = await fetch('/api/memories/stats');
      const data = await response.json();

      if (data.success) {
        const stats = data.stats;
        const totalMemoriesEl = document.getElementById('total-memories');
        const executedMemoriesEl = document.getElementById('executed-memories');
        const avgQualityEl = document.getElementById('avg-quality');
        
        if (totalMemoriesEl) totalMemoriesEl.textContent = stats.total || 0;
        if (executedMemoriesEl) executedMemoriesEl.textContent = stats.executed || 0;
        if (avgQualityEl) avgQualityEl.textContent = (stats.averageQuality || 0).toFixed(1);
      }
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }

  /**
   * Update loading state
   */
  updateLoadingState(loading) {
    const container = document.getElementById('memory-list');
    if (!container) return;

    if (loading) {
      container.innerHTML = '<div class="loading-state">Loading memories...</div>';
    }
  }

  /**
   * Show loading message
   */
  showLoading(message) {
    // Create or update loading overlay
    let overlay = document.getElementById('memory-loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'memory-loading-overlay';
      overlay.className = 'loading-overlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `<div class="loading-content">${message}</div>`;
    overlay.style.display = 'flex';
  }

  /**
   * Hide loading message
   */
  hideLoading() {
    const overlay = document.getElementById('memory-loading-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    this.showMessage(message, 'success');
  }

  /**
   * Show error message
   */
  showError(message) {
    this.showMessage(message, 'error');
  }

  /**
   * Show message
   */
  showMessage(message, type) {
    // Create message element
    const messageEl = document.createElement('div');
    messageEl.className = `message message-${type}`;
    messageEl.textContent = message;
    
    // Add to page
    document.body.appendChild(messageEl);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl);
      }
    }, 3000);
  }
}

// Initialize memory manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.memoryManager = new MemoryManager();
});

// Export for browser environment
if (typeof window !== 'undefined') {
    window.MemoryManager = MemoryManager;
}
