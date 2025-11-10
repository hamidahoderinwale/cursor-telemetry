/**
 * Navigator View HTML Templates
 * Template functions for Navigator view components
 */

function renderNavigatorViewTemplate(data) {
  return `
    <div class="navigator-view">
      <div class="view-header">
        <h2 title="Semantic Navigator: Visualizes your codebase in 2D space using advanced algorithms. Physical mode uses force-directed layout (Barnes-Hut optimized) for co-modification relationships. Latent mode uses UMAP (kNN graph + dimensionality reduction) for semantic similarity. Files with similar code or frequently modified together appear closer. Optimized for large graphs with adaptive parameters and sampling strategies.">Semantic Navigator</h2>
        <p class="view-subtitle">Explore your codebase in latent space - where semantic similarity becomes visual proximity</p>
      </div>

      <!-- View Mode Switcher -->
      <div class="view-mode-controls">
        <div>
          <h3>View Mode</h3>
          <div class="view-mode-switcher">
            <button class="view-mode-btn active" data-mode="physical" onclick="setNavigatorViewMode('physical')" title="Physical Layout: Uses force-directed graph layout (D3.js with Barnes-Hut optimization) based on co-modification relationships. Files frequently edited together in the same sessions appear closer. Uses Jaccard similarity of editing sessions. Optimized with adaptive charge strength and theta parameter (0.7-0.9) for large graphs. Complexity: O(n log n).">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 4h3v3H4V4zm5 0h3v3H9V4zM4 9h3v3H4V9zm5 0h3v3H9V9z"/>
              </svg>
              Physical
            </button>
            <button class="view-mode-btn" data-mode="hybrid" onclick="setNavigatorViewMode('hybrid')" title="Hybrid Layout: Interpolates between physical (co-modification) and latent (semantic) layouts. Blends both relationship types to show a balanced view. Uses weighted combination of both positioning methods.">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="4" r="2"/>
                <circle cx="4" cy="12" r="2"/>
                <circle cx="12" cy="12" r="2"/>
                <path d="M8 6L4 10M8 6l4 4"/>
              </svg>
              Hybrid
            </button>
            <button class="view-mode-btn" data-mode="latent" onclick="setNavigatorViewMode('latent')" title="Latent Layout: Uses UMAP (Uniform Manifold Approximation and Projection) algorithm for dimensionality reduction. First builds a kNN (k-Nearest Neighbors) graph using cosine similarity of feature vectors (TF-IDF + structural features). Then optimizes 2D positions using attractive/repulsive forces. Files with similar code content appear closer regardless of when modified. Optimized with logarithmic sampling and two-stage refinement for large graphs. Complexity: O(n log n) for kNN, then O(n*k) for optimization.">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="8" r="6"/>
                <circle cx="8" cy="8" r="3"/>
                <path d="M8 2v4M8 10v4M2 8h4M10 8h4"/>
              </svg>
              Latent
            </button>
          </div>
          <p>
            <strong>Physical:</strong> Direct co-modification • 
            <strong>Latent:</strong> Semantic similarity • 
            <strong>Hybrid:</strong> Blend both
          </p>
        </div>

        <div>
          <h3>Workspace</h3>
          <select id="navigatorWorkspaceFilter" class="navigator-filter-select" onchange="filterNavigatorByWorkspace(this.value)" title="Filter files by workspace">
            <option value="all">All Workspaces</option>
            <!-- Options will be populated dynamically -->
          </select>
        </div>

        <div>
          <h3>Directory</h3>
          <select id="navigatorDirectoryFilter" class="navigator-filter-select" onchange="filterNavigatorByDirectory(this.value)" title="Filter files by top-level directory">
            <option value="all">All Directories</option>
            <!-- Options will be populated dynamically -->
          </select>
        </div>

        <div>
          <h3>Transition Speed</h3>
          <input type="range" id="transitionSpeed" min="0.5" max="2" step="0.1" value="2" oninput="updateTransitionSpeed(this.value)">
          <div class="speed-label-wrapper">
            <span>Slow</span>
            <span id="speedLabel">2.0x</span>
            <span>Fast</span>
          </div>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="navigator-main-layout">
        
        <!-- Main Visualization -->
        <div class="navigator-visualization-area">
          <div class="navigator-container" id="navigatorContainer">
            <!-- Navigator will be rendered here -->
          </div>

          <!-- Navigation Controls -->
          <div class="navigator-controls">
            <button class="btn btn-primary" onclick="zoomToFitNavigator()">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 2h5v5H2V2zm7 0h5v5H9V2zM2 9h5v5H2V9zm7 0h5v5H9V9z"/>
              </svg>
              Zoom to Fit
            </button>
            <button class="btn btn-secondary" onclick="resetNavigatorView()">Reset View</button>
            <button class="btn btn-secondary" onclick="toggleNavigatorLabels()" id="navigatorLabelToggle">Hide Labels</button>
            
            <div class="spacer"></div>
            
            <div class="interpolation-display">
              <span>Interpolation:</span>
              <span id="interpolationValue" class="interpolation-value">0%</span>
            </div>
          </div>
        </div>

        <!-- Mini-Map Widget -->
        <div class="navigator-sidebar">
          <div class="mini-map-widget">
            <h3>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 2a6 6 0 110 12A6 6 0 018 2z"/>
              </svg>
              Overview
            </h3>
            <div id="miniMapCanvas" class="mini-map-canvas">
              <!-- Mini-map will be rendered here -->
            </div>
            
            <div class="mini-map-stats">
              <div class="mini-map-stat-row">
                <span>Files:</span>
                <span id="navFileCount" class="mini-map-stat-value">0</span>
              </div>
              <div class="mini-map-stat-row">
                <span>Clusters:</span>
                <span id="navClusterCount" class="mini-map-stat-value">0</span>
              </div>
              <div class="mini-map-stat-row">
                <span>Coherence:</span>
                <span id="navCoherence" class="mini-map-stat-value success">0%</span>
              </div>
            </div>
          </div>

          <!-- Cluster Legend -->
          <div class="cluster-legend">
            <h3>Latent Clusters</h3>
            <div id="clusterLegend" class="cluster-legend-list">
              <!-- Cluster legend will be populated -->
            </div>
          </div>
        </div>
      </div>

      <!-- Semantic Insights -->
      <div class="card semantic-insights">
        <div class="card-header">
          <h3 class="card-title" title="Semantic Insights: Automatically discovers patterns using clustering algorithms (k-means, community detection) and semantic analysis. Analyzes file relationships from kNN graphs, co-occurrence patterns, and feature vectors. Shows groups of related files, code organization patterns, and insights about development workflows. Uses AI-powered cluster annotation when available.">Semantic Insights</h3>
          <p class="card-subtitle">Discovered patterns in latent space</p>
        </div>
        <div class="card-body">
          <div id="semanticInsights" class="semantic-insights-grid">
            <!-- Insights will be populated -->
          </div>
        </div>
      </div>
    </div>
  `;
}

// Export to window for global access
window.renderNavigatorViewTemplate = renderNavigatorViewTemplate;

