/**
 * Navigator Core Module
 * Main initialization and state management for the semantic navigator
 */

// Navigator state
const navigatorState = {
  viewMode: 'physical',
  viewDimension: '2d', // '2d' or '3d'
  interpolation: 0.0,
  transitionSpeed: 2.0, // Maximum speed by default
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
  isInitialized: false,
  searchResults: [],
  searchQuery: null,
  autoRotate: false,
  // 3D state
  scene3D: null,
  camera3D: null,
  renderer3D: null,
  controls3D: null,
  nodeMeshes3D: null,
  linkGroup3D: null,
  nodeGroup3D: null,
  cleanup3D: null
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
    
    // Lazy load navigator services if not already loaded
    if (window.loadNavigatorServices && !window._navigatorServicesLoaded) {
      await window.loadNavigatorServices();
    }
    
    // Show loading
    container.innerHTML = '<div class="loading-wrapper"><div class="loading-spinner"></div><span>Computing latent embeddings...</span></div>';
    
    // Fetch file data - reduced limit for faster initial load
    // Start with 500 files, can load more on demand
    let response, data;
    try {
      // Check cache first
      const cacheKey = 'navigatorFileData';
      const cacheExpiry = 5 * 60 * 1000; // 5 minutes
      const cached = sessionStorage.getItem(cacheKey);
      
      if (cached) {
        try {
          const cachedData = JSON.parse(cached);
          if (Date.now() - cachedData.timestamp < cacheExpiry) {
            console.log('[NAVIGATOR] Using cached file data');
            data = cachedData.data;
          }
        } catch (e) {
          // Cache invalid, fetch fresh
        }
      }
      
      if (!data) {
        // Reduced from 100k to 500 for much faster initial load
        response = await fetch(`${window.CONFIG.API_BASE}/api/file-contents?limit=500`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        data = await response.json();
        
        // Cache the data
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            data: data,
            timestamp: Date.now()
          }));
        } catch (e) {
          // Cache storage failed, continue anyway
        }
      }
    } catch (error) {
      console.warn('[NAVIGATOR] Failed to fetch file contents:', error.message);
      container.innerHTML = `
        <div class="empty-wrapper" style="padding: 2rem; text-align: center;">
          <div style="font-size: 1.1rem; font-weight: 500; margin-bottom: 0.5rem; color: var(--color-text);">Companion service not available</div>
          <div style="font-size: 0.9rem; margin-bottom: 1rem; color: var(--color-text-muted);">File contents cannot be loaded. Make sure the companion service is running on port 43917.</div>
          <div style="font-size: 0.85rem; opacity: 0.8; color: var(--color-text-muted);">Error: ${error.message}</div>
        </div>
      `;
      return;
    }
    
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
    
    // Build event lookup map first (O(n) instead of O(n*m))
    // This prevents timeout when processing large datasets
    const eventsByFilePath = new Map();
    const allEvents = window.state.data.events || [];
    
    console.log(`[NAVIGATOR] Building event lookup map from ${allEvents.length} events...`);
    
    allEvents.forEach(event => {
      try {
        const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
        const filePath = details?.file_path || event.file_path || '';
        if (!filePath) return;
        
        // Normalize path for matching
        const normalizedPath = filePath.toLowerCase();
        const pathParts = normalizedPath.split('/');
        const fileName = pathParts[pathParts.length - 1];
        
        // Store event by full path and by filename for flexible matching
        if (!eventsByFilePath.has(normalizedPath)) {
          eventsByFilePath.set(normalizedPath, []);
        }
        eventsByFilePath.get(normalizedPath).push(event);
        
        // Also index by filename for partial matches
        if (fileName && fileName !== normalizedPath) {
          const fileNameKey = `filename:${fileName}`;
          if (!eventsByFilePath.has(fileNameKey)) {
            eventsByFilePath.set(fileNameKey, []);
          }
          eventsByFilePath.get(fileNameKey).push(event);
        }
      } catch (e) {
        // Skip invalid events
      }
    });
    
    console.log(`[NAVIGATOR] Event lookup map built with ${eventsByFilePath.size} keys`);
    
    // Extract workspace and directory information
    // First, try to get comprehensive workspace list from API
    let allWorkspacesFromState = new Set();
    
    try {
      // Try to fetch from API first (most comprehensive)
      // Use AbortController for timeout (5 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const workspaceResponse = await fetch(`${window.CONFIG.API_BASE}/api/workspaces`, { 
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      
      if (workspaceResponse && workspaceResponse.ok) {
        const workspaceData = await workspaceResponse.json();
        const apiWorkspaces = Array.isArray(workspaceData) ? workspaceData : (workspaceData?.data || []);
        apiWorkspaces.forEach(ws => {
          const wsPath = ws.path || ws.id || ws.workspace_path;
          if (wsPath) allWorkspacesFromState.add(wsPath);
        });
        console.log(`[NAVIGATOR] Found ${allWorkspacesFromState.size} workspaces from API`);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.warn('[NAVIGATOR] Could not fetch workspaces from API, using state data:', error.message);
      }
    }
    
    // Also collect from state data (events, prompts, entries) as fallback/enhancement
    // Get from events
    allEvents.forEach(e => {
      const ws = e.workspace_path || e.workspacePath || e.workspace;
      if (ws) allWorkspacesFromState.add(ws);
    });
    
    // Get from prompts
    const allPrompts = window.state?.data?.prompts || [];
    allPrompts.forEach(p => {
      const ws = p.workspace_path || p.workspacePath || p.workspaceId || p.workspaceName;
      if (ws) allWorkspacesFromState.add(ws);
    });
    
    // Get from entries
    const allEntries = window.state?.data?.entries || [];
    allEntries.forEach(e => {
      const ws = e.workspace_path || e.workspacePath || e.workspace;
      if (ws) allWorkspacesFromState.add(ws);
    });
    
    // Get from state workspaces if available
    const stateWorkspaces = window.state?.data?.workspaces || [];
    stateWorkspaces.forEach(ws => {
      const wsPath = ws.path || ws.id || ws.workspace_path;
      if (wsPath) allWorkspacesFromState.add(wsPath);
    });
    
    console.log(`[NAVIGATOR] Found ${allWorkspacesFromState.size} total workspaces (from API + state data):`, Array.from(allWorkspacesFromState).slice(0, 10));
    
    const workspaces = new Set(allWorkspacesFromState); // Start with all collected workspaces
    const directories = new Set();
    
    // Helper to extract workspace from path (fallback only)
    const extractWorkspace = (path) => {
      if (!path) return null;
      // Try to find workspace root (common patterns)
      const parts = path.split('/');
      // Look for common workspace indicators
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part && part !== '.' && part !== '..' && !part.startsWith('.')) {
          // Return first meaningful directory as workspace
          return parts.slice(0, i + 1).join('/');
        }
      }
      return path.split('/').slice(0, 2).join('/') || path;
    };
    
    // Helper to extract directory from path
    const extractDirectory = (path) => {
      if (!path) return '/';
      const parts = path.split('/');
      if (parts.length <= 1) return '/';
      return parts.slice(0, -1).join('/') || '/';
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
        // Look up events from map instead of filtering all events (O(1) lookup)
        const relatedEvents = [];
        const normalizedPath = f.path.toLowerCase();
        const fileName = f.name.toLowerCase();
        
        // Try exact path match first
        if (eventsByFilePath.has(normalizedPath)) {
          relatedEvents.push(...eventsByFilePath.get(normalizedPath));
        }
        
        // Try filename match
        const fileNameKey = `filename:${fileName}`;
        if (eventsByFilePath.has(fileNameKey)) {
          const filenameEvents = eventsByFilePath.get(fileNameKey);
          // Avoid duplicates
          filenameEvents.forEach(evt => {
            if (!relatedEvents.find(e => e.id === evt.id || e.timestamp === evt.timestamp)) {
              relatedEvents.push(evt);
            }
          });
        }
        
        // Extract workspace from events/files - prioritize actual workspace_path
        let workspace = null;
        
        // First, try to get workspace from file data itself
        if (f.workspace_path || f.workspacePath || f.workspace) {
          workspace = f.workspace_path || f.workspacePath || f.workspace;
        }
        
        // Then, try to get from related events (more reliable)
        if (!workspace && relatedEvents.length > 0) {
          const eventWorkspaces = relatedEvents
            .map(e => e.workspace_path || e.workspacePath || e.workspace || '')
            .filter(Boolean);
          
          if (eventWorkspaces.length > 0) {
            // Use the most common workspace from events
            const workspaceCounts = {};
            eventWorkspaces.forEach(ws => {
              workspaceCounts[ws] = (workspaceCounts[ws] || 0) + 1;
            });
            const sortedWorkspaces = Object.entries(workspaceCounts)
              .sort((a, b) => b[1] - a[1]);
            if (sortedWorkspaces.length > 0) {
              workspace = sortedWorkspaces[0][0];
            }
          }
        }
        
        // Fallback to path-based extraction if no workspace found
        if (!workspace) {
          workspace = extractWorkspace(f.path);
        }
        
        const directory = extractDirectory(f.path);
        const directoryParts = directory.split('/').filter(p => p);
        const topLevelDir = directoryParts.length > 0 ? directoryParts[0] : '/';
        
        // Track workspaces and directories
        if (workspace) workspaces.add(workspace);
        if (directory) directories.add(directory);
        if (topLevelDir) directories.add(topLevelDir);
        
        // Get meaningful display name
        const displayName = getMeaningfulName(f);
        
        // Calculate changes from events if not provided
        const changes = relatedEvents.length > 0 ? relatedEvents.length : (f.changes || 0);
        
        // Calculate lastModified from most recent event if not provided
        let lastModified = f.lastModified;
        if (relatedEvents.length > 0) {
          const eventTimestamps = relatedEvents
            .map(e => {
              const ts = e.timestamp;
              if (!ts) return null;
              const time = typeof ts === 'string' ? new Date(ts).getTime() : ts;
              return isNaN(time) ? null : time;
            })
            .filter(Boolean);
          if (eventTimestamps.length > 0) {
            const maxEventTime = Math.max(...eventTimestamps);
            // Use the most recent event time if file.lastModified is missing or older
            if (!lastModified || (typeof lastModified === 'string' ? new Date(lastModified).getTime() : lastModified) < maxEventTime) {
              lastModified = maxEventTime;
            }
          }
        }
        
        return {
          id: f.path,
          path: f.path,
          name: displayName,  // Use meaningful name instead of hash
          originalName: f.name,  // Keep original for reference
          ext: f.ext,
          content: f.content,
          changes: changes,
          lastModified: lastModified,
          size: f.size,
          events: relatedEvents,
          workspace: workspace, // Use the workspace we determined above
          directory: directory,
          topLevelDir: topLevelDir,
          directoryDepth: directoryParts.length
        };
      });
    
    console.log(`[NAVIGATOR] Processing ${files.length} files...`);
    console.log(`[NAVIGATOR] Found ${workspaces.size} workspaces and ${directories.size} directories`);
    
    // Store workspace and directory info in navigator state
    navigatorState.workspaces = Array.from(workspaces).sort();
    navigatorState.directories = Array.from(directories).sort();
    navigatorState.selectedWorkspace = window.state?.currentWorkspace || 'all';
    navigatorState.selectedDirectory = 'all';
    
    // Apply workspace filter if set
    if (navigatorState.selectedWorkspace && navigatorState.selectedWorkspace !== 'all') {
      files = files.filter(f => {
        const fileWorkspace = f.workspace || '';
        return fileWorkspace === navigatorState.selectedWorkspace || 
               fileWorkspace.includes(navigatorState.selectedWorkspace) ||
               navigatorState.selectedWorkspace.includes(fileWorkspace);
      });
      console.log(`[NAVIGATOR] Filtered to ${files.length} files in workspace: ${navigatorState.selectedWorkspace}`);
    }
    
    // Apply directory filter if set
    if (navigatorState.selectedDirectory && navigatorState.selectedDirectory !== 'all') {
      files = files.filter(f => {
        return f.topLevelDir === navigatorState.selectedDirectory ||
               f.directory.startsWith(navigatorState.selectedDirectory) ||
               f.path.includes(navigatorState.selectedDirectory);
      });
      console.log(`[NAVIGATOR] Filtered to ${files.length} files in directory: ${navigatorState.selectedDirectory}`);
    }
    
    // Limit files for performance (embeddings are O(n²))
    // Reduced from 2000 to 800 for faster computation
    const MAX_FILES = 800;
    if (files.length > MAX_FILES) {
      console.warn(`[NAVIGATOR] Too many files (${files.length}), limiting to ${MAX_FILES} most active files`);
      // Sort by activity (events + changes) and take top N
      files = files
        .map(f => ({ ...f, activity: f.events.length + (f.changes || 0) }))
        .sort((a, b) => b.activity - a.activity)
        .slice(0, MAX_FILES);
    }
    
    // Update loading message
    container.innerHTML = '<div class="loading-wrapper"><div class="loading-spinner"></div><span>Computing physical layout...</span></div>';
    
    // Compute physical positions (co-occurrence based) - show this first for immediate feedback
    const { nodes: physicalNodes, links } = window.computePhysicalLayout(files);
    
    // Store physical positions immediately
    physicalNodes.forEach(n => {
      navigatorState.physicalPositions.set(n.id, { x: n.x, y: n.y });
    });
    
    // Store data
    navigatorState.nodes = physicalNodes;
    navigatorState.links = links;
    
    // Render physical layout immediately (progressive loading)
    if (navigatorState.viewDimension === '3d' && window.renderNavigator3D) {
      window.renderNavigator3D(container, physicalNodes, links);
    } else if (window.renderNavigator) {
      window.renderNavigator(container, physicalNodes, links);
    }
    console.log('[NAVIGATOR] Physical layout rendered, computing latent embeddings in background...');
    
    // Populate workspace and directory filters (can do this while latent computes)
    if (window.populateNavigatorFilters) {
      window.populateNavigatorFilters();
    }
    
    // Compute latent positions in background (defer to idle time for better UX)
    // This allows users to see and interact with the graph while latent positions compute
    const computeLatentAsync = async () => {
      try {
        container.innerHTML = '<div class="loading-wrapper"><div class="loading-spinner"></div><span>Computing latent embeddings (this may take a moment)...</span></div>';
        const latentNodes = await window.computeLatentLayoutUMAP(files);
        
        // Store latent positions
        latentNodes.forEach(n => {
          navigatorState.latentPositions.set(n.id, { x: n.x, y: n.y });
        });
        
        // Detect latent clusters (now async)
        navigatorState.clusters = await window.detectLatentClusters(latentNodes, links);
        
        // Re-render with both layouts available
        if (navigatorState.viewDimension === '3d' && window.renderNavigator3D) {
          window.renderNavigator3D(container, physicalNodes, links);
        } else if (window.renderNavigator) {
          window.renderNavigator(container, physicalNodes, links);
        }
        console.log('[NAVIGATOR] Latent embeddings complete');
      } catch (error) {
        console.warn('[NAVIGATOR] Latent embedding computation failed:', error.message);
        // Continue with physical layout only - use physical as fallback for latent
        physicalNodes.forEach(n => {
          navigatorState.latentPositions.set(n.id, { x: n.x, y: n.y });
        });
        if (navigatorState.viewDimension === '3d' && window.renderNavigator3D) {
          window.renderNavigator3D(container, physicalNodes, links);
        } else if (window.renderNavigator) {
          window.renderNavigator(container, physicalNodes, links);
        }
      }
    };
    
    // Use requestIdleCallback if available, otherwise setTimeout
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(computeLatentAsync, { timeout: 2000 });
    } else {
      setTimeout(computeLatentAsync, 100);
    }
    
    // Initialize transition speed display
    if (window.initializeTransitionSpeed) {
      window.initializeTransitionSpeed();
    }
    
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
    console.log(`[NAVIGATOR] Initialization complete in ${elapsed}s`);
    
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

