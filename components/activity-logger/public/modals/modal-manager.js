/**
 * Modal Manager
 * Handles event, prompt, thread, and terminal modals
 */

// Global function for switching diff views (must be defined before modals are rendered)
window.switchDiffView = window.switchDiffView || function(id, view) {
  const codeView = document.getElementById(id + '_code_view');
  const astView = document.getElementById(id + '_ast_view');
  const codeBtn = document.getElementById(id + '_code_btn');
  const astBtn = document.getElementById(id + '_ast_btn');
  
  if (!codeView || !astView || !codeBtn || !astBtn) {
    console.warn('[MODAL] Diff view elements not found for:', id);
    return;
  }
  
  if (view === 'code') {
    codeView.style.display = 'block';
    astView.style.display = 'none';
    codeBtn.style.background = 'var(--color-primary)';
    codeBtn.style.color = 'white';
    astBtn.style.background = 'var(--color-surface)';
    astBtn.style.color = 'var(--color-text-muted)';
  } else {
    codeView.style.display = 'none';
    astView.style.display = 'block';
    astBtn.style.background = 'var(--color-primary)';
    astBtn.style.color = 'white';
    codeBtn.style.background = 'var(--color-surface)';
    codeBtn.style.color = 'var(--color-text-muted)';
    
    // Render AST if not already rendered
    const container = document.getElementById(id + '_ast_container');
    if (container && !container.dataset.rendered) {
      // Check if AST modules are loaded
      if (!window.ASTParser || !window.ASTVisualizer) {
        // Wait for modules to load (they're deferred)
        const checkModules = setInterval(() => {
          if (window.ASTParser && window.ASTVisualizer) {
            clearInterval(checkModules);
            // Retry rendering after modules load by calling switchDiffView again
            setTimeout(() => {
              const astBtn = document.getElementById(id + '_ast_btn');
              if (astBtn) {
                switchDiffView(id, 'ast');
              }
            }, 100);
          }
        }, 100);
        
        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkModules);
          if (!window.ASTParser || !window.ASTVisualizer) {
            container.innerHTML = '<div style="padding: var(--space-lg); text-align: center; color: var(--color-text-muted);">AST visualization modules are still loading. Please try again in a moment.</div>';
          }
        }, 5000);
        return;
      }
      
      container.dataset.rendered = 'true';
      const data = window._astData && window._astData[id];
      if (data && (data.beforeCode || data.afterCode)) {
        try {
          const parser = new window.ASTParser();
          const language = parser.detectLanguage(data.filePath, data.beforeCode || data.afterCode);
          
          const beforeAST = data.beforeCode ? parser.parseCode(data.beforeCode, language) : null;
          const afterAST = data.afterCode ? parser.parseCode(data.afterCode, language) : null;
          
          if (beforeAST && afterAST) {
            parser.compareASTs(beforeAST, afterAST);
            const visualizer = new window.ASTVisualizer(id + '_ast_container');
            visualizer.renderComparison(beforeAST, afterAST, { width: container.clientWidth || 800, height: 400 });
          } else if (afterAST) {
            const visualizer = new window.ASTVisualizer(id + '_ast_container');
            visualizer.renderAST(afterAST, { width: container.clientWidth || 800, height: 400 });
          } else if (beforeAST) {
            const visualizer = new window.ASTVisualizer(id + '_ast_container');
            visualizer.renderAST(beforeAST, { width: container.clientWidth || 800, height: 400 });
          } else {
            container.innerHTML = '<div style="padding: var(--space-lg); text-align: center; color: var(--color-text-muted);">No code available for AST visualization</div>';
          }
        } catch (error) {
          console.error('[MODAL] Error rendering AST:', error);
          container.innerHTML = `<div style="padding: var(--space-lg); text-align: center; color: var(--color-error);">Error rendering AST: ${error.message}</div>`;
        }
      } else {
        // Check if data exists but is empty
        if (window._astData && window._astData[id] && (!data.beforeCode && !data.afterCode)) {
          container.innerHTML = '<div style="padding: var(--space-lg); text-align: center; color: var(--color-text-muted);">No code available for AST visualization</div>';
        } else {
          container.innerHTML = '<div style="padding: var(--space-lg); text-align: center; color: var(--color-text-muted);">No AST data available. The code diff may not have been loaded yet.</div>';
        }
      }
    }
  }
};

class ModalManager {
  constructor() {
    this.state = window.state;
    this.escapeHtml = window.escapeHtml || ((text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    });
    this.truncate = window.truncate || ((str, length) => {
      return str && str.length > length ? str.substring(0, length) + '...' : str;
    });
    this.isImageFile = window.isImageFile || ((filePath) => {
      return filePath && /\.(png|jpg|jpeg|gif|bmp|webp|svg)$/i.test(filePath);
    });
    this.copyToClipboard = window.copyToClipboard;
    this.formatTimeAgo = window.formatTimeAgo;
    // Store reference but don't assume it's a function yet
    this.getEventTitle = null;
    this.findRelatedPrompts = window.findRelatedPrompts;
    this.groupIntoThreads = window.groupIntoThreads;
  }

