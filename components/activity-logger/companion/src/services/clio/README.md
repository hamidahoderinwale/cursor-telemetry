# Clio: Workspace-Aware Privacy-Preserving Usage Analytics

A workspace-aware implementation of the Clio methodology for analyzing telemetry data across multiple workspaces and repository types.

## Architecture

```
clio/
├── core/
│   ├── workspace-context.js      # Workspace and repository analysis
│   ├── adaptive-clustering.js    # Adaptive parameter calculation
│   └── clio-service.js           # Main orchestration service
├── facets/
│   └── repository-aware-extractor.js  # Facet extraction with repo context
├── clustering/
│   └── workspace-aware-clusterer.js   # Multi-strategy clustering
├── privacy/
│   └── workspace-privacy-validator.js # Workspace-aware privacy validation
└── utils/
    └── sampling.js               # Stratified sampling
```

## Key Features

### Workspace Awareness
- Detects and analyzes workspace structure
- Identifies repository types (Node.js, Python, Rust, etc.)
- Analyzes project structure patterns
- Tracks workspace-specific vs cross-workspace patterns

### Multi-Strategy Clustering
1. **Global Clustering**: Cross-workspace patterns (normalized)
2. **Workspace-Specific**: Patterns within individual workspaces
3. **Repository-Type**: Patterns by repository type (Node.js, Python, etc.)

### Adaptive Parameters
- Adjusts clustering parameters based on:
  - Total data volume
  - Number of workspaces
  - Average items per workspace
  - Data sparsity

### Privacy Validation
- Minimum conversation count
- Minimum unique users
- **Minimum unique workspaces** (new requirement)
- **Maximum workspace concentration** (new requirement)
- Privacy score calculation (1-5 scale)

## Environment Variables

The Clio service uses environment variables for API access. Set these in your `.env` file:

```bash
# For embeddings (required for clustering)
OPENROUTER_API_KEY=your_openrouter_key_here
# OR
HF_TOKEN=your_huggingface_token_here
# OR
HUGGINGFACE_API_KEY=your_huggingface_token_here

# For LLM features (facet extraction, cluster summarization)
OPENAI_API_KEY=your_openai_key_here
# OR (fallback)
OPENROUTER_API_KEY=your_openrouter_key_here
# OR (fallback)
HF_TOKEN=your_huggingface_token_here

# Optional: Custom model selection
CLIO_EMBEDDING_MODEL=sentence-transformers/all-mpnet-base-v2
CLIO_CHAT_MODEL=anthropic/claude-3-haiku
OPENROUTER_EMBEDDING_MODEL=sentence-transformers/all-mpnet-base-v2
OPENROUTER_CHAT_MODEL=anthropic/claude-3-haiku
```

**Priority for Embeddings:**
1. OpenRouter (if `OPENROUTER_API_KEY` is set)
2. Hugging Face (if `HF_TOKEN` or `HUGGINGFACE_API_KEY` is set)

**Priority for LLM:**
1. OpenAI (if `OPENAI_API_KEY` is set)
2. OpenRouter (if `OPENROUTER_API_KEY` is set)
3. Hugging Face (if `HF_TOKEN` or `HUGGINGFACE_API_KEY` is set)

## Usage

```javascript
const { ClioService } = require('./services/clio');

// Service automatically initializes embedding and LLM services from environment variables
const clioService = new ClioService(persistentDB, {
  privacyConfig: {
    minConversations: 100,
    minUniqueUsers: 10,
    minUniqueWorkspaces: 3,
    maxWorkspaceConcentration: 0.5
  }
});

// Process data
const results = await clioService.processData(data, {
  sampleSize: 100000,
  strategies: ['global', 'workspace_specific', 'repo_type'],
  privacyStrict: false
});

// Results structure:
// {
//   global: { clusters: [...], ... },
//   workspaceSpecific: { workspace1: { clusters: [...] }, ... },
//   repoType: { nodejs: { clusters: [...] }, ... },
//   metadata: { ... }
// }
```

### Manual Service Initialization

You can also provide custom embedding or LLM services:

```javascript
const { ClioService, ClioEmbeddingService, ClioLLMService } = require('./services/clio');

const embeddingService = new ClioEmbeddingService();
const llmService = new ClioLLMService();

const clioService = new ClioService(persistentDB, {
  embeddingService: embeddingService,
  llmService: llmService,
  privacyConfig: { ... }
});
```

## Components

### WorkspaceContextService
Analyzes workspace structure and repository characteristics.

**Methods:**
- `getWorkspaceContext(workspacePath)` - Get comprehensive workspace context
- `detectRepoType(workspacePath)` - Detect repository type
- `analyzeProjectStructure(workspacePath)` - Analyze structure patterns
- `getWorkspaceStats(data)` - Calculate workspace statistics

### AdaptiveClusteringService
Calculates optimal clustering parameters based on data distribution.

**Methods:**
- `calculateClusteringParams(data, workspaceStats)` - Calculate parameters
- `calculateWorkspaceSpecificParams(workspaceData, context)` - Per-workspace params
- `determineClusteringStrategy(workspaceStats, data)` - Choose strategy

### RepositoryAwareFacetExtractor
Extracts facets including repository and workspace context.

**Methods:**
- `extractFacets(item, workspaceContext)` - Extract comprehensive facets
- Extracts: topic, subtopic, task_type, language, repository_type, project_structure, etc.

### WorkspaceAwareClusterer
Implements multi-strategy clustering.

**Methods:**
- `buildClusters(data, workspaceContexts, options)` - Build all cluster types
- `clusterGlobally(data, workspaceContexts, params)` - Cross-workspace clustering
- `clusterPerWorkspace(data, workspaceContexts, params)` - Per-workspace clustering
- `clusterByRepoType(data, workspaceContexts, params)` - By repository type

### WorkspacePrivacyValidator
Validates clusters meet workspace-aware privacy requirements.

**Methods:**
- `validateCluster(cluster, options)` - Validate single cluster
- `validateClusters(clusters, options)` - Validate multiple clusters
- `filterValidClusters(clusters, options)` - Filter to valid clusters only
- `calculatePrivacyScore(cluster)` - Calculate 1-5 privacy score

### StratifiedSamplingService
Handles representative sampling across workspaces.

**Methods:**
- `sampleForClio(data, targetSize, options)` - Stratified sampling
- `balancedWorkspaceSample(data, targetSize, options)` - Balanced workspace sampling

## Privacy Requirements

Clusters must meet:
1. Minimum conversation count (default: 100)
2. Minimum unique users (default: 10)
3. **Minimum unique workspaces (default: 3)** - NEW
4. **Maximum workspace concentration (default: 50%)** - NEW
5. Privacy score >= 3 (1-5 scale)

## Differences from Clio Paper

| Aspect | Clio Paper | This Implementation |
|--------|------------|---------------------|
| Data Source | Single platform | Multiple workspaces |
| Sample Size | Uniform | Variable per workspace |
| Privacy | Min users + conversations | + Min workspaces + max concentration |
| Clustering | Global k-means | Multi-strategy (global + workspace + repo-type) |
| Facets | Conversation only | + Repository structure + workspace context |
| Hierarchy | Task → Subtask | Repo Type → Task → Pattern (or Workspace → Task) |

## Next Steps

1. Integrate with embedding service (all-mpnet-base-v2)
2. Integrate with LLM service for facet extraction and summarization
3. Implement hierarchy building (neighborhood-based)
4. Add API routes for Clio endpoints
5. Build frontend visualization components

