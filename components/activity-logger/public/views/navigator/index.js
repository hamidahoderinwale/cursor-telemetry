/**
 * Navigator View - UMAP semantic navigator
 */

function renderNavigatorView(container) {
  container.innerHTML = `
    <div class="navigator-view">
      <div class="view-header">
        <h2>Semantic Navigator</h2>
        <p class="view-subtitle">Explore your codebase in latent space - where semantic similarity becomes visual proximity</p>
      </div>

      <!-- View Mode Switcher -->
      <div class="view-mode-controls">
        <div>
          <h3>View Mode</h3>
          <div class="view-mode-switcher">
            <button class="view-mode-btn active" data-mode="physical" onclick="setNavigatorViewMode('physical')">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 4h3v3H4V4zm5 0h3v3H9V4zM4 9h3v3H4V9zm5 0h3v3H9V9z"/>
              </svg>
              Physical
            </button>
            <button class="view-mode-btn" data-mode="hybrid" onclick="setNavigatorViewMode('hybrid')">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="4" r="2"/>
                <circle cx="4" cy="12" r="2"/>
                <circle cx="12" cy="12" r="2"/>
                <path d="M8 6L4 10M8 6l4 4"/>
              </svg>
              Hybrid
            </button>
            <button class="view-mode-btn" data-mode="latent" onclick="setNavigatorViewMode('latent')">
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
          <h3>Transition Speed</h3>
          <input type="range" id="transitionSpeed" min="0.5" max="2" step="0.1" value="1" oninput="updateTransitionSpeed(this.value)">
          <div class="speed-label-wrapper">
            <span>Slow</span>
            <span id="speedLabel">1.0x</span>
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
          <h3 class="card-title">Semantic Insights</h3>
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

  // Initialize navigator after DOM is ready
  setTimeout(() => {
    if (window.initializeNavigator) window.initializeNavigator();
  }, 0);
}

// Export to window for global access
window.renderNavigatorView = renderNavigatorView;

