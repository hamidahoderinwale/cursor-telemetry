/**
 * Procedural Clio Templates
 */

function renderProceduralClioTemplate() {
  return `
    <div class="procedural-clio-view">
      <!-- Header Section -->
      <div class="clio-view-header">
        <div class="clio-header-content">
          <h1 class="clio-view-title">Procedural Patterns (Clio)</h1>
          <p class="clio-view-description">
            Visual exploration of recurring workflow patterns extracted from your development activity
          </p>
        </div>
        <div class="clio-header-actions">
          <a href="#patterns-history" class="clio-action-link" onclick="window.switchView('patterns-history')">
            View History →
          </a>
        </div>
      </div>

      <!-- A. Summary Bar (Top Row) -->
      <div class="clio-summary-bar" id="clio-summary-bar">
        <div class="summary-loading">Loading summary data...</div>
      </div>
      
      <!-- Motif Filters (Rung 6 only) -->
      <div class="clio-motif-filters" id="clio-motif-filters">
        <!-- Filters will be populated by initializeMotifFilters -->
      </div>
      
      <!-- Main Content Area -->
      <div class="clio-main-content">
        <!-- B. Motif Map (Central Visual - Primary) -->
        <div class="clio-motif-map-container">
          <div class="clio-motif-map-header">
            <h2 class="clio-section-title">Motif Map</h2>
            <p class="clio-section-subtitle">Each bubble represents a recurring procedural pattern. Size indicates frequency, color indicates intent.</p>
            <div class="clio-legend">
              <div class="clio-legend-item">
                <div class="clio-legend-color" style="background: #ef4444;"></div>
                <span>Bug Fix</span>
              </div>
              <div class="clio-legend-item">
                <div class="clio-legend-color" style="background: #3b82f6;"></div>
                <span>Feature</span>
              </div>
              <div class="clio-legend-item">
                <div class="clio-legend-color" style="background: #8b5cf6;"></div>
                <span>Refactor</span>
              </div>
              <div class="clio-legend-item">
                <div class="clio-legend-color" style="background: #10b981;"></div>
                <span>Test</span>
              </div>
            </div>
          </div>
          <div class="clio-motif-map" id="clio-motif-map"></div>
        </div>
        
        <!-- D. Motif Details Panel (Right Side) -->
        <div class="clio-motif-details-container">
          <div class="clio-motif-details-header">
            <h3 class="clio-section-title">Pattern Details</h3>
            <p class="clio-section-subtitle">Select a pattern to explore</p>
          </div>
          <div class="clio-motif-details" id="clio-motif-details">
            <div class="motif-details-placeholder">
              <div class="motif-placeholder-icon">[Pattern]</div>
              <p class="motif-placeholder-text">Click a pattern bubble to view details</p>
              <p class="motif-placeholder-hint">Patterns are automatically extracted from your code changes and AI interactions</p>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Motif Frequency Timeline (Bottom Strip) - Now visible by default -->
      <div class="clio-timeline-container" id="clio-timeline-container">
        <div class="clio-timeline-header">
          <h3 class="clio-section-title">Pattern Frequency Timeline</h3>
          <p class="clio-section-subtitle">How often each pattern appears over time (like GitHub contribution graph)</p>
        </div>
        <div class="clio-timeline" id="clio-timeline"></div>
      </div>
    </div>
  `;
}

// Export to window
window.renderProceduralClioTemplate = renderProceduralClioTemplate;

