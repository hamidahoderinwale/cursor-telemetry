/**
 * Clio Motif Visualization
 * Interactive visualization of privacy-preserving workflow patterns
 */

class ClioVisualization {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.clusters = [];
    this.selectedCluster = null;
  }

  /**
   * Render Clio clusters
   */
  async render(clioData) {
    if (!clioData || !this.container) {
      console.warn('[CLIO-VIZ] No data or container');
      return;
    }

    this.clusters = this.extractClusters(clioData);
    
    if (this.clusters.length === 0) {
      this.renderEmptyState();
      return;
    }

    this.renderClusterList();
  }

  /**
   * Extract clusters from Clio result
   */
  extractClusters(clioData) {
    const clusters = [];
    
    // Global clusters
    if (clioData.global && clioData.global.clusters) {
      clioData.global.clusters.forEach((cluster, idx) => {
        clusters.push({
          id: `global-${idx}`,
          type: 'global',
          ...cluster
        });
      });
    }
    
    // Workspace-specific clusters
    if (clioData.workspaceSpecific) {
      Object.entries(clioData.workspaceSpecific).forEach(([workspace, result]) => {
        if (result.clusters) {
          result.clusters.forEach((cluster, idx) => {
            clusters.push({
              id: `workspace-${workspace}-${idx}`,
              type: 'workspace',
              workspace,
              ...cluster
            });
          });
        }
      });
    }
    
    // Repo-type clusters
    if (clioData.repoType) {
      Object.entries(clioData.repoType).forEach(([repoType, result]) => {
        if (result.clusters) {
          result.clusters.forEach((cluster, idx) => {
            clusters.push({
              id: `repo-${repoType}-${idx}`,
              type: 'repo_type',
              repoType,
              ...cluster
            });
          });
        }
      });
    }
    
    return clusters;
  }

  /**
   * Render empty state
   */
  renderEmptyState() {
    this.container.innerHTML = `
      <div class="clio-empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 6v6l4 2"></path>
        </svg>
        <h3>No Clio Motifs Yet</h3>
        <p>Process your workspace data to generate privacy-preserving workflow patterns.</p>
        <button class="btn btn-primary" onclick="window.runClioAnalysis()">
          Generate Motifs
        </button>
      </div>
    `;
  }

  /**
   * Render cluster list with filtering
   */
  renderClusterList() {
    const globalClusters = this.clusters.filter(c => c.type === 'global');
    const workspaceClusters = this.clusters.filter(c => c.type === 'workspace');
    const repoClusters = this.clusters.filter(c => c.type === 'repo_type');

    this.container.innerHTML = `
      <div class="clio-visualization">
        <div class="clio-header">
          <h2>Workflow Motifs (Clio)</h2>
          <div class="clio-stats">
            <span class="stat-badge">
              <strong>${this.clusters.length}</strong> motifs
            </span>
            <span class="stat-badge">
              <strong>${new Set(this.clusters.flatMap(c => c.workspaces || [])).size}</strong> workspaces
            </span>
          </div>
        </div>

        <div class="clio-filters">
          <button class="filter-btn active" data-filter="all" onclick="clioViz.filterClusters('all')">
            All (${this.clusters.length})
          </button>
          <button class="filter-btn" data-filter="global" onclick="clioViz.filterClusters('global')">
            Global (${globalClusters.length})
          </button>
          <button class="filter-btn" data-filter="workspace" onclick="clioViz.filterClusters('workspace')">
            By Workspace (${workspaceClusters.length})
          </button>
          <button class="filter-btn" data-filter="repo_type" onclick="clioViz.filterClusters('repo_type')">
            By Repo Type (${repoClusters.length})
          </button>
        </div>

        <div class="clio-cluster-list" id="clioClusterList">
          ${this.renderClusters(this.clusters)}
        </div>

        <div class="clio-detail-panel" id="clioDetailPanel" style="display: none;">
          <!-- Cluster detail view -->
        </div>
      </div>
    `;
  }

  /**
   * Render individual clusters
   */
  renderClusters(clusters) {
    return clusters.map(cluster => {
      const privacyScore = this.calculatePrivacyScore(cluster);
      const privacyColor = this.getPrivacyColor(privacyScore);
      
      return `
        <div class="clio-cluster-card" data-cluster-id="${cluster.id}" onclick="clioViz.selectCluster('${cluster.id}')">
          <div class="cluster-header">
            <h3 class="cluster-title">
              ${cluster.title || cluster.label || `Pattern ${cluster.id}`}
            </h3>
            <div class="cluster-badges">
              <span class="badge badge-${cluster.type}">${cluster.type}</span>
              <span class="badge badge-privacy" style="background-color: ${privacyColor}">
                Privacy: ${privacyScore}/5
              </span>
            </div>
          </div>
          
          <p class="cluster-description">
            ${cluster.description || cluster.summary || 'No description available'}
          </p>
          
          <div class="cluster-meta">
            <span><strong>${cluster.size || 0}</strong> items</span>
            ${cluster.workspaces ? `<span><strong>${cluster.workspaces.length}</strong> workspaces</span>` : ''}
            ${cluster.repoType ? `<span>Repo: <strong>${cluster.repoType}</strong></span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Calculate privacy score
   */
  calculatePrivacyScore(cluster) {
    return cluster.privacyScore || 
           (cluster.workspaces && cluster.workspaces.length >= 3 ? 4 : 2);
  }

  /**
   * Get privacy color
   */
  getPrivacyColor(score) {
    if (score >= 4) return '#10b981'; // Green
    if (score >= 3) return '#f59e0b'; // Orange
    return '#ef4444'; // Red
  }

  /**
   * Filter clusters
   */
  filterClusters(filterType) {
    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.filter === filterType) {
        btn.classList.add('active');
      }
    });

    // Filter and re-render
    const filtered = filterType === 'all' ? 
      this.clusters : 
      this.clusters.filter(c => c.type === filterType);

    document.getElementById('clioClusterList').innerHTML = this.renderClusters(filtered);
  }

  /**
   * Select and show cluster details
   */
  selectCluster(clusterId) {
    const cluster = this.clusters.find(c => c.id === clusterId);
    if (!cluster) return;

    this.selectedCluster = cluster;
    
    // Show detail panel
    const detailPanel = document.getElementById('clioDetailPanel');
    detailPanel.style.display = 'block';
    detailPanel.innerHTML = this.renderClusterDetail(cluster);

    // Scroll to detail panel
    detailPanel.scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * Render cluster detail view
   */
  renderClusterDetail(cluster) {
    const items = cluster.items || [];
    const sampleSize = Math.min(items.length, 10);
    const sampleItems = items.slice(0, sampleSize);

    return `
      <div class="cluster-detail">
        <div class="detail-header">
          <h2>${cluster.title || `Cluster ${cluster.id}`}</h2>
          <button class="btn btn-secondary" onclick="clioViz.closeDetail()">Close</button>
        </div>

        <div class="detail-body">
          <div class="detail-section">
            <h3>Summary</h3>
            <p>${cluster.summary || cluster.description || 'No summary available'}</p>
          </div>

          <div class="detail-section">
            <h3>Statistics</h3>
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-value">${cluster.size || 0}</div>
                <div class="stat-label">Total Items</div>
              </div>
              ${cluster.workspaces ? `
                <div class="stat-item">
                  <div class="stat-value">${cluster.workspaces.length}</div>
                  <div class="stat-label">Workspaces</div>
                </div>
              ` : ''}
              <div class="stat-item">
                <div class="stat-value">${this.calculatePrivacyScore(cluster)}/5</div>
                <div class="stat-label">Privacy Score</div>
              </div>
            </div>
          </div>

          ${sampleItems.length > 0 ? `
            <div class="detail-section">
              <h3>Sample Items (${sampleSize} of ${items.length})</h3>
              <div class="sample-items">
                ${sampleItems.map((item, idx) => `
                  <div class="sample-item">
                    <span class="item-index">${idx + 1}</span>
                    <div class="item-content">
                      ${this.renderItemSummary(item)}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div class="detail-actions">
            <button class="btn btn-primary" onclick="clioViz.exportCluster('${cluster.id}')">
              Export Pattern
            </button>
            <button class="btn btn-secondary" onclick="clioViz.shareCluster('${cluster.id}')">
              Share
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render item summary
   */
  renderItemSummary(item) {
    if (item.itemType === 'prompt' || item.type === 'prompt') {
      return `<strong>Prompt:</strong> ${(item.text || '').substring(0, 100)}...`;
    }
    if (item.itemType === 'event' || item.type === 'event') {
      const details = typeof item.details === 'string' ? JSON.parse(item.details) : item.details;
      return `<strong>File:</strong> ${details.file_path || 'unknown'}`;
    }
    return item.text || item.content || JSON.stringify(item).substring(0, 100);
  }

  /**
   * Close detail panel
   */
  closeDetail() {
    document.getElementById('clioDetailPanel').style.display = 'none';
    this.selectedCluster = null;
  }

  /**
   * Export cluster
   */
  exportCluster(clusterId) {
    const cluster = this.clusters.find(c => c.id === clusterId);
    if (!cluster) return;

    const exportData = {
      id: cluster.id,
      title: cluster.title,
      description: cluster.description,
      summary: cluster.summary,
      type: cluster.type,
      size: cluster.size,
      privacyScore: this.calculatePrivacyScore(cluster),
      workspaces: cluster.workspaces,
      items: cluster.items
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clio-pattern-${cluster.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Share cluster (creates share link)
   */
  async shareCluster(clusterId) {
    // This would integrate with your sharing system
    alert(`Sharing functionality for cluster ${clusterId} - integrate with /api/share/create`);
  }
}

// Initialize global instance
if (typeof window !== 'undefined') {
  window.ClioVisualization = ClioVisualization;
  
  // Helper to run Clio analysis
  window.runClioAnalysis = async function() {
    try {
      const response = await fetch('/api/clio/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sampleSize: 10000,
          strategies: ['global', 'workspace_specific', 'repo_type']
        })
      });
      
      const result = await response.json();
      
      if (window.clioViz) {
        window.clioViz.render(result);
      }
    } catch (error) {
      console.error('[CLIO] Analysis failed:', error);
      alert(`Clio analysis failed: ${error.message}`);
    }
  };
}


