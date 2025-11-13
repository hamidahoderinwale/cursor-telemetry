# Image and Plot Processing Modules

This directory contains modular processors for image and plot handling.

## Structure

```
processors/
├── image-processor.js          # Core image processing with Sharp
├── jupyter/
│   └── notebook-plot-extractor.js  # Extract plots from Jupyter notebooks
└── plots/
    ├── plot-file-detector.js   # Detect plot files from scripts
    └── plot-version-tracker.js # Track plot versions and regenerations
```

## Image Processor

**File:** `image-processor.js`

Handles all image processing operations using Sharp:
- Thumbnail generation
- Metadata extraction (dimensions, format, color space)
- Perceptual hashing for similarity detection
- Image optimization

### Usage

```javascript
const ImageProcessor = require('./processors/image-processor');

const processor = new ImageProcessor({
  thumbnailDir: './thumbnails',
  maxThumbnailSize: { width: 300, height: 200 },
  thumbnailQuality: 80
});

// Process an image
const result = await processor.processImage('/path/to/image.png', {
  generateThumbnail: true,
  extractMetadata: true,
  computeHash: true
});
```

## Jupyter Notebook Plot Extractor

**File:** `jupyter/notebook-plot-extractor.js`

Extracts plot outputs from Jupyter notebook cells:
- Detects matplotlib PNG outputs
- Detects plotly JSON outputs
- Detects SVG outputs
- Captures cell execution context
- Links plots to source code

### Usage

```javascript
const NotebookPlotExtractor = require('./processors/jupyter/notebook-plot-extractor');

const extractor = new NotebookPlotExtractor(imageProcessor);

// Extract all plots from a notebook
const result = await extractor.extractPlotsFromNotebook('/path/to/notebook.ipynb');
```

## Plot File Detector

**File:** `plots/plot-file-detector.js`

Detects when scripts generate plot/image files:
- Monitors common output directories (plots/, figures/, etc.)
- Detects plot generation patterns in code (plt.savefig, etc.)
- Resolves plot file paths
- Links plots to source scripts

### Usage

```javascript
const PlotFileDetector = require('./processors/plots/plot-file-detector');

const detector = new PlotFileDetector(imageProcessor);

// Detect plot patterns in code
const detection = detector.detectPlotPatterns(code);

// Detect new plot files in directory
const plots = await detector.detectNewPlotFiles('/path/to/output', sinceTimestamp);
```

## Plot Version Tracker

**File:** `plots/plot-version-tracker.js`

Tracks plot versions and detects regenerations:
- Detects when same plot is regenerated
- Tracks version history
- Computes similarity between versions
- Detects changes (dimensions, format, code, etc.)

### Usage

```javascript
const PlotVersionTracker = require('./processors/plots/plot-version-tracker');

const tracker = new PlotVersionTracker(persistentDB);

// Track a plot
const tracked = await tracker.trackPlot(plot, {
  similarityThreshold: 0.85
});

// Get version history
const history = await tracker.getVersionHistory(plotId);
```

## Integration

All processors are integrated through the `PlotService` in `services/plot-service.js`, which orchestrates:
- Notebook plot extraction
- File-based plot detection
- Version tracking
- Database storage

The service is automatically initialized in `index.js` and integrated with:
- File watcher (detects plot generation from code)
- Screenshot monitor (processes images)
- API routes (`/api/plots/*`)

## Database Schema

Plots are stored in the `plot_outputs` table with fields for:
- Plot metadata (type, format, library, dimensions)
- Source information (notebook path, cell index, script path)
- Version control (original_plot_id, regeneration_count, version_number)
- Similarity tracking (perceptual_hash, similarity_to_original)
- Change tracking (changes_detected JSON)

## API Endpoints

- `GET /api/plots` - Get all plots with filters
- `GET /api/plots/:id` - Get plot by ID
- `GET /api/plots/:id/versions` - Get version history
- `GET /api/plots/:id/similar` - Find similar plots
- `POST /api/plots/process-notebook` - Process notebook and extract plots
- `POST /api/plots/process-directory` - Process plot files from directory
- `POST /api/plots/detect-from-code` - Detect plots from code patterns
- `GET /api/plots/stats` - Get plot statistics

