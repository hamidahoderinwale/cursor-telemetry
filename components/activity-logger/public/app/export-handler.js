/**
 * Export Handler Module
 * Handles database export functionality with filtering options
 */

// Export database as JSON (with size limits to prevent browser crashes)
async function exportDatabase(limit = 1000, includeAllFields = false) {
  try {
    console.log('📤 Exporting database...', { limit, includeAllFields });
    
    // Show loading state
    const exportBtn = document.querySelector('.export-btn');
    if (exportBtn) {
      const originalHTML = exportBtn.innerHTML;
      exportBtn.innerHTML = '<span>Exporting...</span>';
      exportBtn.disabled = true;
      
      // Confirm for large exports
      if (limit > 5000) {
        const confirmed = confirm(`This will export ${limit} items. Large exports may take time and use significant memory. Continue?`);
        if (!confirmed) {
          exportBtn.innerHTML = originalHTML;
          exportBtn.disabled = false;
          return;
        }
      }
      
      // Fetch data from API with limit
      const url = new URL(`${window.CONFIG.API_BASE}/api/export/database`);
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
          exportBtn.innerHTML = originalHTML;
          exportBtn.disabled = false;
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
      
      console.log(`[SUCCESS] Exported ${result.data.metadata.totalEntries} entries, ${result.data.metadata.totalPrompts} prompts, ${result.data.metadata.totalEvents} events`);
      
      // Show success feedback
      exportBtn.innerHTML = '<span>Exported!</span>';
      exportBtn.style.color = '#10b981';
      setTimeout(() => {
        exportBtn.innerHTML = originalHTML;
        exportBtn.disabled = false;
        exportBtn.style.color = '';
      }, 2000);
    } else {
      // No button found, just log
      console.log('[EXPORT] Button not found, export completed');
    }
    
  } catch (error) {
    console.error('Export error:', error);
    const exportBtn = document.querySelector('.export-btn');
    if (exportBtn) {
      const originalHTML = exportBtn.innerHTML;
      exportBtn.innerHTML = '<span>✗ Failed</span>';
      exportBtn.style.color = '#ef4444';
      setTimeout(() => {
        exportBtn.innerHTML = originalHTML;
        exportBtn.disabled = false;
        exportBtn.style.color = '';
      }, 3000);
    }
    alert(`Export failed: ${error.message}\n\nTry exporting with a smaller limit (e.g., exportDatabase(500))`);
  }
}

// Export with options dialog
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

// Export with filters (for export options modal)
async function exportDatabaseWithFilters({ dateFrom, dateTo, limit = 1000, types = {}, options = {} }) {
  try {
    console.log('📤 Exporting database with filters...', { dateFrom, dateTo, limit, types, options });
    
    // Show loading state
    const exportBtn = document.querySelector('.export-btn');
    if (exportBtn) {
      const originalHTML = exportBtn.innerHTML;
      exportBtn.innerHTML = '<span>Exporting...</span>';
      exportBtn.disabled = true;
    }
    
    // Confirm for large exports
    if (limit > 5000) {
      const confirmed = confirm(`This will export ${limit} items. Large exports may take time and use significant memory. Continue?`);
      if (!confirmed) {
        if (exportBtn) {
          exportBtn.innerHTML = originalHTML;
          exportBtn.disabled = false;
        }
        return;
      }
    }
    
    // Build URL with all parameters
    const url = new URL(`${window.CONFIG.API_BASE}/api/export/database`);
    url.searchParams.set('limit', limit.toString());
    
    // Enable streaming for large exports (>5000 items) or if explicitly requested
    const useStreaming = limit > 5000 || options.streaming === true;
    if (useStreaming) {
      url.searchParams.set('stream', 'true');
    }
    
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
    
    // Abstraction level (new)
    if (options.abstractionLevel !== undefined) {
      url.searchParams.set('abstraction_level', options.abstractionLevel.toString());
    }
    if (options.abstractPrompts) {
      url.searchParams.set('abstract_prompts', 'true');
    }
    if (options.extractPatterns) {
      url.searchParams.set('extract_patterns', 'true');
    }
    
    console.log('[EXPORT] Fetching from:', url.toString());
    console.log('[EXPORT] Streaming:', useStreaming);
    
    // Handle streaming vs non-streaming
    if (useStreaming) {
      await handleStreamingExport(url, exportBtn, originalHTML, { dateFrom, limit });
    } else {
      await handleBatchExport(url, exportBtn, originalHTML, { dateFrom, limit });
    }
    
  } catch (error) {
    console.error('Export error:', error);
    const exportBtn = document.querySelector('.export-btn');
    if (exportBtn) {
      const originalHTML = exportBtn.innerHTML;
      exportBtn.innerHTML = '<span>✗ Failed</span>';
      exportBtn.style.color = '#ef4444';
      setTimeout(() => {
        exportBtn.innerHTML = originalHTML;
        exportBtn.disabled = false;
        exportBtn.style.color = '';
      }, 3000);
    }
    alert(`Export failed: ${error.message}\n\nTry exporting with a smaller limit or different date range.`);
  }
}

