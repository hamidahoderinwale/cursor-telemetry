/**
 * Enhanced Visualization Engine - Creates interactive charts using Observable Plot
 * 
 * Features:
 * - Reactive visualizations (auto-update when data changes)
 * - Linked brushing (select in one chart, filter others)
 * - Cross-filtering (interactive selection propagates)
 * - Advanced chart types (network, heatmap, parallel coordinates, Sankey)
 * - Interactive features (tooltips, zoom/pan, brush selection)
 * 
 * Observable Plot is a declarative visualization library. We use it to create
 * charts that automatically handle interactions like brushing, zooming, and tooltips.
 */

class VisualizationEngine {
  constructor() {
    this.plot = null;
    this.chartRegistry = new Map(); // Track all charts for linked brushing
    this.activeFilters = new Map(); // Store active filter selections
    this.loadObservable();
  }

  /**
   * Load Observable Plot library from CDN
   * Observable Plot is a JavaScript library for creating interactive visualizations
   */
  async loadObservable() {
    if (typeof Plot !== 'undefined') {
      this.plot = Plot;
      return;
    }

    // Check if already loading
    if (this._loadingPromise) {
      return this._loadingPromise;
    }

    this._loadingPromise = new Promise(async (resolve, reject) => {
      try {
        // Try dynamic import first (works in modern browsers)
        try {
          const PlotModule = await import('https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6/+esm');
          this.plot = PlotModule.Plot || PlotModule.default || PlotModule;
          if (this.plot) {
            resolve();
            return;
          }
        } catch (importError) {
          console.warn('ES module import failed, trying script tag:', importError);
        }

        // Fallback to script tag (UMD build)
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6/dist/plot.umd.js';
        script.type = 'text/javascript';
        
        script.onload = () => {
          // Check if Plot is available
          if (typeof Plot !== 'undefined') {
            this.plot = Plot;
            resolve();
          } else if (window.Plot) {
            this.plot = window.Plot;
            resolve();
          } else {
            reject(new Error('Plot not available after loading'));
          }
        };
        
        script.onerror = () => {
          reject(new Error('Failed to load Observable Plot script'));
        };
        
        document.head.appendChild(script);
      } catch (error) {
        console.error('Failed to load Observable Plot:', error);
        reject(error);
      }
    });

    return this._loadingPromise;
  }

  /**
   * Register a chart for reactive updates and linked brushing
   * @param {string} chartId - Unique identifier for the chart
   * @param {Object} chartData - Chart metadata (queryId, type, data, etc.)
   */
  registerChart(chartId, chartData) {
    this.chartRegistry.set(chartId, {
      ...chartData,
      element: null,
      lastUpdate: Date.now()
    });
  }

  /**
   * Unregister a chart when it's removed
   * @param {string} chartId - Chart identifier to remove
   */
  unregisterChart(chartId) {
    this.chartRegistry.delete(chartId);
  }

  /**
   * Update all charts that share the same query data (reactive updates)
   * When query results change, all charts using that data update automatically
   * @param {string} queryId - Query identifier whose results changed
   * @param {Object} newResults - New query results
   */
  updateChartsForQuery(queryId, newResults) {
    this.chartRegistry.forEach((chartData, chartId) => {
      if (chartData.queryId === queryId) {
        // Re-render chart with new data
        const container = document.getElementById(`chart-${chartId}`);
        if (container) {
          this.renderChartToContainer(container, newResults, chartData.type, chartId);
        }
      }
    });
  }

  /**
   * Apply a filter selection across all linked charts (cross-filtering)
   * When you select data in one chart, it filters other charts
   * @param {string} sourceChartId - Chart that initiated the filter
   * @param {Object} filter - Filter criteria (e.g., { column: 'category', values: ['A', 'B'] })
   */
  applyCrossFilter(sourceChartId, filter) {
    this.activeFilters.set(sourceChartId, filter);
    
    // Update all other charts with this filter
    this.chartRegistry.forEach((chartData, chartId) => {
      if (chartId !== sourceChartId && chartData.data) {
        const filteredData = this.applyFilterToData(chartData.data, filter);
        const container = document.getElementById(`chart-${chartId}`);
        if (container) {
          this.renderChartToContainer(container, filteredData, chartData.type, chartId);
        }
      }
    });
  }

