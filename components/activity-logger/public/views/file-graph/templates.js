/**
 * File Graph View HTML Templates
 * Template functions for File Graph view components
 */

function renderFileGraphViewTemplate(data) {
  return `
    <div class="file-graph-view">
      <div class="view-header">
        <h2 title="Interactive network graph showing relationships between files in your codebase. Files are connected based on semantic similarity, co-modification patterns, or temporal proximity. You can overlay AI activity, complexity metrics, and apply various clustering algorithms">Semantic File Network</h2>
        <p class="view-subtitle">Interactive code relationship visualization with AI activity overlay</p>
      </div>

      <div class="graph-controls">
        <div class="control-group">
          <label>Analysis Mode:</label>
          <select id="graphMetric" onchange="updateFileGraph()">
            <option value="tfidf">TF-IDF Semantic</option>
            <option value="cooccurrence">Co-occurrence</option>
            <option value="temporal">Temporal Proximity</option>
          </select>
        </div>

        <div class="control-group">
          <label>Layout:</label>
          <select id="layoutAlgorithm" onchange="updateFileGraph()">
            <option value="force">Force-Directed</option>
            <option value="circular">Circular</option>
            <option value="radial">Radial</option>
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
          <label>Clustering:</label>
          <select id="clusteringAlgorithm" onchange="updateFileGraph()">
            <option value="none">None</option>
            <option value="fileType">By File Type</option>
            <option value="workspace">By Workspace</option>
            <option value="directory">By Directory</option>
            <option value="similarity">By Similarity</option>
            <option value="community">Community Detection</option>
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
        <input type="text" id="fileSearch" class="graph-search-input" placeholder="Search files by name..." 
               oninput="filterGraphNodes(this.value)">
        <div id="fileSearchResults" class="graph-search-results"></div>
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
            <h3 class="card-title help-cursor" title="Visualizes semantic similarity between your AI prompts using TF-IDF embeddings and dimensionality reduction (PCA/t-SNE/MDS). Prompts with similar content appear closer together. Data is extracted from your Cursor database and analyzed locally.">
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
                  <label class="embeddings-control-label" title="PCA: Fastest, linear. t-SNE: Best clusters. MDS: Preserves distances.">Reduction Method:</label>
                  <select id="embeddingsReductionMethod" class="embeddings-control-select" onchange="renderEmbeddingsVisualization()">
                    <option value="pca">PCA (Principal Component Analysis)</option>
                    <option value="tsne">t-SNE (t-Distributed Stochastic Neighbor Embedding)</option>
                    <option value="mds">MDS (Multidimensional Scaling)</option>
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
              <h4 class="embeddings-subsection-title help" title="Terms ranked by TF-IDF (Term Frequency-Inverse Document Frequency) score. Higher scores indicate terms that are important in specific files but rare across all files.">
                Top Terms by Importance:
              </h4>
              <div id="topTerms" class="embeddings-subsection-content scrollable">
                <div class="embeddings-subsection-placeholder">Analyzing...</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;
}

// Export to window for global access
window.renderFileGraphViewTemplate = renderFileGraphViewTemplate;

