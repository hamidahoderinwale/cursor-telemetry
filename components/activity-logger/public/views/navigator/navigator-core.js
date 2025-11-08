/**
 * Navigator Core Module
 * Main initialization and state management for the semantic navigator
 */

// Navigator state
const navigatorState = {
  viewMode: 'physical',
  interpolation: 0.0,
  transitionSpeed: 1.0,
  physicalPositions: new Map(),
  latentPositions: new Map(),
  nodes: [],
  links: [],
  clusters: [],
  svg: null,
  zoom: null,
  g: null,
  labels: null,
  nodeElements: null,
  linkElements: null,
  labelsVisible: true,
  miniMapSvg: null,
  miniMapViewport: null,
  miniMapScale: 0.2,
  isInitializing: false,
  isInitialized: false
};

/**
 * Initialize the navigator with file data
 */
async function initializeNavigator() {
  const container = document.getElementById('navigatorContainer');
  if (!container) return;
  
  // Prevent multiple simultaneous initializations
  if (navigatorState.isInitializing) {
    console.log('[NAVIGATOR] Initialization already in progress, skipping...');
    return;
  }
  
  // If already initialized and container has content, skip
  if (navigatorState.isInitialized && container.innerHTML && !container.innerHTML.includes('loading-wrapper')) {
    console.log('[NAVIGATOR] Already initialized, skipping...');
    return;
  }
  
  navigatorState.isInitializing = true;
  
  try {
    const startTime = Date.now();
    console.log('[NAVIGATOR] Starting initialization...');
    
    // Show loading
    container.innerHTML = '<div class="loading-wrapper"><div class="loading-spinner"></div><span>Computing latent embeddings...</span></div>';
    
    // Fetch file data
    const response = await fetch(`${window.CONFIG.API_BASE}/api/file-contents?limit=100000`);
    const data = await response.json();
    
    if (!data.files || data.files.length === 0) {
      container.innerHTML = '<div class="empty-wrapper">No file data available</div>';
      return;
    }
    
    // Helper function to check if a string is a Git object hash (40-char hex)
    const isGitObjectHash = (str) => /^[0-9a-f]{40}$/i.test(str);
    
    // Helper function to get a meaningful file name
    const getMeaningfulName = (file) => {
      // If the name itself is a Git hash, try to extract from path
      if (isGitObjectHash(file.name)) {
        const pathParts = file.path.split('/');
        // Find a non-hash part of the path
        for (let i = pathParts.length - 1; i >= 0; i--) {
          if (!isGitObjectHash(pathParts[i]) && pathParts[i].length > 0) {
            return pathParts[i];
          }
        }
        return 'Git object';
      }
      return file.name;
    };
    
    // Prepare files with events - filter out Git object hashes
    let files = data.files
      .filter(f => {
        // Filter out Git object hashes
        if (f.path && f.path.includes('.git/objects/') && isGitObjectHash(f.name)) {
          return false;
        }
        return true;
      })
      .map(f => {
        const relatedEvents = (window.state.data.events || []).filter(event => {
          try {
            const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
            const filePath = details?.file_path || event.file_path || '';
            return filePath.includes(f.name) || f.path.includes(filePath);
          } catch (e) {
            return false;
          }
        });
        
        // Get meaningful display name
        const displayName = getMeaningfulName(f);
        
        return {
          id: f.path,
          path: f.path,
          name: displayName,  // Use meaningful name instead of hash
          originalName: f.name,  // Keep original for reference
          ext: f.ext,
          content: f.content,
          changes: f.changes || 0,
          lastModified: f.lastModified,
          size: f.size,
          events: relatedEvents || []
        };
      });
    
    console.log(`[NAVIGATOR] Processing ${files.length} files...`);
    
    // Limit files for performance (embeddings are O(n²))
    const MAX_FILES = 2000; // Increased to cover more of the database while keeping O(n^2) manageable
    if (files.length > MAX_FILES) {
      console.warn(`[NAVIGATOR] Too many files (${files.length}), limiting to ${MAX_FILES} most active files`);
      // Sort by activity (events + changes) and take top N
      files = files
        .map(f => ({ ...f, activity: f.events.length + (f.changes || 0) }))
        .sort((a, b) => b.activity - a.activity)
        .slice(0, MAX_FILES);
    }
    
    // Compute physical positions (co-occurrence based)
    const { nodes: physicalNodes, links } = window.computePhysicalLayout(files);
    
    // Compute latent positions (semantic similarity based) using UMAP-like layout
    const latentNodes = window.computeLatentLayoutUMAP(files);
    
    // Store positions
    physicalNodes.forEach(n => {
      navigatorState.physicalPositions.set(n.id, { x: n.x, y: n.y });
    });
    
    latentNodes.forEach(n => {
      navigatorState.latentPositions.set(n.id, { x: n.x, y: n.y });
    });
    
    // Detect latent clusters
    navigatorState.clusters = window.detectLatentClusters(latentNodes, links);
    
    // Store data
    navigatorState.nodes = physicalNodes;
    navigatorState.links = links;
    
    // Render
    window.renderNavigator(container, physicalNodes, links);
    
    // Render mini-map
    window.renderMiniMap();
    
    // Update stats (with delay to ensure DOM is ready)
    setTimeout(() => {
      window.updateNavigatorStats();
    }, 100);
    
    // Generate insights
    window.generateSemanticInsights();
    
    navigatorState.isInitialized = true;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[NAVIGATOR] ✅ Initialization complete in ${elapsed}s`);
    
  } catch (error) {
    // Suppress CORS/network errors (expected when companion service is offline)
    const errorMessage = error.message || error.toString();
    const isNetworkError = errorMessage.includes('CORS') || 
                           errorMessage.includes('NetworkError') || 
                           errorMessage.includes('Failed to fetch') ||
                           error.name === 'NetworkError' ||
                           error.name === 'TypeError';
    
    // Only log if it's not a network error
    if (!isNetworkError) {
      console.error('Error initializing navigator:', error);
    }
    
    // Show user-friendly message instead of error for network issues
    if (isNetworkError) {
      container.innerHTML = `<div class="error-wrapper">Navigator requires companion service (offline mode)</div>`;
    } else {
      const escapeHtml = window.escapeHtml || ((str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
      });
      container.innerHTML = `<div class="error-wrapper">Error loading navigator: ${escapeHtml(error.message)}</div>`;
    }
  } finally {
    navigatorState.isInitializing = false;
  }
}

// Export to window
window.navigatorState = navigatorState;
window.initializeNavigator = initializeNavigator;

