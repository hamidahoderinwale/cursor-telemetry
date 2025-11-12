/**
 * Navigator View HTML Templates
 * Template functions for Navigator view components
 */

function renderNavigatorViewTemplate(data) {
  return `
    <div class="navigator-view">
      <div class="view-header">
        <h2 title="Semantic Navigator: Visualizes your codebase in 2D space using advanced algorithms. Physical mode uses force-directed layout (Barnes-Hut optimized) for co-modification relationships. Latent mode uses UMAP (kNN graph + dimensionality reduction) for semantic similarity. Files with similar code or frequently modified together appear closer. Optimized for large graphs with adaptive parameters and sampling strategies.">Semantic Navigator</h2>
        <div class="view-subtitle">
          <p>
            Explore your codebase in latent space—where semantic similarity becomes visual proximity. 
            The Semantic Navigator transforms your codebase into a 2D map where files are positioned based on their relationships, revealing hidden connections that aren't apparent from directory structure alone.
          </p>
          
          <p>
            The navigator offers three distinct viewing modes. <strong>Physical mode</strong> uses force-directed graph layout to position files based on co-modification patterns—files frequently edited together in the same sessions appear closer. <strong>Latent mode</strong> employs UMAP (Uniform Manifold Approximation and Projection) to analyze code content, structure, and patterns, positioning files by semantic similarity regardless of when they were modified. <strong>Hybrid mode</strong> blends both approaches, simultaneously showing co-modification patterns and semantic clusters for a comprehensive view.
          </p>
          
          <p>
            Files with similar functionality, shared dependencies, or related code patterns naturally cluster together, making it easy to discover related code, understand codebase organization, and navigate complex projects visually. The visualization uses advanced dimensionality reduction techniques to compress high-dimensional code features—including TF-IDF vectors, structural patterns, and co-occurrence data—into an intuitive 2D layout that preserves meaningful relationships.
          </p>
          
          <p>
            Clusters are automatically discovered using k-means and community detection algorithms, with AI-powered annotations describing each group's purpose and characteristics. This creates a "map" of your codebase where proximity reveals relationships that might not be obvious from directory structure alone, helping you understand code organization, find related files, and discover architectural patterns at a glance.
          </p>
        </div>
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
          <h3>Semantic Search</h3>
          <div style="display: flex; gap: 4px;">
            <input type="text" id="navigatorSearchInput" class="navigator-filter-select" 
                   placeholder="Search files by content..." 
                   onkeyup="handleNavigatorSearch(event)"
                   style="flex: 1; min-width: 0;">
            <button class="btn btn-secondary" onclick="clearNavigatorSearch()" title="Clear search">
              ✕
            </button>
          </div>
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
            <button class="btn btn-secondary" onclick="toggleNavigator3D()" id="navigator3DToggle" title="Toggle between 2D and 3D visualization">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0L0 4v8l8 4 8-4V4L8 0zM2 5.5l6 3v6l-6-3v-6zm12 0v6l-6 3v-6l6-3z"/>
              </svg>
              <span id="navigator3DLabel">3D View</span>
            </button>
            
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
                <span>Silhouette:</span>
                <span id="navSilhouette" class="mini-map-stat-value">-</span>
              </div>
              <div class="mini-map-stat-row">
                <span>Cohesion:</span>
                <span id="navCohesion" class="mini-map-stat-value">-</span>
              </div>
              <div class="mini-map-stat-row">
                <span>Separation:</span>
                <span id="navSeparation" class="mini-map-stat-value">-</span>
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

