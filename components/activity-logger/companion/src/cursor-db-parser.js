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
   * Extract composer/chat data from global state database
   */
  async extractComposerData() {
    try {
      const { global } = this.dbPaths;
      
      if (!fs.existsSync(global)) {
        console.log('⚠️  Cursor global database not found');
        return [];
      }

      // Query for composer chat data
      const query = `
        SELECT key, value 
        FROM ItemTable 
        WHERE key LIKE '%composer%' 
           OR key LIKE '%chat%'
           OR key LIKE '%backgroundComposer%'
      `;

      const { stdout } = await execAsync(
        `sqlite3 "${global}" "${query.replace(/\n/g, ' ')}"`
      );

      const conversations = [];
      const lines = stdout.trim().split('\n').filter(l => l);

      for (const line of lines) {
        try {
          const [key, valueBlob] = line.split('|', 2);
          
          // Skip hidden states
          if (key.includes('.hidden')) continue;
          
          // Parse the value blob (usually JSON or binary)
          if (valueBlob && valueBlob.length > 50) {
            // Try to extract JSON data
            const jsonMatch = valueBlob.match(/\{.*\}/);
            if (jsonMatch) {
              try {
                const data = JSON.parse(jsonMatch[0]);
                conversations.push({
                  id: key,
                  type: this.determineType(key),
                  data: data,
                  timestamp: Date.now(),
                  extracted: true
                });
              } catch (jsonError) {
                // Not valid JSON, try to extract text
                const textData = this.extractTextFromBlob(valueBlob);
                if (textData) {
                  conversations.push({
                    id: key,
                    type: this.determineType(key),
                    text: textData,
                    timestamp: Date.now(),
                    extracted: true
                  });
                }
              }
            }
          }
        } catch (error) {
          // Skip invalid entries
        }
      }

      console.log(`[DATA] Extracted ${conversations.length} composer conversations`);
      return conversations;

    } catch (error) {
      console.error('Error extracting composer data:', error.message);
      return [];
    }
  }

  /**
   * Extract workspace-specific prompts with actual conversation titles
   */
  async extractWorkspacePrompts() {
    try {
      const { workspaces } = this.dbPaths;
      
      if (!fs.existsSync(workspaces)) {
        return [];
      }

      const prompts = [];
      const workspaceDirs = fs.readdirSync(workspaces);

      // Check ALL workspaces (not just recent 5)
      const allWorkspaces = workspaceDirs
        .map(dir => ({
          dir,
          path: path.join(workspaces, dir),
          mtime: fs.statSync(path.join(workspaces, dir)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      for (const workspace of allWorkspaces) {
        const dbPath = path.join(workspace.path, 'state.vscdb');
        
        if (fs.existsSync(dbPath)) {
          try {
            // Get composer data which has conversation titles
            const { stdout } = await execAsync(
              `sqlite3 "${dbPath}" "SELECT value FROM ItemTable WHERE key = 'composer.composerData'"`
            );

            if (stdout && stdout.length > 50) {
              try {
                const data = JSON.parse(stdout.trim());
                
                // Extract actual conversation titles
                if (data.allComposers && Array.isArray(data.allComposers)) {
                  // Resolve workspace ID to actual path
                  const workspacePath = this.getWorkspacePath(workspace.dir);
                  const workspaceName = this.getWorkspaceName(workspacePath);
                  
                  data.allComposers.forEach(composer => {
                    if (composer.name) {
                      const mode = composer.unifiedMode || composer.forceMode || 'unknown';
                      const isAuto = composer.unifiedMode === 'agent';
                      
                      // Infer model name from mode (based on Cursor defaults as of Oct 2024)
                      let modelName = 'unknown';
                      if (isAuto || mode === 'agent') {
                        modelName = 'claude-4.5-sonnet';  // Default for Agent/Auto mode
                      } else if (mode === 'chat') {
                        modelName = 'claude-4.5-sonnet';  // Default for Chat mode
                      } else if (mode === 'edit') {
                        modelName = 'claude-4.5-sonnet';  // Default for Edit mode (CMD+K)
                      }
                      
                      // ===== NEW: Extract context files from composer =====
                      const contextFiles = this.extractContextFilesFromComposer(composer);
                      
                      prompts.push({
                        text: composer.name,
                        workspaceId: workspace.dir,
                        workspacePath: workspacePath,
                        workspaceName: workspaceName,
                        composerId: composer.composerId,
                        timestamp: composer.lastUpdatedAt || composer.createdAt || workspace.mtime,
                        source: 'composer',
                        type: 'conversation',
                        subtitle: composer.subtitle || '',
                        linesAdded: composer.totalLinesAdded || 0,
                        linesRemoved: composer.totalLinesRemoved || 0,
                        contextUsage: composer.contextUsagePercent || 0,
                        // Model/mode information
                        mode: mode,
                        modelType: composer.unifiedMode || 'unknown', // 'agent', 'chat', 'edit'
                        forceMode: composer.forceMode || 'unknown',
                        isAuto: isAuto,
                        modelName: modelName,  // Inferred model name
                        // NEW: Context files
                        contextFiles: contextFiles,
                        status: 'captured',
                        confidence: 'high'
                      });
                    }
                  });
                }
              } catch (jsonError) {
                console.warn(`Could not parse composer data for workspace ${workspace.dir}`);
              }
            }
          } catch (dbError) {
            // Skip workspace if DB is locked or inaccessible
          }
        }
      }

      console.log(`[NOTE] Extracted ${prompts.length} workspace prompts`);
      return prompts;

    } catch (error) {
      console.error('Error extracting workspace prompts:', error.message);
      return [];
    }
  }

  /**
   * Parse persistent composer data and extract actual prompts
   */
  async parsePersistentComposerData() {
    try {
      const { global } = this.dbPaths;
      
      // Get composer data which contains actual conversation content
      const composerQuery = `
        SELECT key, value 
        FROM ItemTable 
        WHERE key LIKE '%composer.composerData%'
           OR key LIKE '%backgroundComposer.persistentData%'
           OR key LIKE '%aichat%'
           OR key LIKE '%conversation%'
      `;

      const { stdout } = await execAsync(
        `sqlite3 "${global}" "${composerQuery.replace(/\n/g, ' ')}"`
      );

      const prompts = [];
      
      if (stdout && stdout.length > 10) {
        const lines = stdout.trim().split('\n');
        
        for (const line of lines) {
          const [key, valueBlob] = line.split('|', 2);
          
          if (valueBlob && valueBlob.length > 50) {
            // Try to parse as JSON
            try {
              // Extract JSON from the blob
              const jsonMatch = valueBlob.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                
                // Extract prompts from composer data
                if (data.allComposers && Array.isArray(data.allComposers)) {
                  data.allComposers.forEach(composer => {
                    if (composer.name) {
                      prompts.push({
                        text: composer.name,
                        timestamp: composer.lastUpdatedAt || composer.createdAt || Date.now(),
                        source: 'composer',
                        type: 'conversation-title',
                        composerId: composer.composerId,
                        status: 'captured',
                        confidence: 'high'
                      });
                    }
                    
                    // Extract messages if available
                    if (composer.messages && Array.isArray(composer.messages)) {
                      let previousUserPrompt = null;
                      
                      composer.messages.forEach(msg => {
                        if (msg.text || msg.content) {
                          const message = {
                            text: msg.text || msg.content,
                            timestamp: msg.timestamp || Date.now(),
                            source: 'composer-message',
                            type: msg.role === 'user' ? 'user-prompt' : 'ai-response',
                            composerId: composer.composerId,
                            status: 'captured',
                            confidence: 'high'
                          };
                          
                          // NEW: Calculate thinking time for AI responses
                          if (msg.role === 'assistant' && previousUserPrompt) {
                            const thinkingTime = message.timestamp - previousUserPrompt.timestamp;
                            if (thinkingTime > 0 && thinkingTime < 300000) { // Max 5 minutes
                              message.thinkingTime = thinkingTime;
                              message.thinkingTimeSeconds = (thinkingTime / 1000).toFixed(2);
                            }
                          }
                          
                          // NEW: Extract terminal blocks from prompt
                          if (msg.role === 'user') {
                            message.terminalBlocks = this.extractTerminalBlocks(message.text);
                            previousUserPrompt = message;
                          }
                          
                          // NEW: Detect images/attachments
                          if (msg.attachments || msg.images) {
                            message.hasAttachments = true;
                            message.attachmentCount = (msg.attachments?.length || 0) + (msg.images?.length || 0);
                          }
                          
                          prompts.push(message);
                        }
                      });
                    }
                  });
                }
                
                // Extract from setup/terminal data
                if (data.ranTerminalCommands && Array.isArray(data.ranTerminalCommands)) {
                  data.ranTerminalCommands.forEach(cmd => {
                    if (cmd && cmd.length > 5) {
                      prompts.push({
                        text: cmd,
                        timestamp: Date.now(),
                        source: 'terminal-command',
                        type: 'command',
                        status: 'captured',
                        confidence: 'medium'
                      });
                    }
                  });
                }
              }
            } catch (jsonError) {
              // If JSON parsing fails, try to extract text
              const textData = this.extractTextFromBlob(valueBlob);
              if (textData && textData.length > 20) {
                const extractedPrompts = this.extractPromptsFromText(textData);
                prompts.push(...extractedPrompts);
              }
            }
          }
        }
      }

      console.log(`[CHAT] Extracted ${prompts.length} prompts from persistent data`);
      return prompts;
    } catch (error) {
      console.error('Error parsing persistent composer data:', error.message);
      return [];
    }
  }

  /**
   * Extract context files from composer object
   */
  extractContextFilesFromComposer(composer) {
    const files = [];
    const fileSet = new Set(); // To avoid duplicates
    
    try {
      // Extract from tabs array (files open in editor)
      if (composer.tabs && Array.isArray(composer.tabs)) {
        composer.tabs.forEach(tab => {
          const filePath = tab.path || tab.uri || tab.resource?.path;
          if (filePath && !fileSet.has(filePath)) {
            fileSet.add(filePath);
            files.push({
              path: filePath,
              name: path.basename(filePath),
              source: 'open_tab',
              isActive: tab.isActive || false,
              isPinned: tab.isPinned || false
            });
          }
        });
      }
      
      // Extract from codebase context (auto-selected files)
      if (composer.codebaseContext && Array.isArray(composer.codebaseContext)) {
        composer.codebaseContext.forEach(ctx => {
          const filePath = ctx.path || ctx.file || ctx.uri;
          if (filePath && !fileSet.has(filePath)) {
            fileSet.add(filePath);
            files.push({
              path: filePath,
              name: path.basename(filePath),
              source: 'codebase_search',
              score: ctx.score || 0
            });
          }
        });
      }
      
      // Extract from mentions (@ references)
      if (composer.mentions && Array.isArray(composer.mentions)) {
        composer.mentions.forEach(mention => {
          const filePath = mention.path || mention.file || mention;
          if (filePath && typeof filePath === 'string' && !fileSet.has(filePath)) {
            fileSet.add(filePath);
            files.push({
              path: filePath,
              name: path.basename(filePath),
              source: 'explicit_mention'
            });
          }
        });
      }
      
      // Extract from attached files
      if (composer.files && Array.isArray(composer.files)) {
        composer.files.forEach(file => {
          const filePath = file.path || file.uri || file;
          if (filePath && typeof filePath === 'string' && !fileSet.has(filePath)) {
            fileSet.add(filePath);
            files.push({
              path: filePath,
              name: path.basename(filePath),
              source: 'composer_attached'
            });
          }
        });
      }
      
      // Extract from context array (generic context items)
      if (composer.context && Array.isArray(composer.context)) {
        composer.context.forEach(ctx => {
          const filePath = ctx.path || ctx.file || ctx.uri || ctx;
          if (filePath && typeof filePath === 'string' && !fileSet.has(filePath)) {
            fileSet.add(filePath);
            files.push({
              path: filePath,
              name: path.basename(filePath),
              source: 'context_item',
              score: ctx.score || 0
            });
          }
        });
      }
      
      return {
        files: files,
        count: files.length,
        countBySource: {
          explicit: files.filter(f => f.source === 'explicit_mention').length,
          tabs: files.filter(f => f.source === 'open_tab').length,
          auto: files.filter(f => f.source === 'codebase_search' || f.source === 'composer_attached' || f.source === 'context_item').length
        }
      };
      
    } catch (error) {
      console.warn('Error extracting context files from composer:', error.message);
      return { files: [], count: 0, countBySource: { explicit: 0, tabs: 0, auto: 0 } };
    }
  }

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
   * Extract readable text from binary blob
   */
  extractTextFromBlob(blob) {
    // Remove non-printable characters but keep newlines and spaces
    const text = blob.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ');
    
    // Extract meaningful text chunks
    const chunks = text.match(/[a-zA-Z0-9\s\.\,\!\?\:\;\-\_\'\"]{20,}/g);
    
    return chunks ? chunks.join(' ').trim() : '';
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
   * Extract individual prompts from text
   */
  extractPromptsFromText(text) {
    if (!text || text.length < 20) return [];

    const prompts = [];
    
    // Look for common prompt patterns
    const patterns = [
      /(?:create|make|build|write|generate|fix|refactor|explain|add|remove|update|modify)\s+[a-zA-Z\s]{10,200}/gi,
      /(?:can you|could you|please|how do|how to|what is)\s+[a-zA-Z\s]{10,200}/gi,
      /(?:bug|error|issue|problem)[\s\w]{10,200}/gi
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          if (match.length > 20 && match.length < 500) {
            prompts.push({
              text: match.trim(),
              timestamp: Date.now(),
              source: 'composer',
              status: 'extracted',
              confidence: 'medium'
            });
          }
        });
      }
    }

    // Remove duplicates
    const unique = Array.from(new Set(prompts.map(p => p.text)))
      .map(text => prompts.find(p => p.text === text));

    return unique;
  }

  /**
   * Determine conversation type from key
   */
  determineType(key) {
    if (key.includes('backgroundComposer')) return 'background-composer';
    if (key.includes('composerChatViewPane')) return 'chat-panel';
    if (key.includes('chat.')) return 'chat';
    if (key.includes('composer.')) return 'composer';
    return 'unknown';
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
   */
  async getAllData() {
    const now = Date.now();
    
    // Use cache if recent
    if (now - this.cache.lastUpdate < this.updateInterval) {
      return this.cache;
    }

    try {
      const [composerData, workspacePrompts, persistentPrompts] = await Promise.all([
        this.extractComposerData(),
        this.extractWorkspacePrompts(),
        this.parsePersistentComposerData()
      ]);

      // Combine all prompts
      const allPrompts = [
        ...persistentPrompts,
        ...workspacePrompts
      ];

      // Enrich prompts with context information
      const enrichedPrompts = await this.extractContextForPrompts(allPrompts);

      this.cache = {
        conversations: composerData,
        prompts: enrichedPrompts,
        lastUpdate: now,
        stats: {
          totalConversations: composerData.length,
          totalPrompts: enrichedPrompts.length,
          workspaces: workspacePrompts.length
        }
      };

      return this.cache;
    } catch (error) {
      console.error('Error getting all data:', error.message);
      return this.cache; // Return cached data on error
    }
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

