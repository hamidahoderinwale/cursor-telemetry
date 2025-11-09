/**
 * Activity Rhythm Visualization using D3.js
 * Shows coding activity patterns by hour of day
 */

function renderActivityRhythm(container, activityByHour) {
  if (!container || !activityByHour || activityByHour.length !== 24) {
    return;
  }
  
  // Clear container
  container.innerHTML = '';
  
  // Check if D3 is available
  if (typeof d3 === 'undefined') {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-text">D3.js not loaded</div>
      </div>
    `;
    return;
  }
  
  // Set dimensions and margins
  const margin = { top: 20, right: 20, bottom: 50, left: 40 };
  const width = container.clientWidth || 600;
  const height = 250;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  
  // Find max activity for scaling
  const maxActivity = Math.max(...activityByHour, 1);
  
  // Create SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('background', 'transparent');
  
  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);
  
  // Create scales
  const xScale = d3.scaleBand()
    .domain(d3.range(24))
    .range([0, innerWidth])
    .padding(0.1);
  
  const yScale = d3.scaleLinear()
    .domain([0, maxActivity])
    .range([innerHeight, 0])
    .nice();
  
  // Create bars with data including hour index
  const barsData = activityByHour.map((count, hour) => ({ hour, count }));
  
  g.selectAll('.bar')
    .data(barsData)
    .enter()
    .append('rect')
    .attr('class', 'rhythm-bar')
    .attr('x', d => xScale(d.hour))
    .attr('y', d => yScale(d.count))
    .attr('width', xScale.bandwidth())
    .attr('height', d => innerHeight - yScale(d.count))
    .attr('fill', 'var(--color-primary)')
    .attr('rx', 4)
    .attr('ry', 4)
    .style('transition', 'all 0.2s ease')
    .on('mouseenter', function(event, d) {
      d3.select(this)
        .attr('fill', 'var(--color-primary-light)')
        .attr('opacity', 0.8);
    })
    .on('mouseleave', function(event, d) {
      d3.select(this)
        .attr('fill', 'var(--color-primary)')
        .attr('opacity', 1);
    });
  
  // Remove existing tooltip if any
  d3.selectAll('.rhythm-tooltip').remove();
  
  // Add tooltips
  const tooltip = d3.select('body').append('div')
    .attr('class', 'rhythm-tooltip')
    .style('opacity', 0)
    .style('position', 'absolute')
    .style('background', 'var(--color-surface)')
    .style('border', '1px solid var(--color-border)')
    .style('border-radius', 'var(--radius-md)')
    .style('padding', 'var(--space-sm) var(--space-md)')
    .style('font-size', 'var(--text-sm)')
    .style('color', 'var(--color-text)')
    .style('pointer-events', 'none')
    .style('z-index', '1000')
    .style('box-shadow', 'var(--shadow-lg)')
    .style('white-space', 'nowrap');
  
  g.selectAll('.rhythm-bar')
    .on('mouseenter', function(event, d) {
      const hour = d.hour;
      const hourLabel = hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`;
      tooltip.transition()
        .duration(200)
        .style('opacity', 1);
      tooltip.html(`${hourLabel}<br><strong>${d.count} activities</strong>`)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px');
    })
    .on('mouseleave', function() {
      tooltip.transition()
        .duration(200)
        .style('opacity', 0);
    });
  
  // Add X axis with time labels
  const xAxis = g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale)
      .tickValues([0, 6, 12, 18]) // Show 12am, 6am, 12pm, 6pm
      .tickFormat((d) => {
        if (d === 0) return '12am';
        if (d === 6) return '6am';
        if (d === 12) return '12pm';
        if (d === 18) return '6pm';
        return '';
      })
    )
    .style('color', 'var(--color-text-muted)');
  
  // Style axis
  xAxis.selectAll('text')
    .style('font-size', 'var(--text-xs)')
    .style('fill', 'var(--color-text-muted)');
  
  xAxis.selectAll('line, path')
    .style('stroke', 'var(--color-border)');
  
  // Add Y axis
  const yAxis = g.append('g')
    .attr('class', 'y-axis')
    .call(d3.axisLeft(yScale)
      .ticks(5)
      .tickFormat(d => d === 0 ? '' : d)
    )
    .style('color', 'var(--color-text-muted)');
  
  yAxis.selectAll('text')
    .style('font-size', 'var(--text-xs)')
    .style('fill', 'var(--color-text-muted)');
  
  yAxis.selectAll('line, path')
    .style('stroke', 'var(--color-border)');
  
  // Remove domain line
  yAxis.select('.domain').remove();
  xAxis.select('.domain').style('stroke', 'var(--color-border)');
}

// Export to window
window.renderActivityRhythm = renderActivityRhythm;

