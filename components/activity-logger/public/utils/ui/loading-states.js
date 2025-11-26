/**
 * Standardized Loading States and Skeleton Screens
 */

/**
 * Create a skeleton screen element
 * @param {string} type - Type of skeleton ('text', 'card', 'list', 'table')
 * @param {Object} options - Options for skeleton
 * @returns {HTMLElement}
 */
function createSkeleton(type = 'text', options = {}) {
  const { lines = 3, width = '100%', height = '20px', className = '' } = options;
  
  const skeleton = document.createElement('div');
  skeleton.className = `skeleton skeleton-${type} ${className}`;
  
  switch (type) {
    case 'text':
      for (let i = 0; i < lines; i++) {
        const line = document.createElement('div');
        line.className = 'skeleton-line';
        line.style.width = i === lines - 1 ? '60%' : width;
        line.style.height = height;
        skeleton.appendChild(line);
      }
      break;
      
    case 'card':
      const card = document.createElement('div');
      card.className = 'skeleton-card';
      card.style.width = width;
      card.style.height = height || '200px';
      skeleton.appendChild(card);
      break;
      
    case 'list':
      for (let i = 0; i < lines; i++) {
        const item = document.createElement('div');
        item.className = 'skeleton-list-item';
        item.style.height = height;
        skeleton.appendChild(item);
      }
      break;
      
    case 'table':
      const table = document.createElement('div');
      table.className = 'skeleton-table';
      for (let i = 0; i < lines; i++) {
        const row = document.createElement('div');
        row.className = 'skeleton-table-row';
        for (let j = 0; j < 3; j++) {
          const cell = document.createElement('div');
          cell.className = 'skeleton-table-cell';
          row.appendChild(cell);
        }
        table.appendChild(row);
      }
      skeleton.appendChild(table);
      break;
  }
  
  return skeleton;
}

/**
 * Show loading state in container
 * @param {HTMLElement} container - Container element
 * @param {string} message - Loading message
 * @param {string} type - Skeleton type
 */
function showLoadingState(container, message = 'Loading...', type = 'text') {
  if (!container) return;
  
  const loadingContainer = document.createElement('div');
  loadingContainer.className = 'loading-state-container';
  
  const spinner = document.createElement('div');
  spinner.className = 'loading-spinner';
  
  const messageEl = document.createElement('div');
  messageEl.className = 'loading-message';
  messageEl.textContent = message;
  
  loadingContainer.appendChild(spinner);
  loadingContainer.appendChild(messageEl);
  
  // Clear and add loading state
  container.textContent = '';
  container.appendChild(loadingContainer);
  
  // Add skeleton if type is specified
  if (type !== 'text') {
    const skeleton = createSkeleton(type);
    container.appendChild(skeleton);
  }
}

/**
 * Show progress indicator
 * @param {HTMLElement} container - Container element
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} message - Progress message
 */
function showProgress(container, progress = 0, message = '') {
  if (!container) return;
  
  let progressContainer = container.querySelector('.progress-container');
  if (!progressContainer) {
    progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    container.textContent = '';
    container.appendChild(progressContainer);
  }
  
  const progressBar = progressContainer.querySelector('.progress-bar') || 
    (() => {
      const bar = document.createElement('div');
      bar.className = 'progress-bar';
      progressContainer.appendChild(bar);
      return bar;
    })();
  
  progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
  
  if (message) {
    let messageEl = progressContainer.querySelector('.progress-message');
    if (!messageEl) {
      messageEl = document.createElement('div');
      messageEl.className = 'progress-message';
      progressContainer.appendChild(messageEl);
    }
    messageEl.textContent = message;
  }
}

/**
 * Show empty state
 * @param {HTMLElement} container - Container element
 * @param {string} message - Empty state message
 * @param {string} icon - Optional icon/symbol
 */
