/**
 * Data processing and statistics helper functions
 */

function calculateStats() {
  // Ensure state.data exists
  if (!window.state.data) {
    window.state.data = {};
  }
  if (!window.state.stats) {
    window.state.stats = {};
  }

  const events = window.state.data.events || [];
  const entries = window.state.data.entries || [];
  const prompts = window.state.data.prompts || [];
  const terminalCommands = window.state.data.terminalCommands || [];

  // Count sessions
  const sessions = new Set();
  [...events, ...entries, ...prompts].forEach(item => {
    if (item.session_id) sessions.add(item.session_id);
  });

  // Count file changes - all events that represent file modifications
  const fileChanges = window.state.stats?.totalEventCount || events.filter(e => 
    e.type === 'file_change' || e.type === 'code_change' || e.type === 'file_save' || !e.type
  ).length;
  
  // Count terminal commands
  window.state.stats.terminalCommands = terminalCommands.length;

  // Count AI interactions - prompts with meaningful content
  // Uses helper function to check all possible text field names
  const aiInteractions = prompts.filter(p => {
    return window.hasPromptContent ? window.hasPromptContent(p, 5) : 
           (() => {
             const text = p.text || p.prompt || p.preview || p.content || p.message || '';
             return text && text.length > 5;
           })();
  }).length;

  console.log(`[STATS] AI Interactions: ${aiInteractions} of ${prompts.length} prompts`);

  // Calculate code changed
  let totalChars = 0;
  events.forEach(e => {
    try {
      const details = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
      const added = details?.chars_added || details?.added || 0;
      const deleted = details?.chars_deleted || details?.deleted || 0;
      totalChars += added + deleted;
    } catch (err) {
      // Silently skip parsing errors
    }
  });
  
  console.log(`[STATS] Code changed: ${totalChars} chars (${(totalChars / 1024).toFixed(1)} KB) from ${events.length} events`);

  // Calculate average context usage
  // Check multiple possible field names and handle both percentage and token values
  let totalContextUsage = 0;
  let contextUsageCount = 0;
  prompts.forEach(p => {
    // Try multiple field name variations
    const contextUsage = p.contextUsage || 
                        p.context_usage || 
                        p.promptTokens || 
                        p.prompt_tokens ||
                        p.context_file_count ||
                        (p.token_estimate ? p.token_estimate / 1000 : null) || // Convert tokens to percentage estimate
                        0;
    
    // Handle both percentage (0-100) and token values
    // If value is > 100, assume it's tokens and convert to percentage (assuming 100k token context window)
    let usagePercent = contextUsage;
    if (contextUsage > 100) {
      usagePercent = (contextUsage / 100000) * 100; // Convert tokens to percentage
    }
    
    if (usagePercent > 0 && usagePercent <= 100) {
      totalContextUsage += usagePercent;
      contextUsageCount++;
    }
  });
  const avgContextUsage = contextUsageCount > 0 ? (totalContextUsage / contextUsageCount) : 0;

  // Calculate workspace count
  // First try to get from state.data.workspaces (most accurate)
  let workspaceCount = 0;
  if (window.state.data.workspaces && Array.isArray(window.state.data.workspaces)) {
    workspaceCount = window.state.data.workspaces.length;
  } else {
    // Fallback: extract unique workspaces from events, prompts, and entries
    const workspaceSet = new Set();
    [...events, ...prompts, ...entries].forEach(item => {
      const wsPath = item.workspace_path || item.workspacePath || item.workspace || item.workspaceName || item.workspaceId;
      if (wsPath) {
        workspaceSet.add(wsPath);
      }
    });
    workspaceCount = workspaceSet.size;
  }

  // Update stats object, preserving any existing values that might be set elsewhere
  window.state.stats = {
    ...window.state.stats, // Preserve existing stats
    sessions: sessions.size,
    fileChanges: fileChanges,
    aiInteractions: aiInteractions,
    codeChanged: (totalChars / 1024).toFixed(1), // KB
    avgContext: avgContextUsage.toFixed(1),
    workspaces: workspaceCount // Ensure workspace count is set
  };
  
  console.log('[STATS] Final stats:', window.state.stats);

  // Update display if function exists
  if (window.updateStatsDisplay) {
    window.updateStatsDisplay();
  }
}

function groupIntoThreads(entries) {
  const threadMap = new Map();
  
  entries.forEach(entry => {
    const threadId = entry.session_id || entry.thread_id || 'default';
    if (!threadMap.has(threadId)) {
      threadMap.set(threadId, {
        id: threadId,
        messages: [],
        firstMessage: entry.timestamp,
        lastMessage: entry.timestamp
      });
    }
    
    const thread = threadMap.get(threadId);
    thread.messages.push(entry);
    thread.lastMessage = entry.timestamp;
  });
  
  return Array.from(threadMap.values()).sort((a, b) => 
    new Date(b.lastMessage) - new Date(a.lastMessage)
  );
}

function filterEventsByWorkspace(events) {
  const currentWorkspace = window.state.currentWorkspace || 'all';
  if (currentWorkspace === 'all') return events;
  
  return events.filter(event => {
    const workspaceId = event.workspace_id || event.workspaceId;
    const workspaceName = event.workspace_name || event.workspaceName;
    return workspaceId === currentWorkspace || workspaceName === currentWorkspace;
  });
}

// Export to window for global access
window.calculateStats = calculateStats;
window.groupIntoThreads = groupIntoThreads;
window.filterEventsByWorkspace = filterEventsByWorkspace;

