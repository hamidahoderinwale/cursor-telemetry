/**
 * Activity Heatmap Component for Overview
 * Renders a 7-day activity heatmap showing intensity of development activity
 */

/**
 * Generate heatmap data from events, prompts, and terminal commands
 * Returns data with activity counts, lines added, and lines removed per hour
 */
function generateHeatmapData(days = 7) {
  const events = window.state?.data?.events || [];
  const prompts = window.state?.data?.prompts || [];
  const terminalCommands = window.state?.data?.terminalCommands || [];
  
  // Initialize heatmap grid: 7 days × 24 hours
  // Each cell contains: { count: 0, linesAdded: 0, linesRemoved: 0 }
  const heatmap = Array(7).fill(null).map(() => 
    Array(24).fill(null).map(() => ({ count: 0, linesAdded: 0, linesRemoved: 0 }))
  );
  
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  // Process events (which have line change data)
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
        
        // Extract line change data from event
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
  
  // Process prompts and terminal commands (count only, no line changes)
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
 * Render activity heatmap
 */
function renderActivityHeatmap(container) {
  if (!container) return;
  
  const heatmap = generateHeatmapData(7);
  
  // Calculate max values for normalization
  const maxCount = Math.max(...heatmap.flat().map(cell => cell.count), 1);
  const maxLinesAdded = Math.max(...heatmap.flat().map(cell => cell.linesAdded), 1);
  const maxLinesRemoved = Math.max(...heatmap.flat().map(cell => cell.linesRemoved), 1);
  const maxTotalLines = Math.max(maxLinesAdded, maxLinesRemoved, 1);
  
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // Get today's day of week (0 = Sunday)
  const today = new Date().getDay();
  
  // Calculate which day each row represents (most recent first)
  const getDayLabel = (rowIndex) => {
    const dayOffset = 6 - rowIndex;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - dayOffset);
    const dayOfWeek = targetDate.getDay();
    const isToday = dayOffset === 0;
    const dateStr = targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { day: days[dayOfWeek], fullName: dayNames[dayOfWeek], date: dateStr, isToday };
  };
  
  let html = '<div class="activity-heatmap">';
  
  // Header with hour labels
  html += '<div class="heatmap-header">';
  html += '<div class="heatmap-day-column"></div>'; // Empty corner
  html += '<div class="heatmap-hours-row">';
  for (let hour = 0; hour < 24; hour++) {
    if (hour % 3 === 0) { // Show every 3 hours to avoid clutter
      html += `<div class="heatmap-hour-label" style="grid-column: ${hour + 1} / span 3;">${hour}:00</div>`;
    }
  }
  html += '</div>';
  html += '</div>';
  
  // Heatmap grid
  html += '<div class="heatmap-grid">';
  
  heatmap.forEach((dayData, rowIndex) => {
    const dayInfo = getDayLabel(rowIndex);
    
    html += '<div class="heatmap-row">';
    
    // Day label
    html += `<div class="heatmap-day-label ${dayInfo.isToday ? 'today' : ''}" title="${dayInfo.fullName}, ${dayInfo.date}">`;
    html += `<span class="day-name">${dayInfo.day}</span>`;
    html += `<span class="day-date">${dayInfo.date}</span>`;
    html += '</div>';
    
    // Hour cells
    dayData.forEach((cellData, hourIndex) => {
      const { count, linesAdded, linesRemoved } = cellData;
      
      // Calculate color based on additions/deletions blend and activity intensity
      const color = getHeatmapColorBlend(count, linesAdded, linesRemoved, maxCount, maxTotalLines);
      
      // Build tooltip with detailed info
      let tooltip = `${dayInfo.fullName}, ${dayInfo.date} at ${hourIndex}:00`;
      if (count > 0) {
        tooltip += ` - ${count} activity${count !== 1 ? 's' : ''}`;
        if (linesAdded > 0 || linesRemoved > 0) {
          tooltip += ` (+${linesAdded} / -${linesRemoved} lines)`;
        }
      } else {
        tooltip += ' - No activity';
      }
      
      html += `<div class="heatmap-cell" 
                    style="background-color: ${color};" 
                    title="${tooltip}"
                    data-day="${rowIndex}"
                    data-hour="${hourIndex}"
                    data-count="${count}"
                    data-lines-added="${linesAdded}"
                    data-lines-removed="${linesRemoved}">
                ${count > 0 ? `<span class="heatmap-cell-value">${count}</span>` : ''}
              </div>`;
    });
    
    html += '</div>';
  });
  
  html += '</div>';
  
  // Legend
  html += '<div class="heatmap-legend">';
  html += '<div class="legend-section">';
  html += '<span class="legend-label">Activity Intensity</span>';
  html += '<div class="legend-gradient">';
  for (let i = 0; i <= 10; i++) {
    const intensity = i / 10;
    // Use neutral gray for intensity legend (darkness)
    const grayValue = Math.round(200 - (intensity * 100));
    const color = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
    html += `<div class="legend-cell" style="background-color: ${color};" title="${Math.round(intensity * maxCount)} activities"></div>`;
  }
  html += '</div>';
  html += '</div>';
  html += '<div class="legend-section">';
  html += '<span class="legend-label">Code Changes</span>';
  html += '<div class="legend-gradient">';
  // Show color blend: green (additions) → neutral → red (deletions)
  const legendSteps = 11;
  for (let i = 0; i < legendSteps; i++) {
    const ratio = i / (legendSteps - 1); // 0 = all deletions, 1 = all additions
    const color = getHeatmapColorBlend(maxCount, ratio * maxTotalLines, (1 - ratio) * maxTotalLines, maxCount, maxTotalLines);
    html += `<div class="legend-cell" style="background-color: ${color};" title="${ratio < 0.5 ? 'More deletions' : 'More additions'}"></div>`;
  }
  html += '</div>';
  html += '</div>';
  html += '</div>';
  
  html += '</div>';
  
  container.innerHTML = html;
  
  // Add click handlers for cell interaction
  container.querySelectorAll('.heatmap-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const day = parseInt(cell.dataset.day);
      const hour = parseInt(cell.dataset.hour);
      const count = parseInt(cell.dataset.count);
      
      if (count > 0) {
        // Switch to Activity view and filter to that time
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - (6 - day));
        targetDate.setHours(hour, 0, 0, 0);
        const endTime = new Date(targetDate);
        endTime.setHours(hour + 1, 0, 0, 0);
        
        // Store filter and switch view
        if (window.state) {
          window.state.activityHeatmapFilter = {
            start: targetDate.getTime(),
            end: endTime.getTime()
          };
        }
        
        if (window.switchView) {
          window.switchView('activity');
        }
      }
    });
  });
}

