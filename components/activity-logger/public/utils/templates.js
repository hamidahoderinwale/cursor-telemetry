/**
 * HTML Templates Utility
 * Reusable HTML template functions - no HTML strings in main JS files
 */

/**
 * Helper for escaping HTML
 */
function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Create an empty state element
 */
function emptyState(text, hint = '') {
  return `
    <div class="empty-state">
      <div class="empty-state-text">${escapeHtml(text)}</div>
      ${hint ? `<div class="empty-state-hint">${escapeHtml(hint)}</div>` : ''}
    </div>
  `;
}

/**
 * Create a card element
 */
function card(header, body, options = {}) {
  const headerContent = typeof header === 'string' 
    ? `<h3 class="card-title">${escapeHtml(header)}</h3>`
    : header;
  
  const subtitle = options.subtitle 
    ? `<p class="card-subtitle">${escapeHtml(options.subtitle)}</p>`
    : '';
  
  return `
    <div class="card ${options.className || ''}">
      <div class="card-header">
        ${headerContent}
        ${subtitle}
      </div>
      <div class="card-body">
        ${body}
      </div>
    </div>
  `;
}

/**
 * Create a badge element
 */
function badge(text, variant = 'default') {
  return `<span class="badge badge-${variant}">${escapeHtml(text)}</span>`;
}

// Export functions to window for global access
window.escapeHtml = escapeHtml;
window.emptyState = emptyState;
window.card = card;
window.badge = badge;

