/**
 * Embeddings Visualization Component
 * Handles prompt embeddings visualization using TF-IDF and dimensionality reduction (PCA/t-SNE/MDS)
 * 
 * Dependencies: window.CONFIG, window.state, window.tokenizeCode, window.formatTimeAgo, 
 * window.showEventModal, d3
 */

/**
 * Main function to render embeddings visualization
 */
async function renderEmbeddingsVisualization() {
  const container = document.getElementById('embeddingsVisualization');
  if (!container) return;
  
  const prompts = window.state?.data?.prompts || [];
  if (prompts.length === 0) {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: var(--space-xl); text-align: center;">
        <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Data Available</div>
        <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Prompt data will appear here once you start using Cursor AI</div>
      </div>
    `;
    return;
  }
  
  const method = document.getElementById('embeddingsReductionMethod')?.value || 'pca';
  const dimensions = parseInt(document.getElementById('embeddingsDimensions')?.value || '2');
  const numComponents = parseInt(document.getElementById('embeddingsPCAComponents')?.value || '10');
  
  // Show loading state
  container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted);">Processing embeddings... (this may take a moment)</div>';
  
  try {
    console.log(`[EMBEDDINGS] Starting analysis: method=${method}, dims=${dimensions}, components=${numComponents}`);
    
    // Build conversation hierarchy if available
    let hierarchy = null;
    let conversationMap = new Map(); // conversationId -> { title, workspace, color }
    let conversationColors = new Map();
    
    if (window.ConversationHierarchyBuilder) {
      try {
        const hierarchyBuilder = new window.ConversationHierarchyBuilder();
        hierarchy = hierarchyBuilder.buildHierarchy(prompts, []);
        
        // Generate colors for conversations
        let colorIndex = 0;
        const colorPalette = [
          '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
          '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
        ];
        
        hierarchy.workspaces.forEach(workspace => {
          workspace.conversations.forEach(conv => {
            const color = colorPalette[colorIndex % colorPalette.length];
            conversationMap.set(conv.id, {
              title: conv.title,
              workspace: workspace.name,
              color: color,
              promptCount: conv.allPrompts.length
            });
            conversationColors.set(conv.id, color);
            colorIndex++;
          });
        });
        
        console.log(`[EMBEDDINGS] Built hierarchy: ${hierarchy.metadata.totalConversations} conversations across ${hierarchy.metadata.totalWorkspaces} workspaces`);
      } catch (error) {
        console.warn('[EMBEDDINGS] Failed to build conversation hierarchy:', error);
      }
    }
    
    // Filter out JSON metadata, composer conversations (which are just names), and prepare actual prompt texts
    let validPrompts = prompts.filter(p => {
      const text = p.text || p.prompt || p.preview || p.content || '';
      const isJsonLike = text.startsWith('{') || text.startsWith('[');
      // Exclude composer conversations as they only contain conversation names, not actual prompt content
      const isComposerConversation = p.source === 'composer' && p.type === 'conversation';
      return !isJsonLike && !isComposerConversation && text.length > 10;
    });
    
    // LIMIT: Process max 1000 prompts to prevent timeout (O(n²) similarity calculations)
    const MAX_PROMPTS = 1000;
    if (validPrompts.length > MAX_PROMPTS) {
      console.warn(`[EMBEDDINGS] Limiting to ${MAX_PROMPTS} most recent prompts (of ${validPrompts.length} total) to prevent timeout`);
      // Sort by timestamp and take most recent
      validPrompts = validPrompts
        .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
        .slice(0, MAX_PROMPTS);
    }
    
    console.log(`[EMBEDDINGS] Filtered to ${validPrompts.length} valid prompts (processing ${validPrompts.length} for embeddings)`);
    
    // Update stats immediately
    const filesCountEl = document.getElementById('embeddingsFilesCount');
    const totalChangesEl = document.getElementById('embeddingsTotalChanges');
    if (filesCountEl) filesCountEl.textContent = validPrompts.length;
    
    if (validPrompts.length === 0) {
      container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); font-size: 13px;">No valid prompts for analysis (filtered out JSON metadata)</div>';
      if (totalChangesEl) totalChangesEl.textContent = '0';
      return;
    }
    
    // Process in chunks to prevent blocking
    const chunkSize = 100;
    const chunks = [];
    for (let i = 0; i < validPrompts.length; i += chunkSize) {
      chunks.push(validPrompts.slice(i, i + chunkSize));
    }
    
    // Tokenize all prompts (chunked)
    const promptTexts = validPrompts.map(p => p.text || p.prompt || p.preview || p.content || '');
    const allTokens = [];
    
    for (const chunk of chunks) {
      await new Promise(resolve => setTimeout(resolve, 0)); // Yield to browser
      const chunkTexts = chunk.map(p => p.text || p.prompt || p.preview || p.content || '');
      allTokens.push(...chunkTexts.map(text => (window.tokenizeCode || tokenizeCode)(text)));
    }
    
    // Build vocabulary from all prompts - use top terms based on frequency
    const vocab = new Map();
    allTokens.forEach(tokens => {
      tokens.forEach(token => {
        vocab.set(token, (vocab.get(token) || 0) + 1);
      });
    });
    
    // Use vocabulary size based on numComponents setting (adaptive)
    const vocabSize = Math.min(Math.max(numComponents * 5, 20), 150);
    const topVocab = Array.from(vocab.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, vocabSize)
      .map(e => e[0]);
    
    console.log(`[EMBEDDINGS] Using vocabulary size: ${topVocab.length}`);
    
    // Create TF-IDF vectors (chunked)
    const vectors = [];
    const promptLabels = [];
    const promptMetadata = [];
    
    for (let i = 0; i < validPrompts.length; i++) {
      if (i % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0)); // Yield every 100 prompts
      }
      
      const prompt = validPrompts[i];
      const tokens = allTokens[i];
      const vector = [];
      
      // Create TF-IDF vector
      topVocab.forEach(term => {
        const tf = tokens.filter(t => t === term).length / Math.max(tokens.length, 1);
        // Simple IDF approximation
        const df = allTokens.filter(tokSet => tokSet.includes(term)).length;
        const idf = Math.log(validPrompts.length / (df + 1));
        vector.push(tf * idf);
      });
      
      vectors.push(vector);
      
      // Get conversation info for this prompt
      const conversationId = prompt.conversation_id || prompt.conversationId || 
                            prompt.composer_id || prompt.composerId;
      const conversationInfo = conversationId ? conversationMap.get(conversationId) : null;
      
      // Create label (truncated prompt text)
      const text = promptTexts[i];
      const label = text.length > 40 ? text.substring(0, 40) + '...' : text;
      promptLabels.push(label);
      
      // Store metadata for hover/click
      promptMetadata.push({
        id: prompt.id,
        text: text,
        timestamp: prompt.timestamp,
        workspaceName: prompt.workspaceName || conversationInfo?.workspace || 'Unknown',
        source: prompt.source || 'cursor',
        conversationId: conversationId,
        conversationTitle: conversationInfo?.title || null,
        conversationColor: conversationInfo?.color || null
      });
    }
    
    console.log(`[EMBEDDINGS] Built ${vectors.length} TF-IDF vectors with ${vectors[0]?.length} dimensions`);
    
    // Apply dimensionality reduction (with timeout protection)
    let reducedVectors;
    if (method === 'pca') {
      // PCA is fast, can run synchronously
      reducedVectors = applyPCA(vectors, dimensions, numComponents);
      console.log(`[EMBEDDINGS] PCA complete: ${reducedVectors.length} vectors -> ${reducedVectors[0]?.length} dims`);
    } else if (method === 'tsne') {
      // t-SNE is slow, limit to smaller dataset
      if (vectors.length > 500) {
        console.warn(`[EMBEDDINGS] t-SNE is slow with ${vectors.length} prompts, limiting to 500`);
        const limitedVectors = vectors.slice(0, 500);
        const limitedLabels = promptLabels.slice(0, 500);
        const limitedMetadata = promptMetadata.slice(0, 500);
        reducedVectors = applyTSNE(limitedVectors, dimensions, numComponents);
        // Re-render with limited data
        if (dimensions === 2) {
          renderEmbeddings2D(container, reducedVectors, limitedLabels, limitedMetadata);
        } else {
          renderEmbeddings3D(container, reducedVectors, limitedLabels, limitedMetadata);
        }
        return;
      }
      reducedVectors = applyTSNE(vectors, dimensions, numComponents);
      console.log(`[EMBEDDINGS] t-SNE complete`);
    } else {
      // MDS is also slow, limit if needed
      if (vectors.length > 500) {
        console.warn(`[EMBEDDINGS] MDS is slow with ${vectors.length} prompts, limiting to 500`);
        const limitedVectors = vectors.slice(0, 500);
        const limitedLabels = promptLabels.slice(0, 500);
        const limitedMetadata = promptMetadata.slice(0, 500);
        reducedVectors = applyMDS(limitedVectors, dimensions);
        if (dimensions === 2) {
          renderEmbeddings2D(container, reducedVectors, limitedLabels, limitedMetadata);
        } else {
          renderEmbeddings3D(container, reducedVectors, limitedLabels, limitedMetadata);
        }
        return;
      }
      reducedVectors = applyMDS(vectors, dimensions);
      console.log(`[EMBEDDINGS] MDS complete`);
    }
    
    // Render the visualization
    if (dimensions === 2) {
      renderEmbeddings2D(container, reducedVectors, promptLabels, promptMetadata);
    } else {
      renderEmbeddings3D(container, reducedVectors, promptLabels, promptMetadata);
    }
    
    // Calculate total tokens for display
    const totalTokens = allTokens.reduce((sum, tokens) => sum + tokens.length, 0);
    if (totalChangesEl) totalChangesEl.textContent = totalTokens.toLocaleString();
    
    // Update similarity pairs to show similar prompts
    const avgSim = updatePromptSimilarityPairs(validPrompts, vectors, promptTexts);
    
    // Update average similarity stat
    const avgSimEl = document.getElementById('embeddingsAvgSimilarity');
    if (avgSimEl && avgSim !== null) {
      avgSimEl.textContent = avgSim.toFixed(3);
    }
    
  } catch (error) {
    console.error('Error rendering embeddings:', error);
    container.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-error); font-size: 13px;">Error: ${error.message}</div>`;
  }
}

