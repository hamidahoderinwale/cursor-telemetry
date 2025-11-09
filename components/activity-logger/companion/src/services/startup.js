/**
 * Startup service - handles application initialization
 */

function createStartupService(deps) {
  const {
    persistentDB,
    schemaMigrations,
    db,
    dbRepairService,
    server,
    PORT,
    HOST,
    config,
    startFileWatcher,
    clipboardMonitor,
    terminalMonitor,
    errorTracker,
    startRawDataCapture,
    buildLunrIndex,
    checkSessionTimeout,
    cursorDbParser,
    dbRef,
    contextAnalyzer,
    contextChangeTracker,
    productivityTracker,
    todosRoutes,
    activeSession
  } = deps;

  async function loadPersistedData() {
    try {
      console.log('[SAVE] Initializing database (lazy loading mode)...');
      await persistentDB.init();
      
      try {
        const migrationResult = await schemaMigrations.migrate();
        if (migrationResult.migrations.length > 0) {
          console.log(`[MIGRATIONS] Applied ${migrationResult.migrations.length} migration(s): ${migrationResult.migrations.map(m => m.migration).join(', ')}`);
        }
      } catch (migrationErr) {
        console.warn('[MIGRATIONS] Migration warning:', migrationErr.message);
      }
      
      const stats = await persistentDB.getStats();
      
      const maxIds = await persistentDB.getMaxIds();
      db.nextId = Math.max(maxIds.entryId || 0, maxIds.promptId || 0) + 1;
      
      db._entries = [];
      db._prompts = [];
      
      console.log(`[SUCCESS] Database ready with ${stats.entries} entries and ${stats.prompts} prompts (lazy loading)`);
      console.log(`[MEMORY] In-memory cache disabled - using on-demand queries`);
    } catch (error) {
      console.error('Error loading persisted data:', error.message);
      console.log('   Starting with empty database');
    }
  }

  function startServer() {
    return new Promise((resolve, reject) => {
      loadPersistedData().then(() => {
        dbRepairService.repairDatabaseLinks().then(result => {
          if (result.repaired > 0) {
            console.log(`[REPAIR] Repaired ${result.repaired} database links on startup`);
          }
        }).catch(err => {
          console.warn('[REPAIR] Link repair failed (non-critical):', err.message);
        });
        
        server.listen(PORT, HOST, () => {
          console.log(`[LAUNCH] Companion service running on http://${HOST}:${PORT}`);
          console.log(`[DATA] Health endpoint: http://${HOST}:${PORT}/health`);
          console.log(`[UP] Activity endpoint: http://${HOST}:${PORT}/api/activity`);
          console.log(`[SEARCH] Queue endpoint: http://${HOST}:${PORT}/queue`);
          console.log(` WebSocket server running on ws://${HOST}:${PORT}`);
          
          const workspacesToWatch = config.workspace_roots || config.workspaces || [config.root_dir];
          const autoDetect = config.auto_detect_workspaces !== false;
          if (autoDetect) {
            console.log(` Auto-detecting workspaces from ${workspacesToWatch.length} root location(s):`);
          } else {
            console.log(` Watching ${workspacesToWatch.length} configured workspace(s):`);
          }
          workspacesToWatch.forEach((ws, i) => {
            console.log(`   ${i + 1}. ${ws}`);
          });
          console.log(` Ignoring: ${config.ignore.length} patterns`);
          
          startFileWatcher();
          
          if (config.enable_clipboard === true) {
            clipboardMonitor.start();
            console.log(' Clipboard monitor started for prompt capture');
          } else {
            console.log(' Clipboard monitor disabled in config');
          }
          
          console.log('[SYNC] Automatic prompt sync DISABLED (use /api/cursor-database for fresh data)');
          
          if (config.enable_terminal_monitoring !== false) {
            terminalMonitor.start();
            
            terminalMonitor.on('command', async (commandRecord) => {
              try {
                await persistentDB.saveTerminalCommand(commandRecord);
              } catch (error) {
                console.error('Error persisting terminal command:', error);
              }
              
              if (commandRecord.exitCode && commandRecord.exitCode !== 0) {
                errorTracker.trackTerminalError(
                  commandRecord.command,
                  commandRecord.output || '',
                  commandRecord.exitCode
                );
              }
              
              if (global.io) {
                global.io.emit('terminal-command', commandRecord);
              }
            });
            
            console.log('[SYSTEM]  Terminal monitor started for command tracking');
          } else {
            console.log(' Terminal monitor disabled in config');
          }
          
          startRawDataCapture();
          buildLunrIndex();
          
          setInterval(() => {
            checkSessionTimeout();
          }, 5 * 60 * 1000);
          
          console.log('[TIME] Session timeout check started (every 5 minutes)');
          
          console.log('[SEARCH] Starting Cursor database monitoring...');
          cursorDbParser.startMonitoring(async (data) => {
            if (data.prompts && data.prompts.length > 0) {
              console.log(`[CHAT] Found ${data.prompts.length} prompts in Cursor database`);
              
              // Check if dbRef is available and has prompts array
              if (!dbRef || !dbRef.prompts) {
                console.warn('[CHAT] dbRef not available, skipping prompt processing');
                return;
              }
              
              for (const prompt of data.prompts) {
                const exists = dbRef.prompts.find(p => p.text === prompt.text);
                if (!exists) {
                  const enhancedPrompt = {
                    ...prompt,
                    id: dbRef.nextId++,
                    added_from_database: true
                  };
                  
                  dbRef.prompts.push(enhancedPrompt);
                  
                  try {
                    await persistentDB.savePrompt(enhancedPrompt);
                    console.log(`   Saved prompt to SQLite: ${enhancedPrompt.id}`);
                    
                    const currentActiveTodo = todosRoutes.getCurrentActiveTodo();
                    if (currentActiveTodo) {
                      await persistentDB.addPromptToTodo(currentActiveTodo, enhancedPrompt.id);
                      await persistentDB.linkEventToTodo('prompt', enhancedPrompt.id);
                      console.log(`   [TODO] Linked prompt ${enhancedPrompt.id} to TODO ${currentActiveTodo}`);
                    }
                  } catch (saveError) {
                    console.warn('Error saving prompt to database:', saveError.message);
                  }
                  
                  try {
                    const contextAnalysis = await contextAnalyzer.analyzePromptContext(prompt);
                    if (contextAnalysis) {
                      enhancedPrompt.contextAnalysis = contextAnalysis;
                      
                      const contextChange = await contextChangeTracker.trackContextChange(
                        contextAnalysis,
                        {
                          promptId: enhancedPrompt.id,
                          timestamp: Date.now(),
                          sessionId: activeSession()
                        }
                      );
                      if (contextChange) {
                        enhancedPrompt.contextChange = contextChange;
                      }
                    }
                    
                    productivityTracker.trackPromptCreated(enhancedPrompt);
                    productivityTracker.detectPromptIteration(enhancedPrompt, dbRef.prompts);
                    
                    if (enhancedPrompt.linkedEntryId) {
                      const linkedEntry = dbRef.entries.find(e => e.id === enhancedPrompt.linkedEntryId);
                      if (linkedEntry) {
                        productivityTracker.markAIGeneratedCode(linkedEntry);
                      }
                    }
                  } catch (trackingError) {
                    console.warn('Error tracking prompt analytics:', trackingError.message);
                  }
                }
              }
            }
          });
          
          resolve();
        });
      }).catch(error => {
        console.error('Failed to load persisted data:', error);
        server.listen(PORT, HOST, () => {
          console.log(`[LAUNCH] Companion service running on http://${HOST}:${PORT} (without persisted data)`);
        });
        reject(error);
      });
    });
  }

  return {
    loadPersistedData,
    startServer
  };
}

module.exports = createStartupService;