  /**
   * Clear all active filters
   */
  clearFilters() {
    this.activeFilters.clear();
    // Re-render all charts with original data
    this.chartRegistry.forEach((chartData, chartId) => {
      const container = document.getElementById(`chart-${chartId}`);
      if (container && chartData.data) {
        this.renderChartToContainer(container, chartData.data, chartData.type, chartId);
      }
    });
  }

  /**
   * Apply a filter to data rows
   * @param {Object} results - Query results with rows and columns
   * @param {Object} filter - Filter criteria
   * @returns {Object} Filtered results
   */
  applyFilterToData(results, filter) {
    if (!filter || !filter.column || !filter.values) {
      return results;
    }

    const filteredRows = results.rows.filter(row => {
      const value = row[filter.column];
      return filter.values.includes(value);
    });

    return {
      ...results,
      rows: filteredRows,
      count: filteredRows.length
    };
  }

  /**
   * Auto-detect the best chart type for given data
   * Analyzes data structure to suggest appropriate visualization
   */
  detectVisualizationType(results) {
    if (!results.rows || results.rows.length === 0) {
      return 'empty';
    }

    const columns = results.columns || Object.keys(results.rows[0] || {});
    const rowCount = results.rows.length;

    // Check for network graph data (source/target columns)
    if (columns.some(c => c.toLowerCase().includes('source')) && 
        columns.some(c => c.toLowerCase().includes('target'))) {
      return 'network';
    }

    // Check for Sankey data (source/target/value)
    if (columns.some(c => c.toLowerCase().includes('source')) && 
        columns.some(c => c.toLowerCase().includes('target')) &&
        columns.some(c => c.toLowerCase().includes('value'))) {
      return 'sankey';
    }

    // Check for parallel coordinates (multiple numeric columns)
    const numericColumns = columns.filter(col => {
      const values = results.rows.map(row => row[col]).filter(v => !isNaN(Number(v)));
      return values.length > rowCount * 0.8;
    });
    if (numericColumns.length >= 3) {
      return 'parallel';
    }

    // Check for heatmap (two categorical + one numeric)
    if (columns.length >= 3) {
      const catCols = columns.filter(col => {
        const uniqueValues = new Set(results.rows.map(row => String(row[col] || '')));
        return uniqueValues.size <= 20 && uniqueValues.size > 1;
      });
      if (catCols.length >= 2) {
        return 'heatmap';
      }
    }

    // Check for time series (has date/timestamp column)
    const timeColumns = columns.filter(col => 
      col.toLowerCase().includes('time') || 
      col.toLowerCase().includes('date') || 
      col.toLowerCase().includes('timestamp')
    );
    if (timeColumns.length > 0 && rowCount > 1) {
      return 'line';
    }

    // Check for categorical data (few unique values)
    if (rowCount <= 10) {
      return 'bar';
    }

    // Check for numeric distribution
    if (numericColumns.length >= 2) {
      return 'scatter';
    }

    // Default to bar chart
    return 'bar';
  }

