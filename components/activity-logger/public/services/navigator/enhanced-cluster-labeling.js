/**
 * Enhanced Cluster Labeling Service
 * Multi-stage labeling: TF-IDF → LLM → Human curation
 * Inspired by Project AELLA's labeling pipeline
 */

class EnhancedClusterLabeling {
  constructor() {
    this.apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    this.cache = new Map();
  }

  /**
   * Generate cluster labels using multi-stage pipeline
   */
  async generateLabels(cluster, options = {}) {
    const {
      useLLM = true,
      useTFIDF = true,
      stage = 'all' // 'tfidf', 'llm', 'all'
    } = options;

    // Check cache
    const cacheKey = this._getCacheKey(cluster);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    let label = {
      name: `Cluster ${cluster.id}`,
      description: '',
      keywords: [],
      category: 'unknown',
      technologies: [],
      stage: 'none'
    };

    // Stage 1: TF-IDF Analysis (fast, always available)
    if (useTFIDF && (stage === 'tfidf' || stage === 'all')) {
      const tfidfLabel = this._generateTFIDFLabels(cluster);
      label = { ...label, ...tfidfLabel, stage: 'tfidf' };
    }

    // Stage 2: LLM-Generated Labels (quality, requires API)
    if (useLLM && (stage === 'llm' || stage === 'all')) {
      try {
        const llmLabel = await this._generateLLMLabels(cluster, label);
        if (llmLabel) {
          label = { ...label, ...llmLabel, stage: 'llm' };
        }
      } catch (error) {
        console.warn('[CLUSTER-LABEL] LLM labeling failed, using TF-IDF:', error.message);
      }
    }

    // Cache result
    this.cache.set(cacheKey, label);
    return label;
  }

