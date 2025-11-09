/**
 * Modal Manager
 * Handles event, prompt, thread, and terminal modals
 */

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
      const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
      
      // Debug: Log code diff data structure
      console.log('[MODAL] Code diff check:', {
        eventId: event.id,
        eventType: event.type,
        hasDetails: !!details,
        detailsKeys: details ? Object.keys(details) : [],
        before_content: details?.before_content ? `${details.before_content.substring(0, 50)}... (${details.before_content.length} chars)` : details?.before_content,
        after_content: details?.after_content ? `${details.after_content.substring(0, 50)}... (${details.after_content.length} chars)` : details?.after_content,
        before_code: details?.before_code ? `${details.before_code.substring(0, 50)}... (${details.before_code.length} chars)` : details?.before_code,
        after_code: details?.after_code ? `${details.after_code.substring(0, 50)}... (${details.after_code.length} chars)` : details?.after_code,
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
      
      body.innerHTML = this._buildEventModalHTML(event, details, relatedScreenshots, relatedPrompts, relatedConversations, linkedPrompt);
    } catch (error) {
      body.innerHTML = `<div class="empty-state-text">Error loading event details: ${error.message}</div>`;
    }

    modal.classList.add('active');
  }

  _buildEventModalHTML(event, details, relatedScreenshots, relatedPrompts, relatedConversations, linkedPrompt = null) {
    const { escapeHtml, truncate, isImageFile } = this;
    
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
              ${window.renderAnnotationIcon ? window.renderAnnotationIcon(16, 'var(--color-primary)') : '<span>✨</span>'}
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
            ${event.workspace_path ? `
              <div style="padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                <div style="display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap;">
                  <span style="color: var(--color-text-muted); font-size: var(--text-xs);">Workspace:</span>
                  ${window.createWorkspaceBadge ? window.createWorkspaceBadge(event.workspace_path, 'md') : `<span style="color: var(--color-text); font-family: var(--font-mono); font-size: var(--text-xs);">${truncate(event.workspace_path, 40)}</span>`}
                </div>
              </div>
            ` : ''}
            ${details?.file_path ? `
              <div style="padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                <div style="display: flex; flex-direction: column; gap: var(--space-xs);">
                  <span style="color: var(--color-text-muted); font-size: var(--text-xs); margin-bottom: var(--space-xs);">File:</span>
                  ${window.createFilePathBadge ? window.createFilePathBadge(details.file_path, event.workspace_path) : `
                    <div style="display: flex; flex-direction: column; gap: var(--space-xs);">
                      <span style="color: var(--color-text); font-family: var(--font-mono); font-size: var(--text-sm); font-weight: 500;">${details.file_path.split('/').pop()}</span>
                      ${window.formatFilePathWithDirectory ? `
                        <span style="color: var(--color-text-muted); font-family: var(--font-mono); font-size: var(--text-xs);">${window.formatFilePathWithDirectory(details.file_path, 3)}</span>
                      ` : ''}
                    </div>
                  `}
                </div>
              </div>
            ` : ''}
            ${details?.file_path && isImageFile(details.file_path) ? `
              <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md);">
                <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-sm);">Screenshot Preview:</div>
                <div style="border-radius: var(--radius-md); overflow: hidden; background: #000; display: flex; align-items: center; justify-content: center; max-height: 400px;">
                  <img src="${window.CONFIG?.API_BASE_URL || window.CONFIG?.API_BASE || window.DASHBOARD_CONFIG?.API_BASE || 'http://localhost:43917'}/api/image?path=${encodeURIComponent(details.file_path)}" 
                       alt="Screenshot" 
                       style="max-width: 100%; max-height: 400px; object-fit: contain;"
                       onerror="this.parentElement.innerHTML = '<div style=\\'padding: var(--space-lg); color: var(--color-text-muted); text-align: center;\\'>Image not accessible<br><span style=\\'font-size: 0.85em; font-family: var(--font-mono);\\'>Path: ${details.file_path}</span><br><span style=\\'font-size: 0.75em; margin-top: 8px; display: block;\\'>Workaround: The file may have been moved or deleted. Try opening it manually from Finder.</span></div>'">
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
            ${details?.lines_added !== undefined || details?.chars_added !== undefined ? `
              <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md);">
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-lg); text-align: center;">
                  <div>
                    <div style="font-size: var(--text-xl); color: var(--color-success); font-weight: 600; margin-bottom: var(--space-xs);">
                      +${details.lines_added || 0}
                    </div>
                    <div style="font-size: var(--text-xs); color: var(--color-text-muted);">Lines Added</div>
                    <div style="font-size: var(--text-sm); color: var(--color-success); margin-top: var(--space-xs);">
                      +${details.chars_added || 0} chars
                    </div>
                  </div>
                  <div>
                    <div style="font-size: var(--text-xl); color: var(--color-error); font-weight: 600; margin-bottom: var(--space-xs);">
                      -${details.lines_removed || 0}
                    </div>
                    <div style="font-size: var(--text-xs); color: var(--color-text-muted);">Lines Removed</div>
                    <div style="font-size: var(--text-sm); color: var(--color-error); margin-top: var(--space-xs);">
                      -${details.chars_deleted || 0} chars
                    </div>
                  </div>
                </div>
              </div>
            ` : ''}
          </div>
        </div>

        ${event.context ? this._buildContextHTML(event.context) : ''}

        ${relatedScreenshots.length > 0 ? this._buildScreenshotsHTML(event, relatedScreenshots) : ''}

        ${(() => {
          // Normalize code diff data - handle multiple field name variations
          let beforeContent = details?.before_content || details?.before_code || details?.beforeContent || null;
          let afterContent = details?.after_content || details?.after_code || details?.afterContent || null;
          
          // Check if we have valid content (not just empty strings or null)
          const hasBefore = beforeContent && typeof beforeContent === 'string' && beforeContent.trim().length > 0;
          const hasAfter = afterContent && typeof afterContent === 'string' && afterContent.trim().length > 0;
          
          // Show code diff if we have either before or after content, OR if there are diff stats indicating changes
          const hasDiffStats = details?.diff_stats?.has_diff || 
                             details?.lines_added > 0 || 
                             details?.lines_removed > 0 ||
                             (details?.diff_stats && (details.diff_stats.lines_added > 0 || details.diff_stats.lines_removed > 0));
          
          if (hasBefore || hasAfter || hasDiffStats) {
            // Normalize to before_content/after_content format
            const normalizedDetails = {
              ...details,
              before_content: beforeContent || '',
              after_content: afterContent || '',
              diff_stats: details?.diff_stats || (details?.lines_added !== undefined || details?.lines_removed !== undefined ? {
                lines_added: details.lines_added || 0,
                lines_removed: details.lines_removed || 0,
                has_diff: true
              } : null)
            };
            return this._buildCodeDiffHTML(normalizedDetails, linkedPrompt ? 'Generated from linked prompt above' : null);
          }
          return '';
        })()}

        ${relatedPrompts.length > 0 ? this._buildRelatedPromptsHTML(relatedPrompts) : 
          (this.state && this.state.data && this.state.data.prompts && this.state.data.prompts.length > 0) ? 
            this._buildNoRelatedPromptsDebugHTML(event, this.state.data.prompts) : 
            '<div style="padding: var(--space-md); background: rgba(148, 163, 184, 0.1); border-radius: var(--radius-md); border: 1px dashed var(--color-border);"><div style="font-size: var(--text-sm); color: var(--color-text-muted);">No prompts available in state</div></div>'}

        ${relatedConversations.length > 0 ? this._buildRelatedConversationsHTML(relatedConversations) : ''}

        ${this.state.data.cursorDbStats ? this._buildDbStatsHTML(this.state.data.cursorDbStats) : ''}

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
    return `
      <div>
        <h4 style="margin-bottom: var(--space-md); color: var(--color-text); display: flex; align-items: center; gap: var(--space-sm);">
          <span>Related Screenshots</span>
          <span style="background: #f59e0b; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px;">${screenshots.length}</span>
        </h4>
        <div style="font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-md);">
          Screenshots captured within 5 minutes of this event
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: var(--space-md);">
          ${screenshots.map(screenshot => {
            const timeDiff = Math.abs(new Date(event.timestamp).getTime() - new Date(screenshot.timestamp).getTime());
            const minutesAgo = Math.floor(timeDiff / 60000);
            const secondsAgo = Math.floor((timeDiff % 60000) / 1000);
            const timingText = minutesAgo > 0 ? `${minutesAgo}m ${secondsAgo}s` : `${secondsAgo}s`;
            const isBefore = new Date(screenshot.timestamp) < new Date(event.timestamp);
            
            return `
              <div style="border: 2px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; background: var(--color-bg); transition: all 0.2s;" 
                   onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 8px 16px rgba(0,0,0,0.15)';" 
                   onmouseout="this.style.transform=''; this.style.boxShadow='';">
                <div style="position: relative; background: #000; aspect-ratio: 16/9; overflow: hidden;">
                  <img src="${window.CONFIG?.API_BASE_URL || window.CONFIG?.API_BASE || window.DASHBOARD_CONFIG?.API_BASE || 'http://localhost:43917'}/api/image?path=${encodeURIComponent(screenshot.path)}" 
                       alt="${screenshot.fileName}" 
                       style="width: 100%; height: 100%; object-fit: contain; cursor: pointer;"
                       onclick="window.open('${window.CONFIG?.API_BASE_URL || window.CONFIG?.API_BASE || window.DASHBOARD_CONFIG?.API_BASE || 'http://localhost:43917'}/api/image?path=${encodeURIComponent(screenshot.path)}', '_blank')"
                       onerror="this.parentElement.innerHTML = '<div style=\\'display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); padding: var(--space-md); text-align: center; flex-direction: column;\\'>Image<div style=\\'font-size: 0.75em; margin-top: 8px;\\'>Screenshot not accessible</div><div style=\\'font-size: 0.65em; margin-top: 4px; color: var(--color-text-muted);\\'>File may have been moved</div></div>'">
                  <div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">
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
    return `
      <div>
        <h4 style="margin-bottom: var(--space-md); color: var(--color-text); display: flex; align-items: center; gap: var(--space-sm);">
          <span>Code Diff</span>
          ${details.diff_stats?.has_diff ? `
            <span style="font-size: var(--text-xs); color: var(--color-text-muted); font-weight: normal;">
              (${details.diff_stats.lines_added > 0 ? `+${details.diff_stats.lines_added}` : ''}${details.diff_stats.lines_added > 0 && details.diff_stats.lines_removed > 0 ? '/' : ''}${details.diff_stats.lines_removed > 0 ? `-${details.diff_stats.lines_removed}` : ''} lines)
            </span>
          ` : ''}
        </h4>
        ${subtitle ? `
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-md); padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-sm);">
            ${subtitle}
          </div>
        ` : ''}
        <div style="display: grid; gap: var(--space-md);">
          ${details.before_content ? `
            <div>
              <div style="padding: var(--space-xs) var(--space-sm); background: rgba(239, 68, 68, 0.1); border-radius: var(--radius-sm) var(--radius-sm) 0 0; font-size: var(--text-xs); color: var(--color-error); font-weight: 500;">
                Before (${details.before_content.split('\\n').length} lines)
              </div>
              <div class="code-block" style="max-height: 250px; overflow-y: auto; border-radius: 0 0 var(--radius-sm) var(--radius-sm);">
                <pre style="margin: 0; font-size: var(--text-xs); line-height: 1.5;">${escapeHtml(details.before_content)}</pre>
              </div>
            </div>
          ` : ''}
          ${details.after_content ? `
            <div>
              <div style="padding: var(--space-xs) var(--space-sm); background: rgba(34, 197, 94, 0.1); border-radius: var(--radius-sm) var(--radius-sm) 0 0; font-size: var(--text-xs); color: var(--color-success); font-weight: 500;">
                After (${details.after_content.split('\\n').length} lines)
              </div>
              <div class="code-block" style="max-height: 250px; overflow-y: auto; border-radius: 0 0 var(--radius-sm) var(--radius-sm);">
                <pre style="margin: 0; font-size: var(--text-xs); line-height: 1.5;">${escapeHtml(details.after_content)}</pre>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
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
            const minutes = Math.floor(prompt.timeDiffSeconds / 60);
            const seconds = prompt.timeDiffSeconds % 60;
            const timeDiffText = prompt.timeDiffSeconds < 60 ? 
              `${prompt.timeDiffSeconds}s ${prompt.isBefore ? 'before' : 'after'}` : 
              `${minutes}m ${seconds}s ${prompt.isBefore ? 'before' : 'after'}`;
            const relevancePercent = Math.round(prompt.relevanceScore * 100);
            
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
    const eventWorkspace = (event.workspace_path || event.details?.workspace_path || '').toLowerCase();
    
    // Show info about nearby prompts
    const nearbyPrompts = allPrompts.filter(p => {
      const promptTime = new Date(p.timestamp).getTime();
      const timeDiff = Math.abs(eventTime - promptTime);
      return timeDiff < 15 * 60 * 1000; // 15 minutes
    });
    
    return `
      <div>
        <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Related AI Prompts</h4>
        <div style="padding: var(--space-md); background: rgba(148, 163, 184, 0.1); border-radius: var(--radius-md); border: 1px dashed var(--color-border);">
          <div style="font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-xs);">
            <strong>No prompts found within 15 minutes of this event</strong>
          </div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted);">
            <div>Total prompts available: ${allPrompts.length}</div>
            <div>Prompts within 15 minutes: ${nearbyPrompts.length}</div>
            ${nearbyPrompts.length > 0 ? `
              <div style="margin-top: var(--space-sm); padding-top: var(--space-sm); border-top: 1px solid var(--color-border);">
                <div style="font-weight: 500; margin-bottom: var(--space-xs);">Nearby prompts (may not match workspace):</div>
                ${nearbyPrompts.slice(0, 3).map(p => {
                  const promptText = (p.text || p.prompt || p.preview || '').substring(0, 80);
                  const timeDiff = Math.abs(eventTime - new Date(p.timestamp).getTime());
                  const minutes = Math.floor(timeDiff / 60000);
                  const isBefore = new Date(p.timestamp).getTime() < eventTime;
                  const escapedText = window.escapeHtml ? window.escapeHtml(promptText) : promptText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                  return `
                    <div style="margin-top: var(--space-xs); padding: var(--space-xs); background: var(--color-bg); border-radius: var(--radius-sm); font-size: 10px;">
                      <div style="color: var(--color-text);">${escapedText}${promptText.length >= 80 ? '...' : ''}</div>
                      <div style="color: var(--color-text-muted); margin-top: 2px;">${minutes}m ${isBefore ? 'before' : 'after'}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : ''}
          </div>
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
    
    title.textContent = 'AI Prompt';
    
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

