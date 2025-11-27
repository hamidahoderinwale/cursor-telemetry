/**
 * Dashboard Export Module
 * Handles database export functionality
 * Extracted from dashboard.js for better organization
 */

/**
 * Export database with filters
 */
async function exportDatabaseWithFilters({ dateFrom, dateTo, limit = 1000, types = {}, options = {} }) {
  try {
    console.log('Exporting database with filters...', { dateFrom, dateTo, limit, types, options });
    
    // Show loading state
    const exportBtn = document.querySelector('.export-btn');
    let originalHTML = '';
    if (exportBtn) {
      originalHTML = exportBtn.innerHTML;
      if (window.safeSetHTML) {
        window.safeSetHTML(exportBtn, '<span>Exporting...</span>');
      } else {
        exportBtn.innerHTML = '<span>Exporting...</span>';
      }
      exportBtn.disabled = true;
    }
    
    // Confirm for large exports
    if (limit > 5000) {
      const confirmed = confirm(`This will export ${limit} items. Large exports may take time and use significant memory. Continue?`);
      if (!confirmed) {
        if (exportBtn) {
          if (window.safeSetHTML) {
            window.safeSetHTML(exportBtn, originalHTML);
          } else {
            exportBtn.innerHTML = originalHTML;
          }
          exportBtn.disabled = false;
        }
        return;
      }
    }
    
    // Build URL with all parameters
    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const url = new URL(`${apiBase}/api/export/database`);
    url.searchParams.set('limit', limit.toString());
    
    // Date range
    if (dateFrom) {
      url.searchParams.set('since', dateFrom);
    }
    if (dateTo) {
      url.searchParams.set('until', dateTo);
    }
    
    // Type filters (invert logic - exclude_* means "don't include")
    if (!types.events) {
      url.searchParams.set('exclude_events', 'true');
    }
    if (!types.prompts) {
      url.searchParams.set('exclude_prompts', 'true');
    }
    if (!types.terminal) {
      url.searchParams.set('exclude_terminal', 'true');
    }
    if (!types.context) {
      url.searchParams.set('exclude_context', 'true');
    }
    
    // Options
    if (!options.includeCodeDiffs) {
      url.searchParams.set('no_code_diffs', 'true');
    }
    if (!options.includeLinkedData) {
      url.searchParams.set('no_linked_data', 'true');
    }
    if (!options.includeTemporalChunks) {
      url.searchParams.set('no_temporal_chunks', 'true');
    }
    if (options.fullMetadata) {
      url.searchParams.set('full', 'true');
    }
    
    console.log('[EXPORT] Fetching from:', url.toString());
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Export failed: ${response.status} ${response.statusText}`);
    }
    
    // Check response size before parsing
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) { // 50MB
      const proceed = confirm(`Export file is large (${(parseInt(contentLength) / 1024 / 1024).toFixed(1)}MB). This may take time to download. Continue?`);
      if (!proceed) {
        if (exportBtn) {
          if (window.safeSetHTML) {
            window.safeSetHTML(exportBtn, originalHTML);
          } else {
            exportBtn.innerHTML = originalHTML;
          }
          exportBtn.disabled = false;
        }
        return;
      }
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Export failed');
    }
    
    // Create filename with timestamp and filters
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const dateSuffix = dateFrom ? `-${dateFrom}` : '';
    const limitSuffix = limit < 10000 ? `-${limit}items` : '';
    const filename = `cursor-telemetry-export-${timestamp}${dateSuffix}${limitSuffix}.json`;
    
    // Convert to JSON string with pretty formatting
    const indentSize = limit > 5000 ? 0 : 2;
    const jsonString = JSON.stringify(result.data, null, indentSize);
    
    // Check size before creating blob
    const sizeMB = new Blob([jsonString]).size / 1024 / 1024;
    console.log(`[EXPORT] File size: ${sizeMB.toFixed(2)}MB`);
    
    if (sizeMB > 100) {
      throw new Error(`Export file too large (${sizeMB.toFixed(1)}MB). Please reduce the limit.`);
    }
    
    // Create blob and download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url_obj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url_obj;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Clean up after a delay
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url_obj);
    }, 100);
    
    console.log(`[SUCCESS] Exported ${result.data.metadata?.totalEntries || 0} entries, ${result.data.metadata?.totalPrompts || 0} prompts, ${result.data.metadata?.totalEvents || 0} events`);
    
    // Show success feedback
    if (exportBtn) {
      if (window.safeSetHTML) {
        window.safeSetHTML(exportBtn, '<span>Exported!</span>');
      } else {
        exportBtn.innerHTML = '<span>Exported!</span>';
      }
      exportBtn.style.color = '#474747';
      setTimeout(() => {
        if (window.safeSetHTML) {
          window.safeSetHTML(exportBtn, originalHTML);
        } else {
          exportBtn.innerHTML = originalHTML;
        }
        exportBtn.disabled = false;
        exportBtn.style.color = '';
      }, 2000);
    }
    
  } catch (error) {
    console.error('Export error:', error);
    const exportBtn = document.querySelector('.export-btn');
    if (exportBtn) {
      const originalHTML = exportBtn.innerHTML;
      const errorMsg = '<span>Failed</span>';
      if (window.safeSetHTML) {
        window.safeSetHTML(exportBtn, errorMsg);
      } else {
        exportBtn.innerHTML = errorMsg;
      }
      exportBtn.style.color = '#2a2a2a';
      setTimeout(() => {
        if (window.safeSetHTML) {
          window.safeSetHTML(exportBtn, originalHTML);
        } else {
          exportBtn.innerHTML = originalHTML;
        }
        exportBtn.disabled = false;
        exportBtn.style.color = '';
      }, 3000);
    }
    alert(`Export failed: ${error.message}\n\nTry exporting with a smaller limit or different date range.`);
  }
}

/**
 * Export database as JSON (with size limits to prevent browser crashes)
 */
async function exportDatabase(limit = 1000, includeAllFields = false) {
  try {
    console.log('Exporting database...', { limit, includeAllFields });
    
    // Show loading state
    const exportBtn = document.querySelector('.export-btn');
    let originalHTML = '';
    if (exportBtn) {
      originalHTML = exportBtn.innerHTML;
      if (window.safeSetHTML) {
        window.safeSetHTML(exportBtn, '<span>Exporting...</span>');
      } else {
        exportBtn.innerHTML = '<span>Exporting...</span>';
      }
      exportBtn.disabled = true;
      
      // Confirm for large exports
      if (limit > 5000) {
        const confirmed = confirm(`This will export ${limit} items. Large exports may take time and use significant memory. Continue?`);
        if (!confirmed) {
          if (window.safeSetHTML) {
            window.safeSetHTML(exportBtn, originalHTML);
          } else {
            exportBtn.innerHTML = originalHTML;
          }
          exportBtn.disabled = false;
          return;
        }
      }
    }
    
    // Fetch data from API with limit
    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const url = new URL(`${apiBase}/api/export/database`);
    url.searchParams.set('limit', limit.toString());
    if (includeAllFields) {
      url.searchParams.set('full', 'true');
    }
    
    console.log('[EXPORT] Fetching from:', url.toString());
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Export failed: ${response.status} ${response.statusText}`);
    }
    
    // Check response size before parsing
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) { // 50MB
      const proceed = confirm(`Export file is large (${(parseInt(contentLength) / 1024 / 1024).toFixed(1)}MB). This may take time to download. Continue?`);
      if (!proceed) {
        if (exportBtn) {
          if (window.safeSetHTML) {
            window.safeSetHTML(exportBtn, originalHTML);
          } else {
            exportBtn.innerHTML = originalHTML;
          }
          exportBtn.disabled = false;
        }
        return;
      }
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Export failed');
    }
    
    // Create filename with timestamp and limit info
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const limitSuffix = limit < 10000 ? `-${limit}items` : '';
    const filename = `cursor-telemetry-export-${timestamp}${limitSuffix}.json`;
    
    // Convert to JSON string with pretty formatting (use smaller indentation for large files)
    const indentSize = limit > 5000 ? 0 : 2; // No formatting for very large exports
    const jsonString = JSON.stringify(result.data, null, indentSize);
    
    // Check size before creating blob
    const sizeMB = new Blob([jsonString]).size / 1024 / 1024;
    console.log(`[EXPORT] File size: ${sizeMB.toFixed(2)}MB`);
    
    if (sizeMB > 100) {
      throw new Error(`Export file too large (${sizeMB.toFixed(1)}MB). Please reduce the limit.`);
    }
    
    // Create blob and download using streaming for large files
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url_obj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url_obj;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Clean up after a delay
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url_obj);
    }, 100);
    
    console.log(`[SUCCESS] Exported ${result.data.metadata?.totalEntries || 0} entries, ${result.data.metadata?.totalPrompts || 0} prompts, ${result.data.metadata?.totalEvents || 0} events`);
    
    // Show success feedback
    if (exportBtn) {
      if (window.safeSetHTML) {
        window.safeSetHTML(exportBtn, '<span>Exported!</span>');
      } else {
        exportBtn.innerHTML = '<span>Exported!</span>';
      }
      exportBtn.style.color = '#474747';
      setTimeout(() => {
        if (window.safeSetHTML) {
          window.safeSetHTML(exportBtn, originalHTML);
        } else {
          exportBtn.innerHTML = originalHTML;
        }
        exportBtn.disabled = false;
        exportBtn.style.color = '';
      }, 2000);
    }
    
  } catch (error) {
    console.error('Export error:', error);
    const exportBtn = document.querySelector('.export-btn');
    if (exportBtn) {
      const originalHTML = exportBtn.innerHTML;
      const errorMsg = '<span>Failed</span>';
      if (window.safeSetHTML) {
        window.safeSetHTML(exportBtn, errorMsg);
      } else {
        exportBtn.innerHTML = errorMsg;
      }
      exportBtn.style.color = '#2a2a2a';
      setTimeout(() => {
        if (window.safeSetHTML) {
          window.safeSetHTML(exportBtn, originalHTML);
        } else {
          exportBtn.innerHTML = originalHTML;
        }
        exportBtn.disabled = false;
        exportBtn.style.color = '';
      }, 3000);
    }
    alert(`Export failed: ${error.message}\n\nTry exporting with a smaller limit (e.g., exportDatabase(500))`);
  }
}

/**
 * Export with options dialog
 */
async function exportDatabaseWithOptions() {
  const limit = prompt('How many items to export?\n\nRecommended: 1000 (default)\nMax safe: 5000\nEnter number or leave blank for 1000:', '1000');
  if (limit === null) return; // User cancelled
  
  const numLimit = parseInt(limit) || 1000;
  if (numLimit > 10000) {
    alert('Limit too high. Maximum recommended is 10,000 items.');
    return;
  }
  
  const includeAllFields = confirm('Include all fields?\n\nYes = Full export with all metadata\nNo = Simplified export (recommended)');
  
  await exportDatabase(numLimit, includeAllFields);
}

// Export to window for global access
window.exportDatabase = exportDatabase;
window.exportDatabaseWithOptions = exportDatabaseWithOptions;
window.exportDatabaseWithFilters = exportDatabaseWithFilters;