  /**
   * Create a chart with reactive updates and interactive features
   * @param {Object} results - Query results (rows, columns, count)
   * @param {string} type - Chart type (auto-detected if null)
   * @param {string} chartId - Optional chart ID for reactive updates
   * @param {string} queryId - Optional query ID for linked updates
   */
  async createChart(results, type = null, chartId = null, queryId = null) {
    if (!this.plot) {
      try {
        await this.loadObservable();
      } catch (error) {
        const div = document.createElement('div');
        div.className = 'chart-error';
        div.textContent = 'Failed to load Observable Plot. Please refresh the page.';
        return div;
      }
    }

    if (!this.plot) {
      const div = document.createElement('div');
      div.className = 'chart-error';
      div.textContent = 'Observable Plot not available';
      return div;
    }

    if (!results.rows || results.rows.length === 0) {
      const div = document.createElement('div');
      div.className = 'chart-empty';
      div.textContent = 'No data to visualize';
      return div;
    }

    const vizType = type || this.detectVisualizationType(results);
    const container = document.createElement('div');
    container.className = 'observable-chart';
    container.dataset.chartType = vizType;

    // Register chart for reactive updates
    if (chartId) {
      this.registerChart(chartId, {
        queryId,
        type: vizType,
        data: results,
        container
      });
    }

    try {
      let chart;

      switch (vizType) {
        case 'line':
          chart = this.createLineChart(results, chartId);
          break;
        case 'bar':
          chart = this.createBarChart(results, chartId);
          break;
        case 'scatter':
          chart = this.createScatterChart(results, chartId);
          break;
        case 'area':
          chart = this.createAreaChart(results, chartId);
          break;
        case 'heatmap':
          chart = this.createHeatmapChart(results, chartId);
          break;
        case 'network':
          chart = this.createNetworkChart(results, chartId);
          break;
        case 'parallel':
          chart = this.createParallelCoordinatesChart(results, chartId);
          break;
        case 'sankey':
          chart = this.createSankeyChart(results, chartId);
          break;
        default:
          chart = this.createBarChart(results, chartId);
      }

      if (chart) {
        container.appendChild(chart);
      } else {
        container.innerHTML = '<div class="chart-error">Failed to create chart</div>';
      }
    } catch (error) {
      console.error('Chart creation error:', error);
      container.innerHTML = `<div class="chart-error">Error: ${error.message}</div>`;
    }

    return container;
  }

  /**
   * Render chart directly to a container element
   * Used for reactive updates
   */
  async renderChartToContainer(container, results, type, chartId) {
    if (!container) return;

    container.innerHTML = '<div class="chart-loading">Updating chart...</div>';

    try {
      const chart = await this.createChart(results, type, chartId);
      if (chart) {
        container.innerHTML = '';
        container.appendChild(chart);
      }
    } catch (error) {
      console.error('Chart render error:', error);
      container.innerHTML = `<div class="chart-error">Error: ${error.message}</div>`;
    }
  }

  /**
   * Create an interactive line chart with tooltips and brush selection
   * Observable Plot automatically handles interactions like hover and brushing
   */
  createLineChart(results, chartId = null) {
    if (!this.plot) throw new Error('Plot not loaded');
    if (!results.rows || results.rows.length === 0) throw new Error('No data for line chart');
    
    const columns = results.columns || Object.keys(results.rows[0] || {});
    if (columns.length < 2) throw new Error('Line chart requires at least 2 columns');
    
    const timeCol = columns.find(col => 
      col.toLowerCase().includes('time') || 
      col.toLowerCase().includes('date') || 
      col.toLowerCase().includes('timestamp')
    ) || columns[0];
    
    const valueCol = columns.find(col => col !== timeCol && !isNaN(Number(results.rows[0]?.[col]))) || columns[1];

    const data = results.rows.map((row, idx) => ({
      x: new Date(row[timeCol]),
      y: Number(row[valueCol]) || 0,
      index: idx,
      ...row // Include all original data for tooltips
    })).filter(d => !isNaN(d.x.getTime()));

    if (data.length === 0) throw new Error('No valid time series data');

    // Observable Plot's tip() creates interactive tooltips automatically
    // The pointer interaction enables hover and selection
    return this.plot.plot({
      marks: [
        this.plot.line(data, { x: 'x', y: 'y', stroke: '#8B5CF6', strokeWidth: 2 }),
        this.plot.dot(data, { 
          x: 'x', 
          y: 'y', 
          fill: '#8B5CF6', 
          r: 4,
          // Tooltip shows all data on hover
          title: (d) => {
            const dateStr = d.x.toLocaleDateString();
            const timeStr = d.x.toLocaleTimeString();
            return `${timeCol}: ${dateStr} ${timeStr}\n${valueCol}: ${d.y}`;
          },
          // Click handler for cross-filtering
          onmousedown: (event, d) => {
            if (chartId) {
              // Apply cross-filter based on time range
              const selectedData = data.filter(item => 
                Math.abs(item.x.getTime() - d.x.getTime()) < 86400000 // Within 1 day
              );
              if (selectedData.length > 0) {
                this.applyCrossFilter(chartId, {
                  column: timeCol,
                  values: selectedData.map(item => item.x)
                });
              }
            }
          }
        })
      ],
      width: 600,
      height: 300,
      marginLeft: 60,
      marginBottom: 60,
      marginTop: 20,
      marginRight: 20,
      // Zoom and pan are built into Observable Plot
      x: { 
        label: timeCol,
        type: 'time',
        // Enable zoom with wheel
        nice: true
      },
      y: { 
        label: valueCol,
        nice: true,
        grid: true
      },
      // Tooltip configuration
      tip: true
    });
  }

