/**
 * File Graph View HTML Templates
 * Template functions for File Graph view components
 */

function renderFileGraphViewTemplate(data) {
  return `
    <div class="file-graph-view">
      <div class="view-header">
        <h2 title="Semantic File Network: Interactive graph visualization using force-directed layout (D3.js with Barnes-Hut optimization). Files are connected based on TF-IDF semantic similarity, co-occurrence patterns, or temporal proximity. Uses adaptive charge strength and theta parameter (0.7-0.9) for performance. Supports clustering algorithms (k-means, community detection) and AI activity overlays. Complexity: O(n log n) with Barnes-Hut optimization.">Semantic File Network</h2>
        <p class="view-subtitle">Interactive code relationship visualization with AI activity overlay</p>
      </div>

      <div class="graph-controls">
        <div class="control-group">
          <label title="Analysis mode determines how file relationships (edges) are calculated">Analysis Mode:</label>
          <select id="graphMetric" onchange="updateFileGraph()" title="Choose how to measure similarity between files">
            <option value="tfidf" title="TF-IDF Semantic: Uses Term Frequency-Inverse Document Frequency to measure semantic similarity based on code content. Files with similar keywords/terms get higher similarity scores. Good for finding files with similar functionality or purpose.">TF-IDF Semantic</option>
            <option value="cooccurrence" title="Co-occurrence: Measures how often files are modified together in the same session or prompt. Uses Jaccard similarity (intersection/union) of editing sessions. Files frequently edited together get connected. Good for finding related work patterns.">Co-occurrence</option>
            <option value="temporal" title="Temporal Proximity: Connects files based on when they were modified. Files edited close together in time get connected. Good for understanding development workflows and sequential patterns.">Temporal Proximity</option>
          </select>
        </div>

        <div class="control-group">
          <label title="Layout algorithm determines how files are positioned in the graph visualization">Layout:</label>
          <select id="layoutAlgorithm" onchange="updateFileGraph()" title="Choose the layout algorithm for positioning files">
            <option value="force" title="Force-Directed Layout: Uses physics simulation (D3.js) with Barnes-Hut optimization. Nodes repel each other, edges attract connected nodes. Optimized for large graphs with adaptive charge strength and theta parameter (0.7-0.9). Complexity: O(n log n) with Barnes-Hut, O(n²) without. Best for showing natural clustering and relationships.">Force-Directed</option>
            <option value="circular" title="Circular Layout: Arranges all files in a circle. Simple and fast, good for small graphs. All nodes equidistant from center.">Circular</option>
            <option value="radial" title="Radial Layout: Arranges files in clusters around a central point. Each cluster forms a circle. Good for hierarchical or cluster-based visualization.">Radial</option>
          </select>
        </div>

        <div class="control-group">
          <label>Node Size By:</label>
          <select id="nodeSizeMetric" onchange="updateFileGraph()">
            <option value="changes">Change Count</option>
            <option value="size">File Size</option>
            <option value="recency">Recency</option>
          </select>
        </div>

        <div class="control-group">
          <label>Overlay:</label>
          <select id="graphOverlay" onchange="updateFileGraph()">
            <option value="none">None</option>
            <option value="prompts">AI Prompts</option>
            <option value="activity">Activity Heat</option>
            <option value="complexity">Code Complexity</option>
          </select>
        </div>

        <div class="control-group">
          <label title="Clustering groups related files together visually, often with colors or regions">Clustering:</label>
          <select id="clusteringAlgorithm" onchange="updateFileGraph()" title="Choose how to group files into clusters">
            <option value="none" title="No clustering: Files are positioned based only on layout algorithm without grouping">None</option>
            <option value="fileType" title="By File Type: Groups files by extension (.js, .ts, .py, etc.). Simple and fast.">By File Type</option>
            <option value="workspace" title="By Workspace: Groups files by their workspace path. Files from same project appear together.">By Workspace</option>
            <option value="directory" title="By Directory: Groups files by directory structure. Files in same folder appear together.">By Directory</option>
            <option value="similarity" title="By Similarity: Uses similarity scores to form clusters. Files with high similarity scores are grouped. May use k-means or hierarchical clustering.">By Similarity</option>
            <option value="community" title="Community Detection: Uses graph algorithms (like Louvain or modularity optimization) to detect communities in the file graph. Finds natural groupings based on connection patterns.">Community Detection</option>
          </select>
        </div>

        <div class="control-group">
          <label class="with-help">
            Threshold: <span id="thresholdValue">0.2</span>
            <span class="help-text" title="Minimum similarity score (0-1) required to show connections between files. Higher values show only strongly related files.">Threshold</span>
          </label>
          <input type="range" id="similarityThreshold" min="0" max="1" step="0.05" value="0.2" 
                 oninput="document.getElementById('thresholdValue').textContent = this.value; updateFileGraph()"
                 title="Lower = more connections (noisier), Higher = only strong relationships (cleaner)">
        </div>

        <div class="control-group">
          <label>File Types:</label>
          <select id="fileTypeFilter" multiple onchange="updateFileGraph()">
            <!-- Options will be populated programmatically -->
          </select>
        </div>

        <div class="control-actions">
          <button class="btn btn-primary" onclick="updateFileGraph()">Refresh</button>
          <button class="btn btn-secondary" onclick="resetFileGraphZoom()">Reset View</button>
          <button class="btn btn-secondary" onclick="zoomToFit()">Zoom to Fit</button>
          <button class="btn btn-secondary" onclick="toggleLabels()" id="labelToggle">Hide Labels</button>
        </div>
      </div>
      
      <!-- Search & Navigation Panel -->
      <div class="graph-search-panel">
        <input type="text" id="fileSearch" class="graph-search-input" placeholder="Search files by name or path..." 
               oninput="filterGraphNodes(this.value)"
               title="Search files by name, path, or extension. Results highlight matching files in the graph.">
        <div id="fileSearchResults" class="graph-search-results"></div>
        <div id="annotationStatus" style="display: none; font-size: 12px; color: var(--color-text-muted); margin-top: 4px; font-style: italic;"></div>
      </div>

      <div class="graph-container" id="fileGraphContainer">
        <!-- File graph will be rendered here -->
      </div>

      <div class="graph-stats">
        <div class="stat-item">
          <span class="stat-label">Files:</span>
          <span class="stat-value" id="graphNodeCount">0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Connections:</span>
          <span class="stat-value" id="graphLinkCount">0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Avg Similarity:</span>
          <span class="stat-value" id="graphAvgSimilarity">0.00</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">AI Prompts:</span>
          <span class="stat-value" id="graphPromptCount">0</span>
        </div>
      </div>
      
      <!-- Most Similar File Pairs -->
      <div class="card similar-pairs-section">
        <div class="card-header">
          <div>
            <h3 class="card-title help-cursor" title="File pairs ranked by co-occurrence in prompts and editing sessions. Shows which files are frequently worked on together.">
              Most Similar File Pairs
            </h3>
            <p class="card-subtitle">Files frequently modified together with highest co-occurrence scores</p>
          </div>
          <div class="similar-pairs-controls">
            <label>Show:</label>
            <input type="number" id="similarPairsCount" class="similar-pairs-count-input" min="1" max="50" value="10" onchange="updateSimilarPairs()" oninput="if(this.value > 50) this.value = 50; if(this.value < 1) this.value = 1;" />
            <button onclick="highlightSimilarPairs()" class="btn btn-secondary" title="Highlight these pairs in the graph visualization above">Highlight in Graph</button>
          </div>
        </div>
        <div class="card-body">
          <div id="similarFilePairs" class="similar-pairs-list">
            <!-- Will be populated by JavaScript -->
          </div>
        </div>
      </div>

      <!-- Semantic Analysis Panels -->
      <div class="semantic-analysis-grid">
        
        <!-- Prompt Embeddings Analysis -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title help-cursor" title="Prompts Embedding Analysis: Uses TF-IDF (Term Frequency-Inverse Document Frequency) to create feature vectors from prompt text. Then applies dimensionality reduction: PCA (Principal Component Analysis - linear, fastest), t-SNE (t-Distributed Stochastic Neighbor Embedding - non-linear, best clusters), or MDS (Multidimensional Scaling - preserves distances). Prompts with similar content appear closer in 2D/3D space. All processing done locally in browser.">
              Prompts Embedding Analysis
            </h3>
          </div>
          <div class="card-body">
            <p class="embeddings-description">
              Semantic relationships between AI prompts across all time. Colors represent time (purple = older, yellow/green = newer).
            </p>
            <div class="embeddings-stats">
              <div class="embeddings-stat-row">
                <span class="embeddings-stat-label">Prompts Analyzed:</span>
                <span id="embeddingsFilesCount" class="embeddings-stat-value">0</span>
              </div>
              <div class="embeddings-stat-row">
                <span class="embeddings-stat-label">Total Tokens:</span>
                <span id="embeddingsTotalChanges" class="embeddings-stat-value">0</span>
              </div>
              <div class="embeddings-stat-row">
                <span class="embeddings-stat-label">Avg Similarity:</span>
                <span id="embeddingsAvgSimilarity" class="embeddings-stat-value">0.000</span>
              </div>
            </div>
            
            <!-- Dimensionality Reduction Controls -->
            <div class="embeddings-controls">
              <div class="embeddings-controls-row">
                <div class="embeddings-control-group">
                  <label class="embeddings-control-label" title="Dimensionality reduction method: Projects high-dimensional TF-IDF vectors to 2D/3D for visualization">Reduction Method:</label>
                  <select id="embeddingsReductionMethod" class="embeddings-control-select" onchange="renderEmbeddingsVisualization()" title="Choose dimensionality reduction algorithm">
                    <option value="pca" title="PCA (Principal Component Analysis): Linear transformation that finds directions of maximum variance. Fastest method, preserves global structure. Good for linear relationships. Complexity: O(n*d²) where d is dimensions.">PCA (Principal Component Analysis)</option>
                    <option value="tsne" title="t-SNE (t-Distributed Stochastic Neighbor Embedding): Non-linear method that preserves local neighborhoods. Excellent for clustering and finding groups. Slower than PCA but better for non-linear relationships. Uses probability distributions to model similarities.">t-SNE (t-Distributed Stochastic Neighbor Embedding)</option>
                    <option value="mds" title="MDS (Multidimensional Scaling): Preserves pairwise distances between points. Good when you want to maintain relative distances. Can be metric (preserves exact distances) or non-metric (preserves rank order).">MDS (Multidimensional Scaling)</option>
                  </select>
                </div>
                <div class="embeddings-control-group">
                  <label class="embeddings-control-label" title="Number of dimensions to reduce to (2D for flat visualization, 3D for spatial view)">Dimensions:</label>
                  <select id="embeddingsDimensions" class="embeddings-control-select" onchange="renderEmbeddingsVisualization()">
                    <option value="2" selected>2D</option>
                    <option value="3">3D</option>
                  </select>
                </div>
                <div class="embeddings-control-group">
                  <label class="embeddings-control-label" title="Number of principal components to keep (higher = more detail, slower computation)">Components:</label>
                  <input type="number" id="embeddingsPCAComponents" class="embeddings-control-input" min="2" max="50" value="10" onchange="renderEmbeddingsVisualization()" oninput="if(this.value > 50) this.value = 50; if(this.value < 2) this.value = 2;" />
                </div>
              </div>
            </div>
            
            <!-- Embeddings Visualization Canvas -->
            <div id="embeddingsVisualization" class="embeddings-visualization">
              <div class="embeddings-visualization-placeholder">
                Embeddings visualization will appear here
              </div>
            </div>
            
            <div class="embeddings-subsection">
              <h4 class="embeddings-subsection-title">Most Similar Prompt Pairs:</h4>
              <div id="similarityPairs" class="embeddings-subsection-content">
                <div class="embeddings-subsection-placeholder">Analyzing prompts...</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Term Frequency Analysis -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Term Frequency Analysis</h3>
          </div>
          <div class="card-body">
            <div class="tfidf-stats">
              <div class="tfidf-stat-row">
                <span class="tfidf-stat-label">Total Terms:</span>
                <span id="tfidfTotalTerms" class="tfidf-stat-value">0</span>
              </div>
              <div class="tfidf-stat-row">
                <span class="tfidf-stat-label">Unique Terms:</span>
                <span id="tfidfUniqueTerms" class="tfidf-stat-value">0</span>
              </div>
              <div class="tfidf-stat-row">
                <span class="tfidf-stat-label">Avg Term Frequency:</span>
                <span id="tfidfAvgFreq" class="tfidf-stat-value">0.00</span>
              </div>
            </div>
            <div class="embeddings-subsection">
              <h4 class="embeddings-subsection-title help" title="TF-IDF (Term Frequency-Inverse Document Frequency): Scoring method that ranks terms by importance. TF (Term Frequency) = how often term appears in file. IDF (Inverse Document Frequency) = log(total files / files containing term). High TF-IDF = term is common in this file but rare overall (distinctive). Formula: TF-IDF(t,d) = TF(t,d) × log(N/DF(t)) where N = total files, DF = files containing term.">
                Top Terms by Importance:
              </h4>
              <div id="topTerms" class="embeddings-subsection-content scrollable">
                <div class="embeddings-subsection-placeholder">Analyzing...</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- File Dependency Strength -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" title="Shows which files are strongly related based on co-occurrence in prompts, temporal proximity (edited close together), and edit patterns. Higher strength indicates files that are frequently worked on together">File Dependency Strength</h3>
          <p class="card-subtitle">File relationships based on co-occurrence and temporal patterns</p>
        </div>
        <div class="card-body">
          <div id="fileDependencyStrength" style="min-height: 300px;"></div>
        </div>
      </div>

      <!-- File Complexity Trends -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" title="Tracks complexity metrics for files over time including edit frequency, code churn (lines added/removed), and overall complexity scores. Helps identify files that require frequent maintenance">File Complexity Trends</h3>
          <p class="card-subtitle">Edit frequency, code churn, and complexity scores over time</p>
        </div>
        <div class="card-body">
          <div id="fileComplexityTrends" style="min-height: 300px;"></div>
        </div>
      </div>
    </div>
  `;
}

// Export to window for global access
window.renderFileGraphViewTemplate = renderFileGraphViewTemplate;