// Streaming export handler
async function handleStreamingExport(url, exportBtn, originalHTML, { dateFrom, limit }) {
  try {
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Export failed: ${response.status} ${response.statusText}`);
    }
    
    if (!response.body) {
      throw new Error('Streaming not supported by browser');
    }
    
    // Create filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const dateSuffix = dateFrom ? `-${dateFrom}` : '';
    const limitSuffix = limit < 10000 ? `-${limit}items` : '';
    const filename = `cursor-telemetry-export-${timestamp}${dateSuffix}${limitSuffix}.json`;
    
    // Create writable stream for file download
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const chunks = [];
    let totalSize = 0;
    
    // Update UI to show progress
    if (exportBtn) {
      exportBtn.innerHTML = '<span>Streaming...</span>';
    }
    
    // Read chunks
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      chunks.push(chunk);
      totalSize += value.length;
      
      // Update progress (rough estimate)
      if (exportBtn && chunks.length % 100 === 0) {
        const mbReceived = (totalSize / 1024 / 1024).toFixed(1);
        exportBtn.innerHTML = `<span>Streaming... ${mbReceived}MB</span>`;
      }
    }
    
    // Combine chunks and parse
    const jsonString = chunks.join('');
    const result = JSON.parse(jsonString);
    
    if (!result.success) {
      throw new Error(result.error || 'Export failed');
    }
    
    // Create blob and download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const sizeMB = blob.size / 1024 / 1024;
    console.log(`[EXPORT] Streamed file size: ${sizeMB.toFixed(2)}MB`);
    
    const url_obj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url_obj;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url_obj);
    }, 100);
    
    console.log(`[SUCCESS] Streamed export: ${result.data?.metadata?.totalEntries || 0} entries, ${result.data?.metadata?.totalPrompts || 0} prompts`);
    
    if (exportBtn) {
      exportBtn.innerHTML = '<span>Exported!</span>';
      exportBtn.style.color = '#10b981';
      setTimeout(() => {
        exportBtn.innerHTML = originalHTML;
        exportBtn.disabled = false;
        exportBtn.style.color = '';
      }, 2000);
    }
    
  } catch (error) {
    console.error('Streaming export error:', error);
    if (exportBtn) {
      exportBtn.innerHTML = '<span>✗ Failed</span>';
      exportBtn.style.color = '#ef4444';
      setTimeout(() => {
        exportBtn.innerHTML = originalHTML;
        exportBtn.disabled = false;
        exportBtn.style.color = '';
      }, 3000);
    }
    throw error;
  }
}

// Batch export handler (non-streaming)
async function handleBatchExport(url, exportBtn, originalHTML, { dateFrom, limit }) {
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
        exportBtn.innerHTML = originalHTML;
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
    throw new Error(`Export file too large (${sizeMB.toFixed(1)}MB). Please reduce the limit or use streaming.`);
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
  
  console.log(`[SUCCESS] Exported ${result.data.metadata.totalEntries || 0} entries, ${result.data.metadata.totalPrompts || 0} prompts, ${result.data.metadata.totalEvents || 0} events`);
  
  // Show success feedback
  if (exportBtn) {
    exportBtn.innerHTML = '<span>✓ Exported!</span>';
    exportBtn.style.color = '#10b981';
    setTimeout(() => {
      exportBtn.innerHTML = originalHTML;
      exportBtn.disabled = false;
      exportBtn.style.color = '';
    }, 2000);
  }
}

// Export to window for global access
window.exportDatabase = exportDatabase;
window.exportDatabaseWithOptions = exportDatabaseWithOptions;
window.exportDatabaseWithFilters = exportDatabaseWithFilters;