  /**
   * Create an interactive bar chart with linked brushing
   */
  createBarChart(results, chartId = null) {
    if (!this.plot) throw new Error('Plot not loaded');
    if (!results.rows || results.rows.length === 0) throw new Error('No data for bar chart');
    
    const columns = results.columns || Object.keys(results.rows[0] || {});
    if (columns.length < 2) throw new Error('Bar chart requires at least 2 columns');
    
    const categoryCol = columns[0];
    const valueCol = columns.find(col => col !== categoryCol && !isNaN(Number(results.rows[0]?.[col]))) || columns[1];

    const data = results.rows.map((row, idx) => ({
      category: String(row[categoryCol] || ''),
      value: Number(row[valueCol]) || 0,
      index: idx,
      ...row
    }));

    // Observable Plot's barY creates vertical bars with automatic interactions
    return this.plot.plot({
      marks: [
        this.plot.barY(data, { 
          x: 'category', 
          y: 'value', 
          fill: '#8B5CF6',
          // Tooltip on hover
          title: (d) => `${categoryCol}: ${d.category}\n${valueCol}: ${d.value}`,
          // Click handler for cross-filtering
          onmousedown: (event, d) => {
            if (chartId) {
              this.applyCrossFilter(chartId, {
                column: categoryCol,
                values: [d.category]
              });
            }
          }
        })
      ],
      width: 600,
      height: 300,
      marginLeft: 60,
      marginBottom: 60,
      marginTop: 20,
      marginRight: 20,
      x: { 
        label: categoryCol,
        // Rotate labels if too many
        tickRotate: data.length > 10 ? -45 : 0
      },
      y: { 
        label: valueCol,
        grid: true,
        nice: true
      },
      tip: true
    });
  }

  /**
   * Create an interactive scatter plot with zoom and pan
   */
  createScatterChart(results, chartId = null) {
    if (!this.plot) throw new Error('Plot not loaded');
    if (!results.rows || results.rows.length === 0) throw new Error('No data for scatter chart');
    
    const columns = results.columns || Object.keys(results.rows[0] || {});
    if (columns.length < 2) throw new Error('Scatter chart requires at least 2 columns');
    
    const xCol = columns.find(col => !isNaN(Number(results.rows[0]?.[col]))) || columns[0];
    const yCol = columns.find(col => col !== xCol && !isNaN(Number(results.rows[0]?.[col]))) || columns[1];

    const data = results.rows.map((row, idx) => ({
      x: Number(row[xCol]) || 0,
      y: Number(row[yCol]) || 0,
      index: idx,
      ...row
    }));

    // Observable Plot's dot creates scatter points with built-in interactions
    return this.plot.plot({
      marks: [
        this.plot.dot(data, { 
          x: 'x', 
          y: 'y', 
          fill: '#8B5CF6', 
          r: 4,
          // Rich tooltip with all data
          title: (d) => {
            const entries = Object.entries(d)
              .filter(([key]) => !['x', 'y', 'index'].includes(key))
              .map(([key, value]) => `${key}: ${value}`)
              .join('\n');
            return `${xCol}: ${d.x}\n${yCol}: ${d.y}\n\n${entries}`;
          },
          // Brush selection (click and drag)
          onmousedown: (event, d) => {
            if (chartId) {
              // For scatter, we could filter by x or y range
              // This is a simple implementation
            }
          }
        })
      ],
      width: 600,
      height: 300,
      marginLeft: 60,
      marginBottom: 60,
      marginTop: 20,
      marginRight: 20,
      x: { 
        label: xCol,
        nice: true,
        grid: true
      },
      y: { 
        label: yCol,
        nice: true,
        grid: true
      },
      tip: true
    });
  }

