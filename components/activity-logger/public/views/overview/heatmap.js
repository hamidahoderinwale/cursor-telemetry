/**
 * Activity Heatmap Component for Overview
 * Renders a 7-day activity heatmap showing intensity of development activity
 */

/**
 * Generate heatmap data from events, prompts, and terminal commands
 */
function generateHeatmapData(days = 7) {
  const events = window.state?.data?.events || [];
  const prompts = window.state?.data?.prompts || [];
  const terminalCommands = window.state?.data?.terminalCommands || [];
  
  // Combine all activity
  const allActivity = [
    ...events.map(e => ({ time: new Date(e.timestamp).getTime(), type: 'event' })),
    ...prompts.map(p => ({ time: new Date(p.timestamp).getTime(), type: 'prompt' })),
    ...terminalCommands.map(c => ({ time: c.timestamp || new Date(c.timestamp).getTime(), type: 'terminal' }))
  ];
  
  // Initialize heatmap grid: 7 days × 24 hours
  const heatmap = Array(7).fill(null).map(() => Array(24).fill(0));
  
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  // Fill heatmap
  allActivity.forEach(activity => {
    const activityDate = new Date(activity.time);
    const daysAgo = Math.floor((now - activity.time) / oneDay);
    
    // Only include last 7 days
    if (daysAgo >= 0 && daysAgo < 7) {
      const dayIndex = 6 - daysAgo; // 0 = today, 6 = 6 days ago
      const hour = activityDate.getHours();
      
      if (dayIndex >= 0 && dayIndex < 7 && hour >= 0 && hour < 24) {
        heatmap[dayIndex][hour]++;
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
  const maxValue = Math.max(...heatmap.flat(), 1); // Avoid division by zero
  
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
    dayData.forEach((value, hourIndex) => {
      const intensity = maxValue > 0 ? value / maxValue : 0;
      const color = getHeatmapColor(intensity);
      const tooltip = `${dayInfo.fullName}, ${dayInfo.date} at ${hourIndex}:00 - ${value} activity${value !== 1 ? 's' : ''}`;
      
      html += `<div class="heatmap-cell" 
                    style="background-color: ${color};" 
                    title="${tooltip}"
                    data-day="${rowIndex}"
                    data-hour="${hourIndex}"
                    data-count="${value}">
                ${value > 0 ? `<span class="heatmap-cell-value">${value}</span>` : ''}
              </div>`;
    });
    
    html += '</div>';
  });
  
  html += '</div>';
  
  // Legend
  html += '<div class="heatmap-legend">';
  html += '<span class="legend-label">Less</span>';
  html += '<div class="legend-gradient">';
  for (let i = 0; i <= 10; i++) {
    const intensity = i / 10;
    const color = getHeatmapColor(intensity);
    html += `<div class="legend-cell" style="background-color: ${color};" title="${Math.round(intensity * maxValue)} activities"></div>`;
  }
  html += '</div>';
  html += '<span class="legend-label">More</span>';
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

// Export to window for global access
window.renderActivityHeatmap = renderActivityHeatmap;
window.generateHeatmapData = generateHeatmapData;
window.getHeatmapColor = getHeatmapColor;

