/**
 * View Router - Handles view switching and rendering
 */

function switchView(viewName) {
  window.state.currentView = viewName;
  
  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.view === viewName) {
      link.classList.add('active');
    }
  });

  renderCurrentView();
}

function renderCurrentView() {
  const container = document.getElementById('viewContainer');
  if (!container) return;

  switch (window.state.currentView) {
    case 'overview':
      if (window.renderOverviewView) window.renderOverviewView(container);
      break;
    case 'activity':
      if (window.renderActivityView) window.renderActivityView(container);
      break;
    case 'threads':
      if (window.renderThreadsView) window.renderThreadsView(container);
      break;
    case 'analytics':
      if (window.renderAnalyticsView) window.renderAnalyticsView(container);
      break;
    case 'filegraph':
      if (window.renderFileGraphView) window.renderFileGraphView(container);
      break;
    case 'navigator':
      if (window.renderNavigatorView) window.renderNavigatorView(container);
      break;
    case 'todos':
      if (window.renderTodoView) window.renderTodoView(container);
      break;
    case 'system':
      if (window.renderSystemView) window.renderSystemView(container);
      break;
    case 'api-docs':
      if (window.renderAPIDocsView) window.renderAPIDocsView(container);
      break;
    case 'schema-config':
      if (window.renderSchemaConfigView) window.renderSchemaConfigView(container);
      break;
    case 'workspace-comparison':
      if (window.renderWorkspaceComparisonView) window.renderWorkspaceComparisonView(container);
      break;
    default:
      container.innerHTML = '<div class="empty-state">View not found</div>';
  }
}

// Export to window for global access
window.switchView = switchView;
window.renderCurrentView = renderCurrentView;