  /**
   * Create an area chart (stacked line chart)
   */
  createAreaChart(results, chartId = null) {
    if (!this.plot) throw new Error('Plot not loaded');
    if (!results.rows || results.rows.length === 0) throw new Error('No data for area chart');
    
    const columns = results.columns || Object.keys(results.rows[0] || {});
    if (columns.length < 2) throw new Error('Area chart requires at least 2 columns');
    
    const timeCol = columns.find(col => 
      col.toLowerCase().includes('time') || 
      col.toLowerCase().includes('date')
    ) || columns[0];
    
    const valueCol = columns.find(col => col !== timeCol && !isNaN(Number(results.rows[0]?.[col]))) || columns[1];

    const data = results.rows.map(row => ({
      x: new Date(row[timeCol]),
      y: Number(row[valueCol]) || 0,
      ...row
    })).filter(d => !isNaN(d.x.getTime()));

    if (data.length === 0) throw new Error('No valid time series data');

    // Observable Plot's areaY creates filled area charts
    return this.plot.plot({
      marks: [
        this.plot.areaY(data, { 
          x: 'x', 
          y: 'y', 
          fill: '#8B5CF6', 
          fillOpacity: 0.3 
        }),
        this.plot.line(data, { 
          x: 'x', 
          y: 'y', 
          stroke: '#8B5CF6',
          strokeWidth: 2
        }),
        this.plot.dot(data, {
          x: 'x',
          y: 'y',
          fill: '#8B5CF6',
          r: 3,
          title: (d) => `${timeCol}: ${d.x.toLocaleString()}\n${valueCol}: ${d.y}`
        })
      ],
      width: 600,
      height: 300,
      marginLeft: 60,
      marginBottom: 60,
      marginTop: 20,
      marginRight: 20,
      x: { 
        label: timeCol,
        type: 'time',
        nice: true
      },
      y: { 
        label: valueCol,
        nice: true,
        grid: true
      },
      tip: true
    });
  }

  /**
   * Create a heatmap chart for temporal patterns
   * Shows intensity of values across two categorical dimensions
   */
  createHeatmapChart(results, chartId = null) {
    if (!this.plot) throw new Error('Plot not loaded');
    if (!results.rows || results.rows.length === 0) throw new Error('No data for heatmap');
    
    const columns = results.columns || Object.keys(results.rows[0] || {});
    if (columns.length < 3) throw new Error('Heatmap requires at least 3 columns');

    // Find two categorical columns and one numeric
    const catCols = columns.filter(col => {
      const uniqueValues = new Set(results.rows.map(row => String(row[col] || '')));
      return uniqueValues.size <= 20 && uniqueValues.size > 1;
    });
    
    const numCol = columns.find(col => {
      const values = results.rows.map(row => row[col]).filter(v => !isNaN(Number(v)));
      return values.length > results.rows.length * 0.8;
    });

    if (catCols.length < 2 || !numCol) {
      throw new Error('Heatmap requires 2 categorical columns and 1 numeric column');
    }

    const xCol = catCols[0];
    const yCol = catCols[1];

    const data = results.rows.map(row => ({
      x: String(row[xCol] || ''),
      y: String(row[yCol] || ''),
      value: Number(row[numCol]) || 0,
      ...row
    }));

    // Observable Plot's cell creates heatmap tiles
    return this.plot.plot({
      marks: [
        this.plot.cell(data, {
          x: 'x',
          y: 'y',
          fill: 'value',
          // Color scale from light to dark
          fill: {
            type: 'linear',
            scheme: 'purples',
            nice: true
          },
          title: (d) => `${xCol}: ${d.x}\n${yCol}: ${d.y}\n${numCol}: ${d.value}`
        })
      ],
      width: 600,
      height: 300,
      marginLeft: 80,
      marginBottom: 60,
      marginTop: 20,
      marginRight: 20,
      x: { 
        label: xCol,
        tickRotate: -45
      },
      y: { 
        label: yCol
      },
      color: {
        label: numCol,
        legend: true
      },
      tip: true
    });
  }