  async showEventModal(eventId) {
    const modal = document.getElementById('eventModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    
    if (!modal || !title || !body) {
      console.error('[MODAL] Modal elements not found');
      return;
    }
    
    // Show loading state
    title.textContent = 'Loading...';
    body.innerHTML = `
      <div style="text-align: center; padding: var(--space-xl); color: var(--color-text-muted);">
        <div style="margin-bottom: var(--space-md);">Loading event/prompt details...</div>
        <div style="font-size: var(--text-sm);">ID: ${eventId}</div>
      </div>
    `;
    modal.classList.add('active');
    
    // Add click handler to overlay to close modal
    const overlay = modal.querySelector('.modal-overlay');
    if (overlay && !overlay._closeHandler) {
      overlay._closeHandler = (e) => {
        if (e.target === overlay) {
          this.closeEventModal();
        }
      };
      overlay.addEventListener('click', overlay._closeHandler);
    }
    
    // Add Escape key handler
    if (!modal._escapeHandler) {
      modal._escapeHandler = (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
          this.closeEventModal();
        }
      };
      document.addEventListener('keydown', modal._escapeHandler);
    }
    
    // Check if it's an event or a prompt in cache
    let event = this.state?.data?.events?.find(e => 
      e.id === eventId || 
      e.id === parseInt(eventId) || 
      String(e.id) === String(eventId) ||
      e.timestamp === eventId
    );
    let prompt = this.state?.data?.prompts?.find(p => 
      p.id === eventId || 
      p.id === parseInt(eventId) || 
      String(p.id) === String(eventId) ||
      p.timestamp === eventId
    );
    
    // If not in cache, try fetching from API
    if (!event && !prompt) {
      console.log(`[MODAL] Event/prompt ${eventId} not found in cache, fetching from API...`);
      
      try {
        // Try fetching from events API first
        const eventResponse = await fetch(`${window.CONFIG?.API_BASE || 'http://localhost:43917'}/api/activity?id=${eventId}`);
        if (eventResponse.ok) {
          const eventData = await eventResponse.json();
          if (eventData.data && Array.isArray(eventData.data) && eventData.data.length > 0) {
            event = eventData.data.find(e => 
              e.id === eventId || 
              e.id === parseInt(eventId) || 
              String(e.id) === String(eventId)
            );
          }
        }
        
        // If still not found, try entries/prompts API with larger limit
        if (!event && !prompt) {
          // Try with larger limit to find older items
          const entriesResponse = await fetch(`${window.CONFIG?.API_BASE || 'http://localhost:43917'}/entries?limit=1000`);
          if (entriesResponse.ok) {
            const entriesData = await entriesResponse.json();
            const allEntries = entriesData.entries || [];
            prompt = allEntries.find(p => 
              p.id === eventId || 
              p.id === parseInt(eventId) || 
              String(p.id) === String(eventId) ||
              p.id === Number(eventId)
            );
          }
          
          // Also try direct database query via API if available
          // Check if it's in the activity endpoint with larger limit
          if (!prompt && !event) {
            const largerActivityResponse = await fetch(`${window.CONFIG?.API_BASE || 'http://localhost:43917'}/api/activity?limit=1000`);
            if (largerActivityResponse.ok) {
              const activityData = await largerActivityResponse.json();
              const allActivity = activityData.data || [];
              event = allActivity.find(e => 
                e.id === eventId || 
                e.id === parseInt(eventId) || 
                String(e.id) === String(eventId) ||
                e.id === Number(eventId)
              );
              
              // Check if it's actually a prompt in the activity data
              if (!event) {
                prompt = allActivity.find(p => 
                  (p.id === eventId || p.id === parseInt(eventId) || String(p.id) === String(eventId)) &&
                  (p.type === 'prompt' || p.text || p.prompt)
                );
              }
            }
          }
        }
      } catch (apiError) {
        console.warn('[MODAL] API fetch failed:', apiError);
      }
      
      // If still not found after API fetch, show error
      if (!event && !prompt) {
        console.warn(`[MODAL] Event/prompt ${eventId} not found in API either`);
        title.textContent = 'Not Found';
        body.innerHTML = `
          <div style="text-align: center; padding: var(--space-xl); color: var(--color-text-muted);">
            <p style="font-size: var(--text-lg); margin-bottom: var(--space-md);">Event/Prompt #${eventId} could not be found.</p>
            <p style="font-size: var(--text-sm); margin-bottom: var(--space-md);">
              This item may not exist or may have been removed from the database.
            </p>
            <div style="margin-top: var(--space-lg);">
              <button onclick="window.switchView('activity')" style="
                padding: var(--space-sm) var(--space-md);
                background: var(--color-primary);
                color: white;
                border: none;
                border-radius: var(--radius-md);
                cursor: pointer;
                font-size: var(--text-sm);
              ">Go to Activity View</button>
            </div>
          </div>
        `;
        return;
      }
    }
    
    // Handle prompt display
    if (prompt && !event) {
      await this.showPromptInModal(prompt, modal, title, body);
      return;
    }
    
    // If we still don't have an event at this point, we already showed the error above
    if (!event) {
      return;
    }

    // Get event title with fallback
    // Only use window.getEventTitle - never reference this.getEventTitle to avoid errors
    let titleText = '';
    try {
      // Check if window.getEventTitle exists and is a function
      if (typeof window.getEventTitle === 'function') {
        titleText = window.getEventTitle(event);
      } else {
        // Fallback: generate title from event data
        throw new Error('getEventTitle not available');
      }
    } catch (error) {
      // Fallback if getEventTitle is not available or throws an error
      try {
        const eventType = event.type || 'Event';
        let filePath = event.file_path || '';
        
        if (!filePath && event.details) {
          try {
            const details = typeof event.details === 'string' ? JSON.parse(event.details || '{}') : event.details;
            filePath = details?.file_path || details?.filePath || '';
          } catch (e) {
            // Ignore parse errors
          }
        }
        
        const fileName = filePath ? filePath.split('/').pop() : 'Unknown';
        titleText = `${eventType}: ${fileName}`;
      } catch (fallbackError) {
        // Ultimate fallback
        titleText = event.type || 'Event';
      }
    }
    
    title.textContent = titleText;
    
    // Fetch related screenshots
    let relatedScreenshots = [];
    try {
      const screenshotsResponse = await fetch(`http://localhost:43917/api/screenshots/near/${event.timestamp}`);
      if (screenshotsResponse.ok) {
        const screenshotsData = await screenshotsResponse.json();
        if (screenshotsData.success) {
          relatedScreenshots = screenshotsData.screenshots;
        }
      }
    } catch (error) {
      // Suppress CORS/network errors (expected when companion service is offline)
      const errorMessage = error.message || error.toString();
      const isNetworkError = errorMessage.includes('CORS') || 
                             errorMessage.includes('NetworkError') || 
                             errorMessage.includes('Failed to fetch') ||
                             error.name === 'NetworkError' ||
                             error.name === 'TypeError';
      
      // Only log if it's not a network error
      if (!isNetworkError) {
        console.warn('Could not fetch screenshots:', error);
      }
    }

    try {
      let details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
      
      // Merge diff content from event object directly if not in details
      // The API sometimes stores before_code/after_code on the event object itself
      if (!details) details = {};
      if (!details.before_content && !details.before_code) {
        details.before_content = event.before_content || event.before_code || null;
      }
      if (!details.after_content && !details.after_code) {
        details.after_content = event.after_content || event.after_code || null;
      }
      
      // Also check for these fields directly on event if still not found
      if (!details.before_content && event.before_code) {
        details.before_content = event.before_code;
      }
      if (!details.after_content && event.after_code) {
        details.after_content = event.after_code;
      }
      
      // If we have diff stats but no content, try to fetch full entry details from API
      const hasDiffStats = (details?.lines_added > 0 || details?.lines_removed > 0 || 
                           details?.chars_added > 0 || details?.chars_deleted > 0 ||
                           (details?.diff_stats && (details.diff_stats.lines_added > 0 || details.diff_stats.lines_removed > 0)));
      const hasContent = (details?.before_content && details.before_content.trim().length > 0) || 
                        (details?.after_content && details.after_content.trim().length > 0);
      
      if (hasDiffStats && !hasContent) {
        // Try to fetch full entry details
        try {
          const entryResponse = await fetch(`${window.CONFIG?.API_BASE || 'http://localhost:43917'}/api/entries/${event.id}`);
          if (entryResponse.ok) {
            const entryData = await entryResponse.json();
            if (entryData && entryData.entry) {
              const entry = entryData.entry;
              // Merge the full entry data
              if (entry.before_code && !details.before_content) {
                details.before_content = entry.before_code;
              }
              if (entry.after_code && !details.after_content) {
                details.after_content = entry.after_code;
              }
              if (entry.before_content && !details.before_content) {
                details.before_content = entry.before_content;
              }
              if (entry.after_content && !details.after_content) {
                details.after_content = entry.after_content;
              }
              console.log('[MODAL] Fetched full entry details, content available:', {
                hasBefore: !!details.before_content,
                hasAfter: !!details.after_content,
                beforeLength: details.before_content?.length || 0,
                afterLength: details.after_content?.length || 0
              });
            }
          }
        } catch (fetchError) {
          console.debug('[MODAL] Could not fetch full entry details:', fetchError);
          // Continue without full content - we'll show what we have
        }
      }
      
      // Debug: Log code diff data structure
      console.log('[MODAL] Code diff check:', {
        eventId: event.id,
        eventType: event.type,
        hasDetails: !!details,
        detailsKeys: details ? Object.keys(details) : [],
        eventKeys: Object.keys(event).filter(k => k.includes('before') || k.includes('after') || k.includes('code') || k.includes('content')),
        before_content: details?.before_content ? `${details.before_content.substring(0, 50)}... (${details.before_content.length} chars)` : details?.before_content,
        after_content: details?.after_content ? `${details.after_content.substring(0, 50)}... (${details.after_content.length} chars)` : details?.after_content,
        before_code: details?.before_code ? `${details.before_code.substring(0, 50)}... (${details.before_code.length} chars)` : details?.before_code,
        after_code: details?.after_code ? `${details.after_code.substring(0, 50)}... (${details.after_code.length} chars)` : details?.after_code,
        event_before_code: event.before_code ? `${String(event.before_code).substring(0, 50)}... (${String(event.before_code).length} chars)` : event.before_code,
        event_after_code: event.after_code ? `${String(event.after_code).substring(0, 50)}... (${String(event.after_code).length} chars)` : event.after_code,
        before_content_defined: details?.before_content !== undefined,
        after_content_defined: details?.after_content !== undefined,
        before_code_defined: details?.before_code !== undefined,
        after_code_defined: details?.after_code !== undefined
      });
      
      // Check for directly linked prompt (entry.prompt_id)
      let linkedPrompt = null;
      if (event.prompt_id && this.state.data.prompts) {
        linkedPrompt = this.state.data.prompts.find(p => 
          p.id === event.prompt_id || p.id === parseInt(event.prompt_id)
        );
      }
      
      // Find related prompts by temporal proximity and workspace
      const relatedPrompts = this.findRelatedPrompts ? this.findRelatedPrompts(event) : [];
      const eventTime = new Date(event.timestamp).getTime();
      
      // Debug: Log prompt search results
      console.log('[MODAL] Prompt search:', {
        hasFindFunction: !!this.findRelatedPrompts,
        hasPrompts: !!(this.state.data.prompts && this.state.data.prompts.length > 0),
        promptsCount: this.state.data.prompts?.length || 0,
        relatedCount: relatedPrompts.length,
        eventTime: new Date(event.timestamp).toISOString(),
        eventWorkspace: event.workspace_path || event.details?.workspace_path
      });
      
      // Find related conversations (filter out unhelpful background composer state)
      const conversationsArray = Array.isArray(this.state.data.cursorConversations) ? this.state.data.cursorConversations : [];
      const relatedConversations = conversationsArray.filter(c => {
        if (!c || !c.timestamp) return false;
        
        // Filter out non-useful internal state mappings
        if (c.id && (
          c.id.includes('backgroundComposer.persistentData') ||
          c.id.includes('backgroundComposer.windowBcMapping') ||
          c.id.includes('workbench.backgroundComposer')
        )) {
          return false;
        }
        
        const convTime = new Date(c.timestamp).getTime();
        const diff = Math.abs(eventTime - convTime);
        return diff < 10 * 60 * 1000; // 10 minutes
      });
      
      // Find related terminal commands
      const terminalCommands = this.state.data?.terminalCommands || this.state.data?.terminals || [];
      const filePath = details?.file_path || event.file_path || '';
      const relatedTerminalCommands = terminalCommands.filter(cmd => {
        if (!cmd || !cmd.timestamp) return false;
        const cmdTime = new Date(cmd.timestamp).getTime();
        const timeDiff = Math.abs(eventTime - cmdTime);
        
        // Include commands within 5 minutes
        if (timeDiff > 5 * 60 * 1000) return false;
        
        // If file path is available, check if command references the file
        if (filePath) {
          const cmdText = (cmd.command || cmd.text || '').toLowerCase();
          const fileName = filePath.split('/').pop().toLowerCase();
          const dirName = filePath.split('/').slice(-2, -1)[0]?.toLowerCase() || '';
          
          // Check if command mentions the file or directory
          if (cmdText.includes(fileName) || (dirName && cmdText.includes(dirName))) {
            return true;
          }
          
          // Check if command's working directory matches file's directory
          if (cmd.cwd && filePath.includes(cmd.cwd)) {
            return true;
          }
        }
        
        // Include all commands within time window if no file filtering
        return true;
      }).slice(0, 10); // Limit to 10 most recent
      
      body.innerHTML = this._buildEventModalHTML(event, details, relatedScreenshots, relatedPrompts, relatedConversations, linkedPrompt, relatedTerminalCommands);
      
      // Initialize lazy loading for screenshots after HTML is inserted
      this._initializeLazyLoading(body);
    } catch (error) {
      body.innerHTML = `<div class="empty-state-text">Error loading event details: ${error.message}</div>`;
    }

    modal.classList.add('active');
  }