/**
 * Get heatmap color based on intensity (0-1)
 * @deprecated Use getHeatmapColorBlend instead
 */
function getHeatmapColor(intensity) {
  if (intensity === 0) return '#f3f4f6'; // Light gray for no activity
  
  // Color scale: light blue → blue → purple → red
  if (intensity < 0.25) {
    // Light blue
    const alpha = intensity * 4;
    return `rgba(59, 130, 246, ${0.2 + alpha * 0.3})`;
  } else if (intensity < 0.5) {
    // Blue
    const alpha = (intensity - 0.25) * 4;
    return `rgba(59, 130, 246, ${0.5 + alpha * 0.3})`;
  } else if (intensity < 0.75) {
    // Purple
    const alpha = (intensity - 0.5) * 4;
    return `rgba(139, 92, 246, ${0.5 + alpha * 0.3})`;
  } else {
    // Red/Orange for high activity
    const alpha = (intensity - 0.75) * 4;
    return `rgba(239, 68, 68, ${0.5 + alpha * 0.5})`;
  }
}

/**
 * Get heatmap color with blend based on additions (green) and deletions (red),
 * with darkness/intensity based on overall activity
 * @param {number} count - Total activity count for this cell
 * @param {number} linesAdded - Total lines added in this cell
 * @param {number} linesRemoved - Total lines removed in this cell
 * @param {number} maxCount - Maximum activity count across all cells (for intensity)
 * @param {number} maxTotalLines - Maximum total lines (added or removed) across all cells
 * @returns {string} CSS color string
 */
