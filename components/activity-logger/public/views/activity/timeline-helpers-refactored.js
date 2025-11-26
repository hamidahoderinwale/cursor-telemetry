/**
 * Timeline Helpers - Refactored Wrapper
 * 
 * This is a thin wrapper that loads all timeline modules and exports functions
 * to window for backward compatibility.
 * 
 * Module loading order:
 * 1. timeline-grouping.js - Grouping functions
 * 2. timeline-utils.js - Utility functions
 * 3. timeline-item-renderers.js - Individual item renderers
 * 4. timeline-group-renderers.js - Group renderers
 * 5. timeline-interactions.js - Interaction handlers
 * 6. timeline-renderers.js - Main rendering functions
 * 
 * All functions are exported to window for backward compatibility.
 * Existing code continues to work without changes.
 */

// Note: This file should replace timeline-helpers.js after all modules are created
// and tested. For now, it's a reference implementation.

// The modules are loaded via script tags in dashboard.html in the correct order.
// This file serves as documentation and a placeholder for any additional
// initialization or backward compatibility shims that might be needed.

// Export all functions to window (they're already exported by individual modules,
// but this ensures they're available even if modules are loaded out of order)
if (typeof window !== 'undefined') {
  // Re-export all functions for explicit backward compatibility
  // (Most are already exported by their respective modules, but this ensures availability)
  
  // Grouping functions (from timeline-grouping.js)
  if (window.groupIntoTemporalThreads) {
    window.groupIntoTemporalThreads = window.groupIntoTemporalThreads;
  }
  if (window.consolidateSimilarPrompts) {
    window.consolidateSimilarPrompts = window.consolidateSimilarPrompts;
  }
  if (window.buildIntegratedChunks) {
    window.buildIntegratedChunks = window.buildIntegratedChunks;
  }
  
  // Utility functions (from timeline-utils.js)
  if (window.getFilePathFromEvent) {
    window.getFilePathFromEvent = window.getFilePathFromEvent;
  }
  if (window.extractConversationTitle) {
    window.extractConversationTitle = window.extractConversationTitle;
  }
  if (window.extractContextFiles) {
    window.extractContextFiles = window.extractContextFiles;
  }
  if (window.extractAtFiles) {
    window.extractAtFiles = window.extractAtFiles;
  }
  if (window.getEventTitle) {
    window.getEventTitle = window.getEventTitle;
  }
  if (window.getEnhancedFileInfo) {
    window.getEnhancedFileInfo = window.getEnhancedFileInfo;
  }
  if (window.getEventDescription) {
    window.getEventDescription = window.getEventDescription;
  }
  if (window.highlightFileInGraph) {
    window.highlightFileInGraph = window.highlightFileInGraph;
  }
  if (window.toggleContextFiles) {
    window.toggleContextFiles = window.toggleContextFiles;
  }
  
  // Item renderers (from timeline-item-renderers.js)
  if (window.renderPromptTimelineItem) {
    window.renderPromptTimelineItem = window.renderPromptTimelineItem;
  }
  if (window.renderTerminalTimelineItem) {
    window.renderTerminalTimelineItem = window.renderTerminalTimelineItem;
  }
  if (window.renderTimelineItem) {
    window.renderTimelineItem = window.renderTimelineItem;
  }
  if (window.renderConversationTurnTimelineItem) {
    window.renderConversationTurnTimelineItem = window.renderConversationTurnTimelineItem;
  }
  if (window.renderConversationMessage) {
    window.renderConversationMessage = window.renderConversationMessage;
  }
  
  // Group renderers (from timeline-group-renderers.js)
  if (window.renderPromptGroup) {
    window.renderPromptGroup = window.renderPromptGroup;
  }
  if (window.renderFileChangeGroup) {
    window.renderFileChangeGroup = window.renderFileChangeGroup;
  }
  if (window.renderCommitGroup) {
    window.renderCommitGroup = window.renderCommitGroup;
  }
  if (window.renderTemporalThread) {
    window.renderTemporalThread = window.renderTemporalThread;
  }
  if (window.renderIntegratedChunk) {
    window.renderIntegratedChunk = window.renderIntegratedChunk;
  }
  if (window.renderConversationThread) {
    window.renderConversationThread = window.renderConversationThread;
  }
  
  // Interaction handlers (from timeline-interactions.js)
  if (window.togglePromptGroup) {
    window.togglePromptGroup = window.togglePromptGroup;
  }
  if (window.toggleTemporalThread) {
    window.toggleTemporalThread = window.toggleTemporalThread;
  }
  if (window.toggleConversationMessages) {
    window.toggleConversationMessages = window.toggleConversationMessages;
  }
  if (window.toggleTabMessages) {
    window.toggleTabMessages = window.toggleTabMessages;
  }
  if (window.loadEventDetailsIntoContainer) {
    window.loadEventDetailsIntoContainer = window.loadEventDetailsIntoContainer;
  }
  
  // Main renderers (from timeline-renderers.js)
  if (window.renderUnifiedTimeline) {
    window.renderUnifiedTimeline = window.renderUnifiedTimeline;
  }
  if (window.renderActivityTimeline) {
    window.renderActivityTimeline = window.renderActivityTimeline;
  }
}

console.log('[TIMELINE] Timeline helpers modules loaded');

