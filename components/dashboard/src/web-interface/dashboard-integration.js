class DashboardIntegration {
  constructor() {
    this.apiBaseUrl = '/api';
    this.activeIntegrations = new Map();
    this.qualityMetrics = new Map();
  }

  async initialize() {
    console.log('Initializing Dashboard Integration...');
    
    this.replaceBrokenButtons();
    this.addMemoryManagementInterface();
    this.addQualityMetricsDisplay();
    this.setupEventListeners();
    
    console.log('Dashboard Integration initialized');
  }

  replaceBrokenButtons() {
    const brokenButtons = document.querySelectorAll('button[onclick*="returnToContext"]');
    
    brokenButtons.forEach(button => {
      const sessionId = this.extractSessionId(button.getAttribute('onclick'));
      if (sessionId) {
        this.replaceButtonWithEnhancedOptions(button, sessionId);
      }
    });
  }

  replaceButtonWithEnhancedOptions(originalButton, sessionId) {
    const container = originalButton.parentElement;
    const enhancedContainer = document.createElement('div');
    enhancedContainer.className = 'enhanced-session-actions';
    enhancedContainer.innerHTML = `
      <div class="session-actions-header">
        <h4>Session Actions</h4>
        <span class="session-id">${sessionId}</span>
      </div>
      
      <div class="action-buttons">
        <button class="btn btn-primary btn-sm" onclick="dashboardIntegration.integrateSession('${sessionId}')">
          Dynamic Integration
        </button>
        
        <button class="btn btn-success btn-sm" onclick="dashboardIntegration.generateNotebook('${sessionId}')">
          Generate Notebook
        </button>
        
        <button class="btn btn-info btn-sm" onclick="dashboardIntegration.createMemory('${sessionId}')">
          Create Memory
        </button>
        
        <button class="btn btn-secondary btn-sm" onclick="dashboardIntegration.showSessionMetrics('${sessionId}')">
          View Metrics
        </button>
      </div>
      
      <div class="integration-status" id="status-${sessionId}">
        <div class="status-indicator">
          <span class="status-dot"></span>
          <span class="status-text">Ready</span>
        </div>
      </div>
    `;
    
    container.replaceChild(enhancedContainer, originalButton);
  }

  addMemoryManagementInterface() {
    const dashboard = document.querySelector('.dashboard-container') || document.body;
    
    const memoryInterface = document.createElement('div');
    memoryInterface.className = 'memory-management-interface';
    memoryInterface.innerHTML = `
      <div class="memory-panel">
        <div class="panel-header">
          <h3>Memory Management</h3>
          <button class="btn btn-sm btn-secondary" onclick="dashboardIntegration.toggleMemoryPanel()">
            Toggle
          </button>
        </div>
        
        <div class="panel-content" id="memory-panel-content">
          <div class="memory-stats">
            <div class="stat-item">
              <span class="stat-label">Total Memories:</span>
              <span class="stat-value" id="total-memories">0</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Active Memories:</span>
              <span class="stat-value" id="active-memories">0</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Success Rate:</span>
              <span class="stat-value" id="success-rate">0%</span>
            </div>
          </div>
          
          <div class="memory-actions">
            <button class="btn btn-sm btn-primary" onclick="dashboardIntegration.refreshMemories()">
              Refresh
            </button>
            <button class="btn btn-sm btn-success" onclick="dashboardIntegration.createNewMemory()">
              New Memory
            </button>
            <button class="btn btn-sm btn-info" onclick="dashboardIntegration.viewAllMemories()">
              View All
            </button>
          </div>
          
          <div class="recent-memories" id="recent-memories">
            <h4>Recent Memories</h4>
            <div class="memory-list" id="memory-list">
            </div>
          </div>
        </div>
      </div>
    `;
    
    dashboard.appendChild(memoryInterface);
  }

  addQualityMetricsDisplay() {
    const dashboard = document.querySelector('.dashboard-container') || document.body;
    
    const metricsInterface = document.createElement('div');
    metricsInterface.className = 'quality-metrics-interface';
    metricsInterface.innerHTML = `
      <div class="metrics-panel">
        <div class="panel-header">
          <h3>Quality Metrics</h3>
          <button class="btn btn-sm btn-secondary" onclick="dashboardIntegration.toggleMetricsPanel()">
            Toggle
          </button>
        </div>
        
        <div class="panel-content" id="metrics-panel-content">
          <div class="metrics-overview">
            <div class="metric-card">
              <div class="metric-title">Overall Success Rate</div>
              <div class="metric-value" id="overall-success-rate">0%</div>
            </div>
            <div class="metric-card">
              <div class="metric-title">Average Execution Time</div>
              <div class="metric-value" id="avg-execution-time">0ms</div>
            </div>
            <div class="metric-card">
              <div class="metric-title">Average Completeness</div>
              <div class="metric-value" id="avg-completeness">0%</div>
            </div>
          </div>
          
          <div class="strategy-performance">
            <h4>Strategy Performance</h4>
            <div class="strategy-list" id="strategy-list">
            </div>
          </div>
        </div>
      </div>
    `;
    
    dashboard.appendChild(metricsInterface);
  }

  setupEventListeners() {
    document.addEventListener('sessionUpdated', (event) => {
      this.handleSessionUpdate(event.detail);
    });
    
    document.addEventListener('memoryUpdated', (event) => {
      this.handleMemoryUpdate(event.detail);
    });
    
    document.addEventListener('metricsUpdated', (event) => {
      this.handleMetricsUpdate(event.detail);
    });
  }

  async integrateSession(sessionId) {
    const statusElement = document.getElementById(`status-${sessionId}`);
    if (statusElement) {
      this.updateStatus(statusElement, 'Integrating...', 'loading');
    }
    
    try {
      const response = await fetch(`${this.apiBaseUrl}/session/${sessionId}/integrate`, {
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
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        this.updateStatus(statusElement, `Integrated (${result.strategy})`, 'success');
        this.showIntegrationResult(result);
      } else {
        this.updateStatus(statusElement, 'Integration failed', 'error');
        this.showIntegrationError(result);
      }
    } catch (error) {
      console.error('Session integration failed:', error);
      this.updateStatus(statusElement, 'Integration failed', 'error');
      this.showError('Session integration failed: ' + error.message);
    }
  }

  async generateNotebook(sessionId) {
    const statusElement = document.getElementById(`status-${sessionId}`);
    if (statusElement) {
      this.updateStatus(statusElement, 'Generating notebook...', 'loading');
    }
    
    try {
      const response = await fetch(`${this.apiBaseUrl}/session/${sessionId}/generate-notebook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          includeMemories: true,
          includeASTAnalysis: true,
          includeKuraAnalysis: true,
          includeEmbeddingsAnalysis: true,
          platform: 'colab'
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        this.updateStatus(statusElement, 'Notebook generated', 'success');
        this.showNotebookResult(result);
      } else {
        this.updateStatus(statusElement, 'Generation failed', 'error');
        this.showNotebookError(result);
      }
    } catch (error) {
      console.error('Notebook generation failed:', error);
      this.updateStatus(statusElement, 'Generation failed', 'error');
      this.showError('Notebook generation failed: ' + error.message);
    }
  }

  async createMemory(sessionId) {
    const statusElement = document.getElementById(`status-${sessionId}`);
    if (statusElement) {
      this.updateStatus(statusElement, 'Creating memory...', 'loading');
    }
    
    try {
      const response = await fetch(`${this.apiBaseUrl}/session/${sessionId}/create-memory`, {
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
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        this.updateStatus(statusElement, 'Memory created', 'success');
        this.showMemoryResult(result);
        this.refreshMemories();
      } else {
        this.updateStatus(statusElement, 'Creation failed', 'error');
        this.showMemoryError(result);
      }
    } catch (error) {
      console.error('Memory creation failed:', error);
      this.updateStatus(statusElement, 'Creation failed', 'error');
      this.showError('Memory creation failed: ' + error.message);
    }
  }

  async showSessionMetrics(sessionId) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/session/${sessionId}/metrics`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        this.showMetricsModal(result.metrics, sessionId);
      } else {
        this.showError('Failed to load session metrics');
      }
    } catch (error) {
      console.error('Failed to load session metrics:', error);
      this.showError('Failed to load session metrics: ' + error.message);
    }
  }

  async refreshMemories() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/memories?limit=10`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        this.updateMemoryList(result.memories);
        this.updateMemoryStats(result.memories);
      }
    } catch (error) {
      console.error('Failed to refresh memories:', error);
    }
  }

  updateMemoryList(memories) {
    const memoryList = document.getElementById('memory-list');
    if (!memoryList) return;
    
    memoryList.innerHTML = memories.map(memory => `
      <div class="memory-item">
        <div class="memory-header">
          <h5>${memory.name}</h5>
          <span class="memory-type">${memory.type}</span>
        </div>
        <div class="memory-content">
          <p>${memory.content.substring(0, 100)}...</p>
        </div>
        <div class="memory-actions">
          <button class="btn btn-xs btn-primary" onclick="dashboardIntegration.executeMemory('${memory.id}')">
            Execute
          </button>
          <button class="btn btn-xs btn-info" onclick="dashboardIntegration.viewMemory('${memory.id}')">
            View
          </button>
        </div>
        <div class="memory-metadata">
          <span>Confidence: ${memory.metadata.confidence}%</span>
          <span>Completeness: ${memory.metadata.completeness}%</span>
        </div>
      </div>
    `).join('');
  }

  updateMemoryStats(memories) {
    const totalMemories = document.getElementById('total-memories');
    const activeMemories = document.getElementById('active-memories');
    const successRate = document.getElementById('success-rate');
    
    if (totalMemories) totalMemories.textContent = memories.length;
    if (activeMemories) activeMemories.textContent = memories.filter(m => m.metadata.confidence > 50).length;
    if (successRate) {
      const avgConfidence = memories.length > 0 ? 
        Math.round(memories.reduce((sum, m) => sum + m.metadata.confidence, 0) / memories.length) : 0;
      successRate.textContent = `${avgConfidence}%`;
    }
  }

  updateStatus(element, text, status) {
    if (!element) return;
    
    const statusText = element.querySelector('.status-text');
    const statusDot = element.querySelector('.status-dot');
    
    if (statusText) statusText.textContent = text;
    if (statusDot) {
      statusDot.className = `status-dot ${status}`;
    }
  }

  showIntegrationResult(result) {
    const modal = this.createModal('Integration Result', `
      <div class="integration-result">
        <h4>Integration Successful</h4>
        <p><strong>Method:</strong> ${result.strategy}</p>
        <p><strong>Execution Time:</strong> ${result.executionTime}ms</p>
        <p><strong>Completeness:</strong> ${result.result?.completeness || 0}%</p>
        
        <h5>Quality Metrics:</h5>
        <ul>
          <li>Success Rate: ${result.qualityMetrics?.successRate || 0}%</li>
          <li>Average Execution Time: ${result.qualityMetrics?.averageExecutionTime || 0}ms</li>
          <li>Average Completeness: ${result.qualityMetrics?.averageCompleteness || 0}%</li>
        </ul>
        
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="dashboardIntegration.closeModal()">Close</button>
        </div>
      </div>
    `);
    
    document.body.appendChild(modal);
  }

  showNotebookResult(result) {
    const modal = this.createModal('Notebook Generated', `
      <div class="notebook-result">
        <h4>Notebook Generated Successfully!</h4>
        <p><strong>Cells:</strong> ${result.cellCount}</p>
        <p><strong>Memories Included:</strong> ${result.memoriesIncluded}</p>
        <p><strong>Integration Method:</strong> ${result.integrationMethod}</p>
        <p><strong>Completeness:</strong> ${result.completeness}%</p>
        
        <h5>Open in:</h5>
        <div class="open-options">
          <button class="btn btn-primary" onclick="window.open('${result.openUrls?.colab || '#'}', '_blank')">
            Google Colab
          </button>
          <button class="btn btn-secondary" onclick="window.open('${result.openUrls?.jupyter || '#'}', '_blank')">
            Jupyter
          </button>
          <button class="btn btn-info" onclick="window.open('${result.openUrls?.vscode || '#'}', '_blank')">
            VSCode
          </button>
          <button class="btn btn-success" onclick="window.open('${result.openUrls?.cursor || '#'}', '_blank')">
            Cursor
          </button>
        </div>
        
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="dashboardIntegration.closeModal()">Close</button>
        </div>
      </div>
    `);
    
    document.body.appendChild(modal);
  }

  showMemoryResult(result) {
    const modal = this.createModal('Memory Created', `
      <div class="memory-result">
        <h4>Memory Created Successfully!</h4>
        <p><strong>Name:</strong> ${result.memory.name}</p>
        <p><strong>Type:</strong> ${result.memory.type}</p>
        <p><strong>Category:</strong> ${result.memory.category}</p>
        <p><strong>Integration Method:</strong> ${result.integrationMethod}</p>
        <p><strong>Completeness:</strong> ${result.completeness}%</p>
        
        <h5>Triggers:</h5>
        <ul>
          ${result.memory.triggers.map(trigger => `<li>${trigger}</li>`).join('')}
        </ul>
        
        <h5>Actions:</h5>
        <ul>
          <li>Context Restoration: ${Object.keys(result.memory.actions.contextRestoration).length} elements</li>
          <li>Workflow Execution: ${result.memory.actions.workflowExecution.steps.length} steps</li>
          <li>Knowledge Injection: ${result.memory.actions.knowledgeInjection.insights.length} insights</li>
        </ul>
        
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="dashboardIntegration.executeMemory('${result.memory.id}')">
            Execute Memory
          </button>
          <button class="btn btn-secondary" onclick="dashboardIntegration.closeModal()">Close</button>
        </div>
      </div>
    `);
    
    document.body.appendChild(modal);
  }

  createModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'enhanced-modal';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="dashboardIntegration.closeModal()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" onclick="dashboardIntegration.closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
      </div>
    `;
    
    return modal;
  }

  closeModal() {
    const modals = document.querySelectorAll('.enhanced-modal');
    modals.forEach(modal => modal.remove());
  }

  showError(message) {
    const modal = this.createModal('Error', `
      <div class="error-message">
        <p>${message}</p>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="dashboardIntegration.closeModal()">Close</button>
        </div>
      </div>
    `);
    
    document.body.appendChild(modal);
  }

  extractSessionId(onclickAttribute) {
    const match = onclickAttribute.match(/returnToContext\('([^']+)'\)/);
    return match ? match[1] : null;
  }

  handleSessionUpdate(detail) {
    console.log('Session updated:', detail);
  }

  handleMemoryUpdate(detail) {
    console.log('Memory updated:', detail);
    this.refreshMemories();
  }

  handleMetricsUpdate(detail) {
    console.log('Metrics updated:', detail);
  }

  toggleMemoryPanel() {
    const panel = document.getElementById('memory-panel-content');
    if (panel) {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
  }

  toggleMetricsPanel() {
    const panel = document.getElementById('metrics-panel-content');
    if (panel) {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
  }

  createNewMemory() {
    console.log('Create new memory');
  }

  viewAllMemories() {
    console.log('View all memories');
  }

  executeMemory(memoryId) {
    console.log('Execute memory:', memoryId);
  }

  viewMemory(memoryId) {
    console.log('View memory:', memoryId);
  }

  showMetricsModal(metrics, sessionId) {
    console.log('Show metrics modal:', metrics, sessionId);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.dashboardIntegration = new DashboardIntegration();
  window.dashboardIntegration.initialize();
});

module.exports = { DashboardIntegration };