function getHeatmapColorBlend(count, linesAdded, linesRemoved, maxCount, maxTotalLines) {
  // No activity = light gray
  if (count === 0 && linesAdded === 0 && linesRemoved === 0) {
    return '#f3f4f6';
  }
  
  // Calculate overall activity intensity (0-1)
  // Consider both event count and line changes for intensity
  const countIntensity = Math.min(count / Math.max(maxCount, 1), 1);
  const totalLines = linesAdded + linesRemoved;
  const linesIntensity = totalLines > 0 ? Math.min(totalLines / Math.max(maxTotalLines, 1), 1) : 0;
  // Combine both, weighted slightly toward line changes if available
  const activityIntensity = totalLines > 0 
    ? Math.min(countIntensity * 0.3 + linesIntensity * 0.7, 1)
    : countIntensity;
  
  // Calculate the ratio of additions to total changes (0 = all deletions, 1 = all additions)
  let addRatio = 0.5; // Neutral if no line changes
  if (totalLines > 0) {
    addRatio = linesAdded / totalLines;
  }
  
  // Base colors: green for additions, red for deletions
  const green = [34, 197, 94];   // RGB for green-500
  const red = [239, 68, 68];     // RGB for red-500
  const yellow = [234, 179, 8];  // RGB for yellow-500 (neutral/balanced)
  
  // If no line changes, use neutral gray with intensity-based darkness
  if (totalLines === 0) {
    const grayBase = 200;
    const grayValue = Math.round(grayBase - (activityIntensity * 100)); // Darker with more activity
    return `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
  }
  
  // Blend green and red through yellow (neutral) based on addRatio
  // addRatio = 0 → pure red (deletions)
  // addRatio = 0.5 → yellow (balanced)
  // addRatio = 1 → pure green (additions)
  let r, g, b;
  if (addRatio >= 0.5) {
    // More additions: blend from yellow to green
    const blend = (addRatio - 0.5) * 2; // 0 to 1
    r = Math.round(yellow[0] + (green[0] - yellow[0]) * blend);
    g = Math.round(yellow[1] + (green[1] - yellow[1]) * blend);
    b = Math.round(yellow[2] + (green[2] - yellow[2]) * blend);
  } else {
    // More deletions: blend from red to yellow
    const blend = addRatio * 2; // 0 to 1
    r = Math.round(red[0] + (yellow[0] - red[0]) * blend);
    g = Math.round(red[1] + (yellow[1] - red[1]) * blend);
    b = Math.round(red[2] + (yellow[2] - red[2]) * blend);
  }
  
  // Apply darkness/intensity based on activity
  // Higher activity = darker/more saturated
  // Lower activity = lighter/less saturated
  // We'll darken the color by reducing RGB values and increasing saturation
  const baseBrightness = 0.6; // Minimum brightness (lighter)
  const maxBrightness = 1.0;  // Maximum brightness (full color)
  const brightness = baseBrightness + (activityIntensity * (maxBrightness - baseBrightness));
  
  // Apply brightness adjustment
  r = Math.round(r * brightness);
  g = Math.round(g * brightness);
  b = Math.round(b * brightness);
  
  // Add some opacity variation for subtlety
  const baseAlpha = 0.7;
  const maxAlpha = 0.95;
  const alpha = baseAlpha + (activityIntensity * (maxAlpha - baseAlpha));
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Export to window for global access
window.renderActivityHeatmap = renderActivityHeatmap;
window.generateHeatmapData = generateHeatmapData;
window.getHeatmapColor = getHeatmapColor;
window.getHeatmapColorBlend = getHeatmapColorBlend;