function showEmptyState(container, message = 'No data available', icon = '') {
  if (!container) return;
  
  const emptyContainer = document.createElement('div');
  emptyContainer.className = 'empty-state';
  
  if (icon) {
    const iconEl = document.createElement('div');
    iconEl.className = 'empty-state-icon';
    iconEl.textContent = icon;
    emptyContainer.appendChild(iconEl);
  }
  
  const messageEl = document.createElement('div');
  messageEl.className = 'empty-state-message';
  messageEl.textContent = message;
  emptyContainer.appendChild(messageEl);
  
  container.textContent = '';
  container.appendChild(emptyContainer);
}

/**
 * Show error state with retry option
 * @param {HTMLElement} container - Container element
 * @param {Error|string} error - Error object or message
 * @param {Function} onRetry - Optional retry function
 */
function showErrorState(container, error, onRetry = null) {
  if (!container) return;
  
  const errorContainer = document.createElement('div');
  errorContainer.className = 'error-state';
  
  const icon = document.createElement('div');
  icon.className = 'error-state-icon';
  icon.textContent = '[Warning]';
  
  const message = document.createElement('div');
  message.className = 'error-state-message';
  message.textContent = error instanceof Error ? error.message : error;
  
  errorContainer.appendChild(icon);
  errorContainer.appendChild(message);
  
  if (onRetry && typeof onRetry === 'function') {
    const retryButton = document.createElement('button');
    retryButton.className = 'btn btn-primary';
    retryButton.textContent = 'Retry';
    retryButton.onclick = onRetry;
    errorContainer.appendChild(retryButton);
  }
  
  container.textContent = '';
  container.appendChild(errorContainer);
}

// Add CSS for loading states
const style = document.createElement('style');
style.textContent = `
  .loading-state-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-xl, 2rem);
    gap: var(--space-md, 1rem);
  }
  
  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--color-border, #e5e5e5);
    border-top-color: var(--color-primary, #3b82f6);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .loading-message {
    color: var(--color-text-muted, #666);
    font-size: var(--text-sm, 0.875rem);
  }
  
  .skeleton {
    animation: skeleton-pulse 1.5s ease-in-out infinite;
  }
  
  .skeleton-line,
  .skeleton-card,
  .skeleton-list-item,
  .skeleton-table-cell {
    background: linear-gradient(90deg, 
      var(--color-surface, #f9f9f9) 25%, 
      var(--color-border, #e5e5e5) 50%, 
      var(--color-surface, #f9f9f9) 75%);
    background-size: 200% 100%;
    border-radius: var(--radius-sm, 4px);
    margin-bottom: var(--space-sm, 0.5rem);
  }
  
  @keyframes skeleton-pulse {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  
  .skeleton-list-item {
    height: 60px;
  }
  
  .skeleton-table-row {
    display: flex;
    gap: var(--space-sm, 0.5rem);
    margin-bottom: var(--space-sm, 0.5rem);
  }
  
  .skeleton-table-cell {
    flex: 1;
    height: 40px;
  }
  
  .progress-container {
    padding: var(--space-lg, 1.5rem);
  }
  
  .progress-bar {
    height: 8px;
    background: var(--color-primary, #3b82f6);
    border-radius: var(--radius-sm, 4px);
    transition: width 0.3s ease;
  }
  
  .progress-message {
    margin-top: var(--space-sm, 0.5rem);
    color: var(--color-text-muted, #666);
    font-size: var(--text-sm, 0.875rem);
  }
  
  .empty-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-xl, 2rem);
    text-align: center;
    gap: var(--space-md, 1rem);
  }
  
  .empty-state-icon,
  .error-state-icon {
    font-size: 3rem;
    opacity: 0.5;
  }
  
  .empty-state-message,
  .error-state-message {
    color: var(--color-text-muted, #666);
    font-size: var(--text-base, 1rem);
  }
  
  .error-state-message {
    color: var(--color-error, #ef4444);
  }
`;

if (!document.querySelector('style[data-loading-states]')) {
  style.setAttribute('data-loading-states', 'true');
  document.head.appendChild(style);
}

// Export to window
window.createSkeleton = createSkeleton;
window.showLoadingState = showLoadingState;
window.showProgress = showProgress;
window.showEmptyState = showEmptyState;
window.showErrorState = showErrorState;

