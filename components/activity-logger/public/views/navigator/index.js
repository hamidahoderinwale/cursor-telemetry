/**
 * Navigator View - UMAP semantic navigator
 * HTML templates moved to views/navigator/templates.js
 */

function renderNavigatorView(container) {
  container.innerHTML = window.renderNavigatorViewTemplate();

  // Reset initialization state when view is re-rendered
  if (window.navigatorState) {
    window.navigatorState.isInitialized = false;
    window.navigatorState.isInitializing = false;
  }

  // Register cleanup and pause/resume hooks
  if (window.registerViewCleanup) {
    window.registerViewCleanup('navigator', () => {
      // Cleanup 3D renderer if active
      if (window.navigatorState?.cleanup3D) {
        window.navigatorState.cleanup3D();
      }
      // Cleanup 2D renderer if active
      if (window.navigatorState?.svg) {
        window.navigatorState.svg = null;
        window.navigatorState.zoom = null;
        window.navigatorState.g = null;
      }
    });
  }
  
  if (window.registerViewPauseResume) {
    window.registerViewPauseResume('navigator', 
      () => {
        // Pause animations
        if (window.navigatorState?.pause3D) {
          window.navigatorState.pause3D();
        }
        // Pause 2D animations if any
        if (window.navigatorState?.animationId) {
          cancelAnimationFrame(window.navigatorState.animationId);
          window.navigatorState.animationId = null;
        }
      },
      () => {
        // Resume animations
        if (window.navigatorState?.resume3D) {
          window.navigatorState.resume3D();
        }
      }
    );
  }

  // Initialize navigator after DOM is ready
  setTimeout(() => {
    if (window.initializeNavigator) window.initializeNavigator();
  }, 100);
}

/**
 * Populate workspace and directory filter dropdowns
 */
function populateNavigatorFilters() {
  if (!window.navigatorState) return;
  
  const workspaceSelect = document.getElementById('navigatorWorkspaceFilter');
  const directorySelect = document.getElementById('navigatorDirectoryFilter');
  
  // Populate workspace filter
  if (workspaceSelect && window.navigatorState.workspaces) {
    const currentValue = workspaceSelect.value;
    workspaceSelect.innerHTML = '<option value="all">All Workspaces</option>';
    window.navigatorState.workspaces.forEach(ws => {
      const option = document.createElement('option');
      option.value = ws;
      option.textContent = ws.length > 50 ? ws.substring(0, 47) + '...' : ws;
      if (ws === currentValue) option.selected = true;
      workspaceSelect.appendChild(option);
    });
  }
  
  // Populate directory filter
  if (directorySelect && window.navigatorState.directories) {
    const currentValue = directorySelect.value;
    directorySelect.innerHTML = '<option value="all">All Directories</option>';
    // Show top-level directories first
    const topLevelDirs = new Set();
    window.navigatorState.directories.forEach(dir => {
      const parts = dir.split('/').filter(p => p);
      if (parts.length > 0) {
        topLevelDirs.add(parts[0]);
      }
    });
    
    Array.from(topLevelDirs).sort().forEach(dir => {
      const option = document.createElement('option');
      option.value = dir;
      option.textContent = `/${dir}/`;
      if (dir === currentValue) option.selected = true;
      directorySelect.appendChild(option);
    });
  }
}

/**
 * Filter navigator by workspace
 */
function filterNavigatorByWorkspace(workspace) {
  if (!window.navigatorState) return;
  
  window.navigatorState.selectedWorkspace = workspace;
  
  // Re-initialize navigator with filter
  const container = document.getElementById('navigatorContainer');
  if (container && window.initializeNavigator) {
    window.navigatorState.isInitialized = false;
    window.initializeNavigator();
  }
}

/**
 * Filter navigator by directory
 */
function filterNavigatorByDirectory(directory) {
  if (!window.navigatorState) return;
  
  window.navigatorState.selectedDirectory = directory;
  
  // Re-initialize navigator with filter
  const container = document.getElementById('navigatorContainer');
  if (container && window.initializeNavigator) {
    window.navigatorState.isInitialized = false;
    window.initializeNavigator();
  }
}

// Export to window for global access
window.renderNavigatorView = renderNavigatorView;
window.populateNavigatorFilters = populateNavigatorFilters;
window.filterNavigatorByWorkspace = filterNavigatorByWorkspace;
window.filterNavigatorByDirectory = filterNavigatorByDirectory;
