import clipboard from 'clipboardy';
import { queue } from './queue.js';
import Dexie from 'dexie';

// Database setup for prompt storage
const db = new Dexie('CursorActivityLoggerCompanion');
db.version(1).stores({
    prompts: '++id, timestamp, text, status, linked_entry_id'
});

class ClipboardMonitor {
  constructor() {
    this.isMonitoring = false;
    this.lastClipboard = '';
    this.intervalId = null;
    this.checkInterval = 2000; // Check every 2 seconds
  }

  start() {
    if (this.isMonitoring) {
      console.log('⚠️ Clipboard monitor already running');
      return;
    }

    console.log('📋 Starting clipboard monitor for prompt capture');
    this.isMonitoring = true;

    this.intervalId = setInterval(async () => {
      try {
        const text = (await clipboard.read()).trim();
        
        if (text && text !== this.lastClipboard && this.isLikelyPrompt(text)) {
          console.log(`💬 Captured potential prompt: ${text.slice(0, 80)}...`);
          
          // Save to database
          const promptId = await db.prompts.add({
            timestamp: new Date().toISOString(),
            text: text,
            status: 'pending',
            linked_entry_id: null
          });
          
          // Also add to queue for immediate processing
          queue.addPendingPrompt(text);
          this.lastClipboard = text;
          
          console.log(`💾 Saved prompt to database: ${promptId}`);
        }
      } catch (error) {
        // Silently handle clipboard errors (permission denied, etc.)
        if (error.message && !error.message.includes('permission')) {
          console.error('Clipboard monitor error:', error.message);
        }
      }
    }, this.checkInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isMonitoring = false;
    console.log('🛑 Clipboard monitor stopped');
  }

  isLikelyPrompt(text) {
    // Basic heuristics to identify prompts
    if (text.length < 10 || text.length > 2000) return false;
    
    // Skip code-like content
    const codePatterns = [
      /^[{}[\]();\s]*$/,  // Only brackets and semicolons
      /^\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*[=:]\s*/,  // Variable assignments
      /^\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/,  // Function calls
      /^\s*[#@]/,  // Comments or directives
      /^\s*[<>]/,  // HTML/XML tags
      /^\s*[0-9]/,  // Numbers only
      /^\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*[{}]/,  // Object/function definitions
    ];
    
    if (codePatterns.some(pattern => pattern.test(text))) {
      return false;
    }
    
    // Look for prompt-like patterns
    const promptPatterns = [
      /^(can you|please|how do|what is|explain|help me|i need|i want)/i,
      /^(add|create|implement|fix|update|modify|change|remove|delete)/i,
      /^(show me|give me|find|search|look for)/i,
      /\?$/,  // Ends with question mark
      /^(write|generate|make|build|develop)/i,
    ];
    
    return promptPatterns.some(pattern => pattern.test(text));
  }

  getStats() {
    return {
      is_monitoring: this.isMonitoring,
      last_captured: this.lastClipboard ? this.lastClipboard.slice(0, 50) + '...' : null,
      pending_prompts: queue.getPendingPrompts().length
    };
  }
}

export const clipboardMonitor = new ClipboardMonitor();
