/**
 * Visualization Engine - Creates charts using Observable Plot
 */

class VisualizationEngine {
  constructor() {
    this.plot = null;
    this.loadObservable();
  }

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

  detectVisualizationType(results) {
    if (!results.rows || results.rows.length === 0) {
      return 'empty';
    }

    const columns = results.columns || Object.keys(results.rows[0] || {});
    const rowCount = results.rows.length;

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
    const numericColumns = columns.filter(col => {
      const values = results.rows.map(row => row[col]).filter(v => !isNaN(Number(v)));
      return values.length > rowCount * 0.8;
    });
    if (numericColumns.length >= 2) {
      return 'scatter';
    }

    // Default to bar chart
    return 'bar';
  }

  async createChart(results, type = null) {
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

    try {
      let chart;

      switch (vizType) {
        case 'line':
          chart = this.createLineChart(results);
          break;
        case 'bar':
          chart = this.createBarChart(results);
          break;
        case 'scatter':
          chart = this.createScatterChart(results);
          break;
        case 'area':
          chart = this.createAreaChart(results);
          break;
        default:
          chart = this.createBarChart(results);
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

  createLineChart(results) {
    if (!this.plot) {
      throw new Error('Plot not loaded');
    }
    
    if (!results.rows || results.rows.length === 0) {
      throw new Error('No data for line chart');
    }
    
    const columns = results.columns || Object.keys(results.rows[0] || {});
    if (columns.length < 2) {
      throw new Error('Line chart requires at least 2 columns');
    }
    
    const timeCol = columns.find(col => 
      col.toLowerCase().includes('time') || 
      col.toLowerCase().includes('date') || 
      col.toLowerCase().includes('timestamp')
    ) || columns[0];
    
    const valueCol = columns.find(col => col !== timeCol && !isNaN(Number(results.rows[0]?.[col]))) || columns[1];

    const data = results.rows.map(row => ({
      x: new Date(row[timeCol]),
      y: Number(row[valueCol]) || 0
    })).filter(d => !isNaN(d.x.getTime()));

    if (data.length === 0) {
      throw new Error('No valid time series data');
    }

    return this.plot.plot({
      marks: [
        this.plot.line(data, { x: 'x', y: 'y', stroke: '#8B5CF6' }),
        this.plot.dot(data, { x: 'x', y: 'y', fill: '#8B5CF6', r: 3 })
      ],
      width: 600,
      height: 300,
      marginLeft: 60,
      marginBottom: 60,
      x: { label: timeCol },
      y: { label: valueCol }
    });
  }

  createBarChart(results) {
    if (!this.plot) {
      throw new Error('Plot not loaded');
    }
    
    if (!results.rows || results.rows.length === 0) {
      throw new Error('No data for bar chart');
    }
    
    const columns = results.columns || Object.keys(results.rows[0] || {});
    if (columns.length < 2) {
      throw new Error('Bar chart requires at least 2 columns');
    }
    
    const categoryCol = columns[0];
    const valueCol = columns.find(col => col !== categoryCol && !isNaN(Number(results.rows[0]?.[col]))) || columns[1];

    const data = results.rows.map(row => ({
      category: String(row[categoryCol] || ''),
      value: Number(row[valueCol]) || 0
    }));

    return this.plot.plot({
      marks: [
        this.plot.barY(data, { x: 'category', y: 'value', fill: '#8B5CF6' })
      ],
      width: 600,
      height: 300,
      marginLeft: 60,
      marginBottom: 60,
      x: { label: categoryCol },
      y: { label: valueCol }
    });
  }

  createScatterChart(results) {
    if (!this.plot) {
      throw new Error('Plot not loaded');
    }
    
    if (!results.rows || results.rows.length === 0) {
      throw new Error('No data for scatter chart');
    }
    
    const columns = results.columns || Object.keys(results.rows[0] || {});
    if (columns.length < 2) {
      throw new Error('Scatter chart requires at least 2 columns');
    }
    
    const xCol = columns.find(col => !isNaN(Number(results.rows[0]?.[col]))) || columns[0];
    const yCol = columns.find(col => col !== xCol && !isNaN(Number(results.rows[0]?.[col]))) || columns[1];

    const data = results.rows.map(row => ({
      x: Number(row[xCol]) || 0,
      y: Number(row[yCol]) || 0
    }));

    return this.plot.plot({
      marks: [
        this.plot.dot(data, { x: 'x', y: 'y', fill: '#8B5CF6', r: 4 })
      ],
      width: 600,
      height: 300,
      marginLeft: 60,
      marginBottom: 60,
      x: { label: xCol },
      y: { label: yCol }
    });
  }

  createAreaChart(results) {
    if (!this.plot) {
      throw new Error('Plot not loaded');
    }
    
    if (!results.rows || results.rows.length === 0) {
      throw new Error('No data for area chart');
    }
    
    const columns = results.columns || Object.keys(results.rows[0] || {});
    if (columns.length < 2) {
      throw new Error('Area chart requires at least 2 columns');
    }
    
    const timeCol = columns.find(col => 
      col.toLowerCase().includes('time') || 
      col.toLowerCase().includes('date')
    ) || columns[0];
    
    const valueCol = columns.find(col => col !== timeCol && !isNaN(Number(results.rows[0]?.[col]))) || columns[1];

    const data = results.rows.map(row => ({
      x: new Date(row[timeCol]),
      y: Number(row[valueCol]) || 0
    })).filter(d => !isNaN(d.x.getTime()));

    if (data.length === 0) {
      throw new Error('No valid time series data');
    }

    return this.plot.plot({
      marks: [
        this.plot.areaY(data, { x: 'x', y: 'y', fill: '#8B5CF6', fillOpacity: 0.3 }),
        this.plot.line(data, { x: 'x', y: 'y', stroke: '#8B5CF6' })
      ],
      width: 600,
      height: 300,
      marginLeft: 60,
      marginBottom: 60,
      x: { label: timeCol },
      y: { label: valueCol }
    });
  }
}

