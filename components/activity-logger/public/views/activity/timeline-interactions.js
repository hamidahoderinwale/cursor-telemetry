/**
 * Timeline Interaction Handlers
 * Toggle and interaction functions for timeline items
 */

function toggleConversationMessages(threadId) {
  const messagesDiv = document.getElementById(`conversation-messages-${threadId}`);
  const tabsDiv = document.getElementById(`conversation-tabs-${threadId}`);
  const icon = document.getElementById(`conv-icon-${threadId}`);
  
  // Toggle messages or tabs (whichever exists)
  const contentDiv = messagesDiv || tabsDiv;
  
  if (contentDiv && icon) {
    const isHidden = contentDiv.style.display === 'none' || (!contentDiv.classList.contains('visible') && contentDiv.style.display !== 'block');
    if (isHidden) {
      contentDiv.classList.add('visible');
      contentDiv.style.display = 'block';
      icon.style.transform = 'rotate(90deg)';
    } else {
      contentDiv.classList.remove('visible');
      contentDiv.style.display = 'none';
      icon.style.transform = 'rotate(0deg)';
    }
  }
}


function toggleTabMessages(tabId) {
  const messagesDiv = document.getElementById(`tab-messages-${tabId}`);
  const icon = document.getElementById(`tab-icon-${tabId}`);
  
  if (messagesDiv && icon) {
    const isHidden = messagesDiv.style.display === 'none' || !messagesDiv.style.display;
    if (isHidden) {
      messagesDiv.style.display = 'block';
      icon.style.transform = 'rotate(90deg)';
    } else {
      messagesDiv.style.display = 'none';
      icon.style.transform = 'rotate(0deg)';
    }
  }
}


function toggleTemporalThread(threadId) {
  const itemsDiv = document.getElementById(`thread-items-${threadId}`);
  const icon = document.getElementById(`thread-icon-${threadId}`);
  
  if (itemsDiv && icon) {
    const isHidden = itemsDiv.style.display === 'none' || !itemsDiv.classList.contains('visible');
    if (isHidden) {
      itemsDiv.style.display = 'block';
      itemsDiv.classList.add('visible');
      icon.textContent = '';
    } else {
      itemsDiv.style.display = 'none';
      itemsDiv.classList.remove('visible');
      icon.textContent = '';
    }
  }
}


function togglePromptGroup(groupId) {
  const itemsContainer = document.getElementById(`items-${groupId}`);
  const previewContainer = document.getElementById(`preview-${groupId}`);
  const toggleButton = document.getElementById(`toggle-${groupId}`);
  
  if (itemsContainer && previewContainer && toggleButton) {
    const isExpanded = itemsContainer.style.display !== 'none';
    itemsContainer.style.display = isExpanded ? 'none' : 'block';
    previewContainer.style.display = isExpanded ? 'block' : 'none';
    toggleButton.textContent = isExpanded ? '' : '';
  }
}


async function loadEventDetailsIntoContainer(event, container) {
  if (!event || !container) return;
  
  try {
    const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
    
    // Fetch related data
    let relatedScreenshots = [];
    try {
      const screenshotsResponse = await fetch(`http://localhost:43917/api/screenshots/near/${event.timestamp}`);
      if (screenshotsResponse.ok) {
        const screenshotsData = await screenshotsResponse.json();
        if (screenshotsData.success) {
          relatedScreenshots = screenshotsData.screenshots;
        }
      }
    } catch (e) {
      // Ignore screenshot errors
    }
    
    // Find related prompts
    const relatedPrompts = window.findRelatedPrompts ? window.findRelatedPrompts(event) : [];
    
    // Find related conversations
    const conversationsArray = Array.isArray(window.state.data.cursorConversations) ? window.state.data.cursorConversations : [];
    const eventTime = new Date(event.timestamp).getTime();
    const relatedConversations = conversationsArray.filter(c => {
      if (!c || !c.timestamp) return false;
      const convTime = new Date(c.timestamp).getTime();
      const diff = Math.abs(eventTime - convTime);
      return diff < 10 * 60 * 1000;
    });
    
    // Find linked prompt
    let linkedPrompt = null;
    if (event.prompt_id && window.state.data.prompts) {
      linkedPrompt = window.state.data.prompts.find(p => 
        p.id === event.prompt_id || p.id === parseInt(event.prompt_id)
      );
    }
    
    // Find related terminal commands
    const terminalCommands = window.state.data?.terminalCommands || window.state.data?.terminals || [];
    const filePath = details?.file_path || event.file_path || '';
    const relatedTerminalCommands = terminalCommands.filter(cmd => {
      if (!cmd || !cmd.timestamp) return false;
      const cmdTime = new Date(cmd.timestamp).getTime();
      const timeDiff = Math.abs(eventTime - cmdTime);
      if (timeDiff > 5 * 60 * 1000) return false;
      if (filePath) {
        const cmdText = (cmd.command || cmd.text || '').toLowerCase();
        const fileName = filePath.split('/').pop().toLowerCase();
        const dirName = filePath.split('/').slice(-2, -1)[0]?.toLowerCase() || '';
        if (cmdText.includes(fileName) || (dirName && cmdText.includes(dirName))) {
          return true;
        }
        if (cmd.cwd && filePath.includes(cmd.cwd)) {
          return true;
        }
      }
      return true;
    }).slice(0, 10);
    
    // Build HTML using modal manager
    const detailsHTML = window.modalManager._buildEventModalHTML(
      event, 
      details, 
      relatedScreenshots, 
      relatedPrompts, 
      relatedConversations, 
      linkedPrompt, 
      relatedTerminalCommands
    );
    
    container.innerHTML = detailsHTML;
    
    // Initialize lazy loading for images
    if (window.modalManager._initializeLazyLoading) {
      window.modalManager._initializeLazyLoading(container);
    }
  } catch (error) {
    console.error('[LOAD-DETAILS] Error loading event details:', error);
    container.innerHTML = `<div style="padding: var(--space-lg); text-align: center; color: var(--color-error);">Error loading details: ${error.message}</div>`;
  }
}


// Export to window for backward compatibility
if (typeof window !== 'undefined') {
  window.toggleConversationMessages = toggleConversationMessages;
  window.toggleTabMessages = toggleTabMessages;
  window.toggleTemporalThread = toggleTemporalThread;
  window.togglePromptGroup = togglePromptGroup;
  window.loadEventDetailsIntoContainer = loadEventDetailsIntoContainer;
}
