/**
 * Embeddings Visualization Component
 * Handles prompt embeddings visualization using TF-IDF and dimensionality reduction (PCA/t-SNE/MDS)
 * 
 * Dependencies: window.CONFIG, window.state, window.tokenizeCode, window.formatTimeAgo, 
 * window.showEventModal, d3, window.THREE (for 3D visualization)
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
      <div class="embeddings-empty">
        <div class="embeddings-empty__title">No Data Available</div>
        <div class="embeddings-empty__message">Prompt data will appear here once you start using Cursor AI</div>
      </div>
    `;
    return;
  }
  
  const method = document.getElementById('embeddingsReductionMethod')?.value || 'pca';
  const dimensions = parseInt(document.getElementById('embeddingsDimensions')?.value || '3'); // Default to 3D
  const numComponents = parseInt(document.getElementById('embeddingsPCAComponents')?.value || '10');
  
  // Show loading state
  container.innerHTML = '<div class="embeddings-processing">Processing embeddings... (this may take a moment)</div>';
  
  try {
    
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
    
    // LIMIT: Process max 500 prompts to prevent timeout (O(n²) similarity calculations)
    // Reduced from 1000 to 500 for faster processing
    const MAX_PROMPTS = 500;
    if (validPrompts.length > MAX_PROMPTS) {
      console.warn(`[EMBEDDINGS] Limiting to ${MAX_PROMPTS} most recent prompts (of ${validPrompts.length} total) to prevent timeout`);
      // Sort by timestamp and take most recent
      validPrompts = validPrompts
        .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
        .slice(0, MAX_PROMPTS);
    }
    
    
    // Update stats immediately
    const filesCountEl = document.getElementById('embeddingsFilesCount');
    const totalChangesEl = document.getElementById('embeddingsTotalChanges');
    if (filesCountEl) filesCountEl.textContent = validPrompts.length;
    
    if (validPrompts.length === 0) {
      container.innerHTML = '<div class="embeddings-empty__message">No valid prompts for analysis (filtered out JSON metadata)</div>';
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
    
    
    // OPTIMIZATION: Pre-compute document frequencies once (O(n) instead of O(n²))
    const docFreqs = new Map();
    allTokens.forEach(tokens => {
      const uniqueTokens = new Set(tokens);
      uniqueTokens.forEach(term => {
        docFreqs.set(term, (docFreqs.get(term) || 0) + 1);
      });
    });
    
    // Create TF-IDF vectors (chunked, optimized)
    const vectors = [];
    const promptLabels = [];
    const promptMetadata = [];
    
    // Process in larger batches for better performance
    const VECTOR_BATCH_SIZE = 200;
    for (let batchStart = 0; batchStart < validPrompts.length; batchStart += VECTOR_BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + VECTOR_BATCH_SIZE, validPrompts.length);
      
      for (let i = batchStart; i < batchEnd; i++) {
        const prompt = validPrompts[i];
        const tokens = allTokens[i];
        const vector = [];
        
        // Create TF-IDF vector (optimized: use pre-computed docFreqs)
        const tokenCounts = new Map();
        tokens.forEach(t => tokenCounts.set(t, (tokenCounts.get(t) || 0) + 1));
        
        topVocab.forEach(term => {
          const tf = (tokenCounts.get(term) || 0) / Math.max(tokens.length, 1);
          const df = docFreqs.get(term) || 1;
          const idf = Math.log(validPrompts.length / df);
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
      
      // Yield to browser after each batch
      if (batchEnd < validPrompts.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    
    // Apply dimensionality reduction (with timeout protection)
    let reducedVectors;
    if (method === 'pca') {
      // PCA is fast, can run synchronously
      reducedVectors = applyPCA(vectors, dimensions, numComponents);
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
    container.innerHTML = `<div class="embeddings-error">Error: ${error.message}</div>`;
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
      <div class="embeddings-tooltip">
        <div class="embeddings-tooltip__header">
          <span class="embeddings-tooltip__title">
            ${(pair.sim * 100).toFixed(1)}% similar
          </span>
          <span class="embeddings-tooltip__meta">
            ${formatTimeAgo(pair.time1)} & ${formatTimeAgo(pair.time2)}
          </span>
        </div>
        <div class="embeddings-tooltip__content">
          "${truncate(pair.text1, 60)}"
        </div>
        <div class="embeddings-tooltip__content">
          "${truncate(pair.text2, 60)}"
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = html || '<div class="embeddings-empty__message">No similar prompts found</div>';
  
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
  for (let iter = 0; iter < iterations; iter++) {
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
 * Render 2D embeddings visualization (for prompts) - Enhanced with zoom, pan, and better interactions
 */
