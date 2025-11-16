/**
 * Procedural Clio Templates
 */

function renderProceduralClioTemplate() {
  return `
    <div class="procedural-clio-view">
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
            <h2 class="clio-section-title">Motif Map (Rung 6)</h2>
            <p class="clio-section-subtitle">Each bubble represents a recurring procedural pattern (motif)</p>
          </div>
          <div class="clio-motif-map" id="clio-motif-map"></div>
        </div>
        
        <!-- D. Motif Details Panel (Right Side) -->
        <div class="clio-motif-details-container">
          <div class="clio-motif-details-header">
            <h3 class="clio-section-title">Motif Card</h3>
          </div>
          <div class="clio-motif-details" id="clio-motif-details">
            <div class="motif-details-placeholder">
              <p>Click a motif bubble to view details</p>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Optional: Motif Frequency Timeline (Bottom Strip) -->
      <div class="clio-timeline-container" id="clio-timeline-container" style="display: none;">
        <div class="clio-timeline-header">
          <h3 class="clio-section-title">Motif Frequency Timeline</h3>
        </div>
        <div class="clio-timeline" id="clio-timeline"></div>
      </div>
    </div>
  `;
}

// Export to window
window.renderProceduralClioTemplate = renderProceduralClioTemplate;

