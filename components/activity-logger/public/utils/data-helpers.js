/**
 * Data processing and statistics helper functions
 */

function calculateStats() {
  const events = window.state.data.events;
  const entries = window.state.data.entries;
  const terminalCommands = window.state.data.terminalCommands || [];

  // Count sessions
  const sessions = new Set();
  [...events, ...entries].forEach(item => {
    if (item.session_id) sessions.add(item.session_id);
  });

  // Count file changes
  const fileChanges = window.state.stats?.totalEventCount || events.filter(e => 
    e.type === 'file_change' || e.type === 'code_change'
  ).length;
  
  // Count terminal commands
  window.state.stats.terminalCommands = terminalCommands.length;

  // Count AI interactions - prompts with meaningful content
  // Uses helper function to check all possible text field names
  const aiInteractions = (window.state.data.prompts || []).filter(p => {
    return window.hasPromptContent ? window.hasPromptContent(p, 5) : 
           (() => {
             const text = p.text || p.prompt || p.preview || p.content || '';
             return text && text.length > 5;
           })();
  }).length;

  console.log(`AI Interactions: ${aiInteractions} of ${window.state.data.prompts?.length || 0} prompts`);

  // Calculate code changed
  let totalChars = 0;
  events.forEach(e => {
    try {
      const details = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
      const added = details?.chars_added || 0;
      const deleted = details?.chars_deleted || 0;
      totalChars += added + deleted;
    } catch (err) {
      // Silently skip parsing errors
    }
  });
  
  console.log(`[STATS] Code changed: ${totalChars} chars (${(totalChars / 1024).toFixed(1)} KB) from ${events.length} events`);

  // Calculate average context usage
  let totalContextUsage = 0;
  let contextUsageCount = 0;
  (window.state.data.prompts || []).forEach(p => {
    if (p.contextUsage && p.contextUsage > 0) {
      totalContextUsage += p.contextUsage;
      contextUsageCount++;
    }
  });
  const avgContextUsage = contextUsageCount > 0 ? (totalContextUsage / contextUsageCount) : 0;

  window.state.stats = {
    sessions: sessions.size,
    fileChanges: fileChanges,
    aiInteractions: aiInteractions,
    codeChanged: (totalChars / 1024).toFixed(1), // KB
    avgContext: avgContextUsage.toFixed(1)
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