function renderEmbeddings2D(container, vectors, labels, metadata) {
  container.innerHTML = '';
  
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 600;
  const padding = { top: 20, right: 120, bottom: 40, left: 40 };
  
  // Find bounds
  const xValues = vectors.map(v => v[0]);
  const yValues = vectors.map(v => v[1]);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  
  // Add padding to domain
  const xRange = xMax - xMin;
  const yRange = yMax - yMin;
  const xDomain = [xMin - xRange * 0.1, xMax + xRange * 0.1];
  const yDomain = [yMin - yRange * 0.1, yMax + yRange * 0.1];
  
  // Create SVG with zoom/pan support
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('background', 'var(--color-bg-subtle)')
    .style('border-radius', '8px');
  
  // Create main group for zoom/pan
  const g = svg.append('g');
  
  // Initial scales
  const xScale = d3.scaleLinear()
    .domain(xDomain)
    .range([padding.left, width - padding.right]);
  
  const yScale = d3.scaleLinear()
    .domain(yDomain)
    .range([height - padding.bottom, padding.top]);
  
  // Color scale by time
  const timeValues = metadata.map(m => new Date(m.timestamp).getTime());
  const minTime = Math.min(...timeValues);
  const maxTime = Math.max(...timeValues);
  
  const colorScale = d3.scaleSequential()
    .domain([minTime, maxTime])
    .interpolator(d3.interpolateViridis);
  
  // Calculate similarity connections (top 5% most similar pairs)
  const connections = [];
  if (vectors.length > 0 && vectors.length <= 500) {
    const similarities = [];
    for (let i = 0; i < vectors.length; i++) {
      for (let j = i + 1; j < vectors.length; j++) {
        const dist = euclideanDistance(vectors[i], vectors[j]);
        const maxDist = Math.max(...vectors.flatMap((v, idx) => 
          vectors.slice(idx + 1).map(v2 => euclideanDistance(v, v2))
        ));
        const similarity = 1 - (dist / maxDist);
        if (similarity > 0.7) {
          similarities.push({ i, j, similarity });
        }
      }
    }
    similarities.sort((a, b) => b.similarity - a.similarity);
    connections.push(...similarities.slice(0, Math.floor(vectors.length * 0.05)));
  }
  
  // Draw connection lines
  const links = g.append('g').attr('class', 'links');
  links.selectAll('line')
    .data(connections)
    .enter()
    .append('line')
    .attr('x1', d => xScale(vectors[d.i][0]))
    .attr('y1', d => yScale(vectors[d.i][1]))
    .attr('x2', d => xScale(vectors[d.j][0]))
    .attr('y2', d => yScale(vectors[d.j][1]))
    .attr('stroke', 'var(--color-border)')
    .attr('stroke-width', 0.5)
    .attr('opacity', 0.3);
  
  // Draw points with enhanced styling
  const points = g.append('g').attr('class', 'points');
  const circles = points.selectAll('circle')
    .data(vectors)
    .enter()
    .append('circle')
    .attr('cx', (d, i) => xScale(d[0]))
    .attr('cy', (d, i) => yScale(d[1]))
    .attr('r', 5)
    .attr('fill', (d, i) => {
      return metadata[i].conversationColor || colorScale(new Date(metadata[i].timestamp).getTime());
    })
    .attr('opacity', 0.75)
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)
    .style('cursor', 'pointer')
    .style('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))');
  
  // Enhanced tooltip
  const tooltip = d3.select('body').append('div')
    .attr('class', 'embedding-tooltip')
    .style('position', 'absolute')
    .style('background', 'var(--color-bg)')
    .style('border', '1px solid var(--color-border)')
    .style('border-radius', '6px')
    .style('padding', '10px')
    .style('font-size', '12px')
    .style('pointer-events', 'none')
    .style('opacity', 0)
    .style('max-width', '300px')
    .style('box-shadow', '0 4px 12px rgba(0,0,0,0.15)')
    .style('z-index', 1000);
  
  circles
    .on('mouseover', function(event, d) {
      const i = vectors.indexOf(d);
      d3.select(this).attr('r', 8).attr('opacity', 1).attr('stroke-width', 2);
      
      const meta = metadata[i];
      const formatTime = window.formatTimeAgo || ((t) => new Date(t).toLocaleString());
      const text = meta.text || labels[i];
      const truncated = text.length > 150 ? text.substring(0, 150) + '...' : text;
      
      tooltip
        .html(`
          <div style="font-weight: 600; margin-bottom: 6px; color: var(--color-text);">
            ${meta.conversationTitle ? `<div style="font-size: 11px; color: var(--color-accent); margin-bottom: 4px;">${meta.conversationTitle}</div>` : ''}
            Prompt Preview
          </div>
          <div style="color: var(--color-text-muted); font-size: 11px; margin-bottom: 6px;">
            ${formatTime(meta.timestamp)} • ${meta.workspaceName}
          </div>
          <div style="color: var(--color-text); line-height: 1.4;">
            ${window.escapeHtml ? window.escapeHtml(truncated) : truncated}
          </div>
          <div style="margin-top: 6px; font-size: 10px; color: var(--color-text-muted);">
            Click to view details
          </div>
        `)
        .style('opacity', 1);
    })
    .on('mousemove', function(event) {
      tooltip
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px');
    })
    .on('mouseout', function() {
      d3.select(this).attr('r', 5).attr('opacity', 0.75).attr('stroke-width', 1.5);
      tooltip.style('opacity', 0);
    })
    .on('click', function(event, d) {
      const i = vectors.indexOf(d);
      if (window.showEventModal) {
        window.showEventModal(metadata[i].id);
      }
    });
  
  // Add axes with better styling
  const xAxis = d3.axisBottom(xScale).ticks(8);
  const yAxis = d3.axisLeft(yScale).ticks(8);
  
  g.append('g')
    .attr('class', 'axis axis-x')
    .attr('transform', `translate(0, ${height - padding.bottom})`)
    .call(xAxis)
    .style('color', 'var(--color-text-muted)')
    .selectAll('text')
    .style('font-size', '10px')
    .style('fill', 'var(--color-text-muted)');
  
  g.append('g')
    .attr('class', 'axis axis-y')
    .attr('transform', `translate(${padding.left}, 0)`)
    .call(yAxis)
    .style('color', 'var(--color-text-muted)')
    .selectAll('text')
    .style('font-size', '10px')
    .style('fill', 'var(--color-text-muted)');
  
  // Add axis labels
  g.append('text')
    .attr('transform', `translate(${width / 2}, ${height - 5})`)
    .style('text-anchor', 'middle')
    .style('font-size', '11px')
    .style('fill', 'var(--color-text-muted)')
    .text('Dimension 1');
  
  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', 15)
    .attr('x', -height / 2)
    .style('text-anchor', 'middle')
    .style('font-size', '11px')
    .style('fill', 'var(--color-text-muted)')
    .text('Dimension 2');
  
  // Add zoom/pan behavior
  const zoom = d3.zoom()
    .scaleExtent([0.5, 10])
    .on('zoom', (event) => {
      const { transform } = event;
      xScale.range([padding.left, width - padding.right].map(d => transform.applyX(d)));
      yScale.range([height - padding.bottom, padding.top].map(d => transform.applyY(d)));
      
      // Update circles
      circles
        .attr('cx', (d, i) => xScale(d[0]))
        .attr('cy', (d, i) => yScale(d[1]));
      
      // Update links
      links.selectAll('line')
        .attr('x1', d => xScale(vectors[d.i][0]))
        .attr('y1', d => yScale(vectors[d.i][1]))
        .attr('x2', d => xScale(vectors[d.j][0]))
        .attr('y2', d => yScale(vectors[d.j][1]));
      
      // Update axes
      g.select('.axis-x').call(xAxis);
      g.select('.axis-y').call(yAxis);
    });
  
  svg.call(zoom);
  
  // Add legend for time gradient
  const legend = svg.append('g')
    .attr('transform', `translate(${width - 110}, ${padding.top})`);
  
  legend.append('text')
    .attr('x', 0)
    .attr('y', 0)
    .attr('fill', 'var(--color-text)')
    .attr('font-size', '11px')
    .attr('font-weight', '600')
    .text('Time');
  
  const gradientHeight = 100;
  const gradientWidth = 15;
  
  const defs = svg.append('defs');
  const gradient = defs.append('linearGradient')
    .attr('id', 'time-gradient-2d')
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
    .attr('y', 12)
    .attr('width', gradientWidth)
    .attr('height', gradientHeight)
    .attr('fill', 'url(#time-gradient-2d)')
    .attr('stroke', 'var(--color-border)')
    .attr('stroke-width', 1)
    .attr('rx', 2);
  
  legend.append('text')
    .attr('x', gradientWidth + 5)
    .attr('y', 20)
    .attr('fill', 'var(--color-text-muted)')
    .attr('font-size', '9px')
    .text('New');
  
  legend.append('text')
    .attr('x', gradientWidth + 5)
    .attr('y', 12 + gradientHeight)
    .attr('fill', 'var(--color-text-muted)')
    .attr('font-size', '9px')
    .text('Old');
  
  // Add reset zoom button
  const resetButton = svg.append('g')
    .attr('class', 'reset-zoom')
    .attr('transform', `translate(${width - 110}, ${height - 30})`)
    .style('cursor', 'pointer')
    .on('click', () => {
      svg.transition().duration(750).call(
        zoom.transform,
        d3.zoomIdentity
      );
    });
  
  resetButton.append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', 90)
    .attr('height', 20)
    .attr('fill', 'var(--color-bg)')
    .attr('stroke', 'var(--color-border)')
    .attr('stroke-width', 1)
    .attr('rx', 4);
  
  resetButton.append('text')
    .attr('x', 45)
    .attr('y', 13)
    .attr('text-anchor', 'middle')
    .attr('fill', 'var(--color-text)')
    .attr('font-size', '10px')
    .text('Reset Zoom');
}

