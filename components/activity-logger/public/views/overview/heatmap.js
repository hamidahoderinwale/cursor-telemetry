/**
 * Activity Heatmap Component for Overview
 * GitHub-inspired contribution graph showing development activity over time
 */

/**
 * Generate heatmap data for a year (or configurable period)
 * Returns data organized by weeks and days
 */
function generateYearHeatmapData(weeks = 53) {
  const events = window.state?.data?.events || [];
  const prompts = window.state?.data?.prompts || [];
  const terminalCommands = window.state?.data?.terminalCommands || [];
  
  // Initialize heatmap: weeks × 7 days
  // Each cell contains: { count: 0, linesAdded: 0, linesRemoved: 0, date: Date }
  const heatmap = [];
  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;
  
  // Start from today and go back (weeks * 7) days
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - (weeks * 7));
  
  // Align to Sunday (start of week)
  const startDay = startDate.getDay();
  startDate.setDate(startDate.getDate() - startDay);
  
  // Initialize all weeks
  for (let week = 0; week < weeks; week++) {
    const weekData = [];
    for (let day = 0; day < 7; day++) {
      const cellDate = new Date(startDate);
      const daysOffset = week * 7 + day;
      cellDate.setDate(cellDate.getDate() + daysOffset);
      
      weekData.push({
        count: 0,
        events: 0,
        prompts: 0,
        terminal: 0,
        linesAdded: 0,
        linesRemoved: 0,
        date: new Date(cellDate),
        isToday: cellDate.toDateString() === now.toDateString(),
        isFuture: cellDate > now
      });
    }
    heatmap.push(weekData);
  }
  
  // Process all activities
  const allActivities = [
    ...events.map(e => ({ 
      time: new Date(e.timestamp).getTime(), 
      type: 'event',
      event: e
    })),
    ...prompts.map(p => ({ 
      time: new Date(p.timestamp).getTime(), 
      type: 'prompt',
      prompt: p
    })),
    ...terminalCommands.map(c => ({ 
      time: new Date(c.timestamp || c.created_at).getTime(), 
      type: 'terminal',
      command: c
    }))
  ];
  
  allActivities.forEach(activity => {
    const activityDate = new Date(activity.time);
    const daysSinceStart = Math.floor((activityDate - startDate) / oneDay);
    
    if (daysSinceStart >= 0 && daysSinceStart < (weeks * 7)) {
      const week = Math.floor(daysSinceStart / 7);
      const day = daysSinceStart % 7;
      
      if (week >= 0 && week < weeks && day >= 0 && day < 7) {
        const cell = heatmap[week][day];
        cell.count++;
        
        // Track activity types separately
        if (activity.type === 'event') {
          cell.events++;
        } else if (activity.type === 'prompt') {
          cell.prompts++;
        } else if (activity.type === 'terminal') {
          cell.terminal++;
        }
        
        // Extract line change data from events
        if (activity.type === 'event' && activity.event) {
          try {
            const details = typeof activity.event.details === 'string' 
              ? JSON.parse(activity.event.details) 
              : activity.event.details;
            const linesAdded = details?.lines_added || details?.diff_stats?.lines_added || 0;
            const linesRemoved = details?.lines_removed || details?.diff_stats?.lines_removed || 0;
            
            cell.linesAdded += linesAdded;
            cell.linesRemoved += linesRemoved;
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }
    }
  });
  
  return { heatmap, startDate, weeks };
}

/**
 * Get GitHub-style color based on activity level
 * Colors: #ebedf0 (none), #9be9a8 (low), #40c463 (medium), #30a14e (high), #216e39 (very high)
 * Uses logarithmic scaling for better visual distribution
 */
function getGitHubColor(intensity) {
  // intensity: 0-1 (0 = no activity, 1 = max activity)
  // Apply logarithmic scaling for better distribution
  const logIntensity = intensity > 0 ? Math.log1p(intensity * 9) / Math.log(10) : 0;
  
  if (logIntensity === 0) return '#ebedf0'; // Light gray - no activity
  if (logIntensity < 0.2) return '#9be9a8'; // Light green - low activity
  if (logIntensity < 0.4) return '#40c463';  // Medium green - medium activity
  if (logIntensity < 0.6) return '#30a14e';  // Dark green - high activity
  return '#216e39'; // Very dark green - very high activity
}

/**
 * Render GitHub-style activity heatmap
 */
function renderActivityHeatmap(container) {
  if (!container) return;
  
  const { heatmap, startDate, weeks } = generateYearHeatmapData(53);
  
  // Calculate max values for normalization (use logarithmic scaling for better distribution)
  const allCounts = heatmap.flatMap(week => week.map(cell => cell.count));
  const maxCount = Math.max(...allCounts, 1);
  const totalActivities = allCounts.reduce((sum, count) => sum + count, 0);
  
  // Show empty state if no data
  if (totalActivities === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 3rem; text-align: center;">
        <div class="empty-state-text" style="font-size: 1.1rem; font-weight: 500; margin-bottom: 0.5rem; font-style: normal;">No activity data available</div>
        <div class="empty-state-hint" style="font-size: 0.9rem; color: var(--color-text-muted); font-style: normal;">
          Start coding to see your activity heatmap. Make sure the companion service is running.
        </div>
      </div>
    `;
    return;
  }
  
  // Calculate percentiles for better legend
  const sortedCounts = [...allCounts].sort((a, b) => a - b);
  const p25 = sortedCounts[Math.floor(sortedCounts.length * 0.25)] || 0;
  const p50 = sortedCounts[Math.floor(sortedCounts.length * 0.5)] || 0;
  const p75 = sortedCounts[Math.floor(sortedCounts.length * 0.75)] || 0;
  
  // Month labels - track which months we've seen
  const monthLabels = [];
  const monthPositions = new Map();
  let currentMonth = -1;
  
  for (let week = 0; week < weeks; week++) {
    const firstDayOfWeek = heatmap[week][0].date;
    const month = firstDayOfWeek.getMonth();
    
    if (month !== currentMonth) {
      const monthName = firstDayOfWeek.toLocaleDateString('en-US', { month: 'short' });
      monthLabels.push({ week, month: monthName });
      monthPositions.set(week, monthLabels.length - 1);
      currentMonth = month;
    }
  }
  
  let html = '<div class="github-heatmap">';
  
  // Header with month labels
  html += '<div class="heatmap-header">';
  html += '<div class="heatmap-months-row">';
  
  let lastMonthIndex = -1;
  for (let week = 0; week < weeks; week++) {
    const monthIndex = monthPositions.get(week);
    if (monthIndex !== undefined && monthIndex !== lastMonthIndex) {
      // Calculate how many weeks this month spans
      let monthWeeks = 1;
      for (let w = week + 1; w < weeks; w++) {
        if (monthPositions.get(w) === monthIndex) {
          monthWeeks++;
        } else {
          break;
        }
      }
      
      html += `<div class="heatmap-month-label" style="grid-column: ${week + 1} / span ${monthWeeks};">${monthLabels[monthIndex].month}</div>`;
      lastMonthIndex = monthIndex;
    }
  }
  
  html += '</div>';
  html += '</div>';
  
  // Main heatmap grid
  html += '<div class="heatmap-content">';
  html += '<div class="heatmap-grid">';
  
  // Render weeks (columns)
  for (let week = 0; week < weeks; week++) {
    html += '<div class="heatmap-week-column">';
    
    // Render days (rows) for this week
    for (let day = 0; day < 7; day++) {
      const cell = heatmap[week][day];
      const { count, events, prompts, terminal, linesAdded, linesRemoved, date, isToday, isFuture } = cell;
      
      // Calculate intensity (0-1) with logarithmic scaling
      const intensity = maxCount > 0 ? Math.min(count / maxCount, 1) : 0;
      const color = isFuture ? '#f3f4f6' : getGitHubColor(intensity);
      
      // Build enhanced tooltip with activity breakdown
      const dateStr = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      let tooltip = `${dateStr}`;
      if (isFuture) {
        tooltip += '\nFuture date';
      } else if (count === 0) {
        tooltip += '\nNo activity';
      } else {
        tooltip += `\n${count} contribution${count !== 1 ? 's' : ''}`;
        
        // Activity breakdown
        const parts = [];
        if (events > 0) parts.push(`${events} file change${events !== 1 ? 's' : ''}`);
        if (prompts > 0) parts.push(`${prompts} AI prompt${prompts !== 1 ? 's' : ''}`);
        if (terminal > 0) parts.push(`${terminal} terminal command${terminal !== 1 ? 's' : ''}`);
        
        if (parts.length > 0) {
          tooltip += '\n' + parts.join(', ');
        }
        
        // Line changes
        if (linesAdded > 0 || linesRemoved > 0) {
          tooltip += `\n${linesAdded > 0 ? '+' + linesAdded.toLocaleString() : ''}${linesAdded > 0 && linesRemoved > 0 ? ' / ' : ''}${linesRemoved > 0 ? '-' + linesRemoved.toLocaleString() : ''} lines`;
        }
      }
      
      // Build data attributes for better interactivity
      const cellClasses = [
        'heatmap-cell',
        isToday ? 'today' : '',
        isFuture ? 'future' : '',
        count === 0 ? 'no-activity' : '',
        count > 0 && count <= p25 ? 'low-activity' : '',
        count > p25 && count <= p50 ? 'medium-activity' : '',
        count > p50 && count <= p75 ? 'high-activity' : '',
        count > p75 ? 'very-high-activity' : ''
      ].filter(Boolean).join(' ');
      
      html += `<div class="${cellClasses}" 
                    style="--cell-color: ${color}; transition: all 0.2s ease;" 
                    title="${tooltip.replace(/\n/g, ' • ')}"
                    data-date="${date.toISOString()}"
                    data-count="${count}"
                    data-events="${events}"
                    data-prompts="${prompts}"
                    data-terminal="${terminal}"
                    data-lines-added="${linesAdded}"
                    data-lines-removed="${linesRemoved}">
              </div>`;
    }
    
    html += '</div>';
  }
  
  html += '</div>'; // heatmap-grid
  html += '</div>'; // heatmap-content
  
  // Enhanced Legend with activity summary
  const activeDays = allCounts.filter(count => count > 0).length;
  const avgPerDay = activeDays > 0 ? (totalActivities / activeDays).toFixed(1) : 0;
  
  html += '<div class="heatmap-legend">';
  html += '<div class="legend-content">';
  html += '<div class="legend-text">';
  html += '<span class="legend-label">Less</span>';
  html += '<div class="legend-cells">';
  for (let i = 0; i <= 4; i++) {
    const intensity = i / 4;
    const color = getGitHubColor(intensity);
    const label = i === 0 ? 'No' : i === 1 ? 'Low' : i === 2 ? 'Medium' : i === 3 ? 'High' : 'Very high';
    html += `<div class="legend-cell" style="--cell-color: ${color};" title="${label} activity"></div>`;
  }
  html += '</div>';
  html += '<span class="legend-label">More</span>';
  html += '</div>';
  html += '<div class="legend-stats">';
  html += `<span class="legend-stat">${totalActivities.toLocaleString()} total activities</span>`;
  html += `<span class="legend-stat">${activeDays} active days</span>`;
  html += `<span class="legend-stat">~${avgPerDay} avg/day</span>`;
  html += '</div>';
  html += '</div>';
  html += '</div>';
  
  html += '</div>'; // github-heatmap
  
  container.innerHTML = html;
  
  // Add click handlers for cell interaction
  container.querySelectorAll('.heatmap-cell:not(.future)').forEach(cell => {
    cell.addEventListener('click', () => {
      const dateStr = cell.dataset.date;
      const count = parseInt(cell.dataset.count);
      
      if (count > 0 && dateStr) {
        const targetDate = new Date(dateStr);
        const startTime = new Date(targetDate);
        startTime.setHours(0, 0, 0, 0);
        const endTime = new Date(targetDate);
        endTime.setHours(23, 59, 59, 999);
        
        // Store filter and switch view
        if (window.state) {
          window.state.activityHeatmapFilter = {
            start: startTime.getTime(),
            end: endTime.getTime()
          };
        }
        
        if (window.switchView) {
          window.switchView('activity');
        }
      }
    });
  });
  
  // Enhanced hover effects with scale and shadow
  container.querySelectorAll('.heatmap-cell').forEach(cell => {
    cell.addEventListener('mouseenter', function() {
      if (!this.classList.contains('future')) {
        this.style.transform = 'scale(1.15)';
        this.style.zIndex = '10';
        this.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        this.style.outline = '2px solid var(--color-primary, #6366f1)';
        this.style.outlineOffset = '2px';
      }
    });
    
    cell.addEventListener('mouseleave', function() {
      this.style.transform = 'scale(1)';
      this.style.zIndex = '1';
      this.style.boxShadow = 'none';
      this.style.outline = 'none';
    });
  });
}

/**
 * Generate heatmap data from events, prompts, and terminal commands (legacy 7-day version)
 * @deprecated Use generateYearHeatmapData instead
 */
function generateHeatmapData(days = 7) {
  const events = window.state?.data?.events || [];
  const prompts = window.state?.data?.prompts || [];
  const terminalCommands = window.state?.data?.terminalCommands || [];
  
  const heatmap = Array(7).fill(null).map(() => 
    Array(24).fill(null).map(() => ({ count: 0, linesAdded: 0, linesRemoved: 0 }))
  );
  
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  events.forEach(event => {
    const eventTime = new Date(event.timestamp).getTime();
    const daysAgo = Math.floor((now - eventTime) / oneDay);
    
    if (daysAgo >= 0 && daysAgo < 7) {
      const dayIndex = 6 - daysAgo;
      const activityDate = new Date(eventTime);
      const hour = activityDate.getHours();
      
      if (dayIndex >= 0 && dayIndex < 7 && hour >= 0 && hour < 24) {
        const cell = heatmap[dayIndex][hour];
        cell.count++;
        
        try {
          const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
          const linesAdded = details?.lines_added || details?.diff_stats?.lines_added || 0;
          const linesRemoved = details?.lines_removed || details?.diff_stats?.lines_removed || 0;
          
          cell.linesAdded += linesAdded;
          cell.linesRemoved += linesRemoved;
        } catch (e) {
          // Ignore parsing errors
        }
      }
    }
  });
  
  const otherActivity = [
    ...prompts.map(p => ({ time: new Date(p.timestamp).getTime(), type: 'prompt' })),
    ...terminalCommands.map(c => ({ time: c.timestamp || new Date(c.timestamp).getTime(), type: 'terminal' }))
  ];
  
  otherActivity.forEach(activity => {
    const activityDate = new Date(activity.time);
    const daysAgo = Math.floor((now - activity.time) / oneDay);
    
    if (daysAgo >= 0 && daysAgo < 7) {
      const dayIndex = 6 - daysAgo;
      const hour = activityDate.getHours();
      
      if (dayIndex >= 0 && dayIndex < 7 && hour >= 0 && hour < 24) {
        heatmap[dayIndex][hour].count++;
      }
    }
  });
  
  return heatmap;
}

/**
 * Get heatmap color based on intensity (0-1) - GitHub style
 */
function getHeatmapColor(intensity) {
  return getGitHubColor(intensity);
}

/**
 * Get heatmap color with blend based on additions (green) and deletions (red)
 * @deprecated Using GitHub-style colors now, but keeping for compatibility
 */
function getHeatmapColorBlend(count, linesAdded, linesRemoved, maxCount, maxTotalLines) {
  if (count === 0 && linesAdded === 0 && linesRemoved === 0) {
    return '#ebedf0';
  }
  
  const countIntensity = Math.min(count / Math.max(maxCount, 1), 1);
  return getGitHubColor(countIntensity);
}

// Export to window for global access
window.renderActivityHeatmap = renderActivityHeatmap;
window.generateHeatmapData = generateHeatmapData;
window.generateYearHeatmapData = generateYearHeatmapData;
window.getHeatmapColor = getHeatmapColor;
window.getHeatmapColorBlend = getHeatmapColorBlend;
window.getGitHubColor = getGitHubColor;
