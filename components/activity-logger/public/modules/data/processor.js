/**
 * Data Processing Module
 * Handles data transformation, filtering, and aggregation
 */

import { state, updateStats } from '../core/state.js';

/**
 * Calculate dashboard statistics from current data
 */
export function calculateStats() {
  const { events, prompts, terminalCommands } = state.data;
  
  // Count unique sessions
  const sessions = new Set(events.map(e => e.session_id)).size;
  
  // Count file changes
  const fileChanges = events.filter(e => 
    e.source === 'filewatcher' || e.file_path
  ).length;
  
  // Calculate AI interactions
  const aiInteractions = calculateAIInteractions(prompts);
  
  // Calculate code changed (sum of diff sizes)
  const codeChanged = events.reduce((sum, e) => {
    const diff = e.notes?.match(/Diff: ([+-]?\d+) chars/);
    return sum + (diff ? Math.abs(parseInt(diff[1])) : 0);
  }, 0);
  
  // Terminal commands
  const terminalCommandsCount = terminalCommands?.length || 0;
  
  updateStats({
    sessions,
    fileChanges,
    aiInteractions,
    codeChanged,
    terminalCommands: terminalCommandsCount
  });
  
  return state.stats;
}

/**
 * Calculate AI interactions from prompts
 */
function calculateAIInteractions(prompts) {
  if (!prompts || !Array.isArray(prompts)) {
    return 0;
  }
  
  // Count unique composer IDs
  const composerIds = new Set();
  let nonJsonPrompts = 0;
  
  prompts.forEach(prompt => {
    const promptText = prompt.text || prompt.content || '';
    
    try {
      const parsed = JSON.parse(promptText);
      if (parsed.composerId) {
        composerIds.add(parsed.composerId);
      }
    } catch {
      nonJsonPrompts++;
    }
  });
  
  return Math.max(composerIds.size, nonJsonPrompts, prompts.length);
}

/**
 * Group prompts into conversation threads
 */
export function groupIntoThreads(entries) {
  const threads = new Map();
  
  entries.forEach(entry => {
    const threadId = entry.thread_id || entry.session_id || 'unknown';
    
    if (!threads.has(threadId)) {
      threads.set(threadId, {
        id: threadId,
        prompts: [],
        startTime: entry.timestamp,
        lastTime: entry.timestamp
      });
    }
    
    const thread = threads.get(threadId);
    thread.prompts.push(entry);
    thread.lastTime = entry.timestamp;
  });
  
  // Convert to array and sort by most recent
  return Array.from(threads.values())
    .sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
}

/**
 * Filter events by workspace
 */
export function filterByWorkspace(items, workspace) {
  if (!workspace || workspace === 'all') {
    return items;
  }
  
  return items.filter(item => {
    const itemWorkspace = item.workspace_path || item.workspacePath || '';
    return itemWorkspace.includes(workspace);
  });
}

/**
 * Filter events by time range
 */
export function filterByTimeRange(items, startTime, endTime) {
  return items.filter(item => {
    const timestamp = new Date(item.timestamp).getTime();
    return timestamp >= startTime && timestamp <= endTime;
  });
}

/**
 * Aggregate events by time buckets (hourly, daily, etc.)
 */
export function aggregateByTime(events, bucketSize = 'hourly') {
  const buckets = new Map();
  
  events.forEach(event => {
    const timestamp = new Date(event.timestamp);
    let bucketKey;
    
    switch (bucketSize) {
      case 'hourly':
        bucketKey = new Date(timestamp.getFullYear(), timestamp.getMonth(), 
                            timestamp.getDate(), timestamp.getHours()).getTime();
        break;
      case 'daily':
        bucketKey = new Date(timestamp.getFullYear(), timestamp.getMonth(), 
                            timestamp.getDate()).getTime();
        break;
      case 'weekly':
        const weekStart = new Date(timestamp);
        weekStart.setDate(timestamp.getDate() - timestamp.getDay());
        bucketKey = new Date(weekStart.getFullYear(), weekStart.getMonth(), 
                            weekStart.getDate()).getTime();
        break;
      default:
        bucketKey = timestamp.getTime();
    }
    
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, {
        timestamp: bucketKey,
        events: [],
        count: 0
      });
    }
    
    const bucket = buckets.get(bucketKey);
    bucket.events.push(event);
    bucket.count++;
  });
  
  return Array.from(buckets.values()).sort((a, b) => a.timestamp - b.timestamp);
}

export default {
  calculateStats,
  groupIntoThreads,
  filterByWorkspace,
  filterByTimeRange,
  aggregateByTime
};