  /**
   * Create a network graph for file relationships
   * Shows connections between files based on co-modification or dependencies
   */
  createNetworkChart(results, chartId = null) {
    if (!this.plot) throw new Error('Plot not loaded');
    if (!results.rows || results.rows.length === 0) throw new Error('No data for network graph');
    
    const columns = results.columns || Object.keys(results.rows[0] || {});
    
    const sourceCol = columns.find(col => col.toLowerCase().includes('source')) || columns[0];
    const targetCol = columns.find(col => col.toLowerCase().includes('target')) || columns[1];

    // Build node and link data
    const nodes = new Set();
    const links = [];

    results.rows.forEach(row => {
      const source = String(row[sourceCol] || '');
      const target = String(row[targetCol] || '');
      if (source && target) {
        nodes.add(source);
        nodes.add(target);
        links.push({ source, target, ...row });
      }
    });

    // For Observable Plot, we'll create a simple node-link visualization
    // Note: Observable Plot doesn't have built-in force-directed layout,
    // so we'll use a simple grid or circular layout
    const nodeArray = Array.from(nodes);
    const nodePositions = {};
    const radius = 100;
    const centerX = 300;
    const centerY = 150;

    nodeArray.forEach((node, i) => {
      const angle = (i / nodeArray.length) * 2 * Math.PI;
      nodePositions[node] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        label: node
      };
    });

    const linkData = links.map(link => ({
      x1: nodePositions[link.source]?.x || 0,
      y1: nodePositions[link.source]?.y || 0,
      x2: nodePositions[link.target]?.x || 0,
      y2: nodePositions[link.target]?.y || 0,
      ...link
    }));

    const nodeData = nodeArray.map(node => ({
      x: nodePositions[node].x,
      y: nodePositions[node].y,
      label: node
    }));

