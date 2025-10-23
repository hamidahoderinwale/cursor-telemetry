/**
 * Time Series Visualizer
 * Creates interactive time-based charts showing activity over time
 */

class TimeSeriesVisualizer {
  constructor() {
    this.timeRanges = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      'all': Infinity
    };
  }

  /**
   * Generate changes over time data
   */
  generateChangesOverTime(events, entries, timeRange = '7d') {
    const allItems = [...events, ...entries];
    const now = Date.now();
    const rangeMs = this.timeRanges[timeRange];
    
    // Filter by time range
    const filteredItems = allItems.filter(item => {
      const itemTime = new Date(item.timestamp).getTime();
      return now - itemTime <= rangeMs;
    });

    // Group by time buckets
    const buckets = this.createTimeBuckets(filteredItems, timeRange);
    
    return {
      buckets,
      totals: this.calculateTotals(buckets),
      trends: this.calculateTrends(buckets)
    };
  }

  /**
   * Create time buckets based on range
   */
  createTimeBuckets(items, timeRange) {
    const bucketSize = this.getBucketSize(timeRange);
    const buckets = new Map();

    items.forEach(item => {
      const timestamp = new Date(item.timestamp).getTime();
      const bucketKey = Math.floor(timestamp / bucketSize) * bucketSize;
      
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, {
          timestamp: bucketKey,
          codeChanges: 0,
          prompts: 0,
          fileModifications: 0,
          totalEvents: 0,
          files: new Set(),
          sessions: new Set()
        });
      }

      const bucket = buckets.get(bucketKey);
      bucket.totalEvents++;
      
      if (item.session_id) {
        bucket.sessions.add(item.session_id);
      }

      const type = item.type;
      if (type === 'code_change' || type === 'file_change') {
        bucket.codeChanges++;
        bucket.fileModifications++;
        
        const details = this.parseDetails(item);
        if (details.file_path) {
          bucket.files.add(details.file_path);
        }
      } else if (type === 'prompt_response' || type === 'prompt') {
        bucket.prompts++;
      }
    });

    // Convert Sets to counts and sort by timestamp
    const result = Array.from(buckets.values()).map(bucket => ({
      ...bucket,
      files: bucket.files.size,
      sessions: bucket.sessions.size
    })).sort((a, b) => a.timestamp - b.timestamp);

    return result;
  }

  /**
   * Get bucket size based on time range
   */
  getBucketSize(timeRange) {
    const sizes = {
      '24h': 60 * 60 * 1000,        // 1 hour buckets
      '7d': 6 * 60 * 60 * 1000,     // 6 hour buckets
      '30d': 24 * 60 * 60 * 1000,   // 1 day buckets
      'all': 7 * 24 * 60 * 60 * 1000 // 1 week buckets
    };
    return sizes[timeRange] || sizes['7d'];
  }

  /**
   * Calculate totals
   */
  calculateTotals(buckets) {
    return buckets.reduce((totals, bucket) => ({
      codeChanges: totals.codeChanges + bucket.codeChanges,
      prompts: totals.prompts + bucket.prompts,
      fileModifications: totals.fileModifications + bucket.fileModifications,
      totalEvents: totals.totalEvents + bucket.totalEvents
    }), {
      codeChanges: 0,
      prompts: 0,
      fileModifications: 0,
      totalEvents: 0
    });
  }

  /**
   * Calculate trends
   */
  calculateTrends(buckets) {
    if (buckets.length < 2) {
      return { codeChanges: 0, prompts: 0, overall: 0 };
    }

    const midpoint = Math.floor(buckets.length / 2);
    const firstHalf = buckets.slice(0, midpoint);
    const secondHalf = buckets.slice(midpoint);

    const firstHalfAvg = {
      codeChanges: this.average(firstHalf, 'codeChanges'),
      prompts: this.average(firstHalf, 'prompts')
    };

    const secondHalfAvg = {
      codeChanges: this.average(secondHalf, 'codeChanges'),
      prompts: this.average(secondHalf, 'prompts')
    };

    return {
      codeChanges: this.calculatePercentageChange(firstHalfAvg.codeChanges, secondHalfAvg.codeChanges),
      prompts: this.calculatePercentageChange(firstHalfAvg.prompts, secondHalfAvg.prompts),
      overall: this.calculatePercentageChange(
        firstHalfAvg.codeChanges + firstHalfAvg.prompts,
        secondHalfAvg.codeChanges + secondHalfAvg.prompts
      )
    };
  }

  /**
   * Calculate average for a metric
   */
  average(buckets, metric) {
    if (buckets.length === 0) return 0;
    const sum = buckets.reduce((total, bucket) => total + bucket[metric], 0);
    return sum / buckets.length;
  }

  /**
   * Calculate percentage change
   */
  calculatePercentageChange(oldValue, newValue) {
    if (oldValue === 0) return newValue > 0 ? 100 : 0;
    return ((newValue - oldValue) / oldValue) * 100;
  }

  /**
   * Generate activity heatmap data
   */
  generateActivityHeatmap(events, entries) {
    const allItems = [...events, ...entries];
    const heatmap = Array(7).fill(null).map(() => Array(24).fill(0));

    allItems.forEach(item => {
      const date = new Date(item.timestamp);
      const day = date.getDay(); // 0-6 (Sunday-Saturday)
      const hour = date.getHours(); // 0-23
      heatmap[day][hour]++;
    });

    return heatmap;
  }

  /**
   * Generate cumulative changes
   */
  generateCumulativeData(events, entries) {
    const allItems = [...events, ...entries]
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    let cumulativeCode = 0;
    let cumulativePrompts = 0;
    let cumulativeFiles = new Set();

    return allItems.map(item => {
      if (item.type === 'code_change' || item.type === 'file_change') {
        cumulativeCode++;
        const details = this.parseDetails(item);
        if (details.file_path) {
          cumulativeFiles.add(details.file_path);
        }
      } else if (item.type === 'prompt_response' || item.type === 'prompt') {
        cumulativePrompts++;
      }

      return {
        timestamp: new Date(item.timestamp).getTime(),
        cumulativeCode,
        cumulativePrompts,
        cumulativeFiles: cumulativeFiles.size
      };
    });
  }

  /**
   * Render time series chart using D3
   */
  renderTimeSeriesChart(containerId, data, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    const width = container.clientWidth || 800;
    const height = options.height || 300;
    const margin = { top: 20, right: 30, bottom: 50, left: 60 };

    const svg = d3.select(`#${containerId}`)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create scales
    const x = d3.scaleTime()
      .domain(d3.extent(data.buckets, d => new Date(d.timestamp)))
      .range([0, chartWidth]);

    const yMax = d3.max(data.buckets, d => Math.max(d.codeChanges, d.prompts, d.totalEvents));
    const y = d3.scaleLinear()
      .domain([0, yMax * 1.1])
      .range([chartHeight, 0]);

    // Add grid lines
    g.append('g')
      .attr('class', 'grid')
      .attr('opacity', 0.1)
      .call(d3.axisLeft(y)
        .tickSize(-chartWidth)
        .tickFormat('')
      );

    // Add axes
    g.append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(x).ticks(6))
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)');

    g.append('g')
      .call(d3.axisLeft(y));

    // Add axis labels
    svg.append('text')
      .attr('transform', `translate(${width/2},${height - 5})`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Time');

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 15)
      .attr('x', -(height / 2))
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Activity Count');

    // Create line generators
    const lineCode = d3.line()
      .x(d => x(new Date(d.timestamp)))
      .y(d => y(d.codeChanges))
      .curve(d3.curveMonotoneX);

    const linePrompts = d3.line()
      .x(d => x(new Date(d.timestamp)))
      .y(d => y(d.prompts))
      .curve(d3.curveMonotoneX);

    // Add lines
    if (options.showCodeChanges !== false) {
      g.append('path')
        .datum(data.buckets)
        .attr('fill', 'none')
        .attr('stroke', '#000000')
        .attr('stroke-width', 2)
        .attr('d', lineCode);
    }

    if (options.showPrompts !== false) {
      g.append('path')
        .datum(data.buckets)
        .attr('fill', 'none')
        .attr('stroke', '#666666')
        .attr('stroke-width', 2)
        .attr('d', linePrompts);
    }

    // Add dots
    if (options.showCodeChanges !== false) {
      g.selectAll('.dot-code')
        .data(data.buckets)
        .enter().append('circle')
        .attr('class', 'dot-code')
        .attr('cx', d => x(new Date(d.timestamp)))
        .attr('cy', d => y(d.codeChanges))
        .attr('r', 3)
        .attr('fill', '#000000')
        .append('title')
        .text(d => `${new Date(d.timestamp).toLocaleString()}\nCode Changes: ${d.codeChanges}`);
    }

    if (options.showPrompts !== false) {
      g.selectAll('.dot-prompts')
        .data(data.buckets)
        .enter().append('circle')
        .attr('class', 'dot-prompts')
        .attr('cx', d => x(new Date(d.timestamp)))
        .attr('cy', d => y(d.prompts))
        .attr('r', 3)
        .attr('fill', '#666666')
        .append('title')
        .text(d => `${new Date(d.timestamp).toLocaleString()}\nPrompts: ${d.prompts}`);
    }

    // Add legend
    const legend = svg.append('g')
      .attr('transform', `translate(${width - 150}, ${margin.top})`);

    if (options.showCodeChanges !== false) {
      legend.append('line')
        .attr('x1', 0).attr('x2', 30)
        .attr('y1', 0).attr('y2', 0)
        .attr('stroke', '#000000')
        .attr('stroke-width', 2);
      legend.append('text')
        .attr('x', 35).attr('y', 5)
        .style('font-size', '12px')
        .text('Code Changes');
    }

    if (options.showPrompts !== false) {
      legend.append('line')
        .attr('x1', 0).attr('x2', 30)
        .attr('y1', 20).attr('y2', 20)
        .attr('stroke', '#666666')
        .attr('stroke-width', 2);
      legend.append('text')
        .attr('x', 35).attr('y', 25)
        .style('font-size', '12px')
        .text('AI Prompts');
    }
  }

  /**
   * Render activity heatmap
   */
  renderActivityHeatmap(containerId, heatmapData) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const maxValue = Math.max(...heatmapData.flat());

    let html = '<div class="heatmap-grid">';
    
    // Hour labels
    html += '<div class="heatmap-row"><div class="heatmap-label"></div>';
    for (let hour = 0; hour < 24; hour++) {
      html += `<div class="heatmap-hour-label">${hour}</div>`;
    }
    html += '</div>';

    // Days and cells
    heatmapData.forEach((dayData, dayIndex) => {
      html += `<div class="heatmap-row">`;
      html += `<div class="heatmap-day-label">${days[dayIndex]}</div>`;
      
      dayData.forEach((value, hourIndex) => {
        const intensity = maxValue > 0 ? value / maxValue : 0;
        const color = this.getHeatmapColor(intensity);
        html += `<div class="heatmap-cell" style="background-color: ${color}" 
                  title="${days[dayIndex]} ${hourIndex}:00 - ${value} events"></div>`;
      });
      
      html += '</div>';
    });

    html += '</div>';
    container.innerHTML = html;
  }

  /**
   * Get heatmap color based on intensity
   */
  getHeatmapColor(intensity) {
    if (intensity === 0) return '#f5f5f5';
    if (intensity < 0.2) return '#e0e0e0';
    if (intensity < 0.4) return '#b0b0b0';
    if (intensity < 0.6) return '#808080';
    if (intensity < 0.8) return '#505050';
    return '#303030';
  }

  /**
   * Parse details helper
   */
  parseDetails(item) {
    if (typeof item.details === 'string') {
      try {
        return JSON.parse(item.details);
      } catch {
        return {};
      }
    }
    return item.details || {};
  }
}

// Export for use in dashboard
window.TimeSeriesVisualizer = TimeSeriesVisualizer;

