# Computational Model

This module implements the computational model for transforming raw trace data into high-level structured context for AI guidance and analysis.

## Overview

The computational model consists of three phases:

1. **Phase 1: Data Structuring and Modeling**
   - Workspace state reconstruction
   - Event vectorization and encoding

2. **Phase 2: Procedural Abstraction and Evaluation**
   - Local subroutine discovery (clustering)
   - Context Precision (CP) evaluation
   - High-fidelity library integration

3. **Phase 3: Utility Demonstration and Validation**
   - Predictive context generation
   - Statistical validation (A/B testing)

## Installation

### Prerequisites

- Python 3.8 or higher
- Access to companion service database (SQLite or PostgreSQL)

### Setup

1. Install Python dependencies:

```bash
cd computational-model
pip install -r requirements.txt
```

2. Configure environment variables (optional):

Create a `.env` file or set environment variables:

```bash
# Database
DATABASE_TYPE=sqlite  # or 'postgres'
DATABASE_PATH=/path/to/companion.db  # for SQLite
DATABASE_URL=postgresql://...  # for PostgreSQL

# Embedding Service
EMBEDDING_SERVICE=openrouter  # or 'huggingface', 'local'
OPENROUTER_API_KEY=your_key_here
HF_TOKEN=your_token_here
CLIO_EMBEDDING_MODEL=sentence-transformers/all-mpnet-base-v2

# Clustering
CLUSTERING_METHOD=dtw  # or 'kmeans'
MIN_CLUSTER_SIZE=3
MAX_CLUSTERS=20

# Context Precision
CP_TIME_WINDOW_SECONDS=300
MIN_CP_THRESHOLD=0.5
```

## Usage

### 1. Sequence Clustering

Cluster event sequences to discover behavioral patterns:

```bash
# Via script
python scripts/cluster_sequences.py \
  --method dtw \
  --n-clusters 10 \
  --min-size 3 \
  --input sequences.json \
  --output clusters.json

# Via stdin/stdout
cat sequences.json | python scripts/cluster_sequences.py --method dtw > clusters.json
```

### 2. Context Precision Calculation

Calculate Context Precision for prompts:

```bash
# Single prompt
python scripts/calculate_cp.py --prompt-id 123

# Baseline for all prompts
python scripts/calculate_cp.py --baseline --workspace /path/to/workspace --limit 1000

# Save to file
python scripts/calculate_cp.py --baseline --output cp_results.json
```

### 3. A/B Test Analysis

Analyze A/B test results:

```bash
# Input format: JSON with 'control' and 'treatment' keys
python scripts/ab_test_analysis.py --input ab_test_data.json --output results.json
```

### 4. Full Pipeline

Build complete behavioral library:

```bash
python sequence_processor.py \
  --workspace /path/to/workspace \
  --output behavioral_library.json \
  --min-cp 0.5
```

## Scripts

### `scripts/cluster_sequences.py`

Clusters event sequences using DTW or k-means.

**Input:** JSON with sequences (stdin or file)
```json
{
  "sequences": [
    [
      {"combined_vector": [0.1, 0.2, ...], "event_type": "Agent", ...},
      ...
    ],
    ...
  ]
}
```

**Output:** Cluster assignments and behavioral library
```json
{
  "method": "dtw",
  "clusters_found": 5,
  "cluster_assignments": [0, 1, 0, 2, ...],
  "behavioral_library": [...]
}
```

### `scripts/calculate_cp.py`

Calculates Context Precision (CP) for prompts.

**Context Precision Formula:**
```
CP = |Context_documents ∩ Diff_documents| / |Context_documents|
```

**Output:**
```json
{
  "prompt_id": 123,
  "cp": 0.75,
  "context_file_count": 4,
  "diff_file_count": 3,
  "intersection_count": 3,
  "unused_context_files": ["file1.js"]
}
```

### `scripts/ab_test_analysis.py`

Performs statistical analysis on A/B test data.

**Input:**
```json
{
  "control": {
    "time_to_completion": [{"value": 120}, ...],
    "context_precision": [{"value": 0.6}, ...],
    "success_rate": {"value": 0.8}
  },
  "treatment": {
    "time_to_completion": [{"value": 90}, ...],
    "context_precision": [{"value": 0.75}, ...],
    "success_rate": {"value": 0.85}
  }
}
```

**Output:**
```json
{
  "conclusion": "Statistically significant",
  "time_to_completion": {
    "p_value": 0.02,
    "percent_change": -25.0,
    "significant": true
  },
  ...
}
```

## Python API

### DatabaseConnector

```python
from database_connector import DatabaseConnector

db = DatabaseConnector()
events = db.get_events(workspace_path="/path/to/workspace", limit=100)
prompts = db.get_prompts(workspace_path="/path/to/workspace")
db.close()
```

### EventVectorizer

```python
from vectorizer import EventVectorizer

vectorizer = EventVectorizer()
vectorizer.build_event_type_encoder(events)
vectorized = vectorizer.vectorize_sequence(events, prompts_map)
```

### SequenceProcessor

```python
from sequence_processor import SequenceProcessor

processor = SequenceProcessor()
library = processor.build_behavioral_library(workspace_path="/path/to/workspace")
processor.save_library(library, output_path="library.json")
processor.close()
```

## Integration with Companion Service

The computational model can be called from the companion service via subprocess:

```javascript
// In companion service
const { execSync } = require('child_process');
const path = require('path');

function buildBehavioralLibrary(workspacePath) {
  const scriptPath = path.join(__dirname, 'computational-model', 'sequence_processor.py');
  const result = execSync(
    `python3 ${scriptPath} --workspace "${workspacePath}"`,
    { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
  );
  return JSON.parse(result);
}
```

## Output Directory

Results are saved to `output/` directory by default:
- `behavioral_library.json` - Discovered behavioral patterns
- `cp_results.json` - Context Precision calculations
- `clusters.json` - Clustering results

## Dependencies

See `requirements.txt` for full list. Key dependencies:

- **numpy, scipy, pandas** - Scientific computing
- **tslearn** - Time series clustering (DTW)
- **scikit-learn** - Machine learning
- **statsmodels** - Statistical analysis
- **sqlalchemy, psycopg2** - Database connectivity
- **sentence-transformers** - Local embeddings (optional)

## Troubleshooting

### Database Connection Issues

- Ensure database path is correct for SQLite
- Check DATABASE_URL for PostgreSQL
- Verify database file exists and is readable

### Clustering Fails

- Install `tslearn` for DTW: `pip install tslearn`
- Fallback to k-means if DTW unavailable
- Reduce `--n-clusters` if too many clusters requested

### Embedding Service Issues

- Set API keys in environment or `.env` file
- For local embeddings, ensure `sentence-transformers` is installed
- Check network connectivity for API-based services

## License

Same as parent project.

