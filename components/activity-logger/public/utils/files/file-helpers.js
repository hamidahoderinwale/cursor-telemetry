/**
 * File-related utility functions
 */

function getFileTypeColor(ext) {
  const colors = {
    'js': '#f7df1e',
    'ts': '#3178c6',
    'py': '#3776ab',
    'html': '#e34c26',
    'css': '#264de4',
    'json': '#00d1b2',
    'md': '#083fa1'
  };
  return colors[ext] || '#64748b';
}

// Export to window for global access
window.getFileTypeColor = getFileTypeColor;
