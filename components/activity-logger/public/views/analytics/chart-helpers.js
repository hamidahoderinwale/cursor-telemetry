/**
 * Chart rendering helper functions for Analytics view
 */

function renderFileTypesChart() {
  const ctx = document.getElementById('fileTypesChart');
  if (!ctx) {
    console.warn('[CHART] fileTypesChart canvas not found');
    return;
  }

  const events = window.state?.data?.events || [];
  if (events.length === 0) {
    console.warn('[CHART] No events data for fileTypesChart');
    ctx.parentElement.innerHTML = '<div style="padding: var(--space-xl); text-align: center; color: var(--color-text-muted);">No file data available</div>';
    return;
  }

  const typeCount = {};
  events.forEach(event => {
    try {
      const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
      const path = details?.file_path || '';
      let ext = path.split('.').pop() || 'unknown';
      
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

  window.createChart('fileTypesChart', {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: [
          window.CONFIG.CHART_COLORS.primary,
          window.CONFIG.CHART_COLORS.secondary,
          window.CONFIG.CHART_COLORS.accent,
          window.CONFIG.CHART_COLORS.success,
          window.CONFIG.CHART_COLORS.warning
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

function renderHourlyChart() {
  const ctx = document.getElementById('hourlyChart');
  if (!ctx) {
    console.warn('[CHART] hourlyChart canvas not found');
    return;
  }

  const allEvents = window.state?.data?.events || [];
  const allPrompts = window.state?.data?.prompts || [];
  
  if (allEvents.length === 0 && allPrompts.length === 0) {
    console.warn('[CHART] No data for hourlyChart');
    ctx.parentElement.innerHTML = '<div style="padding: var(--space-xl); text-align: center; color: var(--color-text-muted);">No activity data available</div>';
    return;
  }

  const now = Date.now();
  const twelveHoursAgo = now - (12 * 60 * 60 * 1000);
  const intervalSize = 15 * 60 * 1000;
  const numIntervals = 48;
  
  const intervals = [];
  for (let i = 0; i < numIntervals; i++) {
    const intervalStart = twelveHoursAgo + (i * intervalSize);
    intervals.push({
      timestamp: intervalStart,
      events: 0,
      prompts: 0
    });
  }
  
  allEvents.forEach(event => {
    const eventTime = new Date(event.timestamp).getTime();
    if (eventTime >= twelveHoursAgo) {
      const intervalIndex = Math.floor((eventTime - twelveHoursAgo) / intervalSize);
      if (intervalIndex >= 0 && intervalIndex < numIntervals) {
        intervals[intervalIndex].events++;
      }
    }
  });
  
  allPrompts.forEach(prompt => {
    const promptTime = new Date(prompt.timestamp).getTime();
    if (promptTime >= twelveHoursAgo) {
      const intervalIndex = Math.floor((promptTime - twelveHoursAgo) / intervalSize);
      if (intervalIndex >= 0 && intervalIndex < numIntervals) {
        intervals[intervalIndex].prompts++;
      }
    }
  });
  
  const labels = intervals.map(i => {
    const date = new Date(i.timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  window.createChart('hourlyChart', {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'File Changes',
          data: intervals.map(i => i.events),
          backgroundColor: window.CONFIG.CHART_COLORS.primary + '80',
          borderColor: window.CONFIG.CHART_COLORS.primary,
          borderWidth: 1
        },
        {
          label: 'AI Prompts',
          data: intervals.map(i => i.prompts),
          backgroundColor: window.CONFIG.CHART_COLORS.accent + '80',
          borderColor: window.CONFIG.CHART_COLORS.accent,
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {position: 'bottom'}
      },
      scales: {
        x: {
          ticks: {
            maxTicksLimit: 12
          }
        },
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function renderAIActivityChart() {
  const canvas = document.getElementById('aiActivityChart');
  if (!canvas) return;
  
  const allEvents = window.state.data.events || [];
  const allPrompts = window.state.data.prompts || [];
  
  console.log('[CHART-DEBUG] AI Activity Chart rendering with:', {
    totalEvents: allEvents.length,
    totalPrompts: allPrompts.length
  });
  
  const now = Date.now();
  const oldestEvent = allEvents.length > 0 ? Math.min(...allEvents.map(e => new Date(e.timestamp).getTime())) : now;
  const oldestPrompt = allPrompts.length > 0 ? Math.min(...allPrompts.map(p => new Date(p.timestamp).getTime())) : now;
  const oldestData = Math.min(oldestEvent, oldestPrompt);
  
  const useHourly = (now - oldestData) < (2 * 24 * 60 * 60 * 1000);
  const bucketSize = useHourly ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const numBuckets = useHourly ? 24 : 14;
  
  const buckets = [];
  for (let i = numBuckets - 1; i >= 0; i--) {
    const bucketTime = now - (i * bucketSize);
    buckets.push({
      timestamp: bucketTime,
      promptCount: 0,
      codeChanges: 0,
      fileCount: 0
    });
  }
  
  allPrompts.forEach(prompt => {
    const promptTime = new Date(prompt.timestamp).getTime();
    const bucketIndex = Math.floor((now - promptTime) / bucketSize);
    const actualIndex = numBuckets - 1 - bucketIndex;
    if (actualIndex >= 0 && actualIndex < numBuckets) {
      buckets[actualIndex].promptCount++;
    }
  });
  
  allEvents.forEach(event => {
    const eventTime = new Date(event.timestamp).getTime();
    const bucketIndex = Math.floor((now - eventTime) / bucketSize);
    const actualIndex = numBuckets - 1 - bucketIndex;
    if (actualIndex >= 0 && actualIndex < numBuckets) {
      buckets[actualIndex].fileCount++;
      let changeSize = 0;
      try {
        const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
        if (details.chars_added) changeSize += details.chars_added;
        if (details.chars_deleted) changeSize += details.chars_deleted;
      } catch (e) {
        changeSize = 100;
      }
      buckets[actualIndex].codeChanges += changeSize / 1024;
    }
  });
  
  if (buckets.every(b => b.promptCount === 0 && b.codeChanges === 0)) {
    canvas.style.display = 'none';
    const container = canvas.parentElement;
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; padding: var(--space-xl); text-align: center;">
        <div style="font-size: var(--text-lg); font-weight: 500; color: var(--color-text); margin-bottom: var(--space-md);">
          ${allPrompts.length === 0 && allEvents.length === 0 ? 'Waiting for Data' : 'No Recent Activity'}
        </div>
        <div style="font-size: var(--text-sm); color: var(--color-text-muted); max-width: 500px; line-height: 1.6;">
          ${allPrompts.length === 0 && allEvents.length === 0 ? `
            <div style="margin-bottom: var(--space-md);">
              The companion service hasn't sent any data yet.
            </div>
            <div style="text-align: left; margin: 0 auto; max-width: 400px;">
              <div style="margin-bottom: var(--space-sm);">• Companion service is still starting up</div>
              <div style="margin-bottom: var(--space-sm);">• You haven't used Cursor AI yet</div>
              <div style="margin-bottom: var(--space-sm);">• Database sync is in progress</div>
            </div>
          ` : `
            Data is loaded (${allPrompts.length} prompts, ${allEvents.length} events) but no activity in the selected time window.
          `}
        </div>
      </div>
    `;
    return;
  }
  
  window.createChart('aiActivityChart', {
    type: 'line',
    data: {
      labels: buckets.map(b => {
        const date = new Date(b.timestamp);
        if (useHourly) {
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
          return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
      }),
      datasets: [
        {
          label: 'AI Prompts',
          data: buckets.map(b => b.promptCount),
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.15)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y-prompts',
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: '#8b5cf6'
        },
        {
          label: 'Code Output (KB)',
          data: buckets.map(b => b.codeChanges),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y-code',
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: '#10b981'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: { size: 11, family: 'Inter' }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: { size: 13 },
          bodyFont: { size: 12 },
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              if (context.dataset.yAxisID === 'y-prompts') {
                label += context.parsed.y + ' prompts';
              } else {
                label += context.parsed.y.toFixed(2) + ' KB';
              }
              return label;
            },
            afterBody: function(tooltipItems) {
              const index = tooltipItems[0].dataIndex;
              const bucket = buckets[index];
              return [`Files changed: ${bucket.fileCount}`];
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxRotation: 45, minRotation: 0, font: { size: 10 } }
        },
        'y-prompts': {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          title: { display: true, text: 'AI Prompts', font: { size: 11, weight: 'bold' } },
          ticks: {
            stepSize: 1,
            callback: function(value) { return Math.floor(value); },
            font: { size: 10 }
          },
          grid: { color: 'rgba(139, 92, 246, 0.1)' }
        },
        'y-code': {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          title: { display: true, text: 'Code Output (KB)', font: { size: 11, weight: 'bold' } },
          ticks: {
            callback: function(value) { return value.toFixed(1) + ' KB'; },
            font: { size: 10 }
          },
          grid: { drawOnChartArea: false, color: 'rgba(16, 185, 129, 0.1)' }
        }
      }
    }
  });
}

function renderPromptTokensChart(hoursParam = 24) {
  const canvas = document.getElementById('promptTokensChart');
  if (!canvas) return;
  
  const prompts = window.state.data.prompts || [];
  const now = Date.now();
  const hours = hoursParam;
  const buckets = Array.from({ length: hours }, (_, i) => {
    const time = now - (hours - i) * 60 * 60 * 1000;
    return {
      timestamp: time,
      charCount: 0,
      contextUsage: 0,
      contextCount: 0,
      count: 0
    };
  });
  
  prompts.forEach(prompt => {
    const promptTime = new Date(prompt.timestamp).getTime();
    const bucketIndex = Math.floor((promptTime - (now - hours * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    if (bucketIndex >= 0 && bucketIndex < hours) {
      const text = prompt.text || prompt.prompt || prompt.preview || '';
      const charCount = text.length;
      const contextUsage = prompt.contextUsage || 0;
      
      buckets[bucketIndex].charCount += charCount;
      if (contextUsage > 0) {
        buckets[bucketIndex].contextUsage += contextUsage;
        buckets[bucketIndex].contextCount += 1;
      }
      buckets[bucketIndex].count += 1;
    }
  });
  
  if (buckets.every(b => b.count === 0)) {
    canvas.style.display = 'none';
    const container = canvas.parentElement;
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 250px; text-align: center;">
        <div style="font-size: var(--text-md); font-weight: 500; color: var(--color-text); margin-bottom: var(--space-xs);">No Data Available</div>
        <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Prompt data will appear once you start using Cursor AI</div>
      </div>
    `;
    return;
  }

  const avgContextUsage = buckets.map(b => 
    b.contextCount > 0 ? b.contextUsage / b.contextCount : 0
  );

  const maxContextUsage = Math.max(...avgContextUsage.filter(v => v > 0));
  const hasContextData = avgContextUsage.some(v => v > 0);
  
  let contextAxisMax = 100;
  let contextStepSize = 20;
  
  if (hasContextData) {
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

  window.createChart('promptTokensChart', {
    type: 'line',
    data: {
      labels: buckets.map(b => {
        const date = new Date(b.timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }),
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
              if (value >= 80) return '#ef4444';
              if (value >= 60) return '#f59e0b';
              return '#10b981';
            }
          }
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { 
          display: true,
          position: 'top',
          align: 'end',
          labels: { usePointStyle: true, padding: 10, font: { size: 11 } }
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
              } else {
                return `${label}: ${value.toLocaleString()}`;
              }
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
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          beginAtZero: true,
          title: { display: true, text: 'Characters', font: { size: 11 } },
          ticks: {
            callback: function(value) {
              return value >= 1000 ? (value/1000).toFixed(1) + 'k' : value;
            }
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
            callback: function(value) { return value.toFixed(0) + '%'; }
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

function updateContextChartTimescale(hours) {
  document.querySelectorAll('.btn-timescale').forEach(btn => {
    const btnHours = parseInt(btn.getAttribute('data-hours'));
    if (btnHours === hours) {
      btn.style.background = 'var(--color-primary)';
      btn.style.color = 'white';
      btn.classList.add('active');
    } else {
      btn.style.background = '';
      btn.style.color = '';
      btn.classList.remove('active');
    }
  });
  
  if (window.renderPromptTokensChart) window.renderPromptTokensChart(hours);
}

// Export to window for global access
window.renderFileTypesChart = renderFileTypesChart;
window.renderHourlyChart = renderHourlyChart;
window.renderAIActivityChart = renderAIActivityChart;
window.renderPromptTokensChart = renderPromptTokensChart;
window.updateContextChartTimescale = updateContextChartTimescale;

