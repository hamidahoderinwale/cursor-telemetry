/**
 * Clio View - Privacy-Preserving Workflow Patterns
 * Displays Clio motifs with interactive visualization
 */

async function renderClioView(container) {
  if (!container) {
    console.error('[CLIO] Container not provided');
    return;
  }

  console.log('[CLIO] Rendering Clio view...');

  // Load CSS if not already loaded
  if (!document.querySelector('link[href*="clio-visualization.css"]')) {
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'views/clio/clio-visualization.css';
    document.head.appendChild(cssLink);
  }

  // Load visualization script if not already loaded
  if (!window.ClioVisualization) {
    await loadScript('views/clio/clio-visualization.js');
  }

  // Create container for visualization
  container.innerHTML = '<div id="clioVisualizationContainer"></div>';

  // Initialize visualization
  window.clioViz = new window.ClioVisualization('clioVisualizationContainer');

  // Check if Clio data is available
  try {
    const statusResponse = await fetch('/api/clio/status');
    const status = await statusResponse.json();

    if (!status.available || !status.ready) {
      renderClioSetupMessage(container, status);
      return;
    }

    // Try to load existing motifs from database
    const motifsResponse = await fetch('/api/clio/motifs?limit=100');
    const motifsData = await motifsResponse.json();

    if (motifsData.success && motifsData.motifs && motifsData.motifs.length > 0) {
      // Convert stored motifs to visualization format
      const clioData = {
        global: {
          clusters: motifsData.motifs
            .filter(m => m.cluster_type === 'global')
            .map(m => m.cluster_data)
        },
        workspaceSpecific: {},
        repoType: {}
      };

      // Group by workspace
      motifsData.motifs
        .filter(m => m.cluster_type === 'workspace' && m.workspace_path)
        .forEach(m => {
          if (!clioData.workspaceSpecific[m.workspace_path]) {
            clioData.workspaceSpecific[m.workspace_path] = { clusters: [] };
          }
          clioData.workspaceSpecific[m.workspace_path].clusters.push(m.cluster_data);
        });

      // Group by repo type
      motifsData.motifs
        .filter(m => m.cluster_type === 'repo_type')
        .forEach(m => {
          const repoType = m.cluster_data?.repoType || 'unknown';
          if (!clioData.repoType[repoType]) {
            clioData.repoType[repoType] = { clusters: [] };
          }
          clioData.repoType[repoType].clusters.push(m.cluster_data);
        });

      await window.clioViz.render(clioData);
    } else {
      // No motifs yet - show empty state
      await window.clioViz.render({});
    }

  } catch (error) {
    console.error('[CLIO] Error loading Clio data:', error);
    container.innerHTML = `
      <div class="clio-error-state">
        <h3>Error Loading Clio Data</h3>
        <p>${error.message}</p>
        <button class="btn btn-primary" onclick="window.renderClioView(document.getElementById('view-container'))">
          Retry
        </button>
      </div>
    `;
  }
}

function renderClioSetupMessage(container, status) {
  container.innerHTML = `
    <div class="clio-setup-message">
      <h2>Clio Service Setup Required</h2>
      <p>Clio requires API keys for embeddings and LLM services.</p>
      
      <div class="setup-status">
        <h3>Service Status:</h3>
        <ul>
          <li>
            <strong>Embedding Service:</strong> 
            ${status.embedding?.available ? '✓ Available' : '✗ Not configured'}
            ${status.embedding?.provider ? ` (${status.embedding.provider})` : ''}
          </li>
          <li>
            <strong>LLM Service:</strong> 
            ${status.llm?.available ? '✓ Available' : '✗ Not configured'}
            ${status.llm?.provider ? ` (${status.llm.provider})` : ''}
          </li>
        </ul>
      </div>

      <div class="setup-instructions">
        <h3>Setup Instructions:</h3>
        <ol>
          <li>Set environment variables in your <code>.env</code> file:</li>
          <pre>OPENROUTER_API_KEY=your_key_here
# OR
HF_TOKEN=your_huggingface_token_here</pre>
          <li>Restart the companion service</li>
          <li>Refresh this page</li>
        </ol>
      </div>
    </div>
  `;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Export to window for global access
window.renderClioView = renderClioView;

