/**
 * Chart Renderers Module
 * Extracted from new-dashboard.js to reduce file size
 * Handles all Chart.js-based visualizations
 */

export class ChartRenderers {
  constructor() {
    this.state = window.state;
    this.CONFIG = window.CONFIG;
    this.createChart = window.createChart;
    
    // Fallback chart colors if CONFIG is not available
    this.defaultColors = {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      accent: '#10b981',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444'
    };
  }
  
  getChartColors() {
    if (this.CONFIG && this.CONFIG.CHART_COLORS) {
      return this.CONFIG.CHART_COLORS;
    }
    return this.defaultColors;
  }

  /**
   * Render File Types breakdown chart (doughnut)
   */
  renderFileTypesChart() {
    const ctx = document.getElementById('fileTypesChart');
    if (!ctx) return;

    // Count file types
    const typeCount = {};
    this.state.data.events.forEach(event => {
      try {
        const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
        const path = details?.file_path || '';
        let ext = path.split('.').pop() || 'unknown';
        
        // Group all Git-related extensions under "Git"
        if (ext.startsWith('Git') || ext === 'COMMIT_EDITMSG' || ext === 'HEAD' || 
            ext === 'index' || ext === 'FETCH_HEAD' || ext === 'ORIG_HEAD' || 
            path.includes('.git/')) {
          ext = 'Git';
        }
        
        typeCount[ext] = (typeCount[ext] || 0) + 1;
      } catch {}
    });

    const labels = Object.keys(typeCount).slice(0, 5);
    const data = labels.map(label => typeCount[label]);

    // Get chart colors with fallback
    const colors = this.getChartColors();

    this.createChart('fileTypesChart', {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: [
            colors.primary,
            colors.secondary,
            colors.accent,
            colors.success,
            colors.warning
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {position: 'bottom'}
        }
      }
    });
  }

  /**
   * Render hourly activity chart (15-min intervals, last 12h)
   */
  renderHourlyChart() {
    const ctx = document.getElementById('hourlyChart');
    if (!ctx) return;

    const allEvents = this.state.data.events || [];
    const allPrompts = this.state.data.prompts || [];
    
    if (allEvents.length === 0 && allPrompts.length === 0) {
      return;
    }

    // Create continuous timeline for the last 12 hours (by 15-minute intervals)
    const now = Date.now();
    const twelveHoursAgo = now - (12 * 60 * 60 * 1000);
    const intervalSize = 15 * 60 * 1000; // 15 minutes
    const numIntervals = 48; // 12 hours / 15 minutes = 48 intervals
    
    const intervals = [];
    for (let i = 0; i < numIntervals; i++) {
      const intervalStart = twelveHoursAgo + (i * intervalSize);
      intervals.push({
        timestamp: intervalStart,
        events: 0,
        prompts: 0
      });
    }
    
    // Fill intervals with events
    allEvents.forEach(event => {
      const eventTime = new Date(event.timestamp).getTime();
      if (eventTime >= twelveHoursAgo) {
        const intervalIndex = Math.floor((eventTime - twelveHoursAgo) / intervalSize);
        if (intervalIndex >= 0 && intervalIndex < numIntervals) {
          intervals[intervalIndex].events++;
        }
      }
    });
    
    // Fill intervals with prompts
    allPrompts.forEach(prompt => {
      const promptTime = new Date(prompt.timestamp).getTime();
      if (promptTime >= twelveHoursAgo) {
        const intervalIndex = Math.floor((promptTime - twelveHoursAgo) / intervalSize);
        if (intervalIndex >= 0 && intervalIndex < numIntervals) {
          intervals[intervalIndex].prompts++;
        }
      }
    });

    this.createChart('hourlyChart', {
      type: 'bar',
      data: {
        labels: intervals.map(interval => {
          const date = new Date(interval.timestamp);
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }),
        datasets: [
          {
            label: 'File Changes',
            data: intervals.map(i => i.events),
            backgroundColor: this.getChartColors().primary,
            borderRadius: 4
          },
          {
            label: 'AI Prompts',
            data: intervals.map(i => i.prompts),
            backgroundColor: '#8b5cf6',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              usePointStyle: true,
              padding: 8,
              font: { size: 10 }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 8,
            callbacks: {
              title: function(context) {
                return context[0].label;
              }
            }
          }
        },
        scales: {
          x: {
            stacked: false,
            grid: { display: false },
            ticks: {
              maxRotation: 45,
              minRotation: 0,
              autoSkip: true,
              maxTicksLimit: 12,
              font: { size: 9 }
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
              font: { size: 10 }
            }
          }
        }
      }
    });
  }

  /**
   * Render AI Activity chart (prompts + code changes over time)
   */
  renderAIActivityChart() {
    const canvas = document.getElementById('aiActivityChart');
    if (!canvas) return;
    
    // Combine events and prompts to create time-series data
    const allEvents = this.state.data.events || [];
    const allPrompts = this.state.data.prompts || [];
    
    console.log('[CHART-DEBUG] AI Activity Chart rendering with:', {
      totalEvents: allEvents.length,
      totalPrompts: allPrompts.length
    });
    
    // Group by hour for the last 24 hours or by day for longer periods
    const now = Date.now();
    
    // Determine granularity based on data span
    const oldestEvent = allEvents.length > 0 ? Math.min(...allEvents.map(e => new Date(e.timestamp).getTime())) : now;
    const oldestPrompt = allPrompts.length > 0 ? Math.min(...allPrompts.map(p => new Date(p.timestamp).getTime())) : now;
    const oldestData = Math.min(oldestEvent, oldestPrompt);
    
    const useHourly = (now - oldestData) < (2 * 24 * 60 * 60 * 1000); // Less than 2 days
    const bucketSize = useHourly ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 1 hour or 1 day
    const numBuckets = useHourly ? 24 : 14; // Last 24 hours or 14 days
    
    // Create time buckets
    const buckets = [];
    for (let i = numBuckets - 1; i >= 0; i--) {
      const bucketTime = now - (i * bucketSize);
      buckets.push({
        timestamp: bucketTime,
        promptCount: 0,
        codeChanges: 0, // in KB
        fileCount: 0
      });
    }
    
    // Fill buckets with prompt data
    allPrompts.forEach(prompt => {
      const promptTime = new Date(prompt.timestamp).getTime();
      const bucketIndex = Math.floor((now - promptTime) / bucketSize);
      const actualIndex = numBuckets - 1 - bucketIndex;
      if (actualIndex >= 0 && actualIndex < numBuckets) {
        buckets[actualIndex].promptCount++;
      }
    });
    
    // Fill buckets with code change data
    allEvents.forEach(event => {
      try {
        const eventTime = new Date(event.timestamp).getTime();
        const bucketIndex = Math.floor((now - eventTime) / bucketSize);
        const actualIndex = numBuckets - 1 - bucketIndex;
        
        if (actualIndex >= 0 && actualIndex < numBuckets) {
          const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
          const chars = (details?.chars_added || 0) + (details?.chars_deleted || 0);
          buckets[actualIndex].codeChanges += chars / 1000; // Convert to KB
          buckets[actualIndex].fileCount++;
        }
      } catch {}
    });
    
    // Format labels
    const labelFormat = useHourly
      ? (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : (date) => date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    
    this.createChart('aiActivityChart', {
      type: 'line',
      data: {
        labels: buckets.map(b => labelFormat(new Date(b.timestamp))),
        datasets: [
          {
            label: 'AI Prompts',
            data: buckets.map(b => b.promptCount),
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            tension: 0.3,
            fill: true,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            yAxisID: 'y'
          },
          {
            label: 'Code Output (KB)',
            data: buckets.map(b => b.codeChanges),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.3,
            fill: true,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              usePointStyle: true,
              padding: 10,
              font: { size: 11 }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 10,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += context.dataset.label.includes('KB')
                    ? `${context.parsed.y.toFixed(1)} KB`
                    : context.parsed.y;
                }
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              maxRotation: 45,
              minRotation: 0,
              font: { size: 9 }
            }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            beginAtZero: true,
            title: {
              display: true,
              text: 'AI Prompts',
              font: { size: 10 }
            },
            ticks: {
              font: { size: 10 }
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            beginAtZero: true,
            title: {
              display: true,
              text: 'Code (KB)',
              font: { size: 10 }
            },
            grid: {
              drawOnChartArea: false
            },
            ticks: {
              font: { size: 10 }
            }
          }
        }
      }
    });
  }

  /**
   * Render prompt tokens chart with timescale controls
   */
  renderPromptTokensChart(hoursParam = 24) {
    const canvas = document.getElementById('promptTokensChart');
    if (!canvas) {
      console.warn('[CHART] promptTokensChart canvas not found');
      return;
    }

    const prompts = this.state.data.prompts || [];
    
    // Check if we have any prompts at all
    if (prompts.length === 0) {
      console.warn('[CHART] No prompts found in state');
      canvas.style.display = 'none';
      const container = canvas.parentElement;
      if (container) {
        container.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 250px; text-align: center; padding: var(--space-xl);">
            <div style="font-size: var(--text-lg); font-weight: 500; color: var(--color-text); margin-bottom: var(--space-sm);">No Prompt Data</div>
            <div style="font-size: var(--text-sm); color: var(--color-text-muted);">No prompts have been recorded yet. Start using Cursor AI to see context usage data here.</div>
          </div>
        `;
      }
      return;
    }
    
    // Filter prompts with token data OR context usage data OR context file count
    // Also check context_file_count as a fallback indicator
    const promptsWithData = prompts.filter(p => {
      const tokens = p.promptTokens || p.estimatedTokens || p.totalTokens || 0;
      const contextUsage = p.contextUsage || p.context_usage || 0;
      const contextFileCount = p.contextFileCount || p.context_file_count || 0;
      // Include if has tokens, context usage > 0, or has context files referenced
      return tokens > 0 || contextUsage > 0 || contextFileCount > 0;
    });

    if (promptsWithData.length === 0) {
      console.warn('[CHART] No prompts with token or context usage data found');
      canvas.style.display = 'none';
      const container = canvas.parentElement;
      if (container) {
        container.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 250px; text-align: center; padding: var(--space-xl);">
            <div style="font-size: var(--text-lg); font-weight: 500; color: var(--color-text); margin-bottom: var(--space-sm);">No Context Data Available</div>
            <div style="font-size: var(--text-sm); color: var(--color-text-muted);">
              Prompts exist (${prompts.length}) but none have token or context usage metrics. 
              This data will appear as you continue using Cursor AI.
            </div>
          </div>
        `;
      }
      return;
    }

    // Time-based filtering
    const now = Date.now();
    const timeWindow = hoursParam * 60 * 60 * 1000;
    const filtered = promptsWithData.filter(p => {
      const timestamp = new Date(p.timestamp).getTime();
      return (now - timestamp) <= timeWindow;
    });

    if (filtered.length === 0) {
      console.warn(`[CHART] No prompts in the last ${hoursParam} hours`);
      canvas.style.display = 'none';
      const container = canvas.parentElement;
      if (container) {
        container.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 250px; text-align: center; padding: var(--space-xl);">
            <div style="font-size: var(--text-lg); font-weight: 500; color: var(--color-text); margin-bottom: var(--space-sm);">No Recent Data</div>
            <div style="font-size: var(--text-sm); color: var(--color-text-muted);">
              No prompts with context data in the last ${hoursParam} hours. 
              Try selecting a longer time range (3d, 7d, or 30d) or wait for new activity.
            </div>
          </div>
        `;
      }
      return;
    }

    // Sort by timestamp
    filtered.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Create time buckets (hourly)
    const buckets = Array.from({ length: hoursParam }, (_, i) => {
      const time = now - (hoursParam - i) * 60 * 60 * 1000;
      return {
        timestamp: time,
        charCount: 0,
        contextUsage: 0,
        contextCount: 0,
        count: 0
      };
    });

    // Fill buckets with prompt data
    filtered.forEach(prompt => {
      const promptTime = new Date(prompt.timestamp).getTime();
      const bucketIndex = Math.floor((promptTime - (now - hoursParam * 60 * 60 * 1000)) / (60 * 60 * 1000));
      
      if (bucketIndex >= 0 && bucketIndex < hoursParam) {
        const text = prompt.text || prompt.prompt || prompt.preview || '';
        const charCount = text.length;
        // Check both camelCase and snake_case
        const contextUsage = prompt.contextUsage || prompt.context_usage || 0;
        const contextFileCount = prompt.contextFileCount || prompt.context_file_count || 0;
        
        buckets[bucketIndex].charCount += charCount;
        
        // If contextUsage is available, use it; otherwise estimate from file count
        if (contextUsage > 0) {
          buckets[bucketIndex].contextUsage += contextUsage;
          buckets[bucketIndex].contextCount += 1;
        } else if (contextFileCount > 0) {
          // Estimate context usage: roughly 2-5% per file referenced
          const estimatedUsage = Math.min(100, contextFileCount * 3);
          buckets[bucketIndex].contextUsage += estimatedUsage;
          buckets[bucketIndex].contextCount += 1;
        }
        buckets[bucketIndex].count += 1;
      }
    });

    // Calculate average context usage per bucket
    const avgContextUsage = buckets.map(b => 
      b.contextCount > 0 ? b.contextUsage / b.contextCount : 0
    );

    // Smart scaling for context usage axis
    const maxContextUsage = Math.max(...avgContextUsage.filter(v => v > 0));
    let contextAxisMax = 100;
    let contextStepSize = 20;
    
    if (maxContextUsage > 0) {
      if (maxContextUsage <= 30) {
        contextAxisMax = 40;
        contextStepSize = 10;
      } else if (maxContextUsage <= 50) {
        contextAxisMax = 60;
        contextStepSize = 10;
      } else if (maxContextUsage <= 70) {
        contextAxisMax = 80;
        contextStepSize = 10;
      }
    }

    // Format labels
    const labels = buckets.map(b => {
      const date = new Date(b.timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });

    // Ensure canvas is visible
    canvas.style.display = 'block';
    
    // Destroy existing chart if it exists
    if (this.chartInstances && this.chartInstances['promptTokensChart']) {
      this.chartInstances['promptTokensChart'].destroy();
      delete this.chartInstances['promptTokensChart'];
    }

    this.createChart('promptTokensChart', {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Prompt Length (chars)',
            data: buckets.map(b => b.charCount),
            borderColor: '#94a3b8',
            backgroundColor: 'rgba(148, 163, 184, 0.1)',
            tension: 0.4,
            fill: true,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 4,
            yAxisID: 'y'
          },
          {
            label: 'Context Usage %',
            data: avgContextUsage,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            tension: 0.4,
            fill: true,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 4,
            yAxisID: 'y1',
            segment: {
              borderColor: ctx => {
                const value = ctx.p1.parsed.y;
                if (value >= 80) return '#ef4444'; // Red
                if (value >= 60) return '#f59e0b'; // Orange
                return '#10b981'; // Green
              }
            }
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'nearest',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              usePointStyle: true,
              padding: 10,
              font: { size: 11 }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 10,
            callbacks: {
              label: function(context) {
                const label = context.dataset.label || '';
                const value = context.parsed.y;
                if (label === 'Prompt Length (chars)') {
                  return `${label}: ${value.toLocaleString()} characters`;
                } else if (label === 'Context Usage %') {
                  let status = '';
                  if (value >= 80) status = ' (High!)';
                  else if (value >= 60) status = ' (Medium-High)';
                  else if (value >= 40) status = ' (Medium)';
                  else status = ' (Normal)';
                  return `${label}: ${value.toFixed(1)}%${status}`;
                }
                return `${label}: ${value.toLocaleString()}`;
              },
              afterBody: function(context) {
                const index = context[0].dataIndex;
                const count = buckets[index].count;
                return count > 0 ? `\n${count} prompt${count !== 1 ? 's' : ''}` : '';
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              maxRotation: 45,
              minRotation: 0,
              font: { size: 9 }
            }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            beginAtZero: true,
            title: {
              display: true,
              text: 'Characters',
              font: { size: 11 }
            },
            ticks: {
              callback: function(value) {
                return value >= 1000 ? (value/1000).toFixed(1) + 'k' : value;
              },
              font: { size: 10 }
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            beginAtZero: true,
            max: contextAxisMax,
            title: {
              display: true,
              text: `Context % (0-${contextAxisMax}%)`,
              font: { size: 11 }
            },
            ticks: {
              stepSize: contextStepSize,
              callback: function(value) {
                return value.toFixed(0) + '%';
              },
              font: { size: 10 }
            },
            grid: {
              drawOnChartArea: false,
              color: function(context) {
                const value = context.tick.value;
                if (value >= 80) return 'rgba(239, 68, 68, 0.1)';
                if (value >= 60) return 'rgba(245, 158, 11, 0.1)';
                return 'rgba(148, 163, 184, 0.05)';
              }
            }
          }
        }
      }
    });
  }

  /**
   * Render system resources chart (CPU + Memory)
   */
  renderSystemResourcesChart() {
    const canvas = document.getElementById('systemResourcesChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const data = this.state.data.systemResources.slice(-30); // Last 30 data points
    
    if (data.length === 0) {
      canvas.style.display = 'none';
      const container = canvas.parentElement;
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; text-align: center;">
          <div style="font-size: var(--text-md); font-weight: 500; color: var(--color-text); margin-bottom: var(--space-xs);">No Data Available</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted);">System resource data will appear as monitoring continues</div>
        </div>
      `;
      return;
    }

    // Calculate max values for dual-axis scaling
    const memoryData = data.map(d => {
      const memBytes = d.memory?.rss || d.memory?.heapUsed || d.memory || 0;
      return parseFloat((memBytes / 1024 / 1024).toFixed(1));
    });
    
    const cpuData = data.map(d => {
      const loadAvg = d.system?.loadAverage || d.loadAverage || [0];
      return loadAvg[0] || 0;
    });
    
    const maxMemory = Math.max(...memoryData);
    const maxCpu = Math.max(...cpuData);

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map((d, i) => `${i + 1}`),
        datasets: [
          {
            label: 'Memory (MB)',
            data: memoryData,
            borderColor: this.getChartColors().primary,
            backgroundColor: this.getChartColors().primary + '20',
            tension: 0.3,
            fill: true,
            borderWidth: 2,
            pointRadius: 2,
            yAxisID: 'y'
          },
          {
            label: 'CPU Load',
            data: cpuData,
            borderColor: this.getChartColors().warning,
            backgroundColor: this.getChartColors().warning + '20',
            tension: 0.3,
            fill: true,
            borderWidth: 2,
            pointRadius: 2,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 10
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 10
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              maxTicksLimit: 10,
              font: { size: 9 }
            }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            beginAtZero: true,
            max: maxMemory * 1.1,
            title: {
              display: true,
              text: 'Memory (MB)'
            },
            ticks: {
              callback: function(value) {
                return value.toFixed(0) + ' MB';
              }
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            beginAtZero: true,
            max: maxCpu * 1.2,
            title: {
              display: true,
              text: 'CPU Load'
            },
            grid: {
              drawOnChartArea: false
            },
            ticks: {
              callback: function(value) {
                return value.toFixed(1);
              }
            }
          }
        }
      }
    });
  }
}

// Export as global
window.ChartRenderers = ChartRenderers;

// Create global instance
window.chartRenderers = new ChartRenderers();

// Export functions for backward compatibility
window.renderFileTypesChart = () => window.chartRenderers.renderFileTypesChart();
window.renderHourlyChart = () => window.chartRenderers.renderHourlyChart();
window.renderAIActivityChart = () => window.chartRenderers.renderAIActivityChart();
window.renderPromptTokensChart = (hours) => window.chartRenderers.renderPromptTokensChart(hours);
window.renderSystemResourcesChart = () => window.chartRenderers.renderSystemResourcesChart();

// Timescale control function
window.updateContextChartTimescale = function(hours) {
  // Update button states
  document.querySelectorAll('.btn-timescale').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.hours == hours);
  });
  
  // Re-render chart with new timescale
  window.chartRenderers.renderPromptTokensChart(hours);
};