  /**
   * Stage 1: TF-IDF Analysis
   * Extract keywords from file names, paths, and content
   */
  _generateTFIDFLabels(cluster) {
    const files = cluster.nodes || [];
    if (files.length === 0) {
      return {
        name: `Cluster ${cluster.id}`,
        keywords: [],
        category: 'unknown'
      };
    }

    // Extract text from files
    const texts = [];
    files.forEach(file => {
      // File name
      if (file.name) {
        texts.push(file.name);
      }
      // File path components
      if (file.path) {
        const pathParts = file.path.split('/').filter(p => p && !p.includes('.'));
        texts.push(...pathParts);
      }
      // File extension
      if (file.ext) {
        texts.push(file.ext);
      }
    });

    // Compute TF-IDF
    const wordCounts = {};
    const docFreq = {};
    const totalDocs = texts.length;

    texts.forEach(text => {
      const words = text.toLowerCase().match(/\b\w{3,}\b/g) || [];
      const uniqueWords = new Set(words);
      
      words.forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      });
      
      uniqueWords.forEach(word => {
        docFreq[word] = (docFreq[word] || 0) + 1;
      });
    });

    // Calculate TF-IDF scores
    const tfidfScores = {};
    Object.keys(wordCounts).forEach(word => {
      const tf = wordCounts[word] / Object.values(wordCounts).reduce((a, b) => a + b, 0);
      const idf = Math.log(totalDocs / (docFreq[word] || 1));
      tfidfScores[word] = tf * idf;
    });

    // Get top keywords
    const keywords = Object.entries(tfidfScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);

    // Generate name from keywords
    const name = keywords.slice(0, 3).join(' ').replace(/\b\w/g, l => l.toUpperCase()) || `Cluster ${cluster.id}`;

    // Infer category from keywords
    const category = this._inferCategory(keywords, files);

    return {
      name,
      keywords,
      category,
      description: `Files related to: ${keywords.slice(0, 5).join(', ')}`
    };
  }

  /**
   * Stage 2: LLM-Generated Labels
   */
  async _generateLLMLabels(cluster, currentLabel) {
    const files = cluster.nodes || [];
    if (files.length === 0) return null;

    // Check if OpenRouter API is available
    try {
      const statusResponse = await fetch(`${this.apiBase}/api/ai/status`);
      if (!statusResponse.ok) return null;
      
      const status = await statusResponse.json();
      if (!status.available || !status.hasApiKey) return null;
    } catch (error) {
      return null;
    }

    // Build context from cluster
    const fileNames = files.slice(0, 20).map(f => f.name || f.path?.split('/').pop() || 'unknown');
    const filePaths = files.slice(0, 20).map(f => f.path || 'unknown');
    const fileTypes = [...new Set(files.map(f => f.ext).filter(Boolean))];
    const keywords = currentLabel.keywords || [];

    const prompt = `Analyze this code cluster and generate a concise label:

Files (${files.length} total):
${fileNames.slice(0, 10).join(', ')}

File Types: ${fileTypes.join(', ')}
Keywords: ${keywords.slice(0, 10).join(', ')}

Generate a structured label:
1. A short name (2-4 words, descriptive)
2. A brief description (1 sentence)
3. Category: frontend|backend|infrastructure|data|ai|testing|documentation|config|other
4. Key technologies (if any, e.g., "react", "typescript", "node")

Respond with JSON only:
{
  "name": "string",
  "description": "string",
  "category": "string",
  "technologies": ["tech1", "tech2"]
}`;

    try {
      const response = await fetch(`${this.apiBase}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are a code analysis assistant. Generate concise, accurate cluster labels. Respond with valid JSON only.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 200
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.content || data.choices?.[0]?.message?.content || '';
        
        // Extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const label = JSON.parse(jsonMatch[0]);
          return {
            name: label.name || currentLabel.name,
            description: label.description || currentLabel.description,
            category: label.category || currentLabel.category,
            technologies: label.technologies || []
          };
        }
      }
    } catch (error) {
      console.warn('[CLUSTER-LABEL] LLM labeling error:', error.message);
    }

    return null;
  }

  /**
   * Infer category from keywords and files
   */
  _inferCategory(keywords, files) {
    const keywordStr = keywords.join(' ').toLowerCase();
    const fileTypes = files.map(f => f.ext).filter(Boolean);

    // Frontend
    if (keywordStr.includes('react') || keywordStr.includes('vue') || keywordStr.includes('angular') ||
        fileTypes.some(t => ['jsx', 'tsx', 'vue', 'html', 'css'].includes(t))) {
      return 'frontend';
    }

    // Backend
    if (keywordStr.includes('api') || keywordStr.includes('server') || keywordStr.includes('route') ||
        fileTypes.some(t => ['py', 'java', 'go', 'rb'].includes(t))) {
      return 'backend';
    }

    // Infrastructure
    if (keywordStr.includes('docker') || keywordStr.includes('kubernetes') || keywordStr.includes('config') ||
        fileTypes.some(t => ['yaml', 'yml', 'toml', 'ini'].includes(t))) {
      return 'infrastructure';
    }

    // Testing
    if (keywordStr.includes('test') || keywordStr.includes('spec') || keywordStr.includes('mock') ||
        fileTypes.some(t => ['test.js', 'spec.js', 'test.ts', 'spec.ts'].some(ext => t.includes(ext)))) {
      return 'testing';
    }

    // Documentation
    if (keywordStr.includes('doc') || keywordStr.includes('readme') ||
        fileTypes.some(t => ['md', 'txt', 'rst'].includes(t))) {
      return 'documentation';
    }

    // Data
    if (keywordStr.includes('data') || keywordStr.includes('model') || keywordStr.includes('database') ||
        fileTypes.some(t => ['sql', 'db', 'json'].includes(t))) {
      return 'data';
    }

    return 'other';
  }

  /**
   * Get cache key for cluster
   */
  _getCacheKey(cluster) {
    const fileIds = (cluster.nodes || []).map(f => f.id || f.path).sort().join(',');
    const key = `${cluster.id}_${fileIds}`;
    // Simple hash
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// Export to window
window.EnhancedClusterLabeling = EnhancedClusterLabeling;

// Create global instance
if (!window.enhancedClusterLabeling) {
  window.enhancedClusterLabeling = new EnhancedClusterLabeling();
}