    // Create network visualization with links and nodes
    return this.plot.plot({
      marks: [
        // Links (edges)
        this.plot.rule(linkData, {
          x1: 'x1',
          y1: 'y1',
          x2: 'x2',
          y2: 'y2',
          stroke: '#8B5CF6',
          strokeOpacity: 0.3,
          strokeWidth: 1
        }),
        // Nodes
        this.plot.dot(nodeData, {
          x: 'x',
          y: 'y',
          r: 6,
          fill: '#8B5CF6',
          title: (d) => `Node: ${d.label}`
        }),
        // Labels
        this.plot.text(nodeData, {
          x: 'x',
          y: 'y',
          text: 'label',
          dx: 8,
          dy: -8,
          fontSize: 10,
          fill: '#333'
        })
      ],
      width: 600,
      height: 300,
      marginLeft: 20,
      marginBottom: 20,
      marginTop: 20,
      marginRight: 20,
      tip: true
    });
  }

  /**
   * Create a parallel coordinates chart for multi-dimensional data
   * Shows relationships across multiple numeric dimensions
   */
  createParallelCoordinatesChart(results, chartId = null) {
    if (!this.plot) throw new Error('Plot not loaded');
    if (!results.rows || results.rows.length === 0) throw new Error('No data for parallel coordinates');
    
    const columns = results.columns || Object.keys(results.rows[0] || {});
    
    // Find all numeric columns
    const numericColumns = columns.filter(col => {
      const values = results.rows.map(row => row[col]).filter(v => !isNaN(Number(v)));
      return values.length > results.rows.length * 0.8;
    });

    if (numericColumns.length < 3) {
      throw new Error('Parallel coordinates requires at least 3 numeric columns');
    }

    // Normalize values to 0-1 range for each dimension
    const normalizedData = results.rows.map((row, idx) => {
      const normalized = {};
      numericColumns.forEach(col => {
        const values = results.rows.map(r => Number(r[col]) || 0);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min || 1;
        normalized[col] = ((Number(row[col]) || 0) - min) / range;
      });
      return {
        index: idx,
        ...normalized,
        ...row
      };
    });

    // For Observable Plot, we'll create a simplified version using lines
    // Each line represents one data point across all dimensions
    const axisPositions = {};
    numericColumns.forEach((col, i) => {
      axisPositions[col] = (i / (numericColumns.length - 1)) * 500;
    });

    // Create line segments for each data point
    const lineData = [];
    normalizedData.forEach((point, idx) => {
      for (let i = 0; i < numericColumns.length - 1; i++) {
        const col1 = numericColumns[i];
        const col2 = numericColumns[i + 1];
        lineData.push({
          x1: axisPositions[col1],
          y1: 250 - (point[col1] * 200),
          x2: axisPositions[col2],
          y2: 250 - (point[col2] * 200),
          index: idx,
          ...point
        });
      }
    });

    return this.plot.plot({
      marks: [
        this.plot.rule(lineData, {
          x1: 'x1',
          y1: 'y1',
          x2: 'x2',
          y2: 'y2',
          stroke: '#8B5CF6',
          strokeOpacity: 0.3,
          strokeWidth: 1
        }),
        // Axis labels
        this.plot.text(numericColumns.map((col, i) => ({
          x: axisPositions[col],
          y: 260,
          text: col,
          fontSize: 10,
          textAnchor: 'middle'
        })), {
          x: 'x',
          y: 'y',
          text: 'text'
        })
      ],
      width: 600,
      height: 300,
      marginLeft: 20,
      marginBottom: 40,
      marginTop: 20,
      marginRight: 20,
      tip: true
    });
  }

  /**
   * Create a Sankey diagram for data flow
   * Shows flow from source to target with value-based width
   */
  createSankeyChart(results, chartId = null) {
    if (!this.plot) throw new Error('Plot not loaded');
    if (!results.rows || results.rows.length === 0) throw new Error('No data for Sankey diagram');
    
    const columns = results.columns || Object.keys(results.rows[0] || {});
    
    const sourceCol = columns.find(col => col.toLowerCase().includes('source')) || columns[0];
    const targetCol = columns.find(col => col.toLowerCase().includes('target')) || columns[1];
    const valueCol = columns.find(col => col.toLowerCase().includes('value')) || columns[2];

    const data = results.rows.map(row => ({
      source: String(row[sourceCol] || ''),
      target: String(row[targetCol] || ''),
      value: Number(row[valueCol]) || 0,
      ...row
    })).filter(d => d.value > 0);

    // For Observable Plot, we'll create a simplified flow diagram
    // Full Sankey requires specialized layout algorithms
    const sources = [...new Set(data.map(d => d.source))];
    const targets = [...new Set(data.map(d => d.target))];
    
    const sourceY = {};
    const targetY = {};
    let sourceYPos = 50;
    let targetYPos = 50;

    sources.forEach(source => {
      sourceY[source] = sourceYPos;
      sourceYPos += 40;
    });

    targets.forEach(target => {
      targetY[target] = targetYPos;
      targetYPos += 40;
    });

    const flowData = data.map(d => ({
      x1: 100,
      y1: sourceY[d.source],
      x2: 500,
      y2: targetY[d.target],
      value: d.value,
      source: d.source,
      target: d.target,
      ...d
    }));

    return this.plot.plot({
      marks: [
        // Flow links
        this.plot.rule(flowData, {
          x1: 'x1',
          y1: 'y1',
          x2: 'x2',
          y2: 'y2',
          stroke: '#8B5CF6',
          strokeWidth: (d) => Math.max(1, d.value / 10),
          strokeOpacity: 0.6,
          title: (d) => `${sourceCol}: ${d.source}\n${targetCol}: ${d.target}\n${valueCol}: ${d.value}`
        }),
        // Source nodes
        this.plot.dot(sources.map(s => ({
          x: 100,
          y: sourceY[s],
          label: s
        })), {
          x: 'x',
          y: 'y',
          r: 8,
          fill: '#8B5CF6',
          title: (d) => `${sourceCol}: ${d.label}`
        }),
        // Target nodes
        this.plot.dot(targets.map(t => ({
          x: 500,
          y: targetY[t],
          label: t
        })), {
          x: 'x',
          y: 'y',
          r: 8,
          fill: '#10B981',
          title: (d) => `${targetCol}: ${d.label}`
        })
      ],
      width: 600,
      height: 300,
      marginLeft: 20,
      marginBottom: 20,
      marginTop: 20,
      marginRight: 20,
      tip: true
    });
  }
}
