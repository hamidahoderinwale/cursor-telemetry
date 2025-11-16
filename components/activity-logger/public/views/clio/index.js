/**
 * Clio View Entry Point
 * Routes to Procedural Clio unified dashboard
 */

// Load templates first
if (!window.renderProceduralClioTemplate) {
  const templatesScript = document.createElement('script');
  templatesScript.src = 'views/clio/templates.js';
  templatesScript.async = false;
  document.head.appendChild(templatesScript);
}

function renderClioView(container) {
  // Ensure D3.js is loaded
  if (typeof d3 === 'undefined') {
    const d3Script = document.createElement('script');
    d3Script.src = 'https://d3js.org/d3.v7.min.js';
    d3Script.onload = () => {
      initializeClioView(container);
    };
    document.head.appendChild(d3Script);
  } else {
    initializeClioView(container);
  }
}

function initializeClioView(container) {
  // Load procedural Clio script if not already loaded
  if (window.renderProceduralClioView) {
    window.renderProceduralClioView(container);
  } else {
    const script = document.createElement('script');
    script.src = 'views/clio/procedural-clio.js';
    script.onload = () => {
      if (window.renderProceduralClioView) {
        window.renderProceduralClioView(container);
      } else {
        container.innerHTML = '<div class="error-message">Failed to initialize Clio view</div>';
      }
    };
    script.onerror = () => {
      container.innerHTML = '<div class="error-message">Failed to load Clio view scripts</div>';
    };
    document.head.appendChild(script);
  }
}

// Export to window for global access
window.renderClioView = renderClioView;