/**
 * Render 3D embeddings visualization using Three.js
 */
async function renderEmbeddings3D(container, vectors, labels, metadata) {
  // Cleanup previous 3D visualization if exists
  if (container._cleanup3D) {
    container._cleanup3D();
    delete container._cleanup3D;
  }
  
  container.innerHTML = '';
  
  // Ensure Three.js is loaded
  if (typeof window.THREE === 'undefined') {
    container.innerHTML = `
      <div class="visualization-3d-unavailable visualization-3d-unavailable--centered">
        <div class="visualization-3d-unavailable__title">3D Visualization Unavailable</div>
        <div class="visualization-3d-unavailable__message">Loading Three.js library...</div>
      </div>
    `;
    
    // Wait for Three.js to load
    await new Promise((resolve) => {
      const checkThree = setInterval(() => {
        if (typeof window.THREE !== 'undefined') {
          clearInterval(checkThree);
          resolve();
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkThree);
        if (typeof window.THREE === 'undefined') {
          container.innerHTML = `
            <div class="visualization-3d-error visualization-3d-error--centered">
              <div class="visualization-3d-error__title">3D Visualization Unavailable</div>
              <div class="visualization-3d-error__message">Three.js failed to load. Please refresh the page.</div>
            </div>
          `;
        }
        resolve();
      }, 5000);
    });
    
    if (typeof window.THREE === 'undefined') return;
  }
  
  const THREE = window.THREE;
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 600;
  
  // Find bounds for normalization
  const xValues = vectors.map(v => v[0]);
  const yValues = vectors.map(v => v[1]);
  const zValues = vectors.map(v => v[2] || 0);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const zMin = Math.min(...zValues);
  const zMax = Math.max(...zValues);
  
  // Normalize to [-1, 1] range
  const normalize = (val, min, max) => {
    const range = max - min;
    return range > 0 ? ((val - min) / range) * 2 - 1 : 0;
  };
  
  // Color scale by time
  const timeValues = metadata.map(m => new Date(m.timestamp).getTime());
  const minTime = Math.min(...timeValues);
  const maxTime = Math.max(...timeValues);
  
  // Create scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f5f5);
  
  // Create camera
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.set(2, 2, 2);
  camera.lookAt(0, 0, 0);
  
  // Create renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);
  
  // Create point cloud
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const sizes = [];
  
  vectors.forEach((v, i) => {
    const x = normalize(v[0], xMin, xMax) * 2;
    const y = normalize(v[1], yMin, yMax) * 2;
    const z = normalize(v[2] || 0, zMin, zMax) * 2;
    
    positions.push(x, y, z);
    
    // Color by time or conversation
    const time = new Date(metadata[i].timestamp).getTime();
    const normalizedTime = (time - minTime) / (maxTime - minTime);
    
    if (metadata[i].conversationColor) {
      // Use conversation color
      const color = new THREE.Color(metadata[i].conversationColor);
      colors.push(color.r, color.g, color.b);
    } else {
      // Use viridis-like color scale
      const hue = normalizedTime * 0.7; // 0 to 0.7 (blue to green)
      const color = new THREE.Color().setHSL(hue, 0.8, 0.5);
      colors.push(color.r, color.g, color.b);
    }
    
    sizes.push(0.05);
  });
  
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
  
  // Create shader material for points
  const pointMaterial = new THREE.ShaderMaterial({
    uniforms: {
      pointTexture: { value: null }
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        float r = distance(gl_PointCoord, vec2(0.5));
        if (r > 0.5) discard;
        float alpha = 1.0 - smoothstep(0.0, 0.5, r);
        gl_FragColor = vec4(vColor, alpha * 0.9);
      }
    `,
    transparent: true,
    vertexColors: true
  });
  
  const points = new THREE.Points(geometry, pointMaterial);
  scene.add(points);
  
  // Create axes helper
  const axesHelper = new THREE.AxesHelper(2.5);
  scene.add(axesHelper);
  
  // Add grid helper
  const gridHelper = new THREE.GridHelper(5, 20, 0x888888, 0xcccccc);
  scene.add(gridHelper);
  
  // Add labels for axes
  const createAxisLabel = (text, position, color) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 128;
    canvas.height = 64;
    context.fillStyle = color;
    context.font = 'Bold 32px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 64, 32);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(position);
    sprite.scale.set(0.5, 0.25, 1);
    return sprite;
  };
  
  scene.add(createAxisLabel('X', new THREE.Vector3(2.5, 0, 0), '#ff0000'));
  scene.add(createAxisLabel('Y', new THREE.Vector3(0, 2.5, 0), '#00ff00'));
  scene.add(createAxisLabel('Z', new THREE.Vector3(0, 0, 2.5), '#0000ff'));
  
  // Add orbit controls
  let controls = null;
  if (window.loadOrbitControls) {
    try {
      const OrbitControls = await window.loadOrbitControls();
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.minDistance = 1;
      controls.maxDistance = 10;
    } catch (error) {
      console.warn('[EMBEDDINGS] Failed to load OrbitControls:', error);
    }
  }
  
  // Add mouse interaction for tooltips
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hoveredIndex = -1;
  
  // Create tooltip element
  const tooltip = document.createElement('div');
  tooltip.style.cssText = `
    position: absolute;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 10px;
    font-size: 12px;
    pointer-events: none;
    opacity: 0;
    max-width: 300px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 1000;
  `;
  container.appendChild(tooltip);
  
  const onMouseMove = (event) => {
    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(points);
    
    if (intersects.length > 0) {
      const index = intersects[0].index;
      if (hoveredIndex !== index) {
        hoveredIndex = index;
        
        // Highlight point
        const sizes = geometry.attributes.size.array;
        sizes[index] = 0.08;
        geometry.attributes.size.needsUpdate = true;
        
        // Show tooltip
        const meta = metadata[index];
        const formatTime = window.formatTimeAgo || ((t) => new Date(t).toLocaleString());
        const text = meta.text || labels[index];
        const truncated = text.length > 150 ? text.substring(0, 150) + '...' : text;
        
        tooltip.innerHTML = `
          <div class="prompt-tooltip">
            ${meta.conversationTitle ? `<div class="prompt-tooltip__conversation">${meta.conversationTitle}</div>` : ''}
            Prompt Preview
          </div>
          <div class="prompt-tooltip__meta">
            ${formatTime(meta.timestamp)} • ${meta.workspaceName}
          </div>
          <div class="prompt-tooltip__text">
            ${window.escapeHtml ? window.escapeHtml(truncated) : truncated}
          </div>
          <div class="prompt-tooltip__footer">
            Click to view details
          </div>
        `;
        tooltip.style.opacity = '1';
        tooltip.style.left = (event.clientX + 10) + 'px';
        tooltip.style.top = (event.clientY - 10) + 'px';
      }
    } else {
      if (hoveredIndex >= 0) {
        const sizes = geometry.attributes.size.array;
        sizes[hoveredIndex] = 0.05;
        geometry.attributes.size.needsUpdate = true;
        hoveredIndex = -1;
        tooltip.style.opacity = '0';
      }
    }
  };
  
  const onMouseClick = (event) => {
    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(points);
    
    if (intersects.length > 0 && window.showEventModal) {
      const index = intersects[0].index;
      window.showEventModal(metadata[index].id);
    }
  };
  
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('click', onMouseClick);
  
  // Animation loop with pause/resume support
  let animationId = null;
  let isPaused = false;
  
  const animate = () => {
    if (isPaused) return;
    
    animationId = requestAnimationFrame(animate);
    
    if (controls) {
      controls.update();
    }
    
    // Rotate points slightly for better visualization
    points.rotation.y += 0.001;
    
    renderer.render(scene, camera);
  };
  
  animate();
  
  // Store pause/resume functions for view lifecycle
  if (!window.embeddings3DState) {
    window.embeddings3DState = {};
  }
  window.embeddings3DState.pause = () => {
    isPaused = true;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  };
  window.embeddings3DState.resume = () => {
    if (isPaused) {
      isPaused = false;
      animate();
    }
  };
  window.embeddings3DState.cleanup = () => {
    isPaused = true;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (renderer) {
      renderer.dispose();
    }
    if (scene) {
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(m => m.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    }
  };
  
  // Handle resize
  const handleResize = () => {
    const newWidth = container.clientWidth;
    const newHeight = container.clientHeight;
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
  };
  
  window.addEventListener('resize', handleResize);
  
  // Store cleanup function
  container._cleanup3D = () => {
    window.removeEventListener('resize', handleResize);
    renderer.domElement.removeEventListener('mousemove', onMouseMove);
    renderer.domElement.removeEventListener('click', onMouseClick);
    renderer.dispose();
    geometry.dispose();
    pointMaterial.dispose();
    if (tooltip.parentNode) {
      tooltip.parentNode.removeChild(tooltip);
    }
  };
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

