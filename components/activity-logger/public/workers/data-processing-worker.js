/**
 * Data Processing Web Worker
 * Handles sorting, filtering, grouping, and aggregating large datasets
 */

/**
 * Sort array with progress updates
 */
function sortArray(data, sortFn, options = {}) {
  const { chunkSize = 1000, onProgress } = options;
  
  // For small arrays, sort directly
  if (data.length <= chunkSize) {
    return [...data].sort(sortFn);
  }
  
  // For large arrays, use merge sort approach with progress
  const sorted = [...data];
  let progress = 0;
  
  // Use native sort with progress callback simulation
  sorted.sort((a, b) => {
    progress++;
    if (progress % 1000 === 0 && onProgress) {
      onProgress((progress / data.length) * 100);
    }
    return sortFn(a, b);
  });
  
  if (onProgress) {
    onProgress(100);
  }
  
  return sorted;
}

/**
 * Filter array with progress updates
 */
function filterArray(data, filterFn, options = {}) {
  const { chunkSize = 1000, onProgress } = options;
  const result = [];
  let progress = 0;
  
  for (let i = 0; i < data.length; i++) {
    if (filterFn(data[i], i, data)) {
      result.push(data[i]);
    }
    
    progress++;
    if (progress % chunkSize === 0 && onProgress) {
      onProgress((progress / data.length) * 100);
    }
  }
  
  if (onProgress) {
    onProgress(100);
  }
  
  return result;
}

/**
 * Group array by key function
 */
function groupBy(data, keyFn, options = {}) {
  const { onProgress } = options;
  const groups = new Map();
  let progress = 0;
  
  for (const item of data) {
    const key = keyFn(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
    
    progress++;
    if (progress % 1000 === 0 && onProgress) {
      onProgress((progress / data.length) * 100);
    }
  }
  
  if (onProgress) {
    onProgress(100);
  }
  
  return Object.fromEntries(groups);
}

/**
 * Aggregate data with reducer function
 */
function aggregate(data, reducer, initialValue, options = {}) {
  const { onProgress } = options;
  let accumulator = initialValue;
  let progress = 0;
  
  for (const item of data) {
    accumulator = reducer(accumulator, item, progress, data);
    progress++;
    
    if (progress % 1000 === 0 && onProgress) {
      onProgress((progress / data.length) * 100);
    }
  }
  
  if (onProgress) {
    onProgress(100);
  }
  
  return accumulator;
}

/**
 * Map array with progress updates
 */
function mapArray(data, mapFn, options = {}) {
  const { chunkSize = 1000, onProgress } = options;
  const result = [];
  let progress = 0;
  
  for (let i = 0; i < data.length; i++) {
    result.push(mapFn(data[i], i, data));
    progress++;
    
    if (progress % chunkSize === 0 && onProgress) {
      onProgress((progress / data.length) * 100);
    }
  }
  
  if (onProgress) {
    onProgress(100);
  }
  
  return result;
}

/**
 * Reduce array with progress updates
 */
function reduceArray(data, reducer, initialValue, options = {}) {
  const { onProgress } = options;
  let accumulator = initialValue;
  let progress = 0;
  
  for (let i = 0; i < data.length; i++) {
    accumulator = reducer(accumulator, data[i], i, data);
    progress++;
    
    if (progress % 1000 === 0 && onProgress) {
      onProgress((progress / data.length) * 100);
    }
  }
  
  if (onProgress) {
    onProgress(100);
  }
  
  return accumulator;
}

/**
 * Process timeline items (events, prompts, etc.)
 */
function processTimelineItems(items, options = {}) {
  const {
    sortBy = 'timestamp',
    sortOrder = 'desc',
    filterFn = null,
    groupBy = null,
    limit = null
  } = options;
  
  let processed = [...items];
  
  // Apply filter
  if (filterFn) {
    processed = filterArray(processed, filterFn);
  }
  
  // Apply sorting
  if (sortBy) {
    const sortFn = (a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortOrder === 'desc' ? -comparison : comparison;
    };
    processed = sortArray(processed, sortFn);
  }
  
  // Apply grouping
  if (groupBy) {
    processed = groupBy(processed, groupBy);
  }
  
  // Apply limit
  if (limit && Array.isArray(processed)) {
    processed = processed.slice(0, limit);
  }
  
  return processed;
}

// Main message handler
self.onmessage = function(e) {
  const { taskId, task, payload, options = {} } = e.data;
  
  try {
    let result;
    let progress = 0;
    
    const progressCallback = (percent) => {
      progress = percent;
      self.postMessage({
        taskId,
        type: 'PROGRESS',
        progress: percent
      });
    };
    
    const taskOptions = { ...options, onProgress: progressCallback };
    
    switch (task) {
      case 'SORT':
        result = sortArray(payload.data, payload.sortFn, taskOptions);
        break;
        
      case 'FILTER':
        result = filterArray(payload.data, payload.filterFn, taskOptions);
        break;
        
      case 'GROUP_BY':
        result = groupBy(payload.data, payload.keyFn, taskOptions);
        break;
        
      case 'AGGREGATE':
        result = aggregate(
          payload.data,
          payload.reducer,
          payload.initialValue,
          taskOptions
        );
        break;
        
      case 'MAP':
        result = mapArray(payload.data, payload.mapFn, taskOptions);
        break;
        
      case 'REDUCE':
        result = reduceArray(
          payload.data,
          payload.reducer,
          payload.initialValue,
          taskOptions
        );
        break;
        
      case 'PROCESS_TIMELINE':
        result = processTimelineItems(payload.items, payload.options || {});
        break;
        
      default:
        throw new Error(`Unknown task: ${task}`);
    }
    
    self.postMessage({
      taskId,
      type: 'RESULT',
      result,
      progress: 100
    });
    
  } catch (error) {
    self.postMessage({
      taskId,
      type: 'ERROR',
      error: error.message,
      stack: error.stack
    });
  }
};





