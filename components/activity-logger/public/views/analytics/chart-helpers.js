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
    // Silently return if canvas not found (view might not be active)
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
    // Silently return if canvas not found (view might not be active)
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

function renderAIActivityChart(timeScale = null) {
  const canvas = document.getElementById('aiActivityChart');
  if (!canvas) return;
  
  const allEvents = window.state.data.events || [];
  const allPrompts = window.state.data.prompts || [];
  
  console.log('[CHART-DEBUG] AI Activity Chart rendering with:', {
    totalEvents: allEvents.length,
    totalPrompts: allPrompts.length,
    timeScale: timeScale || 'auto'
  });
  
  const now = Date.now();
  const oldestEvent = allEvents.length > 0 ? Math.min(...allEvents.map(e => new Date(e.timestamp).getTime())) : now;
  const oldestPrompt = allPrompts.length > 0 ? Math.min(...allPrompts.map(p => new Date(p.timestamp).getTime())) : now;
  const oldestData = Math.min(oldestEvent, oldestPrompt);
  
  // Calculate time span
  const timeSpan = now - oldestData;
  const daysSpan = timeSpan / (24 * 60 * 60 * 1000);
  
  // Determine time scale (use provided or auto-detect)
  let bucketSize, numBuckets, timeUnit, startTime;
  
  if (timeScale) {
    // Use provided time scale
    switch (timeScale) {
      case 'hourly':
        bucketSize = 60 * 60 * 1000; // 1 hour
        numBuckets = 24; // Last 24 hours
        timeUnit = 'hourly';
        startTime = now - (24 * 60 * 60 * 1000);
        break;
      case 'daily':
        bucketSize = 24 * 60 * 60 * 1000; // 1 day
        numBuckets = 30; // Last 30 days
        timeUnit = 'daily';
        startTime = now - (30 * 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        bucketSize = 7 * 24 * 60 * 60 * 1000; // 1 week
        numBuckets = 12; // Last 12 weeks (~3 months)
        timeUnit = 'weekly';
        startTime = now - (12 * 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        bucketSize = 30 * 24 * 60 * 60 * 1000; // ~1 month (30 days)
        numBuckets = 12; // Last 12 months
        timeUnit = 'monthly';
        startTime = now - (12 * 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        // Fallback to auto-detect
        timeScale = null;
    }
  }
  
  // Auto-detect if no time scale provided or invalid
  if (!timeScale) {
    if (daysSpan < 1) {
      // Less than 1 day: use hourly buckets for last 24 hours
      bucketSize = 60 * 60 * 1000; // 1 hour
      numBuckets = 24;
      timeUnit = 'hourly';
      startTime = now - (24 * 60 * 60 * 1000);
    } else if (daysSpan <= 7) {
      // 1-7 days: use daily buckets
      bucketSize = 24 * 60 * 60 * 1000; // 1 day
      numBuckets = Math.ceil(daysSpan) || 1; // Show all available days
      timeUnit = 'daily';
      startTime = oldestData;
    } else if (daysSpan <= 30) {
      // 7-30 days: show last 30 days
      bucketSize = 24 * 60 * 60 * 1000; // 1 day
      numBuckets = 30;
      timeUnit = 'daily';
      startTime = now - (30 * 24 * 60 * 60 * 1000);
    } else {
      // More than 30 days: use daily buckets for last 30 days
      bucketSize = 24 * 60 * 60 * 1000; // 1 day
      numBuckets = 30;
      timeUnit = 'daily';
      startTime = now - (30 * 24 * 60 * 60 * 1000);
    }
  }
  
  // Create buckets
  const buckets = [];
  const actualNumBuckets = Math.ceil((now - startTime) / bucketSize) || 1;
  
  // Create buckets from startTime to now
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
        } else if (timeUnit === 'daily') {
          return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
        } else if (timeUnit === 'weekly') {
          return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' - ' + 
                 new Date(b.timestamp + bucketSize).toLocaleDateString([], { month: 'short', day: 'numeric' });
        } else if (timeUnit === 'monthly') {
          return date.toLocaleDateString([], { month: 'short', year: 'numeric' });
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
            title: function(context) {
              const date = new Date(buckets[context[0].dataIndex].timestamp);
              if (timeUnit === 'hourly') {
                return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
              } else if (timeUnit === 'daily') {
                return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
              } else if (timeUnit === 'weekly') {
                const endDate = new Date(buckets[context[0].dataIndex].timestamp + bucketSize);
                return date.toLocaleDateString([], { month: 'long', day: 'numeric' }) + ' - ' + 
                       endDate.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
              } else if (timeUnit === 'monthly') {
                return date.toLocaleDateString([], { month: 'long', year: 'numeric' });
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
    // Silently return if container not found (view might not be active)
    return;
  }

  const prompts = window.state?.data?.prompts || [];
  const events = window.state?.data?.events || [];
  
  if (prompts.length === 0 && events.length === 0) {
    container.innerHTML = '<div style="padding: var(--space-xl); text-align: center; color: var(--color-text-muted);">No prompt or event data available</div>';
    return;
  }

  // Create event lookup map by ID for fast access
  const eventMap = new Map();
  events.forEach(event => {
    const eventId = event.id || event.entry_id;
    if (eventId) {
      eventMap.set(String(eventId), event);
      // Also index by numeric ID if different
      if (typeof eventId === 'string' && !isNaN(parseInt(eventId))) {
        eventMap.set(String(parseInt(eventId)), event);
      }
    }
  });

  // Find linked prompts using actual database links (linked_entry_id)
  const linkedPrompts = [];
  const unlinkedPrompts = [];
  const processedPromptIds = new Set();
  
  // Method 1: Check prompts with linked_entry_id (prompt -> entry link)
  prompts.forEach(prompt => {
    const promptId = prompt.id || prompt.prompt_id;
    if (processedPromptIds.has(promptId)) return;
    
    const linkedEntryId = prompt.linked_entry_id || prompt.linkedEntryId;
    const promptTime = new Date(prompt.timestamp).getTime();
    
    if (linkedEntryId) {
      // Find the linked event/entry
      const linkedEvent = eventMap.get(String(linkedEntryId));
      
      if (linkedEvent) {
        const eventTime = new Date(linkedEvent.timestamp).getTime();
        const timeToChange = (eventTime - promptTime) / 1000 / 60; // minutes (positive = event after prompt)
        
        // Only count if event happened after prompt (within reasonable time: 30 minutes)
        if (timeToChange >= 0 && timeToChange <= 30) {
          linkedPrompts.push({
            prompt,
            timeToChange: timeToChange,
            eventCount: 1,
            success: true,
            linkedEvent: linkedEvent
          });
          processedPromptIds.add(promptId);
          return;
        }
      }
    }
  });
  
  // Method 2: Check events with prompt_id (entry -> prompt link) - catch any we missed
  events.forEach(event => {
    const eventPromptId = event.prompt_id || event.promptId;
    if (!eventPromptId) return;
    
    // Find the linked prompt
    const linkedPrompt = prompts.find(p => {
      const pId = p.id || p.prompt_id;
      return String(pId) === String(eventPromptId) || parseInt(pId) === parseInt(eventPromptId);
    });
    
    if (linkedPrompt && !processedPromptIds.has(linkedPrompt.id || linkedPrompt.prompt_id)) {
      const promptTime = new Date(linkedPrompt.timestamp).getTime();
      const eventTime = new Date(event.timestamp).getTime();
      const timeToChange = (eventTime - promptTime) / 1000 / 60; // minutes
      
      // Only count if event happened after prompt (within reasonable time: 30 minutes)
      if (timeToChange >= 0 && timeToChange <= 30) {
        linkedPrompts.push({
          prompt: linkedPrompt,
          timeToChange: timeToChange,
          eventCount: 1,
          success: true,
          linkedEvent: event
        });
        processedPromptIds.add(linkedPrompt.id || linkedPrompt.prompt_id);
      }
    }
  });
  
  // Collect unlinked prompts (those not in processedPromptIds)
  prompts.forEach(prompt => {
    const promptId = prompt.id || prompt.prompt_id;
    if (!processedPromptIds.has(promptId)) {
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

  // Time distribution buckets (based on actual database-linked prompts)
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

  // Calculate iteration patterns (prompts in same conversation/thread)
  // Group prompts by conversation_id to find actual iterations
  const conversationGroups = new Map();
  prompts.forEach(prompt => {
    const convId = prompt.conversation_id || prompt.conversationId || 'no-conversation';
    if (!conversationGroups.has(convId)) {
      conversationGroups.set(convId, []);
    }
    conversationGroups.get(convId).push(prompt);
  });
  
  const iterationPatterns = [];
  conversationGroups.forEach((conversationPrompts, convId) => {
    // Only process conversations with 2+ prompts (actual iterations)
    if (conversationPrompts.length < 2) return;
    
    // Sort by timestamp within conversation
    conversationPrompts.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Calculate time differences between consecutive prompts in same conversation
    for (let i = 0; i < conversationPrompts.length - 1; i++) {
      const current = conversationPrompts[i];
      const next = conversationPrompts[i + 1];
      const timeDiff = (new Date(next.timestamp) - new Date(current.timestamp)) / 1000 / 60; // minutes
      
      // Only count if within reasonable iteration window (30 minutes)
      // and at least 0.1 minutes apart (to avoid same-timestamp issues)
      if (timeDiff >= 0.1 && timeDiff <= 30) {
        iterationPatterns.push(timeDiff);
      }
    }
  });
  
  const avgIterations = iterationPatterns.length > 0
    ? (iterationPatterns.reduce((a, b) => a + b, 0) / iterationPatterns.length).toFixed(1)
    : 'N/A';
  
  const iterationCount = conversationGroups.size > 0 
    ? Array.from(conversationGroups.values()).filter(conv => conv.length >= 2).length
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
          <div style="font-size: var(--text-2xl); font-weight: 600; color: var(--color-text);">${iterationCount}</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">${avgIterations !== 'N/A' ? `Avg: ${avgIterations} min apart` : 'No iterations found'}</div>
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

/**
 * Update AI Activity chart time scale
 */
function updateAIActivityChartTimescale(scale) {
  // Update button states
  const controls = document.getElementById('aiActivityTimescaleControls');
  if (controls) {
    controls.querySelectorAll('.btn-timescale').forEach(btn => {
      if (btn.dataset.scale === scale) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
  
  // Re-render chart with new time scale
  if (window.renderAIActivityChart) {
    window.renderAIActivityChart(scale);
  }
}

// Export to window for global access
/**
 * Render AI Model Usage Analytics
 * Shows model distribution and usage patterns with charts
 */
function renderModelUsageAnalytics() {
  const container = document.getElementById('modelUsageAnalytics');
  if (!container) {
    // Silently return if container not found (view might not be active)
    console.debug('[MODEL-USAGE] Container not found, skipping render');
    return;
  }

  try {
    const prompts = window.state?.data?.prompts || [];
    
    console.log('[MODEL-USAGE] Rendering with', prompts.length, 'prompts');
  
  if (prompts.length === 0) {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 250px; padding: var(--space-xl); text-align: center;">
        <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Data Available</div>
        <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Model usage data will appear as you use AI features in Cursor</div>
      </div>
    `;
    return;
  }

  // Parse model information from prompts
  const modelCounts = new Map();
  const modeCounts = new Map();
  const modelModeCombos = new Map();
  const modelTimeSeries = new Map(); // Track model usage over time
  
  // Helper to extract model name
  const getModelName = (p) => {
    // Try multiple sources for model information
    if (p.modelName) return p.modelName;
    if (p.model_name) return p.model_name;
    if (p.model) return p.model;
    if (p.modelInfo?.model) return p.modelInfo.model;
    if (p.modelInfo?.modelName) return p.modelInfo.modelName;
    if (p.modelInfo?.model_name) return p.modelInfo.model_name;
    if (p.metadata?.model) return p.metadata.model;
    
    // Try combining modelType and modelName
    const modelType = p.modelType || p.model_type || p.modelInfo?.modelType || p.modelInfo?.model_type;
    const modelName = p.modelName || p.model_name || p.modelInfo?.modelName || p.modelInfo?.model_name;
    if (modelType && modelName) return `${modelType}/${modelName}`;
    if (modelName) return modelName;
    if (modelType) return modelType;
    
    return 'Unknown';
  };
  
  // Helper to extract mode
  const getMode = (p) => {
    const rawMode = p.type || p.mode || p.metadata?.mode || null;
    
    // If no mode is found, return "Not Specified" (not to be confused with "Auto")
    if (!rawMode) {
      return 'Not Specified';
    }
    
    // Normalize the mode string
    const normalized = String(rawMode)
      .replace('user-prompt', 'User Prompt')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
    
    // Check if it's auto mode (case-insensitive)
    if (normalized.toLowerCase().includes('auto')) {
      return 'Auto';
    }
    
    return normalized;
  };

  prompts.forEach(p => {
    const modelName = getModelName(p);
    const mode = getMode(p);
    const timestamp = new Date(p.timestamp).getTime();
    
    // Count models
    modelCounts.set(modelName, (modelCounts.get(modelName) || 0) + 1);
    
    // Count modes
    modeCounts.set(mode, (modeCounts.get(mode) || 0) + 1);
    
    // Count model-mode combinations
    const combo = `${modelName} (${mode})`;
    modelModeCombos.set(combo, (modelModeCombos.get(combo) || 0) + 1);
    
    // Track model usage over time (by day)
    const day = new Date(timestamp).toDateString();
    if (!modelTimeSeries.has(modelName)) {
      modelTimeSeries.set(modelName, new Map());
    }
    const dayCounts = modelTimeSeries.get(modelName);
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
  });

  // Sort by frequency
  const sortedModels = Array.from(modelCounts.entries()).sort((a, b) => b[1] - a[1]);
  const sortedModes = Array.from(modeCounts.entries()).sort((a, b) => b[1] - a[1]);
  const sortedCombos = Array.from(modelModeCombos.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10); // Top 10

  // Log diagnostic info
  console.log('[MODEL-USAGE] Analysis complete:', {
    totalPrompts: prompts.length,
    uniqueModels: modelCounts.size,
    uniqueModes: modeCounts.size,
    topModels: sortedModels.slice(0, 5).map(([m, c]) => `${m}: ${c}`),
    topModes: sortedModes.slice(0, 5).map(([m, c]) => `${m}: ${c}`)
  });

  // Calculate statistics
  const totalPrompts = prompts.length;
  const uniqueModels = modelCounts.size;
  const uniqueModes = modeCounts.size;
  const mostUsedModel = sortedModels[0]?.[0] || 'N/A';
  const mostUsedModelCount = sortedModels[0]?.[1] || 0;
  const mostUsedMode = sortedModes[0]?.[0] || 'N/A';
  const mostUsedModeCount = sortedModes[0]?.[1] || 0;

  // Helper to escape HTML
  const escapeHtml = (text) => {
    if (typeof text !== 'string') return String(text);
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  // Generate color for model (consistent colors)
  const modelColors = [
    '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
  ];
  const getModelColor = (index) => modelColors[index % modelColors.length];

  // Mode colors
  const modeColors = {
    'Composer': '#10b981',
    'Chat': '#3b82f6',
    'Inline': '#f59e0b',
    'User Prompt': '#8b5cf6',
    'Auto': '#06b6d4',
    'Not Specified': '#6b7280'
  };
  const getModeColor = (mode) => modeColors[mode] || modeColors['Not Specified'];

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: var(--space-lg);">
      <!-- Statistics Summary -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--space-md);">
        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-md);">
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-xs);">Total Prompts</div>
          <div style="font-size: var(--text-2xl); font-weight: 700; color: var(--color-text);">${totalPrompts.toLocaleString()}</div>
        </div>
        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-md);">
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-xs);">Unique Models</div>
          <div style="font-size: var(--text-2xl); font-weight: 700; color: var(--color-text);">${uniqueModels}</div>
        </div>
        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-md);">
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-xs);">Most Used Model</div>
          <div style="font-size: var(--text-sm); font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(mostUsedModel)}">${escapeHtml(mostUsedModel)}</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 2px;">${mostUsedModelCount} prompts</div>
        </div>
        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-md);">
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-xs);">Most Used Mode</div>
          <div style="font-size: var(--text-sm); font-weight: 600; color: var(--color-text);">${escapeHtml(mostUsedMode)}</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 2px;">${mostUsedModeCount} prompts</div>
        </div>
      </div>

      <!-- Charts Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-lg);" class="model-usage-grid">
        <!-- Models Distribution -->
        <div>
          <h4 style="margin-bottom: var(--space-md); color: var(--color-text); font-size: var(--text-md); font-weight: 600;">Models Used</h4>
          <div style="display: flex; flex-direction: column; gap: var(--space-sm);">
            ${sortedModels.map(([model, count], index) => {
              const percentage = ((count / totalPrompts) * 100).toFixed(1);
              const color = getModelColor(index);
              return `
                <div style="display: flex; align-items: center; gap: var(--space-md); padding: var(--space-sm); background: var(--color-surface); border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
                  <div style="width: 12px; height: 12px; border-radius: 3px; background: ${color}; flex-shrink: 0;"></div>
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-size: var(--text-sm); color: var(--color-text); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(model)}">
                      ${escapeHtml(model)}
                    </div>
                    <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 2px;">
                      ${count.toLocaleString()} prompts • ${percentage}%
                    </div>
                  </div>
                  <div style="width: 120px; height: 10px; background: var(--color-bg); border-radius: 5px; overflow: hidden; flex-shrink: 0;">
                    <div style="width: ${percentage}%; height: 100%; background: ${color}; border-radius: 5px; transition: width 0.3s ease;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Usage by Mode -->
        <div>
          <h4 style="margin-bottom: var(--space-md); color: var(--color-text); font-size: var(--text-md); font-weight: 600;">Usage by Mode</h4>
          <div style="display: flex; flex-direction: column; gap: var(--space-sm);">
            ${sortedModes.map(([mode, count]) => {
              const percentage = ((count / totalPrompts) * 100).toFixed(1);
              const color = getModeColor(mode);
              return `
                <div style="display: flex; align-items: center; gap: var(--space-md); padding: var(--space-sm); background: var(--color-surface); border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
                  <div style="width: 12px; height: 12px; border-radius: 3px; background: ${color}; flex-shrink: 0;"></div>
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-size: var(--text-sm); color: var(--color-text); font-weight: 500;">
                      ${escapeHtml(mode)}
                    </div>
                    <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 2px;">
                      ${count.toLocaleString()} prompts • ${percentage}%
                    </div>
                  </div>
                  <div style="width: 120px; height: 10px; background: var(--color-bg); border-radius: 5px; overflow: hidden; flex-shrink: 0;">
                    <div style="width: ${percentage}%; height: 100%; background: ${color}; border-radius: 5px; transition: width 0.3s ease;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Model-Mode Combinations (Top 10) -->
      ${sortedCombos.length > 0 ? `
        <div>
          <h4 style="margin-bottom: var(--space-md); color: var(--color-text); font-size: var(--text-md); font-weight: 600;">Top Model-Mode Combinations</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--space-sm);">
            ${sortedCombos.map(([combo, count], index) => {
              const percentage = ((count / totalPrompts) * 100).toFixed(1);
              const color = getModelColor(index);
              return `
                <div style="padding: var(--space-sm); background: var(--color-surface); border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
                  <div style="font-size: var(--text-xs); color: var(--color-text); font-weight: 500; margin-bottom: var(--space-xs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(combo)}">
                    ${escapeHtml(combo)}
                  </div>
                  <div style="display: flex; align-items: center; gap: var(--space-xs);">
                    <div style="flex: 1; height: 6px; background: var(--color-bg); border-radius: 3px; overflow: hidden;">
                      <div style="width: ${percentage}%; height: 100%; background: ${color}; border-radius: 3px;"></div>
                    </div>
                    <div style="font-size: var(--text-xs); color: var(--color-text-muted); white-space: nowrap;">
                      ${count} (${percentage}%)
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
  } catch (error) {
    console.error('[CHART] Error rendering Model Usage Analytics:', error);
    console.error('[CHART] Error stack:', error.stack);
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 250px; padding: var(--space-xl); text-align: center;">
        <div style="font-size: var(--text-lg); color: var(--color-error); margin-bottom: var(--space-xs); font-weight: 500;">Error Loading Data</div>
        <div style="font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-sm);">Unable to render model usage analytics. Please refresh the page.</div>
        <div style="font-size: var(--text-xs); color: var(--color-text-subtle); font-family: var(--font-mono); padding: var(--space-sm); background: var(--color-surface); border-radius: var(--radius-sm); max-width: 500px; word-break: break-word;">
          ${error.message || 'Unknown error'}
        </div>
        <div style="margin-top: var(--space-md); font-size: var(--text-xs); color: var(--color-text-muted);">
          <button onclick="if(window.diagnoseModelUsageData) window.diagnoseModelUsageData(); else console.log('Diagnostics not available')" style="padding: var(--space-xs) var(--space-sm); background: var(--color-primary); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer;">
            Run Diagnostics
          </button>
        </div>
      </div>
    `;
  }
}

window.renderFileTypesChart = renderFileTypesChart;
window.renderHourlyChart = renderHourlyChart;
window.renderPromptEffectiveness = renderPromptEffectiveness;
window.renderAIActivityChart = renderAIActivityChart;
window.renderPromptTokensChart = renderPromptTokensChart;
window.renderModelUsageAnalytics = renderModelUsageAnalytics;
window.updateContextChartTimescale = updateContextChartTimescale;
window.updateAIActivityChartTimescale = updateAIActivityChartTimescale;

