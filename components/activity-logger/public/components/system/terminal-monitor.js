/**
 * Terminal Monitor Component
 * Real-time visualization of terminal commands and errors
 */

class TerminalMonitorComponent {
  constructor() {
    this.commands = [];
    this.stats = null;
    this.filters = {
      source: 'all',
      showErrors: false,
      workspace: 'all'
    };
  }

  async loadData() {
    try {
      // Load terminal history
      const historyResponse = await fetch(`/api/terminal/history?limit=100`);
      const historyData = await historyResponse.json();
      this.commands = historyData.data || [];

      // Load statistics
      const statsResponse = await fetch(`/api/terminal/stats`);
      const statsData = await statsResponse.json();
      this.stats = statsData.data || {};

      return { success: true };
    } catch (error) {
      console.error('Error loading terminal data:', error);
      return { success: false, error: error.message };
    }
  }

  renderStats() {
    if (!this.stats) return '';

    return `
      <div class="terminal-stats">
        <div class="stat-card">
          <div class="stat-value">${this.stats.total || 0}</div>
          <div class="stat-label">Total Commands</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${this.stats.last24h || 0}</div>
          <div class="stat-label">Last 24 Hours</div>
        </div>
        <div class="stat-card ${this.stats.errorCount > 0 ? 'error' : ''}">
          <div class="stat-value">${this.stats.errorCount || 0}</div>
          <div class="stat-label">Errors</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${this.stats.errorRate || 0}%</div>
          <div class="stat-label">Error Rate</div>
        </div>
      </div>
    `;
  }

  renderTopCommands() {
    if (!this.stats || !this.stats.topCommands) return '';

    return `
      <div class="top-commands-section">
        <h3>Most Used Commands</h3>
        <div class="command-list">
          ${this.stats.topCommands.map((cmd, index) => `
            <div class="command-item">
              <span class="rank">#${index + 1}</span>
              <code class="command-text">${this.escapeHtml(cmd.command)}</code>
              <span class="command-count">${cmd.count}×</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderCommandHistory() {
    const filtered = this.getFilteredCommands();

    if (filtered.length === 0) {
      return '<div class="empty-state">No terminal commands captured yet</div>';
    }

    return `
      <div class="command-history">
        ${filtered.slice(0, 50).map(cmd => this.renderCommand(cmd)).join('')}
      </div>
    `;
  }

  renderCommand(cmd) {
    const timestamp = new Date(cmd.timestamp).toLocaleString();
    const isError = cmd.exit_code && cmd.exit_code !== 0;
    const commandShort = cmd.command.length > 80 
      ? cmd.command.substring(0, 80) + '...' 
      : cmd.command;

    return `
      <div class="terminal-command ${isError ? 'error' : ''}" data-id="${cmd.id}">
        <div class="command-header">
          <span class="command-time">${timestamp}</span>
          <span class="command-source badge">${cmd.source}</span>
          ${cmd.shell ? `<span class="command-shell badge">${cmd.shell}</span>` : ''}
          ${isError ? `<span class="command-status badge error">Exit ${cmd.exit_code}</span>` : ''}
        </div>
        <div class="command-body">
          <code class="command-text">${this.escapeHtml(commandShort)}</code>
        </div>
        ${cmd.workspace ? `<div class="command-workspace">${this.escapeHtml(cmd.workspace)}</div>` : ''}
        ${cmd.output ? `
          <details class="command-output">
            <summary>Output</summary>
            <pre>${this.escapeHtml(cmd.output)}</pre>
          </details>
        ` : ''}
        ${cmd.error ? `<div class="command-error">${this.escapeHtml(cmd.error)}</div>` : ''}
      </div>
    `;
  }

  renderFilters() {
    const sources = [...new Set(this.commands.map(cmd => cmd.source))];
    const workspaces = [...new Set(this.commands.map(cmd => cmd.workspace).filter(w => w))];

    return `
      <div class="terminal-filters">
        <div class="filter-group">
          <label>Source:</label>
          <select id="terminalSourceFilter">
            <option value="all">All Sources</option>
            ${sources.map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label>Workspace:</label>
          <select id="terminalWorkspaceFilter">
            <option value="all">All Workspaces</option>
            ${workspaces.map(w => `
              <option value="${w}">${w.split('/').pop() || w}</option>
            `).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label>
            <input type="checkbox" id="terminalErrorsOnly" ${this.filters.showErrors ? 'checked' : ''}>
            Errors Only
          </label>
        </div>
        <button class="refresh-btn" onclick="terminalMonitor.refresh()">
          [SYNC] Refresh
        </button>
      </div>
    `;
  }

  getFilteredCommands() {
    return this.commands.filter(cmd => {
      if (this.filters.source !== 'all' && cmd.source !== this.filters.source) {
        return false;
      }
      if (this.filters.workspace !== 'all' && cmd.workspace !== this.filters.workspace) {
        return false;
      }
      if (this.filters.showErrors && (!cmd.exit_code || cmd.exit_code === 0)) {
        return false;
      }
      return true;
    });
  }

  render() {
    return `
      <div class="terminal-monitor-container">
        <div class="section-header">
          <h2>[SYSTEM] Terminal Activity</h2>
          <p class="section-description">
            Real-time monitoring of shell commands, errors, and execution patterns
          </p>
        </div>

        ${this.renderStats()}
        ${this.renderFilters()}

        <div class="terminal-content">
          <div class="terminal-sidebar">
            ${this.renderTopCommands()}
          </div>
          <div class="terminal-main">
            <h3>Command History</h3>
            ${this.renderCommandHistory()}
          </div>
        </div>
      </div>
    `;
  }

  async refresh() {
    await this.loadData();
    this.update();
  }

  update() {
    const container = document.getElementById('terminal-monitor-content');
    if (container) {
      container.innerHTML = this.render();
      this.attachEventListeners();
    }
  }

  attachEventListeners() {
    const sourceFilter = document.getElementById('terminalSourceFilter');
    if (sourceFilter) {
      sourceFilter.addEventListener('change', (e) => {
        this.filters.source = e.target.value;
        this.update();
      });
    }

    const workspaceFilter = document.getElementById('terminalWorkspaceFilter');
    if (workspaceFilter) {
      workspaceFilter.addEventListener('change', (e) => {
        this.filters.workspace = e.target.value;
        this.update();
      });
    }

    const errorsOnly = document.getElementById('terminalErrorsOnly');
    if (errorsOnly) {
      errorsOnly.addEventListener('change', (e) => {
        this.filters.showErrors = e.target.checked;
        this.update();
      });
    }
  }

  setupWebSocket(socket) {
    socket.on('terminal-command', (command) => {
      console.log('New terminal command:', command);
      this.commands.unshift(command);
      
      // Keep only last 100 commands in memory
      if (this.commands.length > 100) {
        this.commands = this.commands.slice(0, 100);
      }
      
      this.update();
      
      // Show notification for errors
      if (command.exitCode && command.exitCode !== 0) {
        this.showNotification(`Command failed: ${command.command}`, 'error');
      }
    });
  }

  showNotification(message, type = 'info') {
    // Integrate with dashboard notification system if available
    if (window.showNotification) {
      window.showNotification(message, type);
    } else {
      console.log(`[${type}] ${message}`);
    }
  }

  escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

// Create global instance
window.terminalMonitor = new TerminalMonitorComponent();