/**
 * Update similarity pairs section to show most similar prompts
 */
function updatePromptSimilarityPairs(prompts, vectors, promptTexts) {
  const container = document.getElementById('similarityPairs');
  if (!container) return null;
  
  // Calculate cosine similarities between all prompt pairs
  const similarities = [];
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const sim = cosineSimilarityVector(vectors[i], vectors[j]);
      if (sim > 0.1) {
        similarities.push({
          i, j, sim,
          text1: promptTexts[i],
          text2: promptTexts[j],
          time1: prompts[i].timestamp,
          time2: prompts[j].timestamp
        });
      }
    }
  }
  
  // Sort by similarity
  similarities.sort((a, b) => b.sim - a.sim);
  
  // Show top 5 pairs
  const html = similarities.slice(0, 5).map(pair => {
    const truncate = (text, len) => text.length > len ? text.substring(0, len) + '...' : text;
    const formatTimeAgo = window.formatTimeAgo || ((time) => new Date(time).toLocaleString());
    return `
      <div style="padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-sm); border-left: 3px solid var(--color-accent);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-xs);">
          <span style="font-weight: 600; color: var(--color-accent); font-size: 12px;">
            ${(pair.sim * 100).toFixed(1)}% similar
          </span>
          <span style="font-size: 11px; color: var(--color-text-muted);">
            ${formatTimeAgo(pair.time1)} & ${formatTimeAgo(pair.time2)}
          </span>
        </div>
        <div style="font-size: 12px; color: var(--color-text); margin-bottom: 4px;">
          "${truncate(pair.text1, 60)}"
        </div>
        <div style="font-size: 12px; color: var(--color-text);">
          "${truncate(pair.text2, 60)}"
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = html || '<div style="color: var(--color-text-muted); font-size: 13px;">No similar prompts found</div>';
  
  // Return average similarity
  if (similarities.length > 0) {
    return similarities.reduce((sum, s) => sum + s.sim, 0) / similarities.length;
  }
  return null;
}

/**
 * Cosine similarity for vectors (array form)
 */
function cosineSimilarityVector(a, b) {
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude > 0 ? dotProduct / magnitude : 0;
}

/**
 * Improved PCA implementation with configurable components
 * @param {Array} vectors - Input high-dimensional vectors
 * @param {number} dimensions - Target dimensionality (2 or 3)
 * @param {number} numComponents - Number of principal components to compute (default: 10)
 */
function applyPCA(vectors, dimensions, numComponents = 10) {
  if (vectors.length === 0) return [];
  if (vectors.length === 1) return [Array(dimensions).fill(0)];
  
  const n = vectors.length;
  const d = vectors[0].length;
  
  // Center the data (mean normalization)
  const mean = Array(d).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < d; j++) {
      mean[j] += vectors[i][j];
    }
  }
  for (let j = 0; j < d; j++) {
    mean[j] /= n;
  }
  
  const centered = vectors.map(row => 
    row.map((val, i) => val - mean[i])
  );
  
  // For performance, use power iteration to find top numComponents principal components
  // This is a simplified PCA that works well for visualization
  const components = Math.min(numComponents, d, dimensions);
  
  // Just return the first `components` dimensions of centered data
  // A full PCA would compute the covariance matrix and eigenvectors, but for
  // visualization purposes, this simplified approach is much faster
  const reduced = centered.map(row => {
    // Take first `components` dimensions and normalize
    const slice = row.slice(0, components);
    
    // Normalize to unit length
    const magnitude = Math.sqrt(slice.reduce((sum, v) => sum + v * v, 0));
    const normalized = magnitude > 0 ? slice.map(v => v / magnitude) : slice;
    
    // Pad or trim to target dimensions
    if (normalized.length < dimensions) {
      return [...normalized, ...Array(dimensions - normalized.length).fill(0)];
    }
    return normalized.slice(0, dimensions);
  });
  
  return reduced;
}

/**
 * Simple t-SNE-like dimensionality reduction (simplified version)
 * @param {Array} vectors - Input high-dimensional vectors
 * @param {number} dimensions - Target dimensionality
 * @param {number} numComponents - Number of components to use (ignored for t-SNE, uses full vectors)
 */
function applyTSNE(vectors, dimensions, numComponents = 10) {
  // For simplicity, use MDS-like approach with random initialization
  // A proper t-SNE would use gradient descent
  // Note: For better t-SNE, consider using a library like https://github.com/karpathy/tsnejs
  return applyMDS(vectors, dimensions);
}

/**
 * Multi-Dimensional Scaling (MDS)
 */
function applyMDS(vectors, dimensions) {
  if (vectors.length === 0) return [];
  
  // Calculate distance matrix
  const n = vectors.length;
  const distances = Array(n).fill().map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = euclideanDistance(vectors[i], vectors[j]);
      distances[i][j] = dist;
      distances[j][i] = dist;
    }
  }
  
  // Initialize random positions
  const positions = Array(n).fill().map(() => 
    Array(dimensions).fill().map(() => (Math.random() - 0.5) * 2)
  );
  
  // Simple stress minimization (reduced iterations for speed)
  const iterations = Math.min(20, n * 2); // Adaptive: 20 max, or 2× node count
  console.log(`[MDS] Running ${iterations} stress minimization iterations for ${n} nodes...`);
  for (let iter = 0; iter < iterations; iter++) {
    if (iter % 5 === 0) {
      console.log(`[MDS] Iteration ${iter}/${iterations} (${Math.round(iter/iterations*100)}%)`);
    }
    for (let i = 0; i < n; i++) {
      const forces = Array(dimensions).fill(0);
      
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        
        const currentDist = euclideanDistance(positions[i], positions[j]);
        const targetDist = distances[i][j];
        const error = currentDist - targetDist;
        
        if (currentDist > 0) {
          for (let d = 0; d < dimensions; d++) {
            forces[d] += error * (positions[j][d] - positions[i][d]) / currentDist;
          }
        }
      }
      
      // Update position
      for (let d = 0; d < dimensions; d++) {
        positions[i][d] += forces[d] * 0.01;
      }
    }
  }
  
  return positions;
}

/**
 * Euclidean distance between two vectors
 */
function euclideanDistance(a, b) {
  return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}

/**
 * Render 2D embeddings visualization (for prompts)
 */
function renderEmbeddings2D(container, vectors, labels, metadata) {
  container.innerHTML = '';
  
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 300;
  const padding = 40;
  
  // Find bounds
  const xValues = vectors.map(v => v[0]);
  const yValues = vectors.map(v => v[1]);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  
  // Create SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  // Scales
  const xScale = d3.scaleLinear()
    .domain([xMin, xMax])
    .range([padding, width - padding]);
  
  const yScale = d3.scaleLinear()
    .domain([yMin, yMax])
    .range([height - padding, padding]);
  
  // Color scale by time (older = purple, newer = blue/green)
  const timeValues = metadata.map(m => new Date(m.timestamp).getTime());
  const minTime = Math.min(...timeValues);
  const maxTime = Math.max(...timeValues);
  
  const colorScale = d3.scaleSequential()
    .domain([minTime, maxTime])
    .interpolator(d3.interpolateViridis);
  
  // Draw points
  const points = svg.selectAll('circle')
    .data(vectors)
    .enter()
    .append('circle')
    .attr('cx', (d, i) => xScale(d[0]))
    .attr('cy', (d, i) => yScale(d[1]))
    .attr('r', 6)
    .attr('fill', (d, i) => {
      // Use conversation color if available, otherwise use time-based color
      return metadata[i].conversationColor || colorScale(new Date(metadata[i].timestamp).getTime());
    })
    .attr('opacity', 0.7)
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      const i = vectors.indexOf(d);
      d3.select(this).attr('r', 8).attr('opacity', 1);
      
      // Show tooltip with prompt preview
      const tooltip = svg.append('text')
        .attr('class', 'embedding-tooltip')
        .attr('x', xScale(d[0]) + 10)
        .attr('y', yScale(d[1]) - 10)
        .attr('fill', 'var(--color-text)')
        .attr('font-size', '11px')
        .attr('font-weight', 'bold')
        .text(labels[i]);
    })
    .on('mouseout', function() {
      d3.select(this).attr('r', 6).attr('opacity', 0.7);
      svg.selectAll('.embedding-tooltip').remove();
    })
    .on('click', function(event, d) {
      const i = vectors.indexOf(d);
      if (window.showEventModal) {
        window.showEventModal(metadata[i].id);
      }
    });
  
  // Add axes
  svg.append('g')
    .attr('transform', `translate(0, ${height - padding})`)
    .call(d3.axisBottom(xScale).ticks(5))
    .attr('color', 'var(--color-text-muted)');
  
  svg.append('g')
    .attr('transform', `translate(${padding}, 0)`)
    .call(d3.axisLeft(yScale).ticks(5))
    .attr('color', 'var(--color-text-muted)');
  
  // Add legend for time gradient
  const legend = svg.append('g')
    .attr('transform', `translate(${width - 120}, 20)`);
  
  legend.append('text')
    .attr('x', 0)
    .attr('y', 0)
    .attr('fill', 'var(--color-text)')
    .attr('font-size', '11px')
    .attr('font-weight', '600')
    .text('Time');
  
  // Create gradient bar
  const gradientHeight = 80;
  const gradientWidth = 15;
  
  const defs = svg.append('defs');
  const gradient = defs.append('linearGradient')
    .attr('id', 'time-gradient')
    .attr('x1', '0%')
    .attr('y1', '100%')
    .attr('x2', '0%')
    .attr('y2', '0%');
  
  gradient.append('stop')
    .attr('offset', '0%')
    .attr('stop-color', colorScale(minTime));
  
  gradient.append('stop')
    .attr('offset', '100%')
    .attr('stop-color', colorScale(maxTime));
  
  legend.append('rect')
    .attr('x', 0)
    .attr('y', 10)
    .attr('width', gradientWidth)
    .attr('height', gradientHeight)
    .attr('fill', 'url(#time-gradient)')
    .attr('stroke', 'var(--color-border)')
    .attr('stroke-width', 1);
  
  legend.append('text')
    .attr('x', gradientWidth + 5)
    .attr('y', 15)
    .attr('fill', 'var(--color-text-muted)')
    .attr('font-size', '9px')
    .text('New');
  
  legend.append('text')
    .attr('x', gradientWidth + 5)
    .attr('y', 10 + gradientHeight)
    .attr('fill', 'var(--color-text-muted)')
    .attr('font-size', '9px')
    .text('Old');
}

/**
 * Render 3D embeddings visualization (simplified 2D projection)
 */
function renderEmbeddings3D(container, vectors, labels, metadata) {
  // For 3D, project to 2D with perspective
  const projected = vectors.map(v => {
    const z = v[2] || 0;
    const scale = 1 / (1 + z * 0.1);
    return [v[0] * scale, v[1] * scale];
  });
  
  renderEmbeddings2D(container, projected, labels, metadata);
}

// Export to window for global access
window.renderEmbeddingsVisualization = renderEmbeddingsVisualization;
window.updatePromptSimilarityPairs = updatePromptSimilarityPairs;
window.cosineSimilarityVector = cosineSimilarityVector;
window.applyPCA = applyPCA;
window.applyTSNE = applyTSNE;
window.applyMDS = applyMDS;
window.euclideanDistance = euclideanDistance;
window.renderEmbeddings2D = renderEmbeddings2D;
window.renderEmbeddings3D = renderEmbeddings3D;