  _buildEventModalHTML(event, details, relatedScreenshots, relatedPrompts, relatedConversations, linkedPrompt = null, relatedTerminalCommands = []) {
    const { escapeHtml, truncate, isImageFile } = this;
    
    // Enhance model info from related prompts if event model info is all "Unknown"
    let enhancedModelInfo = event.modelInfo;
    if (enhancedModelInfo) {
      const modelInfoObj = typeof enhancedModelInfo === 'string' ? 
        (() => { try { return JSON.parse(enhancedModelInfo); } catch(e) { return {}; } })() : 
        enhancedModelInfo;
      
      const isAllUnknown = modelInfoObj.model === 'Unknown' && 
                          modelInfoObj.mode === 'Unknown' && 
                          modelInfoObj.provider === 'Unknown';
      
      if (isAllUnknown) {
        // Try to get model info from linked prompt first
        if (linkedPrompt) {
          const promptModelInfo = this._extractModelInfoFromPrompt(linkedPrompt);
          if (promptModelInfo && !this._isAllUnknown(promptModelInfo)) {
            enhancedModelInfo = { ...modelInfoObj, ...promptModelInfo, source: 'linked-prompt' };
          }
        }
        
        // If still unknown, try related prompts
        if (this._isAllUnknown(enhancedModelInfo) && relatedPrompts && relatedPrompts.length > 0) {
          const topRelated = relatedPrompts[0];
          const promptModelInfo = this._extractModelInfoFromPrompt(topRelated);
          if (promptModelInfo && !this._isAllUnknown(promptModelInfo)) {
            enhancedModelInfo = { ...modelInfoObj, ...promptModelInfo, source: 'related-prompt' };
          }
        }
      }
    }
    
    return `
      <div style="display: flex; flex-direction: column; gap: var(--space-xl);">
        
        ${linkedPrompt ? this._buildLinkedPromptSection(linkedPrompt, event) : ''}
        
        <!-- AI Annotation -->
        ${event.annotation ? `
          <div style="
            background: var(--color-bg-alt);
            border-left: 3px solid var(--color-primary);
            padding: var(--space-md);
            border-radius: var(--radius-md);
            margin-bottom: var(--space-md);
          ">
            <div style="
              display: flex;
              align-items: center;
              gap: var(--space-xs);
              margin-bottom: var(--space-xs);
              font-weight: 600;
              color: var(--color-text);
              font-size: 0.9em;
            ">
              <span style="font-size: 0.85em; color: var(--color-text-muted); font-weight: 500;">[AI]</span>
              <span>AI Annotation</span>
            </div>
            <div style="
              color: var(--color-text-secondary);
              font-style: italic;
              font-size: 0.95em;
              line-height: 1.5;
            ">
              ${escapeHtml(event.annotation)}
            </div>
            ${event.intent ? `
              <div style="margin-top: var(--space-sm);">
                <span class="badge" style="background: var(--color-primary); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.85em;">
                  ${escapeHtml(event.intent)}
                </span>
              </div>
            ` : ''}
          </div>
        ` : ''}
        
        <!-- Event Details -->
        <div>
          <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Event Details</h4>
          <div style="display: grid; gap: var(--space-sm);">
            <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
              <span style="color: var(--color-text-muted);">Type:</span>
              <span style="color: var(--color-text);">${event.type || 'Unknown'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
              <span style="color: var(--color-text-muted);">Time:</span>
              <span style="color: var(--color-text);">${new Date(event.timestamp).toLocaleString()}</span>
            </div>
            ${event.session_id ? `
              <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                <span style="color: var(--color-text-muted);">Session ID:</span>
                <span style="color: var(--color-text); font-family: var(--font-mono); font-size: var(--text-xs);">${truncate(event.session_id, 20)}</span>
              </div>
            ` : ''}
            ${event.workspace_path ? `
              <div style="padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                <div style="display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap;">
                  <span style="color: var(--color-text-muted); font-size: var(--text-xs);">Workspace:</span>
                  ${window.createWorkspaceBadge ? window.createWorkspaceBadge(event.workspace_path, 'md') : `<span style="color: var(--color-text); font-family: var(--font-mono); font-size: var(--text-xs);">${truncate(event.workspace_path, 40)}</span>`}
                </div>
              </div>
            ` : ''}
            ${event.source ? `
              <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                <span style="color: var(--color-text-muted);">Source:</span>
                <span class="badge" style="background: var(--color-primary); color: white; padding: 2px 8px; border-radius: 4px; font-size: var(--text-xs);">${escapeHtml(event.source)}</span>
              </div>
            ` : ''}
            ${event.ai_generated !== undefined ? `
              <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                <span style="color: var(--color-text-muted);">AI Generated:</span>
                <span class="badge" style="background: ${event.ai_generated ? 'var(--color-accent)' : 'var(--color-text-muted)'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: var(--text-xs);">
                  ${event.ai_generated ? 'Yes' : 'No'}
                </span>
              </div>
            ` : ''}
            ${event.tags && (Array.isArray(event.tags) ? event.tags.length > 0 : typeof event.tags === 'string' && event.tags.trim().length > 0) ? `
              <div style="padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                <div style="color: var(--color-text-muted); font-size: var(--text-xs); margin-bottom: var(--space-xs);">Tags:</div>
                <div style="display: flex; flex-wrap: wrap; gap: var(--space-xs);">
                  ${(Array.isArray(event.tags) ? event.tags : event.tags.split(',').map(t => t.trim())).map(tag => `
                    <span class="badge" style="background: var(--color-primary-alpha-10); color: var(--color-primary); padding: 4px 8px; border-radius: 4px; font-size: var(--text-xs);">
                      ${escapeHtml(tag)}
                    </span>
                  `).join('')}
                </div>
              </div>
            ` : ''}
            ${(() => {
              // Filter out auto-generated diff notes - they're shown in the diff stats section above
              const notes = event.notes || '';
              const isAutoGeneratedDiffNote = /^File change detected\.?\s*Diff:/i.test(notes) || 
                                             /^File\s+\w+\s*-\s*\d+\s*character\s+change$/i.test(notes) ||
                                             /^New file added$/i.test(notes);
              
              // Only show notes if they're not auto-generated diff information
              if (notes && !isAutoGeneratedDiffNote) {
                return `
                  <div style="padding: var(--space-sm); background: var(--color-bg-alt); border-left: 3px solid var(--color-warning); border-radius: var(--radius-md);">
                    <div style="color: var(--color-text-muted); font-size: var(--text-xs); margin-bottom: var(--space-xs); font-weight: 500;">Notes:</div>
                    <div style="color: var(--color-text); font-size: var(--text-sm); line-height: 1.5;">${escapeHtml(notes)}</div>
                  </div>
                `;
              }
              return '';
            })()}
            ${enhancedModelInfo ? `
              <div style="padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                <div style="display: flex; align-items: center; gap: var(--space-xs); margin-bottom: var(--space-xs);">
                  <span style="color: var(--color-text-muted); font-size: var(--text-xs); font-weight: 500;">Model Information:</span>
                  ${enhancedModelInfo.source && enhancedModelInfo.source !== 'event' ? `
                    <span style="font-size: 10px; padding: 2px 6px; background: var(--color-accent-alpha-10); color: var(--color-accent); border-radius: 4px;" title="Model info inferred from ${enhancedModelInfo.source === 'linked-prompt' ? 'linked prompt' : 'related prompt'}">
                      ${enhancedModelInfo.source === 'linked-prompt' ? 'From linked prompt' : 'From related prompt'}
                    </span>
                  ` : ''}
                </div>
                <div style="display: grid; gap: var(--space-xs);">
                  ${typeof enhancedModelInfo === 'object' ? Object.entries(enhancedModelInfo)
                    .filter(([key]) => key !== 'source') // Don't show source in the grid
                    .map(([key, value]) => `
                    <div style="display: flex; justify-content: space-between; font-size: var(--text-xs);">
                      <span style="color: var(--color-text-muted);">${escapeHtml(key)}:</span>
                      <span style="color: ${value === 'Unknown' ? 'var(--color-text-muted)' : 'var(--color-text)'}; font-family: var(--font-mono);">${escapeHtml(String(value))}</span>
                    </div>
                  `).join('') : `
                    <div style="color: var(--color-text); font-size: var(--text-xs); font-family: var(--font-mono);">${escapeHtml(String(enhancedModelInfo))}</div>
                  `}
                </div>
              </div>
            ` : ''}
            ${details?.file_path ? `
              <div style="padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                <div style="display: flex; flex-direction: column; gap: var(--space-xs);">
                  <span style="color: var(--color-text-muted); font-size: var(--text-xs); margin-bottom: var(--space-xs);">File:</span>
                  ${window.createFilePathBadge ? window.createFilePathBadge(details.file_path, event.workspace_path) : `
                    <div style="display: flex; flex-direction: column; gap: var(--space-xs);">
                      <div style="display: flex; align-items: center; gap: var(--space-xs); flex-wrap: wrap;">
                        <span style="color: var(--color-text); font-family: var(--font-mono); font-size: var(--text-sm); font-weight: 500;">${details.file_path.split('/').pop()}</span>
                        ${details.file_path.includes('.') ? `
                          <span class="badge" style="background: var(--color-primary-alpha-10); color: var(--color-primary); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-family: var(--font-mono);">
                            ${details.file_path.split('.').pop().toUpperCase()}
                          </span>
                        ` : ''}
                      </div>
                      ${window.formatFilePathWithDirectory ? `
                        <span style="color: var(--color-text-muted); font-family: var(--font-mono); font-size: var(--text-xs);">${window.formatFilePathWithDirectory(details.file_path, 3)}</span>
                      ` : ''}
                    </div>
                  `}
                  ${details.git_hash || details.gitHash ? `
                    <div style="margin-top: var(--space-xs); padding-top: var(--space-xs); border-top: 1px solid var(--color-border);">
                      <div style="display: flex; align-items: center; gap: var(--space-xs);">
                        <span style="color: var(--color-text-muted); font-size: var(--text-xs);">Git Hash:</span>
                        <span style="color: var(--color-text); font-family: var(--font-mono); font-size: var(--text-xs);">${escapeHtml(details.git_hash || details.gitHash)}</span>
                        ${window.CONFIG?.GIT_WEB_URL ? `
                          <a href="${window.CONFIG.GIT_WEB_URL}/commit/${details.git_hash || details.gitHash}" target="_blank" style="color: var(--color-primary); font-size: var(--text-xs); text-decoration: none;">View Commit</a>
                        ` : ''}
                      </div>
                    </div>
                  ` : ''}
                  ${details.start_line !== undefined || details.end_line !== undefined || details.lineRange ? `
                    <div style="margin-top: var(--space-xs); padding-top: var(--space-xs); border-top: 1px solid var(--color-border);">
                      <div style="color: var(--color-text-muted); font-size: var(--text-xs);">Line Range:</div>
                      <div style="color: var(--color-text); font-family: var(--font-mono); font-size: var(--text-xs);">
                        ${details.lineRange ? `${details.lineRange.start}-${details.lineRange.end}` : 
                          details.start_line !== undefined && details.end_line !== undefined ? `${details.start_line}-${details.end_line}` :
                          details.start_line !== undefined ? `Line ${details.start_line}` :
                          details.end_line !== undefined ? `Up to line ${details.end_line}` : ''}
                      </div>
                    </div>
                  ` : ''}
                </div>
              </div>
            ` : ''}
            ${details?.file_path && isImageFile(details.file_path) ? `
              <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md);">
                <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-sm);">Screenshot Preview:</div>
                <div style="border-radius: var(--radius-md); overflow: hidden; background: #000; display: flex; align-items: center; justify-content: center; max-height: 400px; position: relative;">
                  <img data-lazy-src="${window.CONFIG?.API_BASE_URL || window.CONFIG?.API_BASE || window.DASHBOARD_CONFIG?.API_BASE || 'http://localhost:43917'}/api/image?path=${encodeURIComponent(details.file_path)}" 
                       alt="Screenshot" 
                       style="max-width: 100%; max-height: 400px; object-fit: contain; opacity: 0; transition: opacity 0.3s ease-in-out;"
                       onload="this.style.opacity='1'; this.parentElement.querySelector('.screenshot-loading-placeholder')?.style.setProperty('display', 'none');"
                       onerror="this.style.opacity='0'; this.parentElement.innerHTML = '<div style=\\'padding: var(--space-lg); color: var(--color-text-muted); text-align: center;\\'>Image not accessible<br><span style=\\'font-size: 0.85em; font-family: var(--font-mono);\\'>Path: ${details.file_path}</span><br><span style=\\'font-size: 0.75em; margin-top: 8px; display: block;\\'>Workaround: The file may have been moved or deleted. Try opening it manually from Finder.</span></div>'">
                  <div class="screenshot-loading-placeholder" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; background: #1a1a1a; color: var(--color-text-muted); font-size: var(--text-xs);">
                    <div style="text-align: center;">
                      <div style="width: 40px; height: 40px; border: 2px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 8px;"></div>
                      <div>Loading...</div>
                    </div>
                  </div>
                </div>
                <div style="margin-top: var(--space-sm); text-align: center; display: flex; gap: var(--space-sm); justify-content: center;">
                  <a href="${window.CONFIG?.API_BASE_URL || window.CONFIG?.API_BASE || window.DASHBOARD_CONFIG?.API_BASE || 'http://localhost:43917'}/api/image?path=${encodeURIComponent(details.file_path)}" target="_blank" style="color: var(--color-accent); font-size: var(--text-sm); text-decoration: none;">
                    View Full Size
                  </a>
                  <span style="color: var(--color-text-muted);">|</span>
                  <a href="file://${details.file_path}" target="_blank" style="color: var(--color-accent); font-size: var(--text-sm); text-decoration: none;" onclick="return false;" title="Note: file:// links only work in some browsers. Use 'View Full Size' instead.">
                    Open in Finder
                  </a>
                </div>
              </div>
            ` : ''}
            ${(() => {
              // Extract diff stats from details or parse from notes field
              let linesAdded = details?.lines_added ?? details?.diff_stats?.lines_added ?? 0;
              let linesRemoved = details?.lines_removed ?? details?.diff_stats?.lines_removed ?? 0;
              let charsAdded = details?.chars_added ?? details?.diff_stats?.chars_added ?? 0;
              let charsDeleted = details?.chars_deleted ?? details?.diff_stats?.chars_deleted ?? 0;
              
              // If stats are missing, try to parse from notes field
              if ((linesAdded === 0 && linesRemoved === 0 && charsAdded === 0 && charsDeleted === 0) && event.notes) {
                // Try to parse "Diff: +11037 chars" or similar patterns
                const diffMatch = event.notes.match(/Diff:\s*([+-]?\d+)\s*chars/i);
                if (diffMatch) {
                  const diffChars = parseInt(diffMatch[1], 10);
                  if (diffChars > 0) {
                    charsAdded = diffChars;
                  } else if (diffChars < 0) {
                    charsDeleted = Math.abs(diffChars);
                  }
                }
                
                // Try to parse line changes if available
                const linesMatch = event.notes.match(/([+-]?\d+)\s*lines/i);
                if (linesMatch) {
                  const diffLines = parseInt(linesMatch[1], 10);
                  if (diffLines > 0) {
                    linesAdded = diffLines;
                  } else if (diffLines < 0) {
                    linesRemoved = Math.abs(diffLines);
                  }
                }
              }
              
              // Show diff stats section if we have any diff information
              if (linesAdded > 0 || linesRemoved > 0 || charsAdded > 0 || charsDeleted > 0) {
                return `
                  <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md);">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-lg); text-align: center;">
                      <div>
                        <div style="font-size: var(--text-xl); color: var(--color-success); font-weight: 600; margin-bottom: var(--space-xs);">
                          +${linesAdded}
                        </div>
                        <div style="font-size: var(--text-xs); color: var(--color-text-muted);">Lines Added</div>
                        <div style="font-size: var(--text-sm); color: var(--color-success); margin-top: var(--space-xs);">
                          +${charsAdded} chars
                        </div>
                      </div>
                      <div>
                        <div style="font-size: var(--text-xl); color: var(--color-error); font-weight: 600; margin-bottom: var(--space-xs);">
                          -${linesRemoved}
                        </div>
                        <div style="font-size: var(--text-xs); color: var(--color-text-muted);">Lines Removed</div>
                        <div style="font-size: var(--text-sm); color: var(--color-error); margin-top: var(--space-xs);">
                          -${charsDeleted} chars
                        </div>
                      </div>
                    </div>
                  </div>
                `;
              }
              return '';
            })()}
          </div>
        </div>

        ${event.context ? this._buildContextHTML(event.context) : ''}

        ${relatedScreenshots.length > 0 ? this._buildScreenshotsHTML(event, relatedScreenshots) : ''}

        ${relatedPrompts.length > 0 ? this._buildRelatedPromptsHTML(relatedPrompts) : 
          (this.state && this.state.data && this.state.data.prompts && this.state.data.prompts.length > 0) ? 
            this._buildNoRelatedPromptsDebugHTML(event, this.state.data.prompts) : 
            '<div style="padding: var(--space-md); background: rgba(148, 163, 184, 0.1); border-radius: var(--radius-md); border: 1px dashed var(--color-border);"><div style="font-size: var(--text-sm); color: var(--color-text-muted);">No prompts available in state</div></div>'}

        ${(() => {
          // Normalize code diff data - handle multiple field name variations
          // Check both details and event object for diff content
          let beforeContent = details?.before_content || details?.before_code || details?.beforeContent || 
                             event.before_content || event.before_code || null;
          let afterContent = details?.after_content || details?.after_code || details?.afterContent || 
                            event.after_content || event.after_code || null;
          
          // Check if we have valid content (not just empty strings or null)
          const hasBefore = beforeContent && typeof beforeContent === 'string' && beforeContent.trim().length > 0;
          const hasAfter = afterContent && typeof afterContent === 'string' && afterContent.trim().length > 0;
          
          // Show code diff if we have either before or after content, OR if there are diff stats indicating changes
          const hasDiffStats = details?.diff_stats?.has_diff || 
                             details?.lines_added > 0 || 
                             details?.lines_removed > 0 ||
                             (details?.diff_stats && (details.diff_stats.lines_added > 0 || details.diff_stats.lines_removed > 0)) ||
                             event.lines_added > 0 ||
                             event.lines_removed > 0;
          
          // If we have diff stats but no content, try to fetch full entry details
          if ((hasDiffStats && !hasBefore && !hasAfter) || (!hasBefore && !hasAfter && (details?.chars_added > 0 || details?.chars_removed > 0))) {
            // Content might not be loaded - we'll show a message and offer to fetch it
            console.log('[MODAL] Diff stats found but content missing, may need to fetch full entry');
          }
          
          if (hasBefore || hasAfter || hasDiffStats) {
            // Normalize to before_content/after_content format and preserve all metadata
            const normalizedDetails = {
              ...details,
              before_content: beforeContent || '',
              after_content: afterContent || '',
              // Preserve all diff stats and metadata
              lines_added: details.lines_added || details.diff_stats?.lines_added || 0,
              lines_removed: details.lines_removed || details.diff_stats?.lines_removed || 0,
              chars_added: details.chars_added || details.diff_stats?.chars_added || 0,
              chars_deleted: details.chars_deleted || details.diff_stats?.chars_deleted || 0,
              diff_size: details.diff_size || details.diff_stats?.diff_size || null,
              diff_summary: details.diff_summary || details.diff_stats?.diff_summary || null,
              change_type: details.change_type || details.diff_stats?.change_type || null,
              diff_stats: details?.diff_stats || (details?.lines_added !== undefined || details?.lines_removed !== undefined ? {
                lines_added: details.lines_added || 0,
                lines_removed: details.lines_removed || 0,
                chars_added: details.chars_added || 0,
                chars_deleted: details.chars_deleted || 0,
                diff_size: details.diff_size || null,
                diff_summary: details.diff_summary || null,
                change_type: details.change_type || null,
                has_diff: true
              } : null)
            };
            return this._buildCodeDiffHTML(normalizedDetails, linkedPrompt ? 'Generated from linked prompt above' : null);
          }
          return '';
        })()}

        ${relatedConversations.length > 0 ? this._buildRelatedConversationsHTML(relatedConversations) : ''}

        ${relatedTerminalCommands.length > 0 ? this._buildRelatedTerminalCommandsHTML(relatedTerminalCommands, event) : ''}

        ${this.state.data.cursorDbStats ? this._buildDbStatsHTML(this.state.data.cursorDbStats) : ''}

      </div>
    `;
  }

  _buildRelatedTerminalCommandsHTML(commands, event) {
    const { escapeHtml } = this;
    const eventTime = new Date(event.timestamp).getTime();
    
    return `
      <div>
        <h4 style="margin-bottom: var(--space-md); color: var(--color-text); display: flex; align-items: center; gap: var(--space-sm);">
          <span>Related Terminal Commands</span>
          <span style="background: #6366f1; color: white; font-size: var(--text-xs); padding: 2px 8px; border-radius: 12px;">${commands.length}</span>
        </h4>
        <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-md);">
          Terminal commands executed within 5 minutes of this event, ordered by time proximity.
        </div>
        <div style="display: grid; gap: var(--space-sm);">
          ${commands.map((cmd, idx) => {
            const cmdTime = new Date(cmd.timestamp).getTime();
            const timeDiff = Math.abs(eventTime - cmdTime);
            const minutes = Math.floor(timeDiff / 60000);
            const seconds = Math.floor((timeDiff % 60000) / 1000);
            const timeDiffText = timeDiff < 60000 ? `${seconds}s` : `${minutes}m ${seconds}s`;
            const isBefore = cmdTime < eventTime;
            const commandText = cmd.command || cmd.text || 'Unknown command';
            const displayCommand = commandText.length > 100 ? commandText.substring(0, 100) + '...' : commandText;
            const exitCode = cmd.exit_code !== undefined ? cmd.exit_code : cmd.exitCode;
            const duration = cmd.duration || cmd.execution_time;
            
            return `
              <div style="padding: var(--space-md); background: var(--color-bg); border-left: 3px solid #6366f1; border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s;" 
                   onmouseover="this.style.transform='translateX(4px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)';" 
                   onmouseout="this.style.transform=''; this.style.boxShadow='';"
                   onclick="showEventModal('${cmd.id || cmd.timestamp}')">
                <div style="display: flex; justify-content: space-between; align-items: start; gap: var(--space-sm); margin-bottom: var(--space-xs);">
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-family: var(--font-mono); font-size: var(--text-sm); color: var(--color-text); line-height: 1.4; word-break: break-all;">
                      ${escapeHtml(displayCommand)}
                    </div>
                  </div>
                  <div style="flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: var(--space-xs);">
                    <span style="font-size: var(--text-xs); color: var(--color-text-muted);">${timeDiffText} ${isBefore ? 'before' : 'after'}</span>
                    ${exitCode !== undefined ? `
                      <span class="badge" style="background: ${exitCode === 0 ? 'var(--color-success)' : 'var(--color-error)'}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-family: var(--font-mono);">
                        Exit: ${exitCode}
                      </span>
                    ` : ''}
                  </div>
                </div>
                <div style="display: flex; gap: var(--space-sm); flex-wrap: wrap; margin-top: var(--space-xs); font-size: var(--text-xs);">
                  ${cmd.cwd ? `
                    <span style="color: var(--color-text-muted); font-family: var(--font-mono);">
                      📁 ${truncate(cmd.cwd, 40)}
                    </span>
                  ` : ''}
                  ${duration ? `
                    <span style="color: var(--color-text-muted);">
                      ⏱ ${duration}ms
                    </span>
                  ` : ''}
                  ${cmd.source ? `
                    <span class="badge" style="background: #6366f1; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">
                      ${escapeHtml(cmd.source)}
                    </span>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  _buildContextHTML(context) {
    return `
      <div>
        <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Context Information</h4>
        <div style="display: grid; gap: var(--space-md);">
          
          ${context.atFiles && context.atFiles.length > 0 ? `
            <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid #10b981;">
              <div style="font-weight: 600; margin-bottom: var(--space-sm); color: var(--color-text); display: flex; align-items: center; gap: var(--space-xs);">
                <span>[FILE] @ Referenced Files</span>
                <span style="background: #10b981; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px;">${context.atFiles.length}</span>
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: var(--space-xs);">
                ${context.atFiles.map(file => `
                  <span style="font-family: var(--font-mono); font-size: var(--text-xs); padding: 4px 8px; background: rgba(16, 185, 129, 0.1); color: #10b981; border-radius: 4px;">
                    ${file.reference || file.fileName || file.filePath}
                  </span>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          ${(context.contextFiles?.attachedFiles?.length || 0) + (context.contextFiles?.codebaseFiles?.length || 0) > 0 ? `
            <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid #3b82f6;">
              <div style="font-weight: 600; margin-bottom: var(--space-sm); color: var(--color-text); display: flex; align-items: center; gap: var(--space-xs);">
                <span>Context Files</span>
                <span style="background: #3b82f6; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px;">
                  ${(context.contextFiles?.attachedFiles?.length || 0) + (context.contextFiles?.codebaseFiles?.length || 0)}
                </span>
              </div>
              <div style="display: grid; gap: var(--space-xs);">
                ${context.contextFiles?.attachedFiles?.map(file => `
                  <div style="font-family: var(--font-mono); font-size: var(--text-xs); padding: 4px 8px; background: rgba(59, 130, 246, 0.1); color: #3b82f6; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                    <span>${file.name || file.path}</span>
                    <span style="font-size: 10px; padding: 2px 4px; background: rgba(59, 130, 246, 0.2); border-radius: 3px;">attached</span>
                  </div>
                `).join('') || ''}
                ${context.contextFiles?.codebaseFiles?.slice(0, 5).map(file => `
                  <div style="font-family: var(--font-mono); font-size: var(--text-xs); padding: 4px 8px; background: rgba(59, 130, 246, 0.05); color: #60a5fa; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                    <span>${file.name || file.path}</span>
                    <span style="font-size: 10px; padding: 2px 4px; background: rgba(59, 130, 246, 0.1); border-radius: 3px;">codebase</span>
                  </div>
                `).join('') || ''}
                ${(context.contextFiles?.codebaseFiles?.length || 0) > 5 ? `
                  <div style="font-size: var(--text-xs); color: var(--color-text-muted); padding: 4px 8px; text-align: center;">
                    +${context.contextFiles.codebaseFiles.length - 5} more files
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}
          
          ${context.browserState && context.browserState.tabs && context.browserState.tabs.length > 0 ? `
            <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid #8b5cf6;">
              <div style="font-weight: 600; margin-bottom: var(--space-sm); color: var(--color-text); display: flex; align-items: center; gap: var(--space-xs);">
                <span>[SYSTEM] UI State</span>
                <span style="background: #8b5cf6; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px;">${context.browserState.tabs.length} tabs</span>
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: var(--space-xs);">
                ${context.browserState.tabs.map(tab => `
                  <span style="font-family: var(--font-mono); font-size: var(--text-xs); padding: 4px 8px; background: rgba(139, 92, 246, 0.1); color: #8b5cf6; border-radius: 4px; ${tab.isActive ? 'font-weight: 600; border: 1px solid #8b5cf6;' : ''}">
                    ${tab.name || tab.path}
                  </span>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
        </div>
      </div>
    `;
  }

  _buildScreenshotsHTML(event, screenshots) {
    const apiBase = window.CONFIG?.API_BASE_URL || window.CONFIG?.API_BASE || window.DASHBOARD_CONFIG?.API_BASE || 'http://localhost:43917';
    
    return `
      <div>
        <h4 style="margin-bottom: var(--space-md); color: var(--color-text); display: flex; align-items: center; gap: var(--space-sm);">
          <span>Related Screenshots</span>
          <span style="background: #f59e0b; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px;">${screenshots.length}</span>
        </h4>
        <div style="font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-md);">
          Screenshots captured within 5 minutes of this event
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: var(--space-md);" class="screenshots-grid">
          ${screenshots.map((screenshot, index) => {
            const timeDiff = Math.abs(new Date(event.timestamp).getTime() - new Date(screenshot.timestamp).getTime());
            const minutesAgo = Math.floor(timeDiff / 60000);
            const secondsAgo = Math.floor((timeDiff % 60000) / 1000);
            const timingText = minutesAgo > 0 ? `${minutesAgo}m ${secondsAgo}s` : `${secondsAgo}s`;
            const isBefore = new Date(screenshot.timestamp) < new Date(event.timestamp);
            const imageUrl = `${apiBase}/api/image?path=${encodeURIComponent(screenshot.path)}`;
            
            return `
              <div style="border: 2px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; background: var(--color-bg); transition: all 0.2s;" 
                   onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 8px 16px rgba(0,0,0,0.15)';" 
                   onmouseout="this.style.transform=''; this.style.boxShadow='';">
                <div style="position: relative; background: #000; aspect-ratio: 16/9; overflow: hidden;">
                  <img data-lazy-src="${imageUrl}"
                       data-screenshot-index="${index}"
                       alt="${screenshot.fileName}" 
                       style="width: 100%; height: 100%; object-fit: contain; cursor: pointer; opacity: 0; transition: opacity 0.3s ease-in-out;"
                       onclick="window.open('${imageUrl}', '_blank')"
                       onerror="this.style.opacity='0'; this.parentElement.innerHTML = '<div style=\\'display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); padding: var(--space-md); text-align: center; flex-direction: column;\\'>Image<div style=\\'font-size: 0.75em; margin-top: 8px;\\'>Screenshot not accessible</div><div style=\\'font-size: 0.65em; margin-top: 4px; color: var(--color-text-muted);\\'>File may have been moved</div></div>'"
                       onload="this.style.opacity='1';">
                  <div class="screenshot-loading-placeholder" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; background: #1a1a1a; color: var(--color-text-muted); font-size: var(--text-xs);">
                    <div style="text-align: center;">
                      <div style="width: 40px; height: 40px; border: 2px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 8px;"></div>
                      <div>Loading...</div>
                    </div>
                  </div>
                  <div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; z-index: 2;">
                    ${timingText} ${isBefore ? 'before' : 'after'}
                  </div>
                </div>
                <div style="padding: var(--space-sm);">
                  <div style="font-size: var(--text-xs); font-family: var(--font-mono); color: var(--color-text); margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${screenshot.fileName}">
                    ${screenshot.fileName}
                  </div>
                  <div style="font-size: 10px; color: var(--color-text-muted);">
                    ${new Date(screenshot.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Initialize lazy loading for images in the modal
   * @param {HTMLElement} container - Modal body container
   */
  _initializeLazyLoading(container) {
    if (!container || !window.imageLazyLoader) {
      return;
    }
    
    // Wait a tick to ensure DOM is ready
    setTimeout(() => {
      // Find all images with data-lazy-src
      const lazyImages = container.querySelectorAll('img[data-lazy-src]');
      
      lazyImages.forEach((img) => {
        const src = img.getAttribute('data-lazy-src');
        if (src) {
          // Use the lazy loader's observe method
          window.imageLazyLoader.observe(img, src);
          
          // Add custom load handler to hide placeholder and show image
          const originalOnLoad = img.onload;
          img.onload = function() {
            // Hide loading placeholder
            const placeholder = img.parentElement?.querySelector('.screenshot-loading-placeholder');
            if (placeholder) {
              placeholder.style.display = 'none';
            }
            // Show image with fade-in
            img.style.opacity = '1';
            if (originalOnLoad) originalOnLoad.call(this);
          };
          
          // Handle errors
          const originalOnError = img.onerror;
          img.onerror = function() {
            // Hide loading placeholder
            const placeholder = img.parentElement?.querySelector('.screenshot-loading-placeholder');
            if (placeholder) {
              placeholder.style.display = 'none';
            }
            if (originalOnError) originalOnError.call(this);
          };
        }
      });
    }, 0);
  }

  _buildLinkedPromptSection(prompt, event) {
    const promptText = prompt.text || prompt.prompt || prompt.preview || prompt.content || 'No prompt text';
    const displayText = promptText.length > 200 ? promptText.substring(0, 200) + '...' : promptText;
    
    return `
      <div style="padding: var(--space-lg); background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%); border-left: 4px solid var(--color-primary); border-radius: var(--radius-md);">
        <div style="display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-md);">
          <span style="font-size: var(--text-lg);">[AI]</span>
          <h4 style="margin: 0; color: var(--color-text);">Linked Prompt</h4>
          <span style="font-size: var(--text-xs); color: var(--color-text-muted); margin-left: auto;">
            ${window.formatTimeAgo(prompt.timestamp)}
          </span>
        </div>
        <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-sm); margin-bottom: var(--space-sm);">
          <div style="font-size: var(--text-sm); color: var(--color-text); line-height: 1.6;">
            ${window.escapeHtml(displayText)}
          </div>
        </div>
        <div style="display: flex; gap: var(--space-xs); flex-wrap: wrap; font-size: var(--text-xs);">
          <span class="badge badge-prompt">${prompt.source || 'cursor'}</span>
          ${prompt.contextUsage > 0 ? `<span class="badge" style="background: var(--color-warning); color: white;">${prompt.contextUsage.toFixed(1)}% context</span>` : ''}
          <span style="color: var(--color-text-muted);">→ This code change resulted from this prompt</span>
        </div>
      </div>
    `;
  }

  _buildCodeDiffHTML(details, subtitle = null) {
    const { escapeHtml } = this;
    const diffId = `diff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const filePath = details.file_path || '';
    
    // Extract all metadata fields
    const linesAdded = details.diff_stats?.lines_added || details.lines_added || 0;
    const linesRemoved = details.diff_stats?.lines_removed || details.lines_removed || 0;
    const charsAdded = details.diff_stats?.chars_added || details.chars_added || 0;
    const charsDeleted = details.diff_stats?.chars_deleted || details.chars_deleted || 0;
    const diffSize = details.diff_stats?.diff_size || details.diff_size || null;
    const diffSummary = details.diff_stats?.diff_summary || details.diff_summary || null;
    const changeType = details.change_type || details.diff_stats?.change_type || null;
    
    return `
      <div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-md);">
          <h4 style="margin: 0; color: var(--color-text); display: flex; align-items: center; gap: var(--space-sm);">
            <span>Code Diff</span>
            ${(linesAdded > 0 || linesRemoved > 0) ? `
              <span style="font-size: var(--text-xs); color: var(--color-text-muted); font-weight: normal;">
                (${linesAdded > 0 ? `+${linesAdded}` : ''}${linesAdded > 0 && linesRemoved > 0 ? '/' : ''}${linesRemoved > 0 ? `-${linesRemoved}` : ''} lines)
              </span>
            ` : ''}
          </h4>
          <div style="display: flex; gap: var(--space-xs);">
            <button id="${diffId}_code_btn" onclick="switchDiffView('${diffId}', 'code')" 
                    style="padding: 6px 12px; background: var(--color-primary); color: white; border: none; border-radius: 6px; font-size: 11px; cursor: pointer; font-weight: 500;">
              Code
            </button>
            <button id="${diffId}_ast_btn" onclick="switchDiffView('${diffId}', 'ast')" 
                    style="padding: 6px 12px; background: var(--color-surface); color: var(--color-text-muted); border: none; border-radius: 6px; font-size: 11px; cursor: pointer; font-weight: 500;">
              AST View
            </button>
          </div>
        </div>
        ${subtitle ? `
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-md); padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-sm);">
            ${subtitle}
          </div>
        ` : ''}
        
        <!-- Metadata Section -->
        <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); margin-bottom: var(--space-md); border: 1px solid var(--color-border);">
          <div style="font-size: var(--text-xs); font-weight: 600; color: var(--color-text-muted); margin-bottom: var(--space-sm); text-transform: uppercase; letter-spacing: 0.5px;">Diff Metadata</div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--space-sm);">
            ${filePath ? `
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 10px; color: var(--color-text-muted);">File Path</span>
                <span style="font-size: var(--text-xs); color: var(--color-text); font-family: var(--font-mono); word-break: break-all;">${escapeHtml(filePath)}</span>
              </div>
            ` : ''}
            ${changeType ? `
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 10px; color: var(--color-text-muted);">Change Type</span>
                <span style="font-size: var(--text-xs); color: var(--color-text);">${escapeHtml(changeType)}</span>
              </div>
            ` : ''}
            ${linesAdded > 0 || linesRemoved > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 10px; color: var(--color-text-muted);">Lines</span>
                <span style="font-size: var(--text-xs); color: var(--color-text);">
                  <span style="color: var(--color-success);">+${linesAdded}</span>
                  ${linesRemoved > 0 ? ` / <span style="color: var(--color-error);">-${linesRemoved}</span>` : ''}
                </span>
              </div>
            ` : ''}
            ${charsAdded > 0 || charsDeleted > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 10px; color: var(--color-text-muted);">Characters</span>
                <span style="font-size: var(--text-xs); color: var(--color-text);">
                  <span style="color: var(--color-success);">+${charsAdded.toLocaleString()}</span>
                  ${charsDeleted > 0 ? ` / <span style="color: var(--color-error);">-${charsDeleted.toLocaleString()}</span>` : ''}
                </span>
              </div>
            ` : ''}
            ${diffSize !== null ? `
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 10px; color: var(--color-text-muted);">Diff Size</span>
                <span style="font-size: var(--text-xs); color: var(--color-text);">${diffSize.toLocaleString()} bytes</span>
              </div>
            ` : ''}
            ${details.before_content ? `
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 10px; color: var(--color-text-muted);">Before Size</span>
                <span style="font-size: var(--text-xs); color: var(--color-text);">${details.before_content.length.toLocaleString()} chars, ${details.before_content.split('\\n').length} lines</span>
              </div>
            ` : ''}
            ${details.after_content ? `
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 10px; color: var(--color-text-muted);">After Size</span>
                <span style="font-size: var(--text-xs); color: var(--color-text);">${details.after_content.length.toLocaleString()} chars, ${details.after_content.split('\\n').length} lines</span>
              </div>
            ` : ''}
          </div>
          ${diffSummary ? `
            <div style="margin-top: var(--space-sm); padding-top: var(--space-sm); border-top: 1px solid var(--color-border);">
              <span style="font-size: 10px; color: var(--color-text-muted); display: block; margin-bottom: 4px;">Summary</span>
              <div style="font-size: var(--text-xs); color: var(--color-text); line-height: 1.5;">${escapeHtml(diffSummary)}</div>
            </div>
          ` : ''}
        </div>
        
        <div id="${diffId}_code_view" style="display: block;">
          ${(details.before_content || details.after_content) && window.renderGitDiff ? `
            ${window.renderGitDiff(
              details.before_content || '',
              details.after_content || '',
              {
                maxLines: 200,
                showLineNumbers: true,
                collapseUnchanged: true,
                filePath: filePath,
                escapeHtml: escapeHtml
              }
            )}
          ` : `
            <div style="display: grid; gap: var(--space-md);">
              ${details.before_content ? `
                <div>
                  <div style="padding: var(--space-xs) var(--space-sm); background: rgba(239, 68, 68, 0.1); border-radius: var(--radius-sm) var(--radius-sm) 0 0; font-size: var(--text-xs); color: var(--color-error); font-weight: 500;">
                    Before (${details.before_content.split('\\n').length} lines, ${details.before_content.length.toLocaleString()} chars)
                  </div>
                  <div class="code-block" style="max-height: 250px; overflow-y: auto; border-radius: 0 0 var(--radius-sm) var(--radius-sm);">
                    <pre style="margin: 0; font-size: var(--text-xs); line-height: 1.5;">${escapeHtml(details.before_content)}</pre>
                  </div>
                </div>
              ` : ''}
              ${details.after_content ? `
                <div>
                  <div style="padding: var(--space-xs) var(--space-sm); background: rgba(34, 197, 94, 0.1); border-radius: var(--radius-sm) var(--radius-sm) 0 0; font-size: var(--text-xs); color: var(--color-success); font-weight: 500;">
                    After (${details.after_content.split('\\n').length} lines, ${details.after_content.length.toLocaleString()} chars)
                  </div>
                  <div class="code-block" style="max-height: 250px; overflow-y: auto; border-radius: 0 0 var(--radius-sm) var(--radius-sm);">
                    <pre style="margin: 0; font-size: var(--text-xs); line-height: 1.5;">${escapeHtml(details.after_content)}</pre>
                  </div>
                </div>
              ` : ''}
              ${!details.before_content && !details.after_content && (linesAdded > 0 || linesRemoved > 0 || charsAdded > 0 || charsDeleted > 0) ? `
                <div style="padding: var(--space-md); background: var(--color-bg-alt); border-radius: var(--radius-md); border: 1px dashed var(--color-border); text-align: center;">
                  <div style="font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-xs);">Code content not available</div>
                  <div style="font-size: var(--text-xs); color: var(--color-text-muted);">Diff statistics are shown above, but the actual code content was not captured.</div>
                </div>
              ` : ''}
            </div>
          `}
        </div>
        <div id="${diffId}_ast_view" style="display: none; min-height: 400px;">
          <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <div id="${diffId}_ast_container" style="width: 100%; min-height: 400px;"></div>
          </div>
        </div>
      </div>
      <script>
        (function() {
          // This part is complete.
          const diffId = '${diffId}';
          const beforeCode = ${details.before_content ? JSON.stringify(details.before_content) : 'null'};
          const afterCode = ${details.after_content ? JSON.stringify(details.after_content) : 'null'};
          const filePath = ${JSON.stringify(filePath)};
          
          // Store AST data for this diff immediately
          window._astData = window._astData || {};
          window._astData[diffId] = { 
            beforeCode: beforeCode, 
            afterCode: afterCode, 
            filePath: filePath 
          };
          
          // Debug log to verify data is stored
          console.debug('[AST] Stored data for', diffId, {
            hasBefore: !!beforeCode,
            hasAfter: !!afterCode,
            filePath: filePath
          });
        })();
      </script>
    `;
  }

  _buildRelatedPromptsHTML(prompts) {
    const { escapeHtml } = this;
    return `
      <div>
        <h4 style="margin-bottom: var(--space-md); color: var(--color-text); display: flex; align-items: center; gap: var(--space-sm);">
          <span>Related AI Prompts</span>
          <span style="background: var(--color-accent); color: white; font-size: var(--text-xs); padding: 2px 8px; border-radius: 12px;">${prompts.length}</span>
        </h4>
        <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-md);">
          Prompts from the same workspace within 5 minutes before this event, ordered by relevance.
        </div>
        <div style="display: grid; gap: var(--space-sm);">
          ${prompts.slice(0, 5).map((prompt, idx) => {
            const promptText = prompt.text || prompt.prompt || prompt.preview || prompt.content || 'No prompt text';
            const displayText = promptText.length > 150 ? promptText.substring(0, 150) + '...' : promptText;
            // Safely calculate time difference, handling NaN cases
            const timeDiffSeconds = (prompt.timeDiffSeconds && !isNaN(prompt.timeDiffSeconds)) ? prompt.timeDiffSeconds : 0;
            const minutes = Math.floor(timeDiffSeconds / 60);
            const seconds = timeDiffSeconds % 60;
            const timeDiffText = timeDiffSeconds < 60 && timeDiffSeconds > 0 ? 
              `${Math.floor(timeDiffSeconds)}s ${prompt.isBefore ? 'before' : 'after'}` : 
              timeDiffSeconds > 0
              ? `${minutes}m ${seconds}s ${prompt.isBefore ? 'before' : 'after'}`
              : 'now';
            const relevancePercent = (prompt.relevanceScore && !isNaN(prompt.relevanceScore)) ? Math.round(prompt.relevanceScore * 100) : 0;
            
            return `
            <div style="padding: var(--space-md); background: var(--color-bg); border-left: 3px solid var(--color-accent); border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s;" 
                 onmouseover="this.style.transform='translateX(4px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)';" 
                 onmouseout="this.style.transform=''; this.style.boxShadow='';"
                 onclick="closeEventModal(); setTimeout(() => showEventModal('${prompt.id}'), 100)">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-xs);">
                <div style="display: flex; align-items: center; gap: var(--space-xs);">
                  <span style="color: var(--color-primary); font-weight: 600; font-size: var(--text-xs);">
                    #${idx + 1}
                  </span>
                  <span style="font-size: var(--text-xs); color: var(--color-text-muted);">
                    ${timeDiffText}
                  </span>
                  <span style="font-size: var(--text-xs); color: var(--color-accent); font-weight: 500;">
                    ${relevancePercent}% match
                  </span>
                </div>
                <span class="badge badge-prompt" style="font-size: 10px; padding: 2px 6px;">
                  ${prompt.source || 'cursor'}
                </span>
              </div>
              <div style="font-size: var(--text-sm); color: var(--color-text); margin-bottom: var(--space-xs); line-height: 1.5;">
                ${escapeHtml(displayText)}
              </div>
              ${prompt.workspaceName || prompt.composerId ? `
                <div style="display: flex; gap: var(--space-xs); flex-wrap: wrap; margin-top: var(--space-sm);">
                  ${prompt.workspaceName ? `
                    <span style="font-size: 10px; padding: 2px 6px; background: var(--color-bg-alt); color: var(--color-text-muted); border-radius: 4px; font-family: var(--font-mono);">
                      ${prompt.workspaceName}
                    </span>
                  ` : ''}
                  ${prompt.composerId ? `
                    <span style="font-size: 10px; padding: 2px 6px; background: var(--color-bg-alt); color: var(--color-text-muted); border-radius: 4px;">
                      Composer
                    </span>
                  ` : ''}
                  ${prompt.linesAdded > 0 || prompt.linesRemoved > 0 ? `
                    <span style="font-size: 10px; padding: 2px 6px; background: var(--color-bg-alt); color: var(--color-text-muted); border-radius: 4px;">
                      <span style="color: var(--color-success);">+${prompt.linesAdded || 0}</span>
                      /
                      <span style="color: var(--color-error);">-${prompt.linesRemoved || 0}</span>
                    </span>
                  ` : ''}
                </div>
              ` : ''}
            </div>
          `}).join('')}
          ${prompts.length > 5 ? `
            <div style="text-align: center; padding: var(--space-md); color: var(--color-text-muted); font-size: var(--text-sm); background: var(--color-bg); border-radius: var(--radius-md); border: 1px dashed var(--color-border);">
              + ${prompts.length - 5} more prompts (${Math.round(prompts.slice(5).reduce((sum, p) => sum + p.relevanceScore, 0) / (prompts.length - 5) * 100)}% avg match)
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  _buildNoRelatedPromptsDebugHTML(event, allPrompts) {
    const eventTime = new Date(event.timestamp).getTime();
    const normalizeWorkspacePath = window.normalizeWorkspacePath || ((path) => (path || '').toLowerCase().replace(/[\/\\]+/g, '/').replace(/^\/+|\/+$/g, ''));
    const eventWorkspace = normalizeWorkspacePath(event.workspace_path || event.details?.workspace_path || '');
    
    // Find nearby prompts (within 15 minutes) and score them
    const nearbyPrompts = allPrompts
      .map(p => {
        const promptTime = new Date(p.timestamp).getTime();
        // Validate timestamp
        if (isNaN(promptTime) || isNaN(eventTime)) return null;
        
        const timeDiff = Math.abs(eventTime - promptTime);
        if (timeDiff > 15 * 60 * 1000) return null; // Outside 15 minutes
        
        const promptWorkspace = normalizeWorkspacePath(p.workspacePath || p.workspaceId || p.workspace_name || '');
        const workspaceMatch = eventWorkspace && promptWorkspace && eventWorkspace === promptWorkspace;
        const minutes = Math.floor(timeDiff / 60000);
        const isBefore = promptTime < eventTime;
        
        // Ensure all numeric values are valid
        if (isNaN(minutes) || isNaN(timeDiff)) return null;
        
        return {
          ...p,
          timeDiff,
          minutes,
          isBefore,
          workspaceMatch,
          promptWorkspace
        };
      })
      .filter(p => p !== null)
      .sort((a, b) => {
        // Sort by: workspace match first, then by time proximity
        if (a.workspaceMatch !== b.workspaceMatch) return b.workspaceMatch - a.workspaceMatch;
        return a.timeDiff - b.timeDiff;
      });
    
    if (nearbyPrompts.length === 0) {
      return '';
    }
    
    // Show nearby prompts with workspace info
    const workspaceMatched = nearbyPrompts.filter(p => p.workspaceMatch);
    const workspaceMismatched = nearbyPrompts.filter(p => !p.workspaceMatch);
    
    return `
      <div>
        <h4 style="margin-bottom: var(--space-md); color: var(--color-text); display: flex; align-items: center; gap: var(--space-sm);">
          <span>Related AI Prompts</span>
          <span style="background: var(--color-accent); color: white; font-size: var(--text-xs); padding: 2px 8px; border-radius: 12px;">${nearbyPrompts.length}</span>
        </h4>
        <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-md);">
          ${workspaceMatched.length > 0 
            ? `${workspaceMatched.length} from same workspace, ${workspaceMismatched.length} from other workspaces`
            : `${nearbyPrompts.length} nearby prompts (different workspace)`}
        </div>
        <div style="display: grid; gap: var(--space-sm);">
          ${nearbyPrompts.slice(0, 5).map((prompt, idx) => {
            const promptText = (prompt.text || prompt.prompt || prompt.preview || prompt.content || 'No prompt text').substring(0, 150);
            // Safely calculate time difference text, handling NaN cases
            const minutes = (prompt.minutes && !isNaN(prompt.minutes)) ? prompt.minutes : 0;
            const timeDiff = (prompt.timeDiff && !isNaN(prompt.timeDiff)) ? prompt.timeDiff : 0;
            const timeDiffText = minutes > 0 
              ? `${minutes}m ${prompt.isBefore ? 'before' : 'after'}`
              : timeDiff > 0
              ? `${Math.floor(timeDiff / 1000)}s ${prompt.isBefore ? 'before' : 'after'}`
              : 'now';
            const escapedText = window.escapeHtml ? window.escapeHtml(promptText) : promptText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            
            return `
              <div style="padding: var(--space-md); background: var(--color-bg); border-left: 3px solid ${prompt.workspaceMatch ? 'var(--color-success)' : 'var(--color-warning)'}; border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s;" 
                   onmouseover="this.style.transform='translateX(4px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)';" 
                   onmouseout="this.style.transform=''; this.style.boxShadow='';"
                   onclick="closeEventModal(); setTimeout(() => showEventModal('${prompt.id}'), 100)">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-xs);">
                  <div style="display: flex; align-items: center; gap: var(--space-xs); flex-wrap: wrap;">
                    <span style="color: var(--color-primary); font-weight: 600; font-size: var(--text-xs);">#${idx + 1}</span>
                    <span style="font-size: var(--text-xs); color: var(--color-text-muted);">${timeDiffText}</span>
                    ${!prompt.workspaceMatch ? `
                      <span style="font-size: var(--text-xs); color: var(--color-warning); font-weight: 500;" title="Different workspace: ${window.escapeHtml ? window.escapeHtml(prompt.promptWorkspace) : prompt.promptWorkspace}">
                        ⚠ Different workspace
                      </span>
                    ` : `
                      <span style="font-size: var(--text-xs); color: var(--color-success); font-weight: 500;">✓ Same workspace</span>
                    `}
                  </div>
                  <span class="badge badge-prompt" style="font-size: 10px; padding: 2px 6px;">
                    ${prompt.source || 'cursor'}
                  </span>
                </div>
                <div style="font-size: var(--text-sm); color: var(--color-text); line-height: 1.5;">
                  ${escapedText}${promptText.length >= 150 ? '...' : ''}
                </div>
              </div>
            `;
          }).join('')}
          ${nearbyPrompts.length > 5 ? `
            <div style="text-align: center; padding: var(--space-md); color: var(--color-text-muted); font-size: var(--text-sm); background: var(--color-bg); border-radius: var(--radius-md); border: 1px dashed var(--color-border);">
              + ${nearbyPrompts.length - 5} more nearby prompts
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  _buildRelatedConversationsHTML(conversations) {
    return `
      <div>
        <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">
          Related Conversations (${conversations.length})
        </h4>
        <div style="display: grid; gap: var(--space-sm);">
          ${conversations.slice(0, 2).map(conv => `
            <div style="padding: var(--space-md); background: var(--color-bg); border-left: 3px solid var(--color-primary); border-radius: var(--radius-md);">
              <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-xs);">
                ${conv.type} • ${this.formatTimeAgo(conv.timestamp)}
              </div>
              <div style="font-size: var(--text-sm); color: var(--color-text);">
                ID: ${conv.id}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  _buildDbStatsHTML(stats) {
    return `
      <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border: 1px solid var(--color-border);">
        <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-xs);">
          Cursor Database Stats
        </div>
        <div style="display: flex; gap: var(--space-lg); font-size: var(--text-sm);">
          <span>Conversations: <strong>${stats.totalConversations || 0}</strong></span>
          <span>Prompts: <strong>${stats.totalPrompts || 0}</strong></span>
          <span>Workspaces: <strong>${stats.workspaces || 0}</strong></span>
        </div>
      </div>
    `;
  }

  async showPromptInModal(prompt, modal, title, body) {
    // Enhance prompt with context changes if available
    if (prompt.id && window.enhancePromptWithContext) {
      try {
        prompt = await window.enhancePromptWithContext(prompt);
      } catch (error) {
        console.warn('Error enhancing prompt with context:', error);
      }
    }
    const promptText = prompt.text || prompt.prompt || prompt.preview || prompt.content || 'No prompt text';
    const charCount = promptText.length.toLocaleString();
    
    title.textContent = `AI Prompt (${charCount} chars)`;
    
    // Check for linked code change
    let linkedCodeChange = null;
    try {
      const linkedEntryId = prompt.linked_entry_id || prompt.linkedEntryId;
      if (linkedEntryId && this.state.data.events) {
        linkedCodeChange = this.state.data.events.find(e => 
          e.id === linkedEntryId || e.id === parseInt(linkedEntryId)
        );
      }
    } catch (e) {
      console.warn('Error finding linked code change:', e);
    }
    
    const details = linkedCodeChange ? 
      (typeof linkedCodeChange.details === 'string' ? JSON.parse(linkedCodeChange.details) : linkedCodeChange.details) :
      null;
    
    body.innerHTML = this._buildPromptModalHTML(prompt, promptText, linkedCodeChange, details);
    modal.classList.add('active');
  }
  
  _buildPromptModalHTML(prompt, promptText, linkedCodeChange, codeDetails) {
    const { escapeHtml } = this;
    const displayText = promptText.length > 500 ? promptText.substring(0, 500) + '...' : promptText;
    
    return `
      <div style="display: flex; flex-direction: column; gap: var(--space-xl);">
        
        <!-- Prompt Content -->
        <div>
          <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Prompt</h4>
          <div style="padding: var(--space-lg); background: var(--color-bg); border-radius: var(--radius-md); border-left: 4px solid var(--color-primary);">
            <div style="font-size: var(--text-sm); color: var(--color-text); line-height: 1.6; white-space: pre-wrap;">
              ${escapeHtml(displayText)}
            </div>
            ${promptText.length > 500 ? `
              <div style="margin-top: var(--space-sm); font-size: var(--text-xs); color: var(--color-text-muted);">
                (Truncated - ${promptText.length} total characters)
              </div>
            ` : ''}
          </div>
        </div>
        
        <!-- Prompt Metadata -->
        <div>
          <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Details</h4>
          <div style="display: grid; gap: var(--space-sm);">
            <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
              <span style="color: var(--color-text-muted);">Time:</span>
              <span style="color: var(--color-text);">${new Date(prompt.timestamp).toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
              <span style="color: var(--color-text-muted);">Source:</span>
              <span class="badge badge-prompt">${prompt.source || 'cursor'}</span>
            </div>
            ${prompt.workspaceName ? `
              <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                <span style="color: var(--color-text-muted);">Workspace:</span>
                <span style="color: var(--color-text); font-family: var(--font-mono); font-size: var(--text-xs);">${prompt.workspaceName}</span>
              </div>
            ` : ''}
            ${prompt.contextUsage > 0 ? `
              <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                <span style="color: var(--color-text-muted);">Context Usage:</span>
                <span class="badge" style="background: var(--color-warning); color: white;">${prompt.contextUsage.toFixed(1)}%</span>
              </div>
            ` : ''}
            ${prompt.contextFileCount > 0 ? `
              <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                <span style="color: var(--color-text-muted);">Context Files:</span>
                <span style="color: var(--color-text);">${prompt.contextFileCount}</span>
              </div>
            ` : ''}
            ${linkedCodeChange ? `
              <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: rgba(34, 197, 94, 0.1); border-radius: var(--radius-md); border: 1px solid rgba(34, 197, 94, 0.3);">
                <span style="color: var(--color-success); font-weight: 500;">Status:</span>
                <span style="color: var(--color-success); font-weight: 500;">Linked to Code Change</span>
              </div>
            ` : `
              <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: rgba(148, 163, 184, 0.1); border-radius: var(--radius-md);">
                <span style="color: var(--color-text-muted);">Status:</span>
                <span style="color: var(--color-text-muted);">Pending (no code change yet)</span>
              </div>
            `}
          </div>
        </div>
        
        <!-- Linked Code Change -->
        ${linkedCodeChange && codeDetails ? `
          <div>
            <h4 style="margin-bottom: var(--space-md); color: var(--color-text); display: flex; align-items: center; gap: var(--space-sm);">
              <span>Resulting Code Change</span>
              <span style="font-size: var(--text-xs); color: var(--color-text-muted); font-weight: normal;">
                (${codeDetails.lines_added || codeDetails.diff_stats?.lines_added || 0} lines added, ${codeDetails.lines_removed || codeDetails.diff_stats?.lines_removed || 0} removed)
              </span>
            </h4>
            <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid var(--color-success); margin-bottom: var(--space-md);">
              <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-sm);">
                File: <code style="font-family: var(--font-mono);">${codeDetails.file_path || linkedCodeChange.file_path || 'Unknown'}</code>
              </div>
              <div style="font-size: var(--text-xs); color: var(--color-text-muted);">
                Time: ${new Date(linkedCodeChange.timestamp).toLocaleString()}
              </div>
            </div>
            ${(codeDetails.before_content || codeDetails.after_content || codeDetails.before_code || codeDetails.after_code) ? 
              this._buildCodeDiffHTML({
                before_content: codeDetails.before_content || codeDetails.before_code,
                after_content: codeDetails.after_content || codeDetails.after_code,
                diff_stats: codeDetails.diff_stats,
                ...codeDetails
              }, 'Code generated from this prompt') : 
              '<div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); color: var(--color-text-muted); text-align: center;">Code diff details not available</div>'
            }
          </div>
        ` : ''}
        
        <!-- Context Information -->
        ${prompt.contextChange || prompt.contextAnalysis || prompt.contextStructure ? `
          <div>
            <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Context Information</h4>
            
            ${prompt.contextChange && window.renderContextChangeIndicator ? 
              window.renderContextChangeIndicator(prompt.contextChange, false) : ''}
            
            ${prompt.contextStructure ? prompt.contextStructure : ''}
            
            ${prompt.contextAnalysis && window.renderContextStructure ? 
              window.renderContextStructure(prompt.contextAnalysis, prompt.contextChange) : ''}
            
            ${prompt.contextChanges && prompt.contextChanges.length > 1 && window.renderContextEvolutionTimeline ? 
              window.renderContextEvolutionTimeline(prompt.contextChanges) : ''}
          </div>
        ` : ''}
        
        ${prompt.context && this._buildContextHTML ? this._buildContextHTML(prompt.context) : ''}
        
        <!-- Related Status Messages -->
        ${prompt.relatedStatusMessages && prompt.relatedStatusMessages.length > 0 && window.renderStatusMessagesInContext ? 
          window.renderStatusMessagesInContext(prompt.relatedStatusMessages, prompt.contextChanges) : ''}
        
      </div>
    `;
  }

  showThreadModal(threadId) {
    const thread = this.groupIntoThreads(this.state.data.entries).find(t => t.id === threadId);
    if (!thread) return;

    const modal = document.getElementById('threadModal');
    const title = document.getElementById('threadModalTitle');
    const body = document.getElementById('threadModalBody');

    title.textContent = `Thread ${threadId.substring(0, 8)}`;
    
    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: var(--space-lg);">
        ${thread.messages.map(msg => `
          <div style="padding: var(--space-lg); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid var(--color-primary);">
            <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-sm);">
              ${new Date(msg.timestamp).toLocaleString()}
            </div>
            ${msg.prompt ? `
              <div style="margin-bottom: var(--space-md);">
                <div style="font-weight: 600; color: var(--color-text); margin-bottom: var(--space-xs);">Prompt:</div>
                <div style="color: var(--color-text-muted);">${this.escapeHtml(msg.prompt)}</div>
              </div>
            ` : ''}
            ${msg.response ? `
              <div>
                <div style="font-weight: 600; color: var(--color-text); margin-bottom: var(--space-xs);">Response:</div>
                <div style="color: var(--color-text-muted);">${this.escapeHtml(msg.response)}</div>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;

    modal.classList.add('active');
  }

  closeThreadModal() {
    document.getElementById('threadModal').classList.remove('active');
  }

  showTerminalModal(id) {
    const cmd = this.state.data.terminalCommands.find(c => c.id === id);
    
    const modal = document.getElementById('eventModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    
    if (!modal || !title || !body) {
      console.error('Modal elements not found');
      return;
    }
    
    if (!cmd) {
      console.warn('Terminal command not found:', id);
      return;
    }
    
    try {
      const isError = cmd.exit_code && cmd.exit_code !== 0;
      const icon = isError ? '[Error]' : '> ';
      
      title.innerHTML = `${icon} Terminal Command`;
      
      body.innerHTML = this._buildTerminalModalHTML(cmd, isError);
    } catch (error) {
      body.innerHTML = `<div class="empty-state-text">Error loading terminal command: ${error.message}</div>`;
    }

    modal.classList.add('active');
  }

  _buildTerminalModalHTML(cmd, isError) {
    const { escapeHtml } = this;
    
    let html = `
      <div style="display: flex; flex-direction: column; gap: var(--space-xl);">
        
        <!-- Command Details -->
        <div>
          <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Command Details</h4>
          <div style="display: grid; gap: var(--space-sm);">
            <div style="padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
              <div style="display: flex; flex-direction: column; gap: var(--space-xs);">
                <span style="color: var(--color-text-muted); font-size: var(--text-xs); margin-bottom: var(--space-xs);">Command:</span>
                <code style="color: var(--color-text); font-family: var(--font-mono); font-size: var(--text-sm); padding: var(--space-sm); background: rgba(99, 102, 241, 0.1); border-radius: var(--radius-sm); display: block; overflow-x: auto; word-break: break-all;">${escapeHtml(cmd.command)}</code>
              </div>
            </div>
            <div style="padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
              <div style="display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap;">
                <span style="color: var(--color-text-muted); font-size: var(--text-xs);">Source:</span>
                <span class="badge" style="background: #6366f1; color: white;">${cmd.source || 'unknown'}</span>
                ${cmd.shell ? `<span class="badge" style="background: rgba(139, 92, 246, 0.2); color: var(--color-primary);">${cmd.shell}</span>` : ''}
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
              <span style="color: var(--color-text-muted);">Timestamp:</span>
              <span style="color: var(--color-text);">${new Date(cmd.timestamp).toLocaleString()}</span>
            </div>
            ${cmd.shell ? `
              <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                <span style="color: var(--color-text-muted);">Shell:</span>
                <span class="badge">${cmd.shell}</span>
              </div>
            ` : ''}
            ${cmd.workspace ? `
              <div style="padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                <div style="display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap;">
                  <span style="color: var(--color-text-muted); font-size: var(--text-xs);">Workspace:</span>
                  ${window.createWorkspaceBadge ? window.createWorkspaceBadge(cmd.workspace, 'md') : `<code style="color: var(--color-text); font-family: var(--font-mono); font-size: var(--text-xs);">${escapeHtml(cmd.workspace)}</code>`}
                </div>
              </div>
            ` : ''}
            ${cmd.exit_code !== null && cmd.exit_code !== undefined ? `
              <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                <span style="color: var(--color-text-muted);">Exit Code:</span>
                <span class="badge" style="background: ${isError ? '#ef4444' : '#10b981'}; color: white;">${cmd.exit_code}</span>
              </div>
            ` : ''}
            ${cmd.duration ? `
              <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                <span style="color: var(--color-text-muted);">Duration:</span>
                <span style="color: var(--color-text);">${cmd.duration}ms</span>
              </div>
            ` : ''}
          </div>
        </div>
    `;
    
    // Show command output if available
    if (cmd.output) {
      html += `
        <div>
          <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Output</h4>
          <pre style="padding: var(--space-md); background: #1e1e1e; color: #d4d4d4; border-radius: var(--radius-md); overflow-x: auto; max-height: 400px; font-size: 12px; line-height: 1.5;"><code>${escapeHtml(cmd.output)}</code></pre>
        </div>
      `;
    }
    
    // Show error message if available
    if (cmd.error) {
      html += `
        <div>
          <h4 style="margin-bottom: var(--space-md); color: var(--color-error);">Error</h4>
          <div style="padding: var(--space-md); background: #fee2e2; color: #dc2626; border-radius: var(--radius-md); font-family: var(--font-mono); font-size: var(--text-sm);">
            ${escapeHtml(cmd.error)}
          </div>
        </div>
      `;
    }
    
    // Show related file changes if linked
    if (cmd.linked_entry_id) {
      const relatedEntry = this.state.data.events.find(e => e.id === cmd.linked_entry_id);
      if (relatedEntry) {
        html += `
          <div>
            <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Related File Change</h4>
            <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid var(--color-primary);">
              <div style="font-family: var(--font-mono); font-size: var(--text-sm); color: var(--color-text); margin-bottom: var(--space-xs);">
                ${escapeHtml(relatedEntry.file_path || 'Unknown file')}
              </div>
              <div style="font-size: var(--text-xs); color: var(--color-text-muted);">
                ${relatedEntry.type || 'file_change'}
              </div>
            </div>
          </div>
        `;
      }
    }
    
    html += `</div>`;
    
    return html;
  }

  closeEventModal() {
    const modal = document.getElementById('eventModal');
    if (modal) {
      modal.classList.remove('active');
      
      // Remove escape key handler
      if (modal._escapeHandler) {
        document.removeEventListener('keydown', modal._escapeHandler);
        modal._escapeHandler = null;
      }
    }
  }

  /**
   * Extract model information from a prompt object
   */
  _extractModelInfoFromPrompt(prompt) {
    if (!prompt) return null;
    
    const modelInfo = {
      model: 'Unknown',
      mode: 'Unknown',
      provider: 'Unknown',
      isAuto: false
    };
    
    // Extract from prompt's modelInfo field if available
    if (prompt.modelInfo) {
      const promptModelInfo = typeof prompt.modelInfo === 'string' ? 
        (() => { try { return JSON.parse(prompt.modelInfo); } catch(e) { return {}; } })() : 
        prompt.modelInfo;
      
      if (promptModelInfo.model && promptModelInfo.model !== 'Unknown') {
        modelInfo.model = promptModelInfo.model;
      }
      if (promptModelInfo.mode && promptModelInfo.mode !== 'Unknown') {
        modelInfo.mode = promptModelInfo.mode;
      }
      if (promptModelInfo.provider && promptModelInfo.provider !== 'Unknown') {
        modelInfo.provider = promptModelInfo.provider;
      }
      if (promptModelInfo.isAuto !== undefined) {
        modelInfo.isAuto = promptModelInfo.isAuto;
      }
    }
    
    // Extract from direct fields if modelInfo wasn't available
    if (modelInfo.model === 'Unknown') {
      const modelName = prompt.model || prompt.ai_model || prompt.assistant_model || 
                       prompt.model_name || prompt.modelName;
      if (modelName) {
        modelInfo.model = String(modelName);
      }
    }
    
    if (modelInfo.mode === 'Unknown') {
      const mode = prompt.mode || prompt.assistant_mode || prompt.ai_mode || 
                   prompt.mode_name || prompt.modeName;
      if (mode) {
        modelInfo.mode = String(mode);
      }
    }
    
    if (modelInfo.provider === 'Unknown' && modelInfo.model !== 'Unknown') {
      // Try to detect provider from model name
      const modelLower = modelInfo.model.toLowerCase();
      if (modelLower.includes('gpt') || modelLower.includes('openai')) {
        modelInfo.provider = 'OpenAI';
      } else if (modelLower.includes('claude') || modelLower.includes('anthropic')) {
        modelInfo.provider = 'Anthropic';
      } else if (modelLower.includes('gemini') || modelLower.includes('google')) {
        modelInfo.provider = 'Google';
      }
    }
    
    return modelInfo;
  }
  
  /**
   * Check if model info is all "Unknown"
   */
  _isAllUnknown(modelInfo) {
    if (!modelInfo) return true;
    const info = typeof modelInfo === 'object' ? modelInfo : 
                 (() => { try { return JSON.parse(modelInfo); } catch(e) { return {}; } })();
    return info.model === 'Unknown' && 
           info.mode === 'Unknown' && 
           info.provider === 'Unknown';
  }
}

// Export as global
window.ModalManager = ModalManager;

// Create global instance
window.modalManager = new ModalManager();

// Export functions for backward compatibility
window.showEventModal = (id) => window.modalManager.showEventModal(id);
window.showThreadModal = (id) => window.modalManager.showThreadModal(id);
window.showTerminalModal = (id) => window.modalManager.showTerminalModal(id);
window.closeEventModal = () => window.modalManager.closeEventModal();
window.closeThreadModal = () => window.modalManager.closeThreadModal();

