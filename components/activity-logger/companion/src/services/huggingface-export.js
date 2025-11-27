/**
 * Hugging Face Export Service
 * Exports cursor telemetry data to Hugging Face datasets for easy viewing and analysis
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

class HuggingFaceExportService {
  constructor(options = {}) {
    this.apiToken = options.apiToken || process.env.HUGGINGFACE_API_TOKEN;
    this.apiBase = 'https://huggingface.co/api';
    this.defaultPrivacyLevel = options.defaultPrivacyLevel || 'private'; // 'public' or 'private'
  }

  /**
   * Check if HuggingFace is configured
   */
  isConfigured() {
    return !!this.apiToken;
  }

  /**
   * Create or update a dataset on Hugging Face
   * @param {Object} options - Export options
   * @param {string} options.datasetName - Name of the dataset (username/dataset-name)
   * @param {Object} options.data - The data to export
   * @param {string} options.description - Dataset description
   * @param {string} options.privacyLevel - 'public' or 'private'
   * @param {Array} options.tags - Tags for the dataset
   * @returns {Promise<Object>} - Result with dataset URL
   */
  async exportToDataset(options) {
    if (!this.isConfigured()) {
      throw new Error('Hugging Face API token not configured. Set HUGGINGFACE_API_TOKEN environment variable.');
    }

    const {
      datasetName,
      data,
      description = 'Cursor IDE telemetry data - development activity, prompts, and patterns',
      privacyLevel = this.defaultPrivacyLevel,
      tags = ['cursor-ide', 'telemetry', 'development-data', 'coding-patterns'],
      license = 'cc-by-4.0', // Creative Commons Attribution
      readme = this.generateReadme(data)
    } = options;

    try {
      console.log(`[HF-EXPORT] Creating/updating dataset: ${datasetName}`);
      console.log(`[HF-EXPORT] Privacy: ${privacyLevel}, Size: ${this.estimateSize(data)}`);

      // 1. Create dataset repository (if doesn't exist)
      await this.createDatasetRepo({
        name: datasetName,
        private: privacyLevel === 'private',
        license,
        tags
      });

      // 2. Prepare data files
      const files = this.prepareDataFiles(data);

      // 3. Upload files to dataset
      for (const file of files) {
        await this.uploadFile({
          datasetName,
          fileName: file.name,
          content: file.content
        });
      }

      // 4. Upload README
      await this.uploadFile({
        datasetName,
        fileName: 'README.md',
        content: readme
      });

      const datasetUrl = `https://huggingface.co/datasets/${datasetName}`;
      
      console.log(`[HF-EXPORT] ✓ Export complete: ${datasetUrl}`);

      return {
        success: true,
        url: datasetUrl,
        viewerUrl: `${datasetUrl}/viewer`,
        filesUrl: `${datasetUrl}/tree/main`,
        datasetName,
        privacy: privacyLevel,
        fileCount: files.length,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[HF-EXPORT] Export failed:', error.message);
      throw new Error(`Hugging Face export failed: ${error.message}`);
    }
  }

  /**
   * Create a dataset repository on HuggingFace
   */
  async createDatasetRepo(options) {
    const { name, private: isPrivate, license, tags } = options;

    const response = await fetch(`${this.apiBase}/datasets/${name}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        private: isPrivate,
        license,
        tags
      })
    });

    // 409 means dataset already exists, which is fine
    if (!response.ok && response.status !== 409) {
      const error = await response.text();
      throw new Error(`Failed to create dataset: ${response.status} - ${error}`);
    }

    return true;
  }

  /**
   * Upload a file to the dataset
   */
  async uploadFile(options) {
    const { datasetName, fileName, content } = options;

    const response = await fetch(
      `https://huggingface.co/api/datasets/${datasetName}/upload/main/${fileName}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
          message: `Update ${fileName}`,
          encoding: 'utf-8'
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to upload ${fileName}: ${response.status} - ${error}`);
    }

    return true;
  }

  /**
   * Prepare data files for upload
   * Splits large datasets into manageable chunks
   */
  prepareDataFiles(data) {
    const files = [];

    // Main data file (overview)
    files.push({
      name: 'data.json',
      content: JSON.stringify({
        metadata: data.metadata || {},
        summary: {
          entriesCount: data.data?.entries?.length || 0,
          promptsCount: data.data?.prompts?.length || 0,
          eventsCount: data.data?.events?.length || 0,
          workspacesCount: data.data?.workspaces?.length || 0,
          dateRange: data.metadata?.dateRange || {}
        }
      }, null, 2)
    });

    // Split data by type for better HF viewer experience
    if (data.data) {
      // Entries (file changes)
      if (data.data.entries && data.data.entries.length > 0) {
        files.push({
          name: 'entries.json',
          content: JSON.stringify(data.data.entries, null, 2)
        });
      }

      // Prompts (AI interactions)
      if (data.data.prompts && data.data.prompts.length > 0) {
        files.push({
          name: 'prompts.json',
          content: JSON.stringify(data.data.prompts, null, 2)
        });
      }

      // Events (timeline)
      if (data.data.events && data.data.events.length > 0) {
        files.push({
          name: 'events.json',
          content: JSON.stringify(data.data.events, null, 2)
        });
      }

      // Clio motifs (high-level patterns) - great for HF viewer
      if (data.data.clio && data.data.clio.length > 0) {
        files.push({
          name: 'clio_motifs.json',
          content: JSON.stringify(data.data.clio, null, 2)
        });
      }

      // Module graph
      if (data.data.moduleGraph) {
        files.push({
          name: 'module_graph.json',
          content: JSON.stringify(data.data.moduleGraph, null, 2)
        });
      }
    }

    return files;
  }

  /**
   * Generate README for the dataset
   */
  generateReadme(data) {
    const metadata = data.metadata || {};
    const counts = metadata.counts || {};
    
    return `# Cursor IDE Telemetry Dataset

## Description

This dataset contains development activity data captured from Cursor IDE, including:
- Code changes and file edits
- AI assistant interactions (prompts and responses)
- Development patterns and workflow motifs
- Module dependencies and code structure

**Exported:** ${metadata.exportedAt || new Date().toISOString()}
**Privacy Level:** ${metadata.exportFormat || 'structured'}

## Dataset Contents

| Type | Count | Description |
|------|-------|-------------|
| Entries | ${counts.entries || 0} | File changes and code edits |
| Prompts | ${counts.prompts || 0} | AI assistant interactions |
| Events | ${counts.events || 0} | Development timeline events |
| Workspaces | ${counts.workspaces || 0} | Project workspaces |
| Clio Motifs | ${counts.motifs || 0} | High-level workflow patterns |

## Date Range

- **From:** ${metadata.dateRange?.since || 'N/A'}
- **To:** ${metadata.dateRange?.until || 'N/A'}

## Privacy

${this.generatePrivacySection(metadata)}

## Usage

### Loading the Dataset

\`\`\`python
from datasets import load_dataset

# Load the entire dataset
dataset = load_dataset("${metadata.datasetName || 'username/dataset-name'}")

# Access specific data
entries = dataset['entries']
prompts = dataset['prompts']
\`\`\`

### Analyzing Development Patterns

\`\`\`python
import json

# Load Clio motifs (high-level patterns)
with open('clio_motifs.json') as f:
    motifs = json.load(f)
    
# Analyze workflow patterns
for motif in motifs:
    print(f"Pattern: {motif['title']}")
    print(f"Frequency: {motif['size']} occurrences")
\`\`\`

## Use Cases

- **ML Training**: Train models on real development workflows
- **Pattern Analysis**: Study coding patterns and AI usage
- **Research**: Analyze human-AI collaboration in software development
- **Productivity**: Understand developer productivity patterns
- **Tool Development**: Build better developer tools based on real data

## License

${metadata.license || 'CC-BY-4.0'}

## Citation

If you use this dataset in your research, please cite:

\`\`\`
@dataset{cursor_telemetry_${new Date().getFullYear()},
  title={Cursor IDE Development Telemetry Dataset},
  author={Developer Activity Logger},
  year={${new Date().getFullYear()}},
  publisher={Hugging Face},
  url={https://huggingface.co/datasets/${metadata.datasetName || 'username/dataset-name'}}
}
\`\`\`

## Generated by

[Cursor Telemetry Dashboard](https://github.com/hamidahoderinwale/cursor-telemetry)
`;
  }

  /**
   * Generate privacy section for README
   */
  generatePrivacySection(metadata) {
    const abstraLevel = metadata.exportFormat;
    
    if (abstraLevel === 'workflows' || metadata.filters?.excludePrompts) {
      return `This dataset uses **high privacy mode** - only workflow patterns and aggregate statistics are included. No source code, prompts, or identifying information is exposed.`;
    } else if (abstraLevel === 'statements') {
      return `This dataset uses **medium privacy mode** - code is described but not included verbatim. Semantic patterns preserved without exposing implementation details.`;
    } else if (abstraLevel === 'abstracts') {
      return `This dataset uses **low privacy mode** - statistics and metadata included, but actual code content is abstracted.`;
    } else {
      return `This dataset includes detailed development data. **Privacy considerations**: If sharing publicly, ensure no sensitive information (API keys, credentials, proprietary code) is included.`;
    }
  }

  /**
   * Estimate dataset size
   */
  estimateSize(data) {
    const json = JSON.stringify(data);
    const bytes = Buffer.byteLength(json);
    return this.formatBytes(bytes);
  }

  /**
   * Format bytes to human-readable
   */
  formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }

  /**
   * List user's datasets on HuggingFace
   */
  async listDatasets() {
    if (!this.isConfigured()) {
      throw new Error('Hugging Face API token not configured');
    }

    const response = await fetch(`${this.apiBase}/datasets`, {
      headers: {
        'Authorization': `Bearer ${this.apiToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to list datasets: ${response.status}`);
    }

    return await response.json();
  }
}

module.exports = HuggingFaceExportService;

