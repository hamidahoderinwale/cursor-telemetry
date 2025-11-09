/**
 * Lucide Icons Helper
 * Provides utility functions for rendering Lucide icons
 */

/**
 * Render a Lucide icon as SVG
 * @param {string} iconName - Name of the icon (e.g., 'sparkles', 'zap')
 * @param {object} options - Options for the icon (size, color, class, etc.)
 * @returns {string} SVG HTML string
 */
function renderLucideIcon(iconName, options = {}) {
  const {
    size = 16,
    color = 'currentColor',
    strokeWidth = 2,
    class: className = '',
    style = ''
  } = options;

  // Icon SVG paths (common icons used in the app)
  const iconPaths = {
    sparkles: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    brain: '<path d="M12 5a3 3 0 0 0-3 3v11a3 3 0 0 0 6 0V8a3 3 0 0 0-3-3Z"/><path d="M12 5a3 3 0 0 1 3 3v11a3 3 0 0 1-6 0V8a3 3 0 0 1 3-3Z"/><path d="M12 1v4"/><path d="M12 21v-4"/>',
    tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.586 8.586a2 2 0 0 0 2.828 0l7.172-7.172a2 2 0 0 0 0-2.828Z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="12 8h.01"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    arrowLeft: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    merge: '<path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-3"/><path d="M12 6v12"/><path d="M7 18l5-6 5 6"/>',
    gitBranch: '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
    gitFork: '<circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><line x1="6" y1="9" x2="12" y2="15"/><line x1="18" y1="9" x2="12" y2="15"/>'
  };

  const path = iconPaths[iconName];
  if (!path) {
    console.warn(`[LUCIDE] Icon "${iconName}" not found, using sparkles as fallback`);
    return renderLucideIcon('sparkles', options);
  }

  return `
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="${size}" 
      height="${size}" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="${color}" 
      stroke-width="${strokeWidth}" 
      stroke-linecap="round" 
      stroke-linejoin="round"
      class="${className}"
      style="${style}"
    >
      ${path}
    </svg>
  `.trim();
}

/**
 * Render annotation icon (sparkles)
 */
function renderAnnotationIcon(size = 14, color = 'var(--color-text-secondary)') {
  return renderLucideIcon('sparkles', {
    size,
    color,
    class: 'annotation-icon',
    style: 'display: inline-block; vertical-align: middle; margin-right: 4px;'
  });
}

// Export to window
if (typeof window !== 'undefined') {
  window.renderLucideIcon = renderLucideIcon;
  window.renderAnnotationIcon = renderAnnotationIcon;
}

