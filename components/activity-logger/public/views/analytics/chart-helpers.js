/**
 * Chart rendering helper functions for Analytics view
 */

// Helper function to get chart colors with fallback
function getChartColors() {
  return (window.CONFIG && window.CONFIG.CHART_COLORS) ? {
    primary: window.CONFIG.CHART_COLORS.primary,
    secondary: window.CONFIG.CHART_COLORS.secondary,
    accent: window.CONFIG.CHART_COLORS.accent,
    success: window.CONFIG.CHART_COLORS.success,
    warning: window.CONFIG.CHART_COLORS.warning
  } : {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    accent: '#10b981',
    success: '#22c55e',
    warning: '#f59e0b'
  };
}

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

  // Get chart colors with fallback
  const colors = getChartColors();

  window.createChart('fileTypesChart', {
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

  const colors = getChartColors();

  window.createChart('hourlyChart', {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'File Changes',
          data: intervals.map(i => i.events),
          backgroundColor: colors.primary + '80',
          borderColor: colors.primary,
          borderWidth: 1
        },
        {
          label: 'AI Prompts',
          data: intervals.map(i => i.prompts),
          backgroundColor: colors.accent + '80',
          borderColor: colors.accent,
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
  
  // Calculate time span
  const timeSpan = now - oldestData;
  const daysSpan = timeSpan / (24 * 60 * 60 * 1000);
  
  // Use daily buckets, but adapt based on available data
  // If less than 1 day of data, use hourly buckets
  // If 1-7 days, use daily buckets
  // If 7-30 days, use daily buckets (show last 30 days)
  // If more than 30 days, use daily buckets (show last 30 days)
  let bucketSize, numBuckets, timeUnit;
  
  if (daysSpan < 1) {
    // Less than 1 day: use hourly buckets for last 24 hours
    bucketSize = 60 * 60 * 1000; // 1 hour
    numBuckets = 24;
    timeUnit = 'hourly';
  } else if (daysSpan <= 7) {
    // 1-7 days: use daily buckets
    bucketSize = 24 * 60 * 60 * 1000; // 1 day
    numBuckets = Math.ceil(daysSpan) || 1; // Show all available days
    timeUnit = 'daily';
  } else {
    // More than 7 days: show last 30 days
    bucketSize = 24 * 60 * 60 * 1000; // 1 day
    numBuckets = 30;
    timeUnit = 'daily';
  }
  
  // Create buckets starting from oldest data (or last N days if data is older)
  const buckets = [];
  const startTime = timeUnit === 'daily' && daysSpan > 30 
    ? now - (30 * 24 * 60 * 60 * 1000) // Last 30 days
    : oldestData; // From oldest data point
  
  // Calculate how many buckets we need from startTime to now
  const actualNumBuckets = timeUnit === 'daily' && daysSpan > 30 
    ? 30 
    : Math.ceil((now - startTime) / bucketSize) || 1;
  
  for (let i = 0; i < actualNumBuckets; i++) {
    const bucketTime = startTime + (i * bucketSize);
    buckets.push({
      timestamp: bucketTime,
      promptCount: 0,
      codeChanges: 0,
      fileCount: 0
    });
  }
  
  // Assign items to buckets based on their timestamp
  allPrompts.forEach(prompt => {
    const promptTime = new Date(prompt.timestamp).getTime();
    if (promptTime < startTime || promptTime > now) return; // Outside range
    
    const bucketIndex = Math.floor((promptTime - startTime) / bucketSize);
    if (bucketIndex >= 0 && bucketIndex < buckets.length) {
      buckets[bucketIndex].promptCount++;
    }
  });
  
  allEvents.forEach(event => {
    const eventTime = new Date(event.timestamp).getTime();
    if (eventTime < startTime || eventTime > now) return; // Outside range
    
    const bucketIndex = Math.floor((eventTime - startTime) / bucketSize);
    if (bucketIndex >= 0 && bucketIndex < buckets.length) {
      buckets[bucketIndex].fileCount++;
      let changeSize = 0;
      try {
        const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
        if (details.chars_added) changeSize += details.chars_added;
        if (details.chars_deleted) changeSize += details.chars_deleted;
      } catch (e) {
        changeSize = 100;
      }
      buckets[bucketIndex].codeChanges += changeSize / 1024;
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
            <div style="margin-bottom: var(--space-md);">
              Data is loaded (${allPrompts.length} prompts, ${allEvents.length} events) but no activity in the selected time window.
            </div>
            <div style="font-size: var(--text-xs); color: var(--color-text-subtle);">
              Available history: ${daysSpan > 0 ? `${daysSpan.toFixed(1)} day${daysSpan !== 1 ? 's' : ''}` : 'less than a day'} of data
            </div>
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
        if (timeUnit === 'hourly') {
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
          // Daily: show day and date
          return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
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
            title: function(context) {
              const date = new Date(buckets[context[0].dataIndex].timestamp);
              if (timeUnit === 'hourly') {
                return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
              } else {
                return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
              }
            },
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              if (context.dataset.yAxisID === 'y-prompts') {
                label += context.parsed.y + ' prompt' + (context.parsed.y !== 1 ? 's' : '');
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
  if (prompts.length === 0) {
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
  
  const now = Date.now();
  let hours = hoursParam;
  
  // Auto-detect appropriate time range if requested time has no data
  // Check if there's any data in the requested window
  const requestedWindowStart = now - (hours * 60 * 60 * 1000);
  const hasDataInWindow = prompts.some(p => {
    const promptTime = new Date(p.timestamp).getTime();
    return promptTime >= requestedWindowStart;
  });
  
  // If no data in requested window, try longer ranges
  if (!hasDataInWindow && hoursParam === 24) {
    const timeRanges = [72, 168, 720]; // 3d, 7d, 30d
    for (const range of timeRanges) {
      const windowStart = now - (range * 60 * 60 * 1000);
      if (prompts.some(p => new Date(p.timestamp).getTime() >= windowStart)) {
        hours = range;
        // Update the active button to reflect the auto-selected range
        setTimeout(() => {
          updateContextChartTimescale(hours, true); // true = don't re-render
        }, 100);
        break;
      }
    }
  }
  
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
      
      // Check multiple sources for context usage
      let contextUsage = prompt.contextUsage || prompt.context_usage || 0;
      
      // If no direct contextUsage, try to estimate from file count
      if (contextUsage === 0) {
        const contextFileCount = prompt.context_file_count || prompt.contextFileCount || 0;
        const atFileCount = prompt.atFiles?.length || 0;
        const contextFiles = prompt.contextFiles?.attachedFiles?.length || prompt.contextFiles?.codebaseFiles?.length || 0;
        
        // Estimate: roughly 2-5% per file referenced
        const totalFileRefs = contextFileCount || atFileCount || contextFiles;
        if (totalFileRefs > 0) {
          contextUsage = Math.min(100, totalFileRefs * 3); // Estimate 3% per file
        } else {
          // Check for @ references in text
          const atMatches = (text.match(/@\w+/g) || []).length;
          if (atMatches > 0) {
            contextUsage = Math.min(100, atMatches * 5); // Estimate 5% per @ reference
          }
        }
      }
      
      buckets[bucketIndex].charCount += charCount;
      if (contextUsage > 0) {
        buckets[bucketIndex].contextUsage += contextUsage;
        buckets[bucketIndex].contextCount += 1;
      }
      buckets[bucketIndex].count += 1;
    }
  });
  
  // Check if we have any prompts with context data
  const hasContextData = buckets.some(b => b.contextCount > 0);
  const hasAnyData = buckets.some(b => b.count > 0);
  
  if (!hasAnyData) {
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
  
  // Show helpful message if no context data but there are prompts
  if (!hasContextData) {
    canvas.style.display = 'none';
    const container = canvas.parentElement;
    const timeLabel = hours === 24 ? '24 hours' : hours === 72 ? '3 days' : hours === 168 ? '7 days' : hours === 720 ? '30 days' : `${hours} hours`;
    
    // Count prompts with context in the time window
    const windowStart = now - (hours * 60 * 60 * 1000);
    const promptsInWindow = prompts.filter(p => {
      const promptTime = new Date(p.timestamp).getTime();
      return promptTime >= windowStart;
    });
    
    const promptsWithContext = promptsInWindow.filter(p => {
      const contextUsage = p.contextUsage || p.context_usage || 0;
      const contextFileCount = p.context_file_count || p.contextFileCount || 0;
      const atFiles = p.atFiles?.length || 0;
      const atMatches = ((p.text || p.prompt || p.preview || '').match(/@\w+/g) || []).length;
      return contextUsage > 0 || contextFileCount > 0 || atFiles > 0 || atMatches > 0;
    });
    
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 250px; text-align: center; padding: var(--space-lg);">
        <div style="font-size: var(--text-md); font-weight: 500; color: var(--color-text); margin-bottom: var(--space-xs);">No Context Data Available</div>
        <div style="font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-md);">
          No prompts with context data in the last ${timeLabel}. Try selecting a longer time range (3d, 7d, or 30d) or wait for new activity.
        </div>
        <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-xs);">
          Prompts in window: ${promptsInWindow.length} | With context: ${promptsWithContext.length}
        </div>
        <div style="font-size: var(--text-xs); color: var(--color-text-muted);">
          Total prompts: ${prompts.length}
        </div>
      </div>
    `;
    return;
  }

  const avgContextUsage = buckets.map(b => 
    b.contextCount > 0 ? b.contextUsage / b.contextCount : 0
  );

  const maxContextUsage = Math.max(...avgContextUsage.filter(v => v > 0));
  // Note: hasContextData already declared above (line 476), reuse it
  // hasContextData is already true at this point since we passed the check at line 492
  
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

  // Format labels based on time range
  const formatLabel = (timestamp) => {
    const date = new Date(timestamp);
    if (hours <= 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (hours <= 168) {
      // 7 days or less: show day and time
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      // 30 days: show date and time
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' });
    }
  };

  window.createChart('promptTokensChart', {
    type: 'line',
    data: {
      labels: buckets.map(b => formatLabel(b.timestamp)),
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

function updateContextChartTimescale(hours, skipRender = false) {
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
  
  if (!skipRender && window.renderPromptTokensChart) {
    window.renderPromptTokensChart(hours);
  }
}

function renderPromptEffectiveness() {
  const container = document.getElementById('promptEffectiveness');
  if (!container) {
    console.warn('[CHART] promptEffectiveness container not found');
    return;
  }

  const prompts = window.state?.data?.prompts || [];
  const events = window.state?.data?.events || [];
  
  if (prompts.length === 0 && events.length === 0) {
    container.innerHTML = '<div style="padding: var(--space-xl); text-align: center; color: var(--color-text-muted);">No prompt or event data available</div>';
    return;
  }

  // Find linked prompts (prompts with code changes within 5-15 minutes)
  const linkedPrompts = [];
  const unlinkedPrompts = [];
  
  prompts.forEach(prompt => {
    const promptTime = new Date(prompt.timestamp).getTime();
    // Check for related events within 15 minutes (before or after)
    const relatedEvents = events.filter(event => {
      const eventTime = new Date(event.timestamp).getTime();
      const timeDiff = Math.abs(eventTime - promptTime);
      return timeDiff <= 15 * 60 * 1000; // 15 minutes
    });
    
    if (relatedEvents.length > 0) {
      const timeToFirstChange = Math.min(...relatedEvents.map(e => Math.abs(new Date(e.timestamp).getTime() - promptTime)));
      linkedPrompts.push({
        prompt,
        timeToChange: timeToFirstChange / 1000 / 60, // minutes
        eventCount: relatedEvents.length,
        success: true
      });
    } else {
      unlinkedPrompts.push(prompt);
    }
  });

  // Calculate metrics
  const totalPrompts = prompts.length;
  const successCount = linkedPrompts.length;
  const successRate = totalPrompts > 0 ? (successCount / totalPrompts * 100).toFixed(1) : 0;
  const avgTimeToChange = linkedPrompts.length > 0 
    ? (linkedPrompts.reduce((sum, p) => sum + p.timeToChange, 0) / linkedPrompts.length).toFixed(1)
    : 0;
  const medianTimeToChange = linkedPrompts.length > 0
    ? linkedPrompts.sort((a, b) => a.timeToChange - b.timeToChange)[Math.floor(linkedPrompts.length / 2)]?.timeToChange.toFixed(1) || 0
    : 0;

  // Time distribution buckets
  const timeBuckets = {
    '0-2 min': 0,
    '2-5 min': 0,
    '5-10 min': 0,
    '10-15 min': 0,
    '>15 min': 0
  };

  linkedPrompts.forEach(p => {
    const time = p.timeToChange;
    if (time <= 2) timeBuckets['0-2 min']++;
    else if (time <= 5) timeBuckets['2-5 min']++;
    else if (time <= 10) timeBuckets['5-10 min']++;
    else if (time <= 15) timeBuckets['10-15 min']++;
    else timeBuckets['>15 min']++;
  });

  // Calculate iteration patterns (prompts followed by more prompts)
  const iterationPatterns = [];
  prompts.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  for (let i = 0; i < prompts.length - 1; i++) {
    const current = prompts[i];
    const next = prompts[i + 1];
    const timeDiff = (new Date(next.timestamp) - new Date(current.timestamp)) / 1000 / 60; // minutes
    if (timeDiff < 10) { // Within 10 minutes
      iterationPatterns.push(timeDiff);
    }
  }
  const avgIterations = iterationPatterns.length > 0
    ? (iterationPatterns.reduce((a, b) => a + b, 0) / iterationPatterns.length).toFixed(1)
    : 0;

  const colors = getChartColors();

  container.innerHTML = `
    <div style="display: grid; gap: var(--space-lg);">
      <!-- Key Metrics -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--space-md);">
        <div style="padding: var(--space-md); background: var(--color-surface); border-radius: var(--radius-md); border: 1px solid var(--color-border);">
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-xs);">Success Rate</div>
          <div style="font-size: var(--text-2xl); font-weight: 600; color: ${successRate >= 50 ? colors.success : colors.warning};">${successRate}%</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">${successCount} of ${totalPrompts} prompts</div>
        </div>
        <div style="padding: var(--space-md); background: var(--color-surface); border-radius: var(--radius-md); border: 1px solid var(--color-border);">
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-xs);">Avg Time to Change</div>
          <div style="font-size: var(--text-2xl); font-weight: 600; color: var(--color-text);">${avgTimeToChange} min</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">Median: ${medianTimeToChange} min</div>
        </div>
        <div style="padding: var(--space-md); background: var(--color-surface); border-radius: var(--radius-md); border: 1px solid var(--color-border);">
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-xs);">Iteration Patterns</div>
          <div style="font-size: var(--text-2xl); font-weight: 600; color: var(--color-text);">${iterationPatterns.length}</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">Avg: ${avgIterations} min apart</div>
        </div>
        <div style="padding: var(--space-md); background: var(--color-surface); border-radius: var(--radius-md); border: 1px solid var(--color-border);">
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-xs);">Unlinked Prompts</div>
          <div style="font-size: var(--text-2xl); font-weight: 600; color: ${unlinkedPrompts.length > totalPrompts * 0.3 ? colors.warning : colors.text};">${unlinkedPrompts.length}</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">${totalPrompts > 0 ? ((unlinkedPrompts.length / totalPrompts) * 100).toFixed(1) : 0}% of total</div>
        </div>
      </div>

      <!-- Time Distribution Chart -->
      <div>
        <h4 style="font-size: var(--text-base); margin-bottom: var(--space-md); color: var(--color-text);">Time to Implementation Distribution</h4>
        <canvas id="timeToChangeChart" style="max-height: 200px;"></canvas>
      </div>
    </div>
  `;

  // Render time distribution chart
  setTimeout(() => {
    const canvas = document.getElementById('timeToChangeChart');
    if (canvas && window.createChart) {
      window.createChart(canvas, {
        type: 'bar',
        data: {
          labels: Object.keys(timeBuckets),
          datasets: [{
            label: 'Prompts',
            data: Object.values(timeBuckets),
            backgroundColor: [
              colors.success,
              colors.primary,
              colors.secondary,
              colors.accent,
              colors.warning
            ]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return `${context.parsed.y} prompts (${context.parsed.y > 0 ? ((context.parsed.y / successCount) * 100).toFixed(1) : 0}%)`;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { color: 'var(--color-text-muted)', font: { size: 11 } },
              grid: { color: 'var(--color-border)' }
            },
            x: {
              ticks: { color: 'var(--color-text-muted)', font: { size: 11 } },
              grid: { display: false }
            }
          }
        }
      });
    }
  }, 100);
}

// Export to window for global access
window.renderFileTypesChart = renderFileTypesChart;
window.renderHourlyChart = renderHourlyChart;
window.renderPromptEffectiveness = renderPromptEffectiveness;
window.renderAIActivityChart = renderAIActivityChart;
window.renderPromptTokensChart = renderPromptTokensChart;
window.updateContextChartTimescale = updateContextChartTimescale;

