/**
 * Analytics Web Worker
 * Handles heavy analytics computations like bucket aggregation, time series processing
 */

/**
 * Create time buckets
 */
function createBuckets(startTime, endTime, bucketSize) {
  const buckets = [];
  const numBuckets = Math.ceil((endTime - startTime) / bucketSize);
  
  for (let i = 0; i < numBuckets; i++) {
    const bucketTime = startTime + (i * bucketSize);
    buckets.push({
      timestamp: bucketTime,
      promptCount: 0,
      codeChanges: 0,
      fileCount: 0,
      charCount: 0,
      contextUsage: 0,
      contextCount: 0,
      count: 0
    });
  }
  
  return buckets;
}

/**
 * Aggregate prompts into buckets
 */
function aggregatePromptsIntoBuckets(prompts, buckets, startTime, bucketSize) {
  for (const prompt of prompts) {
    const promptTime = new Date(prompt.timestamp).getTime();
    if (promptTime < startTime || promptTime > Date.now()) continue;
    
    const bucketIndex = Math.floor((promptTime - startTime) / bucketSize);
    if (bucketIndex >= 0 && bucketIndex < buckets.length) {
      buckets[bucketIndex].promptCount++;
      buckets[bucketIndex].count++;
      
      const text = prompt.text || prompt.prompt || prompt.preview || '';
      buckets[bucketIndex].charCount += text.length;
      
      // Calculate context usage
      let contextUsage = prompt.contextUsage || prompt.context_usage || 0;
      if (contextUsage === 0) {
        const contextFileCount = prompt.context_file_count || prompt.contextFileCount || 0;
        const atFileCount = prompt.atFiles?.length || 0;
        const contextFiles = prompt.contextFiles?.attachedFiles?.length || prompt.contextFiles?.codebaseFiles?.length || 0;
        const totalFileRefs = contextFileCount || atFileCount || contextFiles;
        if (totalFileRefs > 0) {
          contextUsage = Math.min(100, totalFileRefs * 3);
        } else {
          const atMatches = (text.match(/@\w+/g) || []).length;
          if (atMatches > 0) {
            contextUsage = Math.min(100, atMatches * 5);
          }
        }
      }
      
      if (contextUsage > 0) {
        buckets[bucketIndex].contextUsage += contextUsage;
        buckets[bucketIndex].contextCount++;
      }
    }
  }
}

/**
 * Aggregate events into buckets
 */
function aggregateEventsIntoBuckets(events, buckets, startTime, bucketSize) {
  for (const event of events) {
    const eventTime = new Date(event.timestamp).getTime();
    if (eventTime < startTime || eventTime > Date.now()) continue;
    
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
  }
}

/**
 * Process analytics buckets
 */
function processAnalyticsBuckets(payload) {
  const { prompts, events, startTime, endTime, bucketSize } = payload;
  
  const buckets = createBuckets(startTime, endTime, bucketSize);
  
  // Aggregate data into buckets
  if (prompts && prompts.length > 0) {
    aggregatePromptsIntoBuckets(prompts, buckets, startTime, bucketSize);
  }
  
  if (events && events.length > 0) {
    aggregateEventsIntoBuckets(events, buckets, startTime, bucketSize);
  }
  
  return buckets;
}

/**
 * Calculate model usage statistics
 */
function calculateModelUsage(prompts) {
  const modelCounts = new Map();
  const modeCounts = new Map();
  const modelModeCombos = new Map();
  
  for (const p of prompts) {
    const modelName = p.model_name || p.modelName || p.model || 'unknown';
    const mode = p.mode || p.source || 'unknown';
    
    modelCounts.set(modelName, (modelCounts.get(modelName) || 0) + 1);
    modeCounts.set(mode, (modeCounts.get(mode) || 0) + 1);
    
    const combo = `${modelName} (${mode})`;
    modelModeCombos.set(combo, (modelModeCombos.get(combo) || 0) + 1);
  }
  
  return {
    modelCounts: Object.fromEntries(modelCounts),
    modeCounts: Object.fromEntries(modeCounts),
    modelModeCombos: Object.fromEntries(modelModeCombos)
  };
}

// Main message handler
self.onmessage = function(e) {
  const { taskId, task, payload } = e.data;
  
  try {
    let result;
    
    switch (task) {
      case 'PROCESS_BUCKETS':
        result = processAnalyticsBuckets(payload);
        break;
        
      case 'CALCULATE_MODEL_USAGE':
        result = calculateModelUsage(payload.prompts);
        break;
        
      default:
        throw new Error(`Unknown task: ${task}`);
    }
    
    self.postMessage({
      taskId,
      type: 'RESULT',
      result
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



