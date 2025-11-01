#!/usr/bin/env node

/**
 * Cursor Database Parser
 * Extracts prompts, conversations, and AI interactions from Cursor's state.vscdb
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ContextExtractor = require('./context-extractor');

const execAsync = promisify(exec);

class CursorDatabaseParser {
  constructor() {
    this.dbPaths = this.findCursorDatabases();
    this.cache = {
      conversations: [],
      prompts: [],
      lastUpdate: 0
    };
    this.updateInterval = 10000; // Update every 10 seconds
    this.contextExtractor = new ContextExtractor();
    
    // Add mutex to prevent concurrent database reads (thundering herd)
    this.refreshPromise = null;
    this.isRefreshing = false;
  }

  /**
   * Find all Cursor database files
   */
  findCursorDatabases() {
    const basePath = path.join(os.homedir(), 'Library/Application Support/Cursor');
    return {
      global: path.join(basePath, 'User/globalStorage/state.vscdb'),
      workspaces: path.join(basePath, 'User/workspaceStorage')
    };
  }

  /**
   * Resolve workspace ID to actual folder path
   */
  getWorkspacePath(workspaceId) {
    try {
      const { workspaces } = this.dbPaths;
      const workspaceDir = path.join(workspaces, workspaceId);
      const workspaceJsonPath = path.join(workspaceDir, 'workspace.json');
      
      if (fs.existsSync(workspaceJsonPath)) {
        const workspaceJson = JSON.parse(fs.readFileSync(workspaceJsonPath, 'utf8'));
        if (workspaceJson.folder) {
          // Remove 'file://' prefix and return clean path
          return workspaceJson.folder.replace(/^file:\/\//, '');
        }
      }
    } catch (error) {
      console.warn(`Could not resolve workspace path for ${workspaceId}:`, error.message);
    }
    
    return null;
  }

  /**
   * Get a friendly name for the workspace (last directory name)
   */
  getWorkspaceName(workspacePath) {
    if (!workspacePath) return 'Unknown';
    return path.basename(workspacePath);
  }

  /**
   * Extract AI prompts and generations (user inputs + AI responses)
   * This is where Cursor actually stores the conversation messages!
   */
  async extractAIServiceData(dbPath) {
    try {
      if (!fs.existsSync(dbPath)) {
        return { prompts: [], generations: [] };
      }

      // Extract aiService.prompts (user inputs)
      const promptQuery = `SELECT value FROM ItemTable WHERE key = 'aiService.prompts'`;
      const { stdout: promptData } = await execAsync(
        `sqlite3 "${dbPath}" "${promptQuery}"`
      ).catch(() => ({ stdout: '' }));

      // Extract aiService.generations (AI responses)
      const genQuery = `SELECT value FROM ItemTable WHERE key = 'aiService.generations'`;
      const { stdout: genData } = await execAsync(
        `sqlite3 "${dbPath}" "${genQuery}"`
      ).catch(() => ({ stdout: '' }));

      // Try to extract conversation metadata if it exists
      // Query for all conversation-related keys and merge them
      const conversationQuery = `SELECT key, value FROM ItemTable WHERE key LIKE 'aiService.conversations%' OR key LIKE 'conversations%'`;
      const { stdout: conversationData } = await execAsync(
        `sqlite3 "${dbPath}" "${conversationQuery}"`
      ).catch(() => ({ stdout: '' }));
      
      let conversationMetadata = {};
      if (conversationData.trim()) {
        try {
          // Handle multiple rows (key-value pairs)
          // sqlite3 uses tabs as default separator, but values might contain tabs too
          // Use a regex that splits on the first tab only
          const lines = conversationData.trim().split('\n');
          const conversationsMap = new Map();
          
          for (const line of lines) {
            if (!line) continue;
            // Split on first tab only (sqlite3 default separator)
            const tabIndex = line.indexOf('\t');
            if (tabIndex === -1) continue;
            
            const key = line.substring(0, tabIndex);
            const value = line.substring(tabIndex + 1);
            
            try {
              const parsed = JSON.parse(value);
              // If it's an array of conversations, store them
              if (Array.isArray(parsed)) {
                parsed.forEach(conv => {
                  if (conv.id && !conversationsMap.has(conv.id)) {
                    conversationsMap.set(conv.id, conv);
                  }
                });
              } else if (parsed.conversations && Array.isArray(parsed.conversations)) {
                parsed.conversations.forEach(conv => {
                  if (conv.id && !conversationsMap.has(conv.id)) {
                    conversationsMap.set(conv.id, conv);
                  }
                });
              } else if (parsed.id) {
                // Single conversation object
                conversationsMap.set(parsed.id, parsed);
              }
            } catch (parseError) {
              // If this line doesn't parse as JSON, try parsing the whole value as JSON
              try {
                const fullParsed = JSON.parse(value);
                if (Array.isArray(fullParsed)) {
                  fullParsed.forEach(conv => {
                    if (conv.id && !conversationsMap.has(conv.id)) {
                      conversationsMap.set(conv.id, conv);
                    }
                  });
                } else if (fullParsed.conversations) {
                  if (Array.isArray(fullParsed.conversations)) {
                    fullParsed.conversations.forEach(conv => {
                      if (conv.id && !conversationsMap.has(conv.id)) {
                        conversationsMap.set(conv.id, conv);
                      }
                    });
                  }
                } else {
                  Object.assign(conversationMetadata, fullParsed);
                }
              } catch (e2) {
                // Skip this entry if it doesn't parse
              }
            }
          }
          
          // Convert map to array or object structure
          if (conversationsMap.size > 0) {
            conversationMetadata.conversations = Array.from(conversationsMap.values());
          } else if (conversationData.trim()) {
            // Fallback: try parsing the first line as JSON
            const firstLine = lines[0];
            if (firstLine) {
              const tabIndex = firstLine.indexOf('\t');
              if (tabIndex !== -1) {
                const value = firstLine.substring(tabIndex + 1);
                conversationMetadata = JSON.parse(value);
              }
            }
          }
        } catch (e) {
          // Ignore parsing errors for conversation metadata
          console.warn('Could not parse conversation metadata:', e.message);
        }
      }

      const prompts = [];
      const generations = [];

      // Parse user prompts
      if (promptData.trim()) {
        try {
          const promptsArray = JSON.parse(promptData.trim());
          if (Array.isArray(promptsArray)) {
            promptsArray.forEach((item, idx) => {
              const text = item.text || item.textDescription || item.prompt || item.content || item.message;
              if (text && text.trim()) {
                prompts.push({
                  text: text.trim(),
                  type: item.type || 'unknown',
                  timestamp: item.timestamp,
                  generationUUID: item.generationUUID,
                  commandType: item.commandType,
                  // Capture conversation title if available
                  conversationTitle: item.title || item.conversationTitle || item.conversation?.title || item.metadata?.title || null,
                  conversationId: item.conversationId || item.conversation?.id || item.metadata?.conversationId || null,
                  index: idx,
                  messageRole: 'user',
                  source: 'aiService'
                });
              }
            });
          }
        } catch (e) {
          console.warn('Error parsing aiService.prompts:', e.message);
        }
      }

      // Parse AI generations
      if (genData.trim()) {
        try {
          const genArray = JSON.parse(genData.trim());
          if (Array.isArray(genArray)) {
            genArray.forEach((item, idx) => {
              const text = item.text || item.textDescription || item.content || item.message;
              if (text && text.trim()) {
                generations.push({
                  text: text.trim(),
                  type: item.type || 'unknown',
                  timestamp: item.timestamp,
                  generationUUID: item.uuid || item.generationUUID,
                  model: item.model,
                  finishReason: item.finishReason,
                  index: idx,
                  messageRole: 'assistant',
                  source: 'aiService'
                });
              }
            });
          }
        } catch (e) {
          console.warn('Error parsing aiService.generations:', e.message);
        }
      }

      return { prompts, generations, conversationMetadata };
    } catch (error) {
      console.warn('Error extracting AI service data:', error.message);
      return { prompts: [], generations: [], conversationMetadata: {} };
    }
  }

  // REMOVED: Old extraction methods (extractComposerData, extractWorkspacePrompts, parsePersistentComposerData)
  // Now using extractAIServiceData which gets the actual message content from aiService.prompts + aiService.generations


  /**
   * Extract terminal blocks from text (code blocks with terminal output)
   */
  extractTerminalBlocks(text) {
    if (!text) return [];
    
    const terminalBlocks = [];
    
    // Pattern 1: Code blocks with bash/shell/terminal language
    const codeBlockPattern = /```(?:bash|shell|terminal|zsh|sh)?\n([\s\S]*?)```/g;
    let match;
    
    while ((match = codeBlockPattern.exec(text)) !== null) {
      const content = match[1].trim();
      if (content.length > 0) {
        terminalBlocks.push({
          type: 'code_block',
          content: content,
          hasPrompt: content.includes('$') || content.includes('%'),
          position: match.index
        });
      }
    }
    
    // Pattern 2: Terminal-like patterns in plain text ($ or % prompts)
    const terminalLinePattern = /^[\$%]\s+(.+)$/gm;
    while ((match = terminalLinePattern.exec(text)) !== null) {
      terminalBlocks.push({
        type: 'terminal_line',
        content: match[1].trim(),
        position: match.index
      });
    }
    
    // Pattern 3: Error messages
    const errorPatterns = [
      /Error:\s*(.+)/gi,
      /Exception:\s*(.+)/gi,
      /Failed:\s*(.+)/gi,
      /\[ERROR\]\s*(.+)/gi
    ];
    
    errorPatterns.forEach(pattern => {
      let errorMatch;
      while ((errorMatch = pattern.exec(text)) !== null) {
        terminalBlocks.push({
          type: 'error_message',
          content: errorMatch[1].trim(),
          position: errorMatch.index
        });
      }
    });
    
    return terminalBlocks;
  }


  /**
   * Extract context information for prompts
   */
  async extractContextForPrompts(prompts) {
    const enrichedPrompts = [];
    
    for (const prompt of prompts) {
      try {
        // Extract context using the context extractor
        const context = await this.contextExtractor.getPromptContext({
          text: prompt.text,
          content: prompt.text,
          composerData: prompt.composerData || {},
          response: prompt.response
        });
        
        // Enrich prompt with context information
        const enrichedPrompt = {
          ...prompt,
          context: {
            atFiles: context.atFiles || [],
            contextFiles: context.contextFiles || {},
            responseFiles: context.responseFiles || [],
            browserState: context.browserState || {},
            fileRelationships: context.fileRelationships || {}
          }
        };
        
        enrichedPrompts.push(enrichedPrompt);
      } catch (error) {
        console.warn(`Could not extract context for prompt ${prompt.composerId}:`, error.message);
        enrichedPrompts.push(prompt);
      }
    }
    
    return enrichedPrompts;
  }


  /**
   * Get all workspaces (including stale/old ones)
   */
  async getAllWorkspaces() {
    try {
      const { workspaces } = this.dbPaths;
      
      if (!fs.existsSync(workspaces)) {
        return [];
      }

      const workspaceDirs = fs.readdirSync(workspaces);
      const allWorkspaces = [];

      for (const dir of workspaceDirs) {
        try {
          const workspaceDir = path.join(workspaces, dir);
          const stat = fs.statSync(workspaceDir);
          
          // Skip if not a directory
          if (!stat.isDirectory()) continue;
          
          const workspacePath = this.getWorkspacePath(dir);
          const workspaceName = this.getWorkspaceName(workspacePath);
          
          allWorkspaces.push({
            id: dir,
            path: workspacePath,
            name: workspaceName,
            lastAccessed: stat.mtime,
            created: stat.birthtime || stat.ctime,
            exists: workspacePath ? fs.existsSync(workspacePath) : false
          });
        } catch (error) {
          // Skip workspaces that can't be read
          console.warn(`Could not read workspace ${dir}:`, error.message);
        }
      }

      // Sort by last accessed (most recent first)
      allWorkspaces.sort((a, b) => b.lastAccessed - a.lastAccessed);
      
      console.log(`[FILE] Found ${allWorkspaces.length} total workspaces`);
      return allWorkspaces;

    } catch (error) {
      console.error('Error getting all workspaces:', error.message);
      return [];
    }
  }

  /**
   * Get all extracted data
   * Uses mutex to prevent concurrent database reads (thundering herd problem)
   */
  async getAllData() {
    const now = Date.now();
    
    // Use cache if recent
    if (now - this.cache.lastUpdate < this.updateInterval) {
      return this.cache;
    }

    // If already refreshing, wait for that promise instead of starting another refresh
    if (this.isRefreshing && this.refreshPromise) {
      console.log('[CACHE] Database refresh in progress, waiting...');
      try {
        await this.refreshPromise;
      } catch (error) {
        // If refresh failed, continue to try again
      }
      // Return cache (either updated by the other request, or stale if it failed)
      return this.cache;
    }

    // Start refresh with mutex
    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        // ✨ Extract AI service data (actual conversation messages with full threading!)
        const aiServiceMessages = await this.extractAllAIServiceData();

        // Enrich prompts with context information
        const enrichedPrompts = await this.extractContextForPrompts(aiServiceMessages);

        // Count unique conversations
        const uniqueConversations = new Set(
          enrichedPrompts.map(p => p.parentConversationId).filter(Boolean)
        ).size;

        this.cache = {
          conversations: [],  // No longer needed - messages are self-contained
          prompts: enrichedPrompts,
          lastUpdate: Date.now(),
          stats: {
            totalConversations: uniqueConversations,
            totalPrompts: enrichedPrompts.length,
            aiServiceMessages: aiServiceMessages.length,
            userMessages: enrichedPrompts.filter(p => p.messageRole === 'user').length,
            assistantMessages: enrichedPrompts.filter(p => p.messageRole === 'assistant').length
          }
        };

        console.log(`[CACHE] Database refreshed: ${enrichedPrompts.length} prompts, ${uniqueConversations} workspaces`);
        return this.cache;
      } catch (error) {
        console.error('Error getting all data:', error.message);
        return this.cache; // Return cached data on error
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Extract AI service data from all workspaces and thread them
   */
  async extractAllAIServiceData() {
    try {
      const { workspaces: workspaceRoot } = this.dbPaths;
      
      if (!fs.existsSync(workspaceRoot)) {
        return [];
      }

      const workspaceDirs = fs.readdirSync(workspaceRoot)
        .filter(name => {
          const dbPath = path.join(workspaceRoot, name, 'state.vscdb');
          return fs.existsSync(dbPath);
        });

      console.log(`[AI-SERVICE] Extracting from ${workspaceDirs.length} workspaces...`);

      const allMessages = [];
      
      for (const workspaceId of workspaceDirs) {
        const dbPath = path.join(workspaceRoot, workspaceId, 'state.vscdb');
        const { prompts, generations, conversationMetadata } = await this.extractAIServiceData(dbPath);
        
        // Get workspace metadata
        const workspacePath = this.getWorkspacePath(workspaceId);
        const workspaceName = this.getWorkspaceName(workspacePath);

        // Link prompts to generations by UUID and create threaded conversations
        const linked = this.linkPromptsToGenerations(prompts, generations, workspaceId, workspacePath, workspaceName, conversationMetadata);
        allMessages.push(...linked);
      }

      console.log(`[AI-SERVICE] Extracted ${allMessages.length} messages with conversation threading`);
      return allMessages;
    } catch (error) {
      console.warn('Error extracting AI service data:', error.message);
      return [];
    }
  }

  /**
   * Link user prompts to AI generations and create conversation threads
   */
  linkPromptsToGenerations(prompts, generations, workspaceId, workspacePath, workspaceName, conversationMetadata = {}) {
    const threaded = [];
    const genMap = new Map();

    // Build generation lookup by UUID
    generations.forEach(gen => {
      if (gen.generationUUID) {
        genMap.set(gen.generationUUID, gen);
      }
    });

    // Create a map of conversation titles by conversationId if available
    const conversationTitleMap = new Map();
    if (conversationMetadata && typeof conversationMetadata === 'object') {
      // If conversationMetadata is an array of conversations
      if (Array.isArray(conversationMetadata)) {
        conversationMetadata.forEach(conv => {
          if (conv.id && conv.title) {
            conversationTitleMap.set(conv.id, conv.title);
          }
        });
      } else if (conversationMetadata.conversations && Array.isArray(conversationMetadata.conversations)) {
        conversationMetadata.conversations.forEach(conv => {
          if (conv.id && conv.title) {
            conversationTitleMap.set(conv.id, conv.title);
          }
        });
      }
    }

    // Link prompts to their responses
    prompts.forEach((prompt, idx) => {
      const correspondingGen = genMap.get(prompt.generationUUID);
      
      // Estimate timestamp if not available
      let timestamp = prompt.timestamp;
      if (!timestamp && correspondingGen && correspondingGen.timestamp) {
        timestamp = correspondingGen.timestamp - 30000; // 30 seconds before AI response
      }

      // Create conversation ID from generation UUID or workspace + index
      const conversationId = prompt.generationUUID || prompt.conversationId || `${workspaceId}_${idx}`;

      // Determine conversation title: prefer explicit title, then metadata map, then prompt text
      let conversationTitle = prompt.conversationTitle || 
                              conversationTitleMap.get(conversationId) ||
                              conversationTitleMap.get(prompt.conversationId) ||
                              null;
      
      // Fallback to first 100 chars of prompt text if no title found
      if (!conversationTitle) {
        conversationTitle = prompt.text.substring(0, 100);
      }

      // Add user message
      const isConversationThread = prompt.type === 'composer';
      threaded.push({
        id: `${conversationId}_user`,
        text: prompt.text,
        timestamp: timestamp || Date.now(),
        workspaceId: workspaceId,
        workspacePath: workspacePath,
        workspaceName: workspaceName,
        composerId: conversationId,
        source: 'aiService',
        type: isConversationThread ? 'conversation-thread' : 'user-prompt',
        messageRole: 'user',
        // Don't set parentConversationId for thread initiators (so dashboard can identify them as threads)
        parentConversationId: isConversationThread ? undefined : conversationId,
        conversationTitle: conversationTitle,
        confidence: 'high',
        status: 'captured'
      });

      // Add AI response if it exists
      if (correspondingGen) {
        // Use the same conversation title we determined above
        threaded.push({
          id: `${conversationId}_assistant`,
          text: correspondingGen.text,
          timestamp: correspondingGen.timestamp || timestamp + 30000,
          workspaceId: workspaceId,
          workspacePath: workspacePath,
          workspaceName: workspaceName,
          composerId: conversationId,
          source: 'aiService',
          type: 'ai-response',
          messageRole: 'assistant',
          parentConversationId: conversationId,
          conversationTitle: conversationTitle,
          model: correspondingGen.model,
          finishReason: correspondingGen.finishReason,
          thinkingTimeSeconds: correspondingGen.timestamp && timestamp 
            ? ((correspondingGen.timestamp - timestamp) / 1000).toFixed(2)
            : null,
          confidence: 'high',
          status: 'captured'
        });
      }
    });

    return threaded;
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring(callback) {
    console.log('[SEARCH] Starting Cursor database monitoring...');
    
    // Initial extraction
    this.getAllData().then(data => {
      if (callback) callback(data);
    });

    // Periodic updates
    this.monitoringInterval = setInterval(async () => {
      try {
        const data = await this.getAllData();
        if (callback) callback(data);
      } catch (error) {
        console.error('Monitoring error:', error.message);
      }
    }, this.updateInterval);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      console.log('⏹️  Stopped Cursor database monitoring');
    }
  }
}

module.exports = CursorDatabaseParser;

// Test if run directly
if (require.main === module) {
  const parser = new CursorDatabaseParser();
  
  parser.getAllData().then(data => {
    console.log('\n[DATA] Cursor Database Extraction Results:');
    console.log('=====================================');
    console.log(`Conversations: ${data.conversations.length}`);
    console.log(`Prompts: ${data.prompts.length}`);
    console.log('\nSample Prompts:');
    data.prompts.slice(0, 5).forEach((prompt, i) => {
      const text = prompt.text || prompt.preview || 'No text';
      console.log(`${i + 1}. ${text.substring(0, 100)}...`);
    });
  }).catch(error => {
    console.error('Error:', error);
  });
}

