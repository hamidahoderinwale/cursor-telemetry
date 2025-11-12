/**
 * File Graph Component
 * Main file graph initialization and orchestration
 * Part of views/file-graph/ - keeps all file graph code together
 */

// Dependencies: window.CONFIG, window.state, window.computeTFIDFAnalysis, window.renderD3FileGraph, 
// window.renderSimilarFilePairs, window.renderEmbeddingsVisualization, window.escapeHtml

/**
 * Initialize D3 file graph visualization
 */

// Update TF-IDF stats function (defined outside try block to avoid scope issues)
function updateTFIDFStats(tfidfStats) {
  if (!tfidfStats) return;
  
  const tfidfTotalTermsEl = document.getElementById('tfidfTotalTerms');
  const tfidfUniqueTermsEl = document.getElementById('tfidfUniqueTerms');
  const tfidfAvgFreqEl = document.getElementById('tfidfAvgFreq');
  if (tfidfTotalTermsEl) tfidfTotalTermsEl.textContent = tfidfStats.totalTerms.toLocaleString();
  if (tfidfUniqueTermsEl) tfidfUniqueTermsEl.textContent = tfidfStats.uniqueTerms;
  if (tfidfAvgFreqEl) tfidfAvgFreqEl.textContent = tfidfStats.avgFrequency.toFixed(2);
  
  // Show ALL top terms (not just 10) with scrolling
  const termsHtml = tfidfStats.topTerms.map((term, index) => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-xs); background: var(--color-bg); border-radius: var(--radius-sm); font-size: 12px;" title="TF-IDF Score: ${term.tfidf.toFixed(6)} | Frequency: ${term.freq}">
      <span style="display: flex; align-items: center; gap: var(--space-xs);">
        <span style="color: var(--color-text-muted); font-size: 10px; min-width: 25px;">#${index + 1}</span>
        <span style="font-family: var(--font-mono); color: var(--color-text);">${window.escapeHtml ? window.escapeHtml(term.term) : term.term}</span>
      </span>
      <span style="font-weight: 600; color: var(--color-accent);">${term.tfidf.toFixed(4)}</span>
    </div>
  `).join('');
  const topTermsEl = document.getElementById('topTerms');
  if (topTermsEl) {
    topTermsEl.innerHTML = termsHtml || '<div style="color: var(--color-text-muted); font-size: 13px;">No terms found</div>';
  }
}

async function initializeD3FileGraph() {
  try {
    const container = document.getElementById('fileGraphContainer');
    if (!container) return;
    
    // Show loading state with progress
    const updateProgress = (message, percent = null) => {
      const percentText = percent !== null ? ` (${percent}%)` : '';
      container.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
        <div class="loading-spinner"></div>
        <span style="margin-top: 12px; color: var(--color-text-muted);">${message}${percentText}</span>
      </div>`;
    };
    updateProgress('Loading file graph data...', 0);
    
    const apiBase = window.CONFIG?.API_BASE || window.CONFIG?.API_BASE_URL || 'http://localhost:43917';
    
    // OPTIMIZATION: Try fast API endpoint first (pre-computed graph data)
    updateProgress('Loading pre-computed relationships...', 10);
    let graphData = null;
    try {
      const graphResponse = await fetch(`${apiBase}/api/analytics/context/file-relationships?minCount=1`);
      if (graphResponse.ok) {
        const graphResult = await graphResponse.json();
        if (graphResult.success && graphResult.data) {
          graphData = graphResult.data;
          console.log(`[GRAPH] Loaded ${graphData.nodes?.length || 0} nodes and ${graphData.edges?.length || 0} edges from fast API`);
        }
      }
    } catch (e) {
      console.log('[GRAPH] Fast API endpoint not available, falling back to file-contents');
    }
    
    // Check cache for file contents (optimization)
    const cacheKey = 'fileGraphData';
    const cacheExpiry = 5 * 60 * 1000; // 5 minutes
    const cached = sessionStorage.getItem(cacheKey);
    let data;
    
    // Also check for precomputed similarities
    const similaritiesCacheKey = 'fileGraphSimilarities';
    let precomputedSimilarities = null;
    try {
      const similaritiesCache = sessionStorage.getItem(similaritiesCacheKey);
      if (similaritiesCache) {
        const similaritiesData = JSON.parse(similaritiesCache);
        if (Date.now() - similaritiesData.timestamp < 10 * 60 * 1000) { // 10 minute expiry
          precomputedSimilarities = similaritiesData.similarities;
          console.log(`[GRAPH] Found ${precomputedSimilarities.length} precomputed similarities`);
        }
      }
    } catch (e) {
      // Cache invalid, continue
    }
    
    if (cached) {
      try {
        const cachedData = JSON.parse(cached);
        if (Date.now() - cachedData.timestamp < cacheExpiry) {
          console.log('[GRAPH] Using cached file data');
          data = cachedData.data;
        }
      } catch (e) {
        // Cache invalid, fetch fresh
      }
    }
    
    // Fetch file contents from persistent database if not cached
    if (!data) {
      updateProgress('Loading file contents from database...', 20);
      console.log('[FILE] Fetching file contents from SQLite for TF-IDF analysis...');
      let response;
      try {
        // Increased limit for better data coverage - can still be fast with caching
        response = await fetch(`${apiBase}/api/file-contents?limit=1000`);
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
      } catch (error) {
        console.warn('[FILE] Failed to fetch file contents:', error.message);
        // Don't return immediately - try to use graphData if available
        if (!graphData) {
          container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); padding: 2rem; text-align: center;">
              <div style="font-size: 1.1rem; font-weight: 500; margin-bottom: 0.5rem; color: var(--color-text);">Companion service not available</div>
              <div style="font-size: 0.9rem; margin-bottom: 1rem;">File contents cannot be loaded. Make sure the companion service is running on port 43917.</div>
              <div style="font-size: 0.85rem; opacity: 0.8;">Error: ${error.message}</div>
            </div>
          `;
          return;
        }
      }
    }
    
    // If we have graphData from fast API, use it directly (much faster!)
    if (graphData && graphData.nodes && graphData.nodes.length > 0) {
      updateProgress('Rendering graph...', 80);
      console.log(`[GRAPH] Using fast API data: ${graphData.nodes.length} nodes, ${graphData.edges.length} edges`);
      
      // Convert graphData format to our format
      const files = graphData.nodes.map(node => ({
        id: node.id,
        path: node.id,
        name: node.label || node.id.split('/').pop() || node.id,
        ext: node.id.split('.').pop() || '',
        changes: node.mentions || 0,
        size: node.size || 10,
        events: [],
        workspace: node.id.split('/')[0] || 'unknown',
        directory: node.id.split('/').slice(0, -1).join('/') || node.id.split('/')[0] || 'unknown'
      }));
      
      const links = graphData.edges.map(edge => {
        // Ensure source and target are file IDs (strings) that match node IDs
        const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id || edge.source;
        const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id || edge.target;
        
        // Normalize similarity: strength is already 0-1, weight might need normalization
        let similarity = edge.strength || 0;
        if (!similarity && edge.weight) {
          // Normalize weight to 0-1 range (assuming max weight is around 100)
          similarity = Math.min(1.0, edge.weight / 100);
        }
        // Ensure minimum similarity for visibility
        if (similarity < 0.1) similarity = 0.1;
        
        return {
          source: sourceId,
          target: targetId,
          similarity: similarity,
          sharedPrompts: 0,
          sharedSessions: 0
        };
      });
      
      // Update stats immediately
      const nodeCountEl = document.getElementById('graphNodeCount');
      const linkCountEl = document.getElementById('graphLinkCount');
      if (nodeCountEl) nodeCountEl.textContent = files.length;
      if (linkCountEl) linkCountEl.textContent = links.length;
      
      // Update prompt count
      const prompts = window.state?.data?.prompts || [];
      const promptCountEl = document.getElementById('graphPromptCount');
      if (promptCountEl) promptCountEl.textContent = prompts.length;
      
      // Calculate average similarity
      if (links.length > 0) {
        const avgSim = links.reduce((sum, l) => sum + l.similarity, 0) / links.length;
        const avgSimEl = document.getElementById('graphAvgSimilarity');
        if (avgSimEl) avgSimEl.textContent = avgSim.toFixed(3);
      }
      
      // Render immediately
      if (window.renderD3FileGraph) {
        window.renderD3FileGraph(container, files, links);
        console.log('[GRAPH] Graph rendered from fast API data');
      } else {
        console.warn('[GRAPH] renderD3FileGraph function not available');
      }
      
      // Store for later use
      window.fileGraphData = { nodes: files, links: links, tfidfStats: null, similarities: null };
      
      // Render similar pairs
      if (window.renderSimilarFilePairs) {
        window.renderSimilarFilePairs(links, files);
      }
      
      updateProgress('Graph loaded!', 100);
      setTimeout(() => {
        if (container.querySelector('.loading-spinner')) {
          // Clear loading state if still showing
        }
      }, 500);
      
      return; // Early return - we're done!
    }
    
    // If no file contents, try to build graph from events data
    if (!data.files || data.files.length === 0) {
      console.log('[FILE] No file contents available, attempting to build graph from events...');
      const allEvents = window.state?.data?.events || [];
      
      if (allEvents.length === 0) {
        container.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); padding: 2rem; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">[FILE]</div>
            <div style="font-size: 18px; margin-bottom: 8px; color: var(--color-text);">No file data available</div>
            <div style="font-size: 14px; margin-bottom: 16px;">Make some code changes to see file relationships</div>
            <div style="font-size: 12px; opacity: 0.7; max-width: 500px; margin-top: 16px; padding: 12px; background: var(--color-bg-secondary, rgba(0,0,0,0.05)); border-radius: 6px;">
              <strong>Tip:</strong> The file graph visualizes relationships between files based on:
              <ul style="text-align: left; margin: 8px 0; padding-left: 20px;">
                <li>Files modified together in the same sessions</li>
                <li>Semantic similarity (TF-IDF analysis)</li>
                <li>Co-occurrence in AI prompts</li>
              </ul>
              Start editing files to see relationships appear!
            </div>
          </div>
        `;
        return;
      }
      
      // Build file list from events
      const fileMap = new Map();
      allEvents.forEach(event => {
        try {
          const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
          const filePath = details?.file_path || event.file_path || '';
          if (!filePath || filePath.includes('.git/')) return;
          
          if (!fileMap.has(filePath)) {
            const pathParts = filePath.split('/');
            const fileName = pathParts[pathParts.length - 1];
            const ext = fileName.includes('.') ? fileName.split('.').pop() : '';
            
            fileMap.set(filePath, {
              path: filePath,
              name: fileName,
              ext: ext,
              changes: 0,
              events: [],
              content: details?.after_content || details?.after_code || '',
              timestamp: event.timestamp
            });
          }
          
          const file = fileMap.get(filePath);
          file.changes++;
          file.events.push(event);
          if (event.timestamp > file.timestamp) {
            file.timestamp = event.timestamp;
            file.content = details?.after_content || details?.after_code || file.content;
          }
        } catch (e) {
          // Skip invalid events
        }
      });
      
      // Convert map to array format expected by the rest of the code
      data.files = Array.from(fileMap.values());
      data.totalSize = data.files.reduce((sum, f) => sum + (f.content?.length || 0), 0);
      
      console.log(`[FILE] Built file list from ${allEvents.length} events: ${data.files.length} unique files`);
      
      if (data.files.length === 0) {
        container.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); padding: 2rem; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">[FILE]</div>
            <div style="font-size: 18px; margin-bottom: 8px; color: var(--color-text);">No file data available</div>
            <div style="font-size: 14px; margin-bottom: 16px;">Make some code changes to see file relationships</div>
            <div style="font-size: 12px; opacity: 0.7; max-width: 500px; margin-top: 16px; padding: 12px; background: var(--color-bg-secondary, rgba(0,0,0,0.05)); border-radius: 6px;">
              <strong>Tip:</strong> The file graph visualizes relationships between files based on:
              <ul style="text-align: left; margin: 8px 0; padding-left: 20px;">
                <li>Files modified together in the same sessions</li>
                <li>Semantic similarity (TF-IDF analysis)</li>
                <li>Co-occurrence in AI prompts</li>
              </ul>
              Start editing files to see relationships appear!
            </div>
          </div>
        `;
        return;
      }
    }
    
    console.log(`[DATA] Loaded ${data.files.length} files (${(data.totalSize / 1024 / 1024).toFixed(2)} MB) from database`);
    
    // Get unique file extensions from the data, grouping Git files
    const allExts = [...new Set(data.files.map(f => {
      const ext = f.ext;
      // Group all Git-related files as just "Git"
      if (ext && (ext.startsWith('Git') || ext === 'COMMIT_EDITMSG' || ext === 'HEAD' || ext === 'index' || ext === 'FETCH_HEAD' || ext === 'ORIG_HEAD')) {
        return 'Git';
      }
      return ext;
    }).filter(Boolean))].sort();
    
    // Populate file type dropdown
    const fileTypeFilter = document.getElementById('fileTypeFilter');
    if (fileTypeFilter && fileTypeFilter.options.length === 0) {
      allExts.forEach(ext => {
        const option = document.createElement('option');
        option.value = ext;
        option.text = ext.toUpperCase();
        option.selected = true; // Select all by default
        fileTypeFilter.add(option);
      });
    }
    
    // Get selected file types from dropdown
    const selectedTypes = Array.from(fileTypeFilter?.selectedOptions || []).map(o => o.value);
    const allowedExts = selectedTypes.length > 0 ? selectedTypes : allExts;
    
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
    
    // Build event lookup map first (O(n) instead of O(n*m)) - MAJOR OPTIMIZATION
    const eventsByFilePath = new Map();
    const allEvents = window.state.data.events || [];
    
    console.log(`[GRAPH] Building event lookup map from ${allEvents.length} events...`);
    updateProgress(`Processing ${allEvents.length} events...`, 10);
    
    // Process events in batches to prevent timeout
    const EVENT_BATCH_SIZE = 500;
    for (let i = 0; i < allEvents.length; i += EVENT_BATCH_SIZE) {
      const batch = allEvents.slice(i, i + EVENT_BATCH_SIZE);
      
      batch.forEach(event => {
        try {
          const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
          const filePath = details?.file_path || event.file_path || '';
          if (!filePath) return;
          
          // Normalize path for matching
          const normalizedPath = filePath.toLowerCase();
          const pathParts = normalizedPath.split('/');
          const fileName = pathParts[pathParts.length - 1];
          
          // Store event by full path
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
      
      // Yield to event loop periodically
      if (i + EVENT_BATCH_SIZE < allEvents.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    console.log(`[GRAPH] Event lookup map built with ${eventsByFilePath.size} keys`);
    
    // Helper function to check if file should be excluded
    const shouldExcludeFile = (file) => {
      const path = (file.path || '').toLowerCase();
      const name = (file.name || '').toLowerCase();
      
      // LESS AGGRESSIVE: Only exclude files with absolutely nothing
      // Allow files with content OR changes OR events OR mentions
      const hasContent = file.content && file.content.length > 0;
      const hasChanges = (file.changes || 0) > 0;
      const hasEvents = file.events && file.events.length > 0;
      const hasMentions = (file.mentions || 0) > 0; // From graphData
      // Only exclude if file has absolutely nothing
      if (!hasContent && !hasChanges && !hasEvents && !hasMentions) {
        return true;
      }
      
      // Filter out Git object hashes (40-character hex strings in .git/objects/)
      if (path.includes('.git/objects/') && isGitObjectHash(file.name)) {
        return true;
      }
      
      // Filter out generated/cache files
      const generatedPatterns = [
        /\.pyc$/i,           // Python bytecode
        /\.pyo$/i,           // Python optimized bytecode
        /__pycache__/i,      // Python cache directory
        /\.class$/i,          // Java bytecode
        /\.o$/i,              // Object files
        /\.so$/i,             // Shared objects
        /\.dylib$/i,          // Dynamic libraries
        /\.dll$/i,            // Windows DLLs
        /\.exe$/i,            // Executables
        /\.cache$/i,          // Cache files
        /\.tmp$/i,            // Temporary files
        /\.swp$/i,            // Vim swap files
        /\.swo$/i,            // Vim swap files
        /\.DS_Store$/i,       // macOS metadata
        /Thumbs\.db$/i        // Windows thumbnails
      ];
      
      if (generatedPatterns.some(pattern => pattern.test(name) || pattern.test(path))) {
        return true;
      }
      
      // Filter out virtual environment directories
      const venvPatterns = [
        /\/venv\//i,
        /\/env\//i,
        /\/pkl_env\//i,
        /\/\.venv\//i,
        /\/virtualenv\//i,
        /\/site-packages\//i,
        /\/lib\/python[\d.]+\/site-packages\//i,
        /\/node_modules\//i,
        /\/\.git\//i,
        /\/\.svn\//i,
        /\/\.hg\//i,
        /\/\.idea\//i,
        /\/\.vscode\//i,
        /\/\.vs\//i,
        /\/build\//i,
        /\/dist\//i,
        /\/\.next\//i,
        /\/\.nuxt\//i,
        /\/\.cache\//i,
        /\/\.parcel-cache\//i,
        /\/\.turbo\//i
      ];
      
      if (venvPatterns.some(pattern => pattern.test(path))) {
        return true;
      }
      
      return false;
    };
    
    // Filter files by selected extensions (with Git grouping support)
    // First, filter synchronously (fast)
    const filteredFiles = data.files.filter(f => {
      // Exclude generated/cache files and files with no changes
      if (shouldExcludeFile(f)) {
        return false;
      }
      
      // Filter out Git object hashes (40-character hex strings in .git/objects/)
      if (f.path && f.path.includes('.git/objects/') && isGitObjectHash(f.name)) {
        return false;
      }
      
      const ext = f.ext;
      // Check if this is a Git file and "Git" is selected
      if (ext && (ext.startsWith('Git') || ext === 'COMMIT_EDITMSG' || ext === 'HEAD' || ext === 'index' || ext === 'FETCH_HEAD' || ext === 'ORIG_HEAD')) {
        return allowedExts.includes('Git');
      }
      return allowedExts.includes(ext);
    });
    
    updateProgress(`Processing ${filteredFiles.length} files...`, 30);
    
    // Limit files upfront to prevent timeout (increased limit for better coverage)
    const MAX_FILES_TO_PROCESS = 2000; // Increased from 1000 for better data coverage
    const filesToProcess = filteredFiles.length > MAX_FILES_TO_PROCESS 
      ? filteredFiles.slice(0, MAX_FILES_TO_PROCESS)
      : filteredFiles;
    
    if (filteredFiles.length > MAX_FILES_TO_PROCESS) {
      console.log(`[GRAPH] Limiting to ${MAX_FILES_TO_PROCESS} files (of ${filteredFiles.length}) to prevent timeout`);
    }
    
    // Process files in batches with yield points (async)
    const files = [];
    const PROCESS_BATCH_SIZE = 100; // Process 100 files at a time
    
    for (let i = 0; i < filesToProcess.length; i += PROCESS_BATCH_SIZE) {
      // Update progress
      const progress = 30 + Math.floor((i / filesToProcess.length) * 40);
      updateProgress(`Processing files...`, progress);
      const batch = filesToProcess.slice(i, i + PROCESS_BATCH_SIZE);
      
      const batchResults = batch.map(f => {
        // Look up events from map instead of filtering all events (O(1) lookup) - OPTIMIZATION
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
          // Avoid duplicates using Set for O(1) lookup
          const eventIds = new Set(relatedEvents.map(e => e.id || e.timestamp));
          filenameEvents.forEach(evt => {
            const evtId = evt.id || evt.timestamp;
            if (!eventIds.has(evtId)) {
              relatedEvents.push(evt);
              eventIds.add(evtId);
            }
          });
        }
        
        // Get meaningful display name
        const displayName = getMeaningfulName(f);
        
        // Extract workspace and directory for hierarchical grouping
        const pathParts = f.path.split('/');
        const workspace = pathParts[0] || 'Unknown';
        const directory = pathParts.length > 2 ? pathParts.slice(0, -1).join('/') : workspace;
        
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
        
        // LESS AGGRESSIVE: Include files if they have content, events, changes, or mentions
        // Don't skip files just because they don't have events - they might have content for TF-IDF
        const hasContent = f.content && f.content.length > 0;
        const hasEvents = relatedEvents.length > 0;
        const hasChanges = changes > 0;
        const hasMentions = (f.mentions || 0) > 0; // From graphData
        
        // Only skip if file has absolutely nothing useful
        if (!hasContent && !hasEvents && !hasChanges && !hasMentions) {
          return null;
        }
        
        return {
          id: f.path,
          path: f.path,
          name: displayName,  // Use meaningful name instead of hash
          originalName: f.name,  // Keep original for reference
          ext: f.ext,
          content: f.content || '',
          changes: changes,
          lastModified: lastModified,
          size: f.size || (f.content ? f.content.length : 0),
          events: relatedEvents,
          workspace: workspace,
          directory: directory
        };
      });
      
      // Filter out null entries before adding to files array
      const validBatchResults = batchResults.filter(f => f !== null && f !== undefined);
      files.push(...validBatchResults);
      
      // Yield to event loop after each batch to prevent timeout
      if (i + PROCESS_BATCH_SIZE < filesToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    // Filter out null entries - include files with content, events, changes, or mentions
    const validFiles = files.filter(f => {
      if (!f || f === null || f === undefined) return false;
      // Include if file has content (for TF-IDF), events, changes, or mentions
      const hasContent = f.content && f.content.length > 0;
      const hasEvents = f.events && f.events.length > 0;
      const hasChanges = f.changes > 0;
      const hasMentions = (f.mentions || 0) > 0; // From graphData
      return hasContent || hasEvents || hasChanges || hasMentions;
    });
    
    console.log(`[DATA] Filtered to ${validFiles.length} files with allowed extensions (excluded ${files.length - validFiles.length} files with no content/events/changes)`);
    
    // Replace files array with filtered results
    files.length = 0;
    files.push(...validFiles);

    if (files.length === 0) {
      container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted);">
          <div style="text-align: center;">
            <div style="font-size: 48px; margin-bottom: 16px;">[FILE]</div>
            <div style="font-size: 18px; margin-bottom: 8px;">No file data available</div>
            <div style="font-size: 14px;">Make some code changes to see file relationships</div>
          </div>
        </div>
      `;
      return;
    }
    
    // Compute similarity based on context files from prompts (more accurate than session-based)
    const links = [];
    const threshold = parseFloat(document.getElementById('similarityThreshold')?.value || '0.2');
    
    // Define prompts early so it's available in all code paths
    const prompts = window.state?.data?.prompts || [];
    
    // Limit files for performance (O(n²) computation) - increased for better coverage
    const MAX_FILES_FOR_GRAPH = 1000; // Increased from 500 for better data coverage
    const filesForGraph = files.length > MAX_FILES_FOR_GRAPH 
      ? files.slice(0, MAX_FILES_FOR_GRAPH) 
      : files;
    
    if (files.length > MAX_FILES_FOR_GRAPH) {
      console.log(`[GRAPH] Limiting to ${MAX_FILES_FOR_GRAPH} files (of ${files.length}) to prevent timeout`);
    }
    
    // Build file ID to file object map for quick lookup
    const fileMap = new Map();
    filesForGraph.forEach(file => {
      fileMap.set(file.id, file);
      fileMap.set(file.path, file);
    });
    
    // If we have precomputed similarities, use them (MUCH faster!)
    if (precomputedSimilarities && precomputedSimilarities.length > 0) {
      console.log(`[GRAPH] Using ${precomputedSimilarities.length} precomputed similarities (fast path)`);
      const MAX_LINKS = 3000;
      let linkCount = 0;
      
      for (const sim of precomputedSimilarities) {
        if (linkCount >= MAX_LINKS) break;
        
        // Find files by path or name
        const file1 = fileMap.get(sim.file1) || filesForGraph.find(f => f.path === sim.file1 || f.name === sim.file1);
        const file2 = fileMap.get(sim.file2) || filesForGraph.find(f => f.path === sim.file2 || f.name === sim.file2);
        
        if (file1 && file2 && file1.id !== file2.id && sim.similarity > threshold) {
          links.push({
            source: file1.id,
            target: file2.id,
            similarity: sim.similarity,
            sharedPrompts: 0, // Not computed in precomputed version
            sharedSessions: 0
          });
          linkCount++;
        }
      }
      
      console.log(`[GRAPH] Created ${links.length} connections from precomputed similarities (threshold: ${threshold})`);
    } else {
      // Fallback: compute similarities on-the-fly (slower)
      console.log('[GRAPH] Computing similarities on-the-fly (no precomputed cache found)');
      
      // Build file-to-prompts mapping from context files
      // Also build conversation-to-files mapping for enhanced relationships
      const filePromptMap = new Map();
      const fileConversationMap = new Map(); // file -> Set of conversationIds
      // prompts is already defined above
      
      // Build conversation hierarchy if available
      let hierarchy = null;
      if (window.ConversationHierarchyBuilder) {
        try {
          const hierarchyBuilder = new window.ConversationHierarchyBuilder();
          hierarchy = hierarchyBuilder.buildHierarchy(prompts, []);
          console.log(`[GRAPH] Built conversation hierarchy: ${hierarchy.metadata.totalConversations} conversations`);
        } catch (error) {
          console.warn('[GRAPH] Failed to build conversation hierarchy:', error);
        }
      }
      
      prompts.forEach(prompt => {
        const conversationId = prompt.conversation_id || prompt.conversationId || 
                             prompt.composer_id || prompt.composerId;
        
        if (prompt.contextFiles && Array.isArray(prompt.contextFiles)) {
          prompt.contextFiles.forEach(cf => {
            const filePath = cf.path || cf.filePath || cf.file;
            if (filePath) {
              if (!filePromptMap.has(filePath)) {
                filePromptMap.set(filePath, new Set());
              }
              filePromptMap.get(filePath).add(prompt.id || prompt.timestamp);
              
              // Track conversations for this file
              if (conversationId) {
                if (!fileConversationMap.has(filePath)) {
                  fileConversationMap.set(filePath, new Set());
                }
                fileConversationMap.get(filePath).add(conversationId);
              }
            }
          });
        }
        
        // Also check for file changes in the prompt
        if (prompt.file_path || prompt.filePath) {
          const filePath = prompt.file_path || prompt.filePath;
          if (!filePromptMap.has(filePath)) {
            filePromptMap.set(filePath, new Set());
          }
          filePromptMap.get(filePath).add(prompt.id || prompt.timestamp);
          
          // Track conversations for this file
          if (conversationId) {
            if (!fileConversationMap.has(filePath)) {
              fileConversationMap.set(filePath, new Set());
            }
            fileConversationMap.get(filePath).add(conversationId);
          }
        }
      });
      
      // Boost similarity for files in same conversation
      const conversationBoost = 0.15; // 15% boost for files in same conversation
      
      console.log(`[GRAPH] Built file-to-prompt map with ${filePromptMap.size} files`);
      
      // Pre-build session sets for files (optimization to avoid repeated computation)
      const fileSessionMap = new Map();
      filesForGraph.forEach(file => {
        const sessions = new Set((file.events || []).map(e => e.session_id).filter(Boolean));
        fileSessionMap.set(file.id, sessions);
      });
      
      // Compute co-occurrence between files (optimized with early termination)
      const MAX_LINKS = 3000; // Reduced limit to prevent UI slowdown
      let linkCount = 0;
      
      // Process in chunks with yield points
      const CHUNK_SIZE = 50;
      for (let chunkStart = 0; chunkStart < filesForGraph.length && linkCount < MAX_LINKS; chunkStart += CHUNK_SIZE) {
        const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, filesForGraph.length);
        
        for (let i = chunkStart; i < chunkEnd && linkCount < MAX_LINKS; i++) {
          for (let j = i + 1; j < filesForGraph.length && linkCount < MAX_LINKS; j++) {
            const file1 = filesForGraph[i];
            const file2 = filesForGraph[j];
            
            // Get prompts that reference each file (from pre-built map)
            const prompts1 = filePromptMap.get(file1.id) || new Set();
            const prompts2 = filePromptMap.get(file2.id) || new Set();
            
            // Get sessions from pre-built map (optimization)
            const sessions1 = fileSessionMap.get(file1.id) || new Set();
            const sessions2 = fileSessionMap.get(file2.id) || new Set();
            
            // Quick check: skip if no overlap at all (optimization)
            const hasPromptOverlap = prompts1.size > 0 && prompts2.size > 0 && 
                                     [...prompts1].some(p => prompts2.has(p));
            const hasSessionOverlap = sessions1.size > 0 && sessions2.size > 0 && 
                                      [...sessions1].some(s => sessions2.has(s));
            
            if (!hasPromptOverlap && !hasSessionOverlap) {
              continue; // Skip files with no relationship
            }
            
            // Combine both prompt co-occurrence and session co-occurrence
            const promptIntersection = new Set([...prompts1].filter(x => prompts2.has(x)));
            const sessionIntersection = new Set([...sessions1].filter(x => sessions2.has(x)));
            
            const promptUnion = new Set([...prompts1, ...prompts2]);
            const sessionUnion = new Set([...sessions1, ...sessions2]);
            
            // Calculate multiple similarity metrics
            // 1. Jaccard similarity for prompts (intersection / union)
            const promptSim = promptUnion.size > 0 ? promptIntersection.size / promptUnion.size : 0;
            
            // 2. Jaccard similarity for sessions
            const sessionSim = sessionUnion.size > 0 ? sessionIntersection.size / sessionUnion.size : 0;
            
            // 3. Conversation-based similarity boost
            const conversations1 = fileConversationMap.get(file1.id) || new Set();
            const conversations2 = fileConversationMap.get(file2.id) || new Set();
            const conversationIntersection = new Set([...conversations1].filter(x => conversations2.has(x)));
            // Boost similarity if files appear in same conversations (scales with number of shared conversations)
            const conversationSim = conversationIntersection.size > 0 ? 
              Math.min(0.3, conversationIntersection.size * 0.1) : 0;
            
            // 4. File path similarity (common directory structure)
            const path1 = file1.path || file1.name || '';
            const path2 = file2.path || file2.name || '';
            const pathSim = calculatePathSimilarity(path1, path2);
            
            // 5. Temporal proximity (files modified close in time)
            const timeSim = calculateTemporalSimilarity(file1, file2);
            
            // 6. Change frequency similarity (files with similar change patterns)
            const changeSim = calculateChangeSimilarity(file1, file2);
            
            // Weighted combination: prompts (35%), sessions (25%), path (15%), temporal (10%), changes (10%), conversations (5%)
            const similarity = (promptSim * 0.35) + 
                              (sessionSim * 0.25) + 
                              (pathSim * 0.15) + 
                              (timeSim * 0.1) + 
                              (changeSim * 0.1) +
                              (conversationSim * 0.05);
            
            if (similarity > threshold) {
              links.push({
                source: file1.id,
                target: file2.id,
                similarity: similarity,
                sharedPrompts: promptIntersection.size,
                sharedSessions: sessionIntersection.size
              });
              linkCount++;
            }
          }
        }
        
        // Yield to event loop periodically to prevent timeout
        if (chunkStart + CHUNK_SIZE < filesForGraph.length) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      if (linkCount >= MAX_LINKS) {
        console.warn(`[GRAPH] Link limit reached (${MAX_LINKS}), some connections may be missing`);
      }
      
      console.log(`[GRAPH] Created ${links.length} connections between files (threshold: ${threshold})`);
    }
    
    // Store basic data immediately for rendering
    window.fileGraphData = { nodes: files, links: links, tfidfStats: null, similarities: null };
    
    // Render basic graph FIRST (progressive enhancement) - OPTIMIZATION
    if (window.renderD3FileGraph) {
      window.renderD3FileGraph(container, files, links);
      console.log('[GRAPH] Basic graph rendered, computing TF-IDF in background...');
    }
    
    // Compute TF-IDF for semantic analysis ASYNCHRONOUSLY (defer heavy computation) - OPTIMIZATION
    // This allows the graph to render immediately while TF-IDF computes in background
    // Use idle time for this heavy computation
    const computeTFIDF = async () => {
      try {
        const {tfidfStats, similarities} = window.computeTFIDFAnalysis(files);
        
        // Update stored data with TF-IDF results
        if (window.fileGraphData) {
          window.fileGraphData.tfidfStats = tfidfStats;
          window.fileGraphData.similarities = similarities;
        }
        
        // Update TF-IDF stats in UI
        updateTFIDFStats(tfidfStats);
        
        console.log('[GRAPH] TF-IDF analysis complete');
      } catch (error) {
        console.warn('[GRAPH] TF-IDF analysis failed:', error);
        // Graph still works without TF-IDF
      }
    };
    
    // Use idle time if available, otherwise delay
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(computeTFIDF, { timeout: 2000 });
    } else {
      setTimeout(computeTFIDF, 1000);
    }
    
    // Update basic stats (with null checks)
    const nodeCountEl = document.getElementById('graphNodeCount');
    const linkCountEl = document.getElementById('graphLinkCount');
    const promptCountEl = document.getElementById('graphPromptCount');
    const avgSimEl = document.getElementById('graphAvgSimilarity');
    
    // Ensure prompts is defined (it should be from line 554, but add defensive check)
    const prompts = window.state?.data?.prompts || [];
    
    if (nodeCountEl) nodeCountEl.textContent = files.length;
    if (linkCountEl) linkCountEl.textContent = links.length;
    if (promptCountEl) promptCountEl.textContent = prompts.length;
    
    if (links.length > 0 && avgSimEl) {
      const avgSim = links.reduce((sum, l) => sum + l.similarity, 0) / links.length;
      avgSimEl.textContent = avgSim.toFixed(3);
    } else if (avgSimEl) {
      avgSimEl.textContent = '0.000';
    }
    
    // Render most similar file pairs (lightweight, can run immediately)
    if (window.renderSimilarFilePairs) {
      window.renderSimilarFilePairs(links, files);
    }
    
    // Render prompt embeddings visualization - DEFER (very expensive computation)
    // This analyzes prompts themselves, not files (file analysis is in Navigator view)
    // Defer to idle time as this is computationally expensive (PCA/t-SNE/MDS)
    if (window.renderEmbeddingsVisualization) {
      const renderEmbeddings = () => {
        window.renderEmbeddingsVisualization().catch(err => {
          console.error('[ERROR] Failed to render embeddings:', err);
          const container = document.getElementById('embeddingsVisualization');
          if (container) {
            container.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-error); font-size: 13px;">Error rendering embeddings: ${err.message}</div>`;
          }
        });
      };
      
      // Defer expensive embeddings computation
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(renderEmbeddings, { timeout: 5000 });
      } else {
        setTimeout(renderEmbeddings, 3000);
      }
    }
    
    // Show loading state for TF-IDF stats
    const tfidfTotalTermsEl = document.getElementById('tfidfTotalTerms');
    const tfidfUniqueTermsEl = document.getElementById('tfidfUniqueTerms');
    const tfidfAvgFreqEl = document.getElementById('tfidfAvgFreq');
    if (tfidfTotalTermsEl) tfidfTotalTermsEl.textContent = 'Computing...';
    if (tfidfUniqueTermsEl) tfidfUniqueTermsEl.textContent = '...';
    if (tfidfAvgFreqEl) tfidfAvgFreqEl.textContent = '...';
    
    const topTermsEl = document.getElementById('topTerms');
    if (topTermsEl) {
      topTermsEl.innerHTML = '<div style="color: var(--color-text-muted); font-size: 13px; padding: var(--space-md); text-align: center;">Computing TF-IDF analysis...</div>';
    }
    
  } catch (error) {  // This catch matches the try at line 14
    // Suppress CORS/network errors (expected when companion service is offline)
    const errorMessage = error.message || error.toString();
    const isNetworkError = errorMessage.includes('CORS') || 
                           errorMessage.includes('NetworkError') || 
                           errorMessage.includes('Failed to fetch') ||
                           error.name === 'NetworkError' ||
                           error.name === 'TypeError';
    
    // Only log if it's not a network error
    if (!isNetworkError) {
      console.error('Failed to initialize file graph:', error);
    }
    
    const container = document.getElementById('fileGraphContainer');
    if (container) {
      container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted);">
          <div style="text-align: center;">
            <div style="font-size: 48px; margin-bottom: 16px;">!</div>
            <div style="font-size: 18px; margin-bottom: 8px;">File Graph Unavailable</div>
            <div style="font-size: 14px;">${window.escapeHtml ? window.escapeHtml(error.message || 'Error initializing visualization') : (error.message || 'Error initializing visualization')}</div>
          </div>
        </div>
      `;
    }
  }
}

/**
 * Update file graph (re-initialize with current filters)
 */
/**
 * Calculate path similarity between two file paths
 * Returns similarity based on common directory structure
 */
function calculatePathSimilarity(path1, path2) {
  if (!path1 || !path2) return 0;
  
  // Normalize paths
  const p1 = path1.replace(/\\/g, '/').toLowerCase();
  const p2 = path2.replace(/\\/g, '/').toLowerCase();
  
  // If paths are identical
  if (p1 === p2) return 1.0;
  
  // Split into directory components
  const parts1 = p1.split('/').filter(p => p.length > 0);
  const parts2 = p2.split('/').filter(p => p.length > 0);
  
  if (parts1.length === 0 || parts2.length === 0) return 0;
  
  // Find common prefix
  let commonLength = 0;
  const minLength = Math.min(parts1.length, parts2.length);
  for (let i = 0; i < minLength; i++) {
    if (parts1[i] === parts2[i]) {
      commonLength++;
    } else {
      break;
    }
  }
  
  // Calculate similarity: common path depth / max depth
  const maxDepth = Math.max(parts1.length, parts2.length);
  return commonLength / maxDepth;
}

/**
 * Calculate temporal similarity (files modified close in time)
 */
function calculateTemporalSimilarity(file1, file2) {
  if (!file1.events || !file2.events || file1.events.length === 0 || file2.events.length === 0) {
    return 0;
  }
  
  // Get timestamps from events
  const times1 = file1.events.map(e => new Date(e.timestamp).getTime()).sort((a, b) => a - b);
  const times2 = file2.events.map(e => new Date(e.timestamp).getTime()).sort((a, b) => a - b);
  
  // Find minimum time difference between any two events
  let minDiff = Infinity;
  for (const t1 of times1) {
    for (const t2 of times2) {
      const diff = Math.abs(t1 - t2);
      if (diff < minDiff) {
        minDiff = diff;
      }
    }
  }
  
  if (minDiff === Infinity) return 0;
  
  // Convert to similarity: closer in time = higher similarity
  // Use exponential decay: similarity = e^(-diff / 1 hour)
  const oneHour = 60 * 60 * 1000;
  return Math.exp(-minDiff / oneHour);
}

/**
 * Calculate change frequency similarity
 */
function calculateChangeSimilarity(file1, file2) {
  const changes1 = file1.changes || file1.events?.length || 0;
  const changes2 = file2.changes || file2.events?.length || 0;
  
  if (changes1 === 0 && changes2 === 0) return 1.0; // Both unchanged
  if (changes1 === 0 || changes2 === 0) return 0; // One changed, one didn't
  
  // Similarity based on how close their change counts are
  const maxChanges = Math.max(changes1, changes2);
  const minChanges = Math.min(changes1, changes2);
  
  // Ratio of min to max (closer to 1 = more similar)
  return minChanges / maxChanges;
}

function updateFileGraph() {
  // Re-initialize the graph with updated filters
  initializeD3FileGraph();
}

// Export to window for global access
window.initializeD3FileGraph = initializeD3FileGraph;
window.updateFileGraph = updateFileGraph;

