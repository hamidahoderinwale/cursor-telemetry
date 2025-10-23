/**
 * Cursor Activity Dashboard - Clean Modular JavaScript
 */

class ActivityDashboard {
  constructor() {
    this.companionUrl = 'http://localhost:43917';
    this.currentFilter = 'all';
    this.currentTab = 'overview';
    this.currentViewMode = 'list'; // Add view mode tracking
    this.events = [];
    this.entries = [];
    this.prompts = [];
    this.socket = null;
    this.isConnected = false;
    this.sessions = new Set();
    this.workspaces = []; // Changed from Map to Array
    this.embeddings = null;
    this.tfidfData = null;
    this.isConnected = false;
    
    // Initialize semantic analysis engine
    this.semanticEngine = new SemanticAnalysisEngine();
    this.codePatterns = null;
    this.fileGraph = null;
    
    // Initialize prompt analytics engine
    this.promptAnalytics = new PromptAnalyticsEngine();
    this.promptData = null;
    
    // Initialize timeline properties
    this.timeRange = 'all';
    this.visibleLayers = {
      sessions: true,
      fileChanges: true,
      prompts: true
    };
    
    // Initialize time series visualizer
    this.timeSeriesViz = new TimeSeriesVisualizer();
    this.currentTimeRange = '7d';
    
    // Initialize default workspaces
    this.initializeDefaultWorkspaces();
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    // WebSocket disabled - companion service doesn't support it
    // this.initializeWebSocket();
    this.startPolling();
    this.loadWorkspaces();
    this.updateStats();
    this.renderActivityFeed();
    
    // Load all components automatically
    setTimeout(() => {
      this.loadSemanticAnalysis();
      this.loadAnalytics();
      this.updateAnalytics();
      this.updateModelAnalytics();
      this.analyzePrompts();
      
      // Force load semantic analysis components
      this.loadEmbeddings();
      this.loadTFIDF();
    }, 2000);
  }

  setupEventListeners() {
    // Auto-refresh every 5 seconds with performance optimization
    this.refreshInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
      this.refreshData();
      }
    }, 5000);
    
    // Add visibility change listener for performance
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.refreshData();
      }
    });
  }
  
  // Cleanup method for performance
  cleanup() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
  }
  
  setupEventListeners() {
    // Auto-refresh every 5 seconds with performance optimization
    this.refreshInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.refreshData();
      }
    }, 5000);
    
    // Add visibility change listener for performance
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.refreshData();
      }
    });
    
    // Navigation event listeners
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });
    
    // Similarity threshold slider
    const thresholdSlider = document.getElementById('similarityThreshold');
    const thresholdValue = document.getElementById('thresholdValue');
    if (thresholdSlider && thresholdValue) {
      thresholdSlider.addEventListener('input', (e) => {
        thresholdValue.textContent = e.target.value;
      });
    }
  }

  initializeWebSocket() {
    // Check if Socket.IO is available
    if (typeof io === 'undefined') {
      console.warn('Socket.IO not available, dashboard will work without real-time updates');
      return;
    }
    
    try {
      this.socket = io(this.companionUrl, {
        timeout: 5000,
        forceNew: true
      });
      
      this.socket.on('connect', () => {
        console.log('Connected to companion service via WebSocket');
        this.isConnected = true;
        this.updateConnectionStatus(true);
        
        // Request initial data
        this.socket.emit('request-data', 'all');
      });
      
      this.socket.on('disconnect', () => {
        console.log('Disconnected from companion service');
        this.isConnected = false;
        this.updateConnectionStatus(false);
      });
      
      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        this.isConnected = false;
        this.updateConnectionStatus(false);
        // Fallback to polling if WebSocket fails
        this.startPolling();
      });
      
      // Handle real-time data updates
      this.socket.on('initial-data', (data) => {
        console.log('Received initial data from companion service');
        this.processRealtimeData(data);
      });
      
      this.socket.on('new-entry', (entry) => {
        console.log('New entry received:', entry);
        this.handleNewEntry(entry);
      });
      
      this.socket.on('entries-update', (entries) => {
        console.log('Entries updated:', entries.length);
        this.handleEntriesUpdate(entries);
      });
      
      this.socket.on('full-update', (data) => {
        console.log('Full update received');
        this.processRealtimeData(data);
      });
      
      this.socket.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
      
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      this.updateConnectionStatus(false);
    }
  }

  processRealtimeData(data) {
    console.log('Processing realtime data:', {
      hasEntries: !!data.entries,
      hasEvents: !!data.events,
      hasPrompts: !!data.prompts,
      entriesLength: data.entries?.length || 0,
      eventsLength: data.events?.length || 0
    });
    
    // Handle both entries and events from WebSocket with validation
    if (data.entries) {
      const validatedEntries = this.validateAndNormalizeData(data.entries);
      this.events = validatedEntries;
    }
    if (data.events) {
      const validatedEvents = this.validateAndNormalizeData(data.events);
      this.events = [...(this.events || []), ...validatedEvents];
    }
    if (data.prompts) {
      this.prompts = data.prompts;
    }
    
    console.log('Processed data:', {
      eventsCount: this.events.length,
      promptsCount: this.prompts.length
    });
    
    this.updateStats();
    this.renderActivityFeed();
    
    // Update timeline if it exists
    if (window.ganttTimeline && window.ganttTimeline.processData) {
      window.ganttTimeline.data = window.ganttTimeline.processData(this.events);
      window.ganttTimeline.renderTimeline();
    }
  }

  handleNewEntry(entry) {
    this.events.unshift(entry);
    this.updateStats();
    this.renderActivityFeed();
    
    // Update timeline if it exists
    if (window.ganttTimeline && window.ganttTimeline.processData) {
      window.ganttTimeline.data = window.ganttTimeline.processData(this.events);
      window.ganttTimeline.renderTimeline();
    }
  }

  handleEntriesUpdate(entries) {
    this.events = entries;
    this.updateStats();
    this.renderActivityFeed();
    
    // Update timeline if it exists
    if (window.ganttTimeline && window.ganttTimeline.processData) {
      window.ganttTimeline.data = window.ganttTimeline.processData(entries);
      window.ganttTimeline.renderTimeline();
    }
  }

  async startPolling() {
    try {
      await this.refreshData();
      this.updateConnectionStatus(true);
    } catch (error) {
      console.error('Failed to connect to companion service:', error);
      this.updateConnectionStatus(false);
      
      // Show user-friendly message about companion service
      const dashboardStatus = document.getElementById('dashboardStatus');
      if (dashboardStatus) {
        dashboardStatus.textContent = 'Companion service not running';
        dashboardStatus.style.color = 'var(--color-error)';
      }
    }
  }

  async refreshData() {
    try {
      console.log('Fetching data from companion service...');
      
      // Fetch main activity data first
      try {
        const activityResponse = await fetch(`${this.companionUrl}/api/activity`);
        if (activityResponse.ok) {
          const activityData = await activityResponse.json();
          this.events = this.validateAndNormalizeData(activityData);
          console.log('Loaded activity data:', this.events.length, 'events');
        } else {
          console.log('Activity API not available, status:', activityResponse.status);
          this.events = [];
        }
      } catch (error) {
        console.error('Failed to fetch activity data:', error);
        this.events = [];
      }
      
      // Fetch multi-workspace data
      try {
        const workspacesResponse = await fetch(`${this.companionUrl}/api/workspaces`);
        if (workspacesResponse.ok) {
          this.workspaces = await workspacesResponse.json();
          console.log('Loaded workspaces:', this.workspaces.length, 'workspaces');
        } else {
          console.log('Workspaces API not available, status:', workspacesResponse.status);
          this.workspaces = [];
        }
      } catch (error) {
        console.error('Failed to fetch workspaces:', error);
        this.workspaces = [];
      }
      
      // Fetch additional data from companion service
      const [queueResponse, healthResponse, ideStateResponse, systemResourcesResponse, gitDataResponse, rawDataResponse] = await Promise.allSettled([
        fetch(`${this.companionUrl}/queue`),
        fetch(`${this.companionUrl}/health`),
        fetch(`${this.companionUrl}/ide-state`),
        fetch(`${this.companionUrl}/raw-data/system-resources?limit=1000`),
        fetch(`${this.companionUrl}/raw-data/git?limit=1000`),
        fetch(`${this.companionUrl}/raw-data/all?limit=1000`)
      ]);
      
      if (queueResponse.status === 'fulfilled') {
        const data = await queueResponse.value.json();
        console.log('Queue data received:', {
          hasEvents: !!data.events,
          hasEntries: !!data.entries,
          eventsLength: data.events?.length || 0,
          entriesLength: data.entries?.length || 0
        });
        
        // Only merge if we don't already have this data from the main API
        if (data.events && data.events.length > 0) {
          // Check for duplicates before merging
          const existingIds = new Set(this.events.map(e => e.id).filter(Boolean));
          const newEvents = data.events.filter(e => !existingIds.has(e.id));
          this.events = [...this.events, ...newEvents];
        }
        if (data.entries && data.entries.length > 0) {
          this.entries = data.entries;
        }
        
        console.log('Received comprehensive data:', {
          events: this.events.length,
          entries: this.entries?.length || 0
        });
        
        // Update analytics with new data
        this.updateStats();
        this.renderActivityFeed();
        this.updateWorkspaceData();
        this.updateAnalytics();
        this.updateModelAnalytics();
        this.analyzePrompts();
        
        // Load semantic analysis with new data
        this.loadSemanticAnalysis();
        
        // Force load semantic analysis components
        this.loadEmbeddings();
        this.loadTFIDF();
        
        this.updateConnectionStatus(true);
        console.log('Data fetch successful, connection status updated to true');
        
        // Update stats and render feed with new data
        this.updateStats();
        this.renderActivityFeed();
      }
      
      if (healthResponse.status === 'fulfilled') {
        const healthData = await healthResponse.value.json();
        this.updateHealthMetrics(healthData);
      }

      if (ideStateResponse.status === 'fulfilled') {
        const ideStateData = await ideStateResponse.value.json();
        this.ideStates = ideStateData.data || [];
        this.#renderIDEStateActivity();
      }

      if (systemResourcesResponse.status === 'fulfilled') {
        const systemData = await systemResourcesResponse.value.json();
        this.systemResources = systemData.data || [];
        this.updateSystemResourceMetrics();
      }

      if (gitDataResponse.status === 'fulfilled') {
        const gitData = await gitDataResponse.value.json();
        this.gitData = gitData.data || [];
        this.updateGitMetrics();
      }

      if (rawDataResponse.status === 'fulfilled') {
        const rawData = await rawDataResponse.value.json();
        this.rawData = rawData.data || {};
        this.updateRawDataMetrics();
      }
      
    } catch (error) {
      console.error('Error fetching data:', error);
      this.updateConnectionStatus(false);
    }
  }

  updateHealthMetrics(healthData) {
    // Update health metrics display
    const healthElement = document.getElementById('healthMetrics');
    if (healthElement) {
      healthElement.innerHTML = `
        <div class="health-metric">
          <span class="metric-label">Queue Length:</span>
          <span class="metric-value">${healthData.queue_length || 0}</span>
        </div>
        <div class="health-metric">
          <span class="metric-label">Sequence:</span>
          <span class="metric-value">${healthData.sequence || 0}</span>
        </div>
        <div class="health-metric">
          <span class="metric-label">Uptime:</span>
          <span class="metric-value">${this.formatUptime(healthData.uptime)}</span>
        </div>
      `;
    }
  }

  formatUptime(seconds) {
    if (!seconds) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  updateStats() {
    // Get events filtered by workspace ONLY (not by type filter)
    const activeWorkspace = this.getActiveWorkspace();
    let filteredEvents = this.events || [];
    let filteredEntries = this.entries || [];
    
    // Apply workspace filtering if a workspace is selected
    if (activeWorkspace) {
      filteredEvents = filteredEvents.filter(event => 
        this.eventMatchesWorkspace(event, activeWorkspace)
      );
      
      filteredEntries = (this.entries || []).filter(entry => 
        this.eventMatchesWorkspace(entry, activeWorkspace)
      );
    }

    console.log('Updating stats with data:', {
      events: filteredEvents?.length || 0,
      entries: filteredEntries?.length || 0,
      totalEvents: this.events?.length || 0,
      totalEntries: this.entries?.length || 0,
      activeWorkspace: activeWorkspace?.name || 'All Workspaces',
      sampleEvent: filteredEvents?.[0],
      sampleEntry: filteredEntries?.[0]
    });

    // Calculate stats from both events and entries - improved file change detection
    const fileChangeEvents = (filteredEvents || []).filter(e => {
      const type = e.type;
      return type === 'code_change' || type === 'file_change' || type === 'file_modified' || 
             type === 'file_created' || type === 'file_deleted' || type === 'file_saved' ||
             type === 'filewatcher-detected' || type === 'code-change';
    });
    const fileChangeEntries = (filteredEntries || []).filter(e => {
      const type = e.type;
      return type === 'file_change' || type === 'code_change' || type === 'file_modified' || 
             type === 'file_created' || type === 'file_deleted' || type === 'file_saved' ||
             type === 'filewatcher-detected' || type === 'code-change';
    });
    const sessionEvents = (filteredEvents || []).filter(e => e.type === 'session_event');
    const promptEvents = (filteredEvents || []).filter(e => e.type === 'prompt_response');
    const clipboardEvents = (filteredEvents || []).filter(e => e.type === 'clipboard');
    
    // Get unique sessions from both events and entries
    const eventSessions = new Set((filteredEvents || []).map(e => e.session_id).filter(Boolean));
    const entrySessions = new Set((filteredEntries || []).map(e => e.session_id).filter(Boolean));
    const uniqueSessions = new Set([...eventSessions, ...entrySessions]);
    
    // Calculate total bytes from both events and entries - improved calculation
    const eventBytes = fileChangeEvents.reduce((sum, e) => {
      try {
        const details = JSON.parse(e.details || '{}');
        // Try multiple possible byte size fields
        const diffSize = details.diff_size || details.bytes_changed || details.size || 0;
        return sum + diffSize;
      } catch {
        return sum;
      }
    }, 0);

    const entryBytes = fileChangeEntries.reduce((sum, e) => {
      try {
        const details = JSON.parse(e.details || '{}');
        // Try multiple possible byte size fields
        const diffSize = details.diff_size || details.bytes_changed || details.size || 0;
        return sum + diffSize;
      } catch {
        return sum;
      }
    }, 0);

    // Also calculate bytes from content length if diff_size is not available
    const contentBytes = [...fileChangeEvents, ...fileChangeEntries].reduce((sum, e) => {
      try {
        const details = JSON.parse(e.details || '{}');
        const content = details.content || details.after_content || '';
        const beforeContent = details.before_content || '';
        if (content || beforeContent) {
          return sum + Math.abs(content.length - beforeContent.length);
        }
        return sum;
      } catch {
        return sum;
      }
    }, 0);

    // Calculate bytes from the actual content in the data
    const actualContentBytes = [...filteredEvents, ...filteredEntries].reduce((sum, e) => {
      try {
        const details = JSON.parse(e.details || '{}');
        const content = details.content || details.after_content || '';
        if (content && typeof content === 'string') {
          return sum + content.length;
        }
        return sum;
      } catch {
        return sum;
      }
    }, 0);

    const totalBytes = eventBytes + entryBytes + contentBytes + actualContentBytes;
    const totalEvents = filteredEvents.length + filteredEntries.length;
    const totalFileChanges = fileChangeEvents.length + fileChangeEntries.length;

    // Debug: show event types we're getting
    const eventTypes = [...new Set([...filteredEvents, ...filteredEntries].map(e => {
      if (e.type) return e.type;
      // Try to infer type from context
      if (e.file || e.filePath || e.file_path) return 'file_change';
      if (e.prompt || e.response) return 'prompt_response';
      return 'file_change'; // Default fallback
    }))];
    console.log('Event types found:', eventTypes);
    console.log('File change events found:', fileChangeEvents.length);
    console.log('File change entries found:', fileChangeEntries.length);
    
    console.log('Calculated stats:', {
      sessions: uniqueSessions.size,
      events: totalEvents,
      fileChanges: totalFileChanges,
      bytes: totalBytes,
      eventBytes: eventBytes,
      entryBytes: entryBytes,
      contentBytes: contentBytes,
      actualContentBytes: actualContentBytes
    });

    // Update the UI elements (top stats bar)
    const sessionsElements = document.querySelectorAll('#totalSessions');
    const eventsElement = document.getElementById('totalEvents');
    const fileChangesElement = document.getElementById('totalFileChanges');
    const bytesElement = document.getElementById('totalBytes');

    // Update all sessions elements (there might be multiple)
    sessionsElements.forEach(el => el.textContent = uniqueSessions.size);
    if (eventsElement) eventsElement.textContent = totalEvents;
    if (fileChangesElement) fileChangesElement.textContent = totalFileChanges;
    if (bytesElement) bytesElement.textContent = this.formatBytes(totalBytes);
    
    // Update additional stats
    const promptCount = document.getElementById('totalPrompts');
    const clipboardCount = document.getElementById('totalClipboard');
    const workspacesCount = document.getElementById('totalWorkspaces');
    const activeTimeElement = document.getElementById('totalActiveTime');
    const codeChangeElement = document.getElementById('codeChangeCount');
    const fileChangeElement = document.getElementById('fileChangeCount');
    const aiInteractionElement = document.getElementById('aiInteractionCount');
    
    if (promptCount) promptCount.textContent = promptEvents.length;
    if (clipboardCount) clipboardCount.textContent = clipboardEvents.length;
    if (workspacesCount) workspacesCount.textContent = this.workspaces.length;
    if (codeChangeElement) codeChangeElement.textContent = fileChangeEvents.length;
    if (fileChangeElement) fileChangeElement.textContent = totalFileChanges;
    if (aiInteractionElement) aiInteractionElement.textContent = promptEvents.length;
    
    // Calculate and update active time
    if (activeTimeElement && this.events.length > 0) {
      const timestamps = this.events.map(e => new Date(e.timestamp)).filter(d => !isNaN(d));
      if (timestamps.length > 0) {
        const earliest = Math.min(...timestamps);
        const latest = Math.max(...timestamps);
        const duration = latest - earliest;
        const hours = Math.floor(duration / (1000 * 60 * 60));
        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
        activeTimeElement.textContent = `${hours}h ${minutes}m`;
      }
    }
  }

  updateWorkspaceData() {
    console.log('Updating workspace data...', {
      workspaces: this.workspaces.length,
      events: this.events.length,
      entries: this.entries.length
    });

    this.workspaces.forEach(workspace => {
      // Ensure workspace has a proper name
      if (!workspace.name || workspace.name === 'undefined') {
        workspace.name = workspace.path ? workspace.path.split('/').pop() || 'Unknown' : 'Unknown';
      }
      
      console.log(`Processing workspace: ${workspace.name} (${workspace.path})`);
      
      // Get all events for this workspace using improved matching
      const workspaceEvents = (this.events || []).filter(event => 
        this.eventMatchesWorkspace(event, workspace)
      );

      const workspaceEntries = (this.entries || []).filter(entry => 
        this.eventMatchesWorkspace(entry, workspace)
      );

      console.log(`Workspace ${workspace.name} stats:`, {
        events: workspaceEvents.length,
        entries: workspaceEntries.length
      });

      // Calculate workspace metrics
      workspace.events = workspaceEvents.length;
      workspace.entries = workspaceEntries.length;

      // Get unique files
      const filePaths = new Set();
      workspaceEvents.forEach(event => {
        try {
          const details = JSON.parse(event.details || '{}');
          if (details.file_path) {
            filePaths.add(details.file_path);
          }
        } catch (e) {
          // Skip invalid JSON
        }
      });
      workspace.files = filePaths.size;

      // Calculate sessions
      workspace.sessions = new Set(workspaceEvents.map(e => e.session_id)).size;

      // Calculate AI interactions
      const aiInteractions = workspaceEvents.filter(e => e.type === 'prompt_response').length;
      workspace.aiInteractions = aiInteractions;

      // Calculate additional metrics
      workspace.bytesChanged = this.calculateBytesChanged(workspaceEvents);
      workspace.lastActivity = this.getLastActivity(workspaceEvents);
      workspace.fileTypes = this.getFileTypes(workspaceEvents);
      workspace.complexity = this.calculateWorkspaceComplexity(workspaceEvents);
      workspace.productivity = this.calculateWorkspaceProductivity(workspaceEvents);

      console.log(`Final workspace ${workspace.name} data:`, {
        events: workspace.events,
        files: workspace.files,
        sessions: workspace.sessions,
        aiInteractions: workspace.aiInteractions
      });
    });
    
    this.renderWorkspaceList();
    this.renderWorkspaceComparison();
  }

  // Calculate bytes changed for a workspace
  calculateBytesChanged(events) {
    let totalBytes = 0;
    events.forEach(event => {
      try {
        const details = JSON.parse(event.details || '{}');
        if (details.content && details.before_content) {
          totalBytes += Math.abs(details.content.length - details.before_content.length);
        }
      } catch {
        // Skip invalid events
      }
    });
    return totalBytes;
  }

  // Get last activity timestamp
  getLastActivity(events) {
    if (events.length === 0) return null;
    const sortedEvents = events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return new Date(sortedEvents[0].timestamp);
  }

  // Get file types in workspace
  getFileTypes(events) {
    const fileTypes = {};
    events.forEach(event => {
      try {
        const details = JSON.parse(event.details || '{}');
        if (details.file_path) {
          const ext = details.file_path.split('.').pop() || 'no-extension';
          fileTypes[ext] = (fileTypes[ext] || 0) + 1;
        }
      } catch {
        // Skip invalid events
      }
    });
    return fileTypes;
  }

  // Calculate workspace complexity
  calculateWorkspaceComplexity(events) {
    const complexities = events.map(event => {
      try {
        const details = JSON.parse(event.details || '{}');
        const content = details.content || details.before_content || '';
        return this.calculateComplexity(content);
      } catch {
        return 0;
      }
    }).filter(c => c > 0);

    return {
      avg: complexities.reduce((sum, c) => sum + c, 0) / complexities.length || 0,
      max: Math.max(...complexities, 0),
      total: complexities.length
    };
  }

  // Calculate productivity metrics
  calculateProductivity(events) {
    if (!events || events.length === 0) return 0;
    
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const recentEvents = events.filter(event => 
      new Date(event.timestamp) >= lastWeek
    );
    
    const dailyActivity = {};
    recentEvents.forEach(event => {
      const date = new Date(event.timestamp).toDateString();
      dailyActivity[date] = (dailyActivity[date] || 0) + 1;
    });
    
    // Calculate a simple productivity score (0-10)
    const recentActivity = recentEvents.length;
    const activeDays = Object.keys(dailyActivity).length;
    const avgDailyEvents = recentEvents.length / 7;
    const consistency = activeDays / 7;
    
    // Simple productivity score: recent activity + consistency + daily average
    const productivityScore = Math.min(10, (recentActivity * 0.1) + (consistency * 2) + (avgDailyEvents * 0.5));
    
    return Math.round(productivityScore * 10) / 10; // Round to 1 decimal place
  }

  calculateWorkspaceProductivity(events) {
    if (!events || events.length === 0) {
      return {
        score: 0,
        recentActivity: 0,
        activeDays: 0,
        consistency: 0
      };
    }
    
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const recentEvents = events.filter(event => 
      new Date(event.timestamp) >= lastWeek
    );
    
    const dailyActivity = {};
    recentEvents.forEach(event => {
      const date = new Date(event.timestamp).toDateString();
      dailyActivity[date] = (dailyActivity[date] || 0) + 1;
    });
    
    const recentActivity = recentEvents.length;
    const activeDays = Object.keys(dailyActivity).length;
    const consistency = activeDays / 7;
    
    // Calculate productivity score
    const avgDailyEvents = recentEvents.length / 7;
    const productivityScore = Math.min(10, (recentActivity * 0.1) + (consistency * 2) + (avgDailyEvents * 0.5));
    
    return {
      score: Math.round(productivityScore * 10) / 10,
      recentActivity: recentActivity,
      activeDays: activeDays,
      consistency: consistency
    };
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // New method to update system resource metrics
  updateSystemResourceMetrics() {
    if (!this.systemResources || this.systemResources.length === 0) return;
    
    const latest = this.systemResources[this.systemResources.length - 1];
    const memoryUsage = latest.memory ? latest.memory.heapUsed / 1024 / 1024 : 0;
    const cpuUsage = latest.cpu ? (latest.cpu.user + latest.cpu.system) / 1000000 : 0;
    
    // Update system metrics display
    const systemMetricsElement = document.getElementById('systemMetrics');
    if (systemMetricsElement) {
      systemMetricsElement.innerHTML = `
        <div class="metric-card">
          <h4>System Resources</h4>
          <div class="metric-item">
            <span class="metric-label">Memory Usage:</span>
            <span class="metric-value">${memoryUsage.toFixed(1)} MB</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">CPU Usage:</span>
            <span class="metric-value">${cpuUsage.toFixed(1)}%</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Load Average:</span>
            <span class="metric-value">${latest.system?.loadAverage?.[0]?.toFixed(2) || 'N/A'}</span>
          </div>
        </div>
      `;
    }
  }

  // New method to update git metrics
  updateGitMetrics() {
    if (!this.gitData || this.gitData.length === 0) return;
    
    const latest = this.gitData[this.gitData.length - 1];
    const branch = latest.branch || 'unknown';
    const statusCount = latest.status ? latest.status.length : 0;
    const recentCommits = latest.recentCommits ? latest.recentCommits.length : 0;
    
    // Update git metrics display
    const gitMetricsElement = document.getElementById('gitMetrics');
    if (gitMetricsElement) {
      gitMetricsElement.innerHTML = `
        <div class="metric-card">
          <h4>Git Status</h4>
          <div class="metric-item">
            <span class="metric-label">Current Branch:</span>
            <span class="metric-value">${branch}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Modified Files:</span>
            <span class="metric-value">${statusCount}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Recent Commits:</span>
            <span class="metric-value">${recentCommits}</span>
          </div>
        </div>
      `;
    }
  }

  // New method to update raw data metrics
  updateRawDataMetrics() {
    if (!this.rawData) return;
    
    const systemCount = this.rawData.systemResources?.length || 0;
    const gitCount = this.rawData.gitData?.length || 0;
    const cursorCount = this.rawData.cursorDatabase?.length || 0;
    const appleCount = this.rawData.appleScript?.length || 0;
    const logCount = this.rawData.logs?.length || 0;
    
    // Update raw data metrics display
    const rawDataMetricsElement = document.getElementById('rawDataMetrics');
    if (rawDataMetricsElement) {
      rawDataMetricsElement.innerHTML = `
        <div class="metric-card">
          <h4>Data Collection</h4>
          <div class="metric-item">
            <span class="metric-label">System Resources:</span>
            <span class="metric-value">${systemCount} samples</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Git Data:</span>
            <span class="metric-value">${gitCount} snapshots</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Cursor Database:</span>
            <span class="metric-value">${cursorCount} entries</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">AppleScript:</span>
            <span class="metric-value">${appleCount} captures</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Log Files:</span>
            <span class="metric-value">${logCount} files</span>
          </div>
        </div>
      `;
    }
  }

  // Enhanced IDE state monitoring
  #renderIDEStateActivity() {
    if (!this.ideStates || this.ideStates.length === 0) return;
    
    const latestState = this.ideStates;
    const ideStateElement = document.getElementById('ideStateActivityChart');
    
    if (ideStateElement && latestState) {
      const editorState = latestState.editorState || {};
      const workspaceState = latestState.workspaceState || {};
      const debugState = latestState.debugState || {};
      const cursorState = latestState.cursorSpecificState || {};
      
      ideStateElement.innerHTML = `
        <div class="ide-state-container">
          <div class="ide-state-section">
            <h4>Editor State</h4>
            <div class="state-grid">
              <div class="state-item">
                <span class="state-label">Active Tabs:</span>
                <span class="state-value">${editorState.activeTabs?.length || 0}</span>
              </div>
              <div class="state-item">
                <span class="state-label">Current File:</span>
                <span class="state-value">${editorState.currentFile || 'None'}</span>
              </div>
              <div class="state-item">
                <span class="state-label">Cursor Position:</span>
                <span class="state-value">${editorState.cursorPosition || 'Unknown'}</span>
              </div>
              <div class="state-item">
                <span class="state-label">Selection:</span>
                <span class="state-value">${editorState.selection || 'None'}</span>
              </div>
            </div>
          </div>
          
          <div class="ide-state-section">
            <h4>Workspace State</h4>
            <div class="state-grid">
              <div class="state-item">
                <span class="state-label">Root Path:</span>
                <span class="state-value">${workspaceState.rootPath || 'Unknown'}</span>
              </div>
              <div class="state-item">
                <span class="state-label">Open Files:</span>
                <span class="state-value">${workspaceState.openFiles?.length || 0}</span>
              </div>
              <div class="state-item">
                <span class="state-label">Active Panel:</span>
                <span class="state-value">${workspaceState.activePanel || 'None'}</span>
              </div>
              <div class="state-item">
                <span class="state-label">Sidebar State:</span>
                <span class="state-value">${workspaceState.sidebarState || 'Unknown'}</span>
              </div>
            </div>
          </div>
          
          <div class="ide-state-section">
            <h4>Debug State</h4>
            <div class="state-grid">
              <div class="state-item">
                <span class="state-label">Debug Active:</span>
                <span class="state-value">${debugState.isActive ? 'Yes' : 'No'}</span>
              </div>
              <div class="state-item">
                <span class="state-label">Breakpoints:</span>
                <span class="state-value">${debugState.breakpoints?.length || 0}</span>
              </div>
              <div class="state-item">
                <span class="state-label">Current Thread:</span>
                <span class="state-value">${debugState.currentThread || 'None'}</span>
              </div>
              <div class="state-item">
                <span class="state-label">Variables:</span>
                <span class="state-value">${debugState.variables?.length || 0}</span>
              </div>
            </div>
          </div>
          
          <div class="ide-state-section">
            <h4>Cursor Specific</h4>
            <div class="state-grid">
              <div class="state-item">
                <span class="state-label">AI Model:</span>
                <span class="state-value">${cursorState.currentModel || 'Unknown'}</span>
              </div>
              <div class="state-item">
                <span class="state-label">Mode:</span>
                <span class="state-value">${cursorState.mode || 'Unknown'}</span>
              </div>
              <div class="state-item">
                <span class="state-label">Context Length:</span>
                <span class="state-value">${cursorState.contextLength || 'Unknown'}</span>
              </div>
              <div class="state-item">
                <span class="state-label">Temperature:</span>
                <span class="state-value">${cursorState.temperature || 'Unknown'}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  }

  // Enhanced semantic analysis methods
  async generateFileGraph() {
    try {
      const fileGraphElement = document.getElementById('fileGraph');
      if (!fileGraphElement) return;

      // Get file change events for analysis
      const fileEvents = this.events.filter(e => e.type === 'code_change' || e.type === 'file_change');
      const filePaths = [...new Set(fileEvents.map(e => {
        try {
          const details = JSON.parse(e.details || '{}');
          return details.file_path;
        } catch {
          return null;
        }
      }).filter(Boolean))];

      if (filePaths.length === 0) {
        fileGraphElement.innerHTML = '<div class="graph-placeholder">No file changes detected yet</div>';
        return;
      }

      // Create file relationship analysis
      const fileAnalysis = this.analyzeFileRelationships(filePaths, fileEvents);
      
      // Generate visualization
      this.renderFileGraph(fileAnalysis, fileGraphElement);
      
    } catch (error) {
      console.error('Error generating file graph:', error);
    }
  }

  analyzeFileRelationships(filePaths, fileEvents) {
    const relationships = new Map();
    const fileStats = new Map();

    // Analyze each file
    filePaths.forEach(filePath => {
      const fileEvents = this.events.filter(e => {
        try {
          const details = JSON.parse(e.details || '{}');
          return details.file_path === filePath;
        } catch {
          return false;
        }
      });

      const stats = {
        changeCount: fileEvents.length,
        lastModified: Math.max(...fileEvents.map(e => new Date(e.timestamp).getTime())),
        fileType: this.getFileType(filePath),
        size: this.estimateFileSize(fileEvents),
        complexity: this.calculateComplexity(fileEvents)
      };

      fileStats.set(filePath, stats);
    });

    // Find relationships between files
    filePaths.forEach(filePath => {
      const relatedFiles = this.findRelatedFiles(filePath, filePaths, fileEvents);
      relationships.set(filePath, {
        stats: fileStats.get(filePath),
        relatedFiles: relatedFiles,
        centrality: this.calculateCentrality(filePath, fileEvents)
      });
    });

    return {
      files: fileStats,
      relationships: relationships,
      clusters: this.identifyClusters(relationships)
    };
  }

  getFileType(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const typeMap = {
      'js': 'JavaScript',
      'ts': 'TypeScript',
      'py': 'Python',
      'html': 'HTML',
      'css': 'CSS',
      'json': 'JSON',
      'md': 'Markdown',
      'txt': 'Text'
    };
    return typeMap[ext] || 'Other';
  }

  estimateFileSize(fileEvents) {
    return fileEvents.reduce((total, event) => {
      try {
        const details = JSON.parse(event.details || '{}');
        return total + (details.diff_size || 0);
      } catch {
        return total;
      }
    }, 0);
  }

  calculateComplexity(fileEvents) {
    // Simple complexity metric based on change frequency and size
    const avgChangeSize = this.estimateFileSize(fileEvents) / fileEvents.length;
    const changeFrequency = fileEvents.length;
    return Math.log(avgChangeSize * changeFrequency + 1);
  }

  findRelatedFiles(filePath, allPaths, fileEvents) {
    // Find files that are often modified together
    const timeWindows = this.createTimeWindows(fileEvents);
    const relatedFiles = new Map();

    allPaths.forEach(otherPath => {
      if (otherPath === filePath) return;
      
      let coOccurrence = 0;
      timeWindows.forEach(window => {
        const hasFile = window.some(event => {
          try {
            const details = JSON.parse(event.details || '{}');
            return details.file_path === filePath;
          } catch {
            return false;
          }
        });
        const hasOther = window.some(event => {
          try {
            const details = JSON.parse(event.details || '{}');
            return details.file_path === otherPath;
          } catch {
            return false;
          }
        });
        
        if (hasFile && hasOther) coOccurrence++;
      });

      if (coOccurrence > 0) {
        relatedFiles.set(otherPath, coOccurrence);
      }
    });

    return Array.from(relatedFiles.entries())
      .sort((a, b) => b[1] - a[1])
      ; // Top 5 related files
  }

  createTimeWindows(fileEvents, windowSize = 300000) { // 5 minutes
    const windows = [];
    const sortedEvents = fileEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    for (let i = 0; i < sortedEvents.length; i++) {
      const windowStart = new Date(sortedEvents[i].timestamp).getTime();
      const window = sortedEvents.filter(event => {
        const eventTime = new Date(event.timestamp).getTime();
        return eventTime >= windowStart && eventTime <= windowStart + windowSize;
      });
      if (window.length > 0) windows.push(window);
    }
    
    return windows;
  }

  calculateCentrality(filePath, fileEvents) {
    // Simple centrality based on how often this file is modified
    const fileEventCount = fileEvents.filter(e => {
      try {
        const details = JSON.parse(e.details || '{}');
        return details.file_path === filePath;
      } catch {
        return false;
      }
    }).length;
    
    return fileEventCount / fileEvents.length;
  }

  identifyClusters(relationships) {
    // Simple clustering based on file types and relationships
    const clusters = new Map();
    const visited = new Set();

    relationships.forEach((data, filePath) => {
      if (visited.has(filePath)) return;
      
      const cluster = [filePath];
      visited.add(filePath);
      
      // Find related files in the same cluster
      data.relatedFiles.forEach(([relatedPath, strength]) => {
        if (strength > 1 && !visited.has(relatedPath)) {
          cluster.push(relatedPath);
          visited.add(relatedPath);
        }
      });
      
      if (cluster.length > 1) {
        clusters.set(`cluster_${clusters.size}`, cluster);
      }
    });

    return clusters;
  }

  renderFileGraph(analysis, container) {
    const { files, relationships, clusters } = analysis;
    
    container.innerHTML = `
      <div class="file-graph-container">
        <div class="graph-stats">
          <h4>File Analysis Summary</h4>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-label">Total Files:</span>
              <span class="stat-value">${files.size}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">File Clusters:</span>
              <span class="stat-value">${clusters.size}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Most Active:</span>
              <span class="stat-value">${this.getMostActiveFile(files)}</span>
            </div>
          </div>
        </div>
        
        <div class="file-list">
          <h4>File Activity</h4>
          ${Array.from(files.entries())
            .sort((a, b) => b[1].changeCount - a[1].changeCount)
            .slice(0, 10)
            .map(([path, stats]) => `
              <div class="file-item">
                <div class="file-info">
                  <span class="file-name">${path.split('/').pop()}</span>
                  <span class="file-type">${stats.fileType}</span>
                </div>
                <div class="file-stats">
                  <span class="change-count">${stats.changeCount} changes</span>
                  <span class="complexity">Complexity: ${stats.complexity.toFixed(2)}</span>
                </div>
              </div>
            `).join('')}
        </div>
        
        <div class="clusters-list">
          <h4>File Clusters</h4>
          ${Array.from(clusters.entries())
            .map(([clusterName, files]) => `
              <div class="cluster-item">
                <h5>${clusterName.replace('_', ' ').toUpperCase()}</h5>
                <div class="cluster-files">
                  ${files.map(file => `<span class="cluster-file">${file.split('/').pop()}</span>`).join(', ')}
                </div>
              </div>
            `).join('')}
        </div>
      </div>
    `;
  }

  getMostActiveFile(files) {
    const mostActive = Array.from(files.entries())
      .sort((a, b) => b[1].changeCount - a[1].changeCount)[0];
    return mostActive ? mostActive[0].split('/').pop() : 'None';
  }

  // System resource monitoring with real-time charts
  updateSystemResourceMetrics() {
    if (!this.systemResources || this.systemResources.length === 0) return;
    
    const latest = this.systemResources[this.systemResources.length - 1];
    const memoryUsage = latest.memory ? latest.memory.heapUsed / 1024 / 1024 : 0;
    const cpuUsage = latest.cpu ? (latest.cpu.user + latest.cpu.system) / 1000000 : 0;
    
    // Update system metrics display
    const systemMetricsElement = document.getElementById('systemMetrics');
    if (systemMetricsElement) {
      systemMetricsElement.innerHTML = `
        <div class="metric-card">
          <h4>System Resources</h4>
          <div class="metric-item">
            <span class="metric-label">Memory Usage:</span>
            <span class="metric-value">${memoryUsage.toFixed(1)} MB</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">CPU Usage:</span>
            <span class="metric-value">${cpuUsage.toFixed(1)}%</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Load Average:</span>
            <span class="metric-value">${latest.system?.loadAverage?.[0]?.toFixed(2) || 'N/A'}</span>
          </div>
        </div>
        <div class="resource-chart">
          <h5>Resource Trends</h5>
          <div class="chart-placeholder">
            <canvas id="resourceChart" width="400" height="200"></canvas>
          </div>
        </div>
      `;
      
      // Draw resource chart
      this.drawResourceChart();
    }
  }

  drawResourceChart() {
    const canvas = document.getElementById('resourceChart');
    if (!canvas || !this.systemResources) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Get recent data (last 20 points)
    const recentData = this.systemResources.slice(-20);
    if (recentData.length < 2) return;
    
    // Prepare data
    const memoryData = recentData.map(d => d.memory ? d.memory.heapUsed / 1024 / 1024 : 0);
    const cpuData = recentData.map(d => d.cpu ? (d.cpu.user + d.cpu.system) / 1000000 : 0);
    
    // Find min/max for scaling
    const memMin = Math.min(...memoryData);
    const memMax = Math.max(...memoryData);
    const cpuMin = Math.min(...cpuData);
    const cpuMax = Math.max(...cpuData);
    
    // Draw axes with tick marks
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 20);
    ctx.lineTo(40, height - 20);
    ctx.lineTo(width - 20, height - 20);
    ctx.stroke();
    
    // Add Y-axis tick marks and labels
    ctx.fillStyle = '#666';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const y = 20 + (i / yTicks) * (height - 40);
      const value = memMax - (i / yTicks) * (memMax - memMin);
      ctx.fillText(value.toFixed(1), 35, y + 3);
      
      // Draw tick mark
      ctx.beginPath();
      ctx.moveTo(38, y);
      ctx.lineTo(42, y);
      ctx.stroke();
    }
    
    // Add X-axis tick marks
    ctx.textAlign = 'center';
    const xTicks = Math.min(5, recentData.length);
    for (let i = 0; i < xTicks; i++) {
      const x = 40 + (i / (xTicks - 1)) * (width - 60);
      const timeIndex = Math.floor((i / (xTicks - 1)) * (recentData.length - 1));
      const time = new Date(recentData[timeIndex].timestamp);
      ctx.fillText(time.toLocaleTimeString().slice(0, 5), x, height - 5);
      
      // Draw tick mark
      ctx.beginPath();
      ctx.moveTo(x, height - 22);
      ctx.lineTo(x, height - 18);
      ctx.stroke();
    }
    
    // Draw memory line
    ctx.strokeStyle = '#007acc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    memoryData.forEach((value, index) => {
      const x = 40 + (index / (memoryData.length - 1)) * (width - 60);
      const y = height - 20 - ((value - memMin) / (memMax - memMin)) * (height - 40);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    
    // Draw CPU line
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    cpuData.forEach((value, index) => {
      const x = 40 + (index / (cpuData.length - 1)) * (width - 60);
      const y = height - 20 - ((value - cpuMin) / (cpuMax - cpuMin)) * (height - 40);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    
    // Add axis labels
    ctx.fillStyle = '#333';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Resource Usage Over Time', width / 2, 15);
    
    // Add Y-axis label
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Usage (%)', 0, 0);
    ctx.restore();
    
    // Add X-axis label
    ctx.textAlign = 'center';
    ctx.fillText('Time', width / 2, height - 5);
    
    // Add legend with better positioning
    const legendX = width - 120;
    const legendY = 20;
    
    // Memory legend
    ctx.fillStyle = '#007acc';
    ctx.fillRect(legendX, legendY, 12, 12);
    ctx.fillStyle = '#333';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Memory (MB)', legendX + 18, legendY + 8);
    
    // CPU legend
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(legendX, legendY + 20, 12, 12);
    ctx.fillStyle = '#333';
    ctx.fillText('CPU (%)', legendX + 18, legendY + 28);
  }

  // Update analytics with all data - now includes multi-workspace aggregation
  updateAnalytics() {
    this.updateCodePatterns();
    this.updateFileActivity();
    this.updateWorkspaceMetrics();
    // Removed: this.updateMultiWorkspaceAnalytics();
    // Removed: this.updateGlobalMetrics();
  }

  // Multi-workspace analytics aggregation
  updateMultiWorkspaceAnalytics() {
    this.renderWorkspaceComparison();
    this.renderGlobalCodePatterns();
    this.renderCrossWorkspaceMetrics();
  }

  // Global metrics across all workspaces
  updateGlobalMetrics() {
    this.renderGlobalStats();
    this.renderWorkspaceDistribution();
    this.renderProductivityInsights();
  }

  // Code patterns analysis - now aggregates across all workspaces
  updateCodePatterns() {
    const container = document.getElementById('codePatterns');
    if (!container) return;
    
    const patterns = this.analyzeCodePatterns();
    
    container.innerHTML = `
      <div class="chart-container">
        <div>Code Patterns Analysis (All Workspaces)</div>
        <div>Most common patterns: ${patterns.slice(0, 5).join(', ')}</div>
        <div class="pattern-details">
          ${patterns.slice(0, 10).map((pattern, index) => `
            <div class="pattern-item">
              <span class="pattern-rank">${index + 1}.</span>
              <span class="pattern-name">${pattern}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // File activity analysis
  updateFileActivity() {
    const container = document.getElementById('fileActivity');
    if (!container) return;
    
    const fileEvents = this.events.filter(e => e.type === 'code_change' || e.type === 'file_change');
    const fileStats = {};
    
    fileEvents.forEach(event => {
      try {
        const details = JSON.parse(event.details || '{}');
        const filePath = details.file_path;
        if (filePath) {
          const fileName = filePath.split('/').pop();
          fileStats[fileName] = (fileStats[fileName] || 0) + 1;
        }
      } catch {
        // Skip invalid events
      }
    });
    
    const topFiles = Object.entries(fileStats)
      .sort(([,a], [,b]) => b - a)
      ;
    
    container.innerHTML = `
      <div class="chart-container">
        <div>File Activity</div>
        <div class="file-stats">
          ${topFiles.map(([file, count]) => `
            <div class="file-item">
              <span class="file-name">${file}</span>
              <span class="file-count">${count} changes</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Workspace metrics
  updateWorkspaceMetrics() {
    const container = document.getElementById('workspaceMetrics');
    if (!container) return;
    
    const totalFiles = new Set();
    const fileTypes = {};
    const totalChanges = this.events.filter(e => e.type === 'code_change' || e.type === 'file_change').length;
    
    this.events.forEach(event => {
      try {
        const details = JSON.parse(event.details || '{}');
        const filePath = details.file_path;
        if (filePath) {
          totalFiles.add(filePath);
          const ext = filePath.split('.').pop() || 'no-extension';
          fileTypes[ext] = (fileTypes[ext] || 0) + 1;
        }
      } catch {
        // Skip invalid events
      }
    });
    
    const topTypes = Object.entries(fileTypes)
      .sort(([,a], [,b]) => b - a)
      ;
    
    container.innerHTML = `
      <div class="chart-container">
        <div>Workspace Metrics</div>
        <div class="metric-item">
          <span class="metric-label">Total Files:</span>
          <span class="metric-value">${totalFiles.size}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Total Changes:</span>
          <span class="metric-value">${totalChanges}</span>
        </div>
        <div class="file-types">
          <div class="types-header">File Types:</div>
          ${topTypes.map(([type, count]) => `
            <div class="type-item">
              <span class="type-name">${type}</span>
              <span class="type-count">${count}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Enhanced prompt analysis and correlation
  analyzePrompts() {
    const promptEvents = this.events.filter(e => e.type === 'prompt_response');
    const codeChangeEvents = this.events.filter(e => e.type === 'code_change' || e.type === 'file_change');
    
    if (promptEvents.length === 0) return;
    
    const promptAnalysis = {
      totalPrompts: promptEvents.length,
      avgComplexity: this.calculatePromptComplexity(promptEvents),
      responseQuality: this.calculateResponseQuality(promptEvents),
      categories: this.categorizePrompts(promptEvents),
      correlations: this.findPromptCodeCorrelations(promptEvents, codeChangeEvents),
      trends: this.analyzePromptTrends(promptEvents)
    };
    
    this.renderPromptAnalysis(promptAnalysis);
  }

  calculatePromptComplexity(promptEvents) {
    const complexities = promptEvents.map(event => {
      try {
        const details = JSON.parse(event.details || '{}');
        const prompt = details.prompt || '';
        const response = details.response || '';
        
        // Simple complexity metrics
        const promptLength = prompt.length;
        const responseLength = response.length;
        const wordCount = prompt.split(/\s+/).length;
        const hasCode = /```|function|class|import|export/.test(prompt);
        const hasQuestions = /\?/.test(prompt);
        
        return {
          length: promptLength,
          wordCount: wordCount,
          responseRatio: responseLength / Math.max(promptLength, 1),
          hasCode: hasCode,
          hasQuestions: hasQuestions,
          complexity: Math.log(promptLength * wordCount + 1) + (hasCode ? 2 : 0) + (hasQuestions ? 1 : 0)
        };
      } catch {
        return { complexity: 0 };
      }
    });
    
    const avgComplexity = complexities.reduce((sum, c) => sum + c.complexity, 0) / complexities.length;
    return avgComplexity;
  }

  calculateResponseQuality(promptEvents) {
    const qualities = promptEvents.map(event => {
      try {
        const details = JSON.parse(event.details || '{}');
        const prompt = details.prompt || '';
        const response = details.response || '';
        
        // Quality metrics
        const responseLength = response.length;
        const promptLength = prompt.length;
        const responseRatio = responseLength / Math.max(promptLength, 1);
        const hasCode = /```|function|class|import|export/.test(response);
        const hasExplanation = response.length > prompt.length * 0.5;
        
        return {
          responseRatio: responseRatio,
          hasCode: hasCode,
          hasExplanation: hasExplanation,
          quality: (responseRatio > 0.5 ? 1 : 0) + (hasCode ? 1 : 0) + (hasExplanation ? 1 : 0)
        };
      } catch {
        return { quality: 0 };
      }
    });
    
    const avgQuality = qualities.reduce((sum, q) => sum + q.quality, 0) / qualities.length;
    return Math.min(avgQuality / 3, 1); // Normalize to 0-1
  }

  categorizePrompts(promptEvents) {
    const categories = {
      'Code Generation': 0,
      'Code Review': 0,
      'Debugging': 0,
      'Documentation': 0,
      'Refactoring': 0,
      'Testing': 0,
      'General': 0
    };
    
    promptEvents.forEach(event => {
      try {
        const details = JSON.parse(event.details || '{}');
        const prompt = (details.prompt || '').toLowerCase();
        
        if (prompt.includes('generate') || prompt.includes('create') || prompt.includes('write')) {
          categories['Code Generation']++;
        } else if (prompt.includes('review') || prompt.includes('check') || prompt.includes('analyze')) {
          categories['Code Review']++;
        } else if (prompt.includes('debug') || prompt.includes('error') || prompt.includes('fix')) {
          categories['Debugging']++;
        } else if (prompt.includes('document') || prompt.includes('comment') || prompt.includes('explain')) {
          categories['Documentation']++;
        } else if (prompt.includes('refactor') || prompt.includes('improve') || prompt.includes('optimize')) {
          categories['Refactoring']++;
        } else if (prompt.includes('test') || prompt.includes('unit') || prompt.includes('spec')) {
          categories['Testing']++;
        } else {
          categories['General']++;
        }
      } catch {
        categories['General']++;
      }
    });
    
    return categories;
  }

  findPromptCodeCorrelations(promptEvents, codeChangeEvents) {
    const correlations = [];
    const timeWindow = 300000; // 5 minutes
    
    promptEvents.forEach(promptEvent => {
      const promptTime = new Date(promptEvent.timestamp).getTime();
      
      // Find code changes within time window
      const relatedChanges = codeChangeEvents.filter(changeEvent => {
        const changeTime = new Date(changeEvent.timestamp).getTime();
        return Math.abs(changeTime - promptTime) <= timeWindow;
      });
      
      if (relatedChanges.length > 0) {
        correlations.push({
          promptId: promptEvent.id,
          promptTime: promptTime,
          relatedChanges: relatedChanges.length,
          files: [...new Set(relatedChanges.map(c => {
            try {
              const details = JSON.parse(c.details || '{}');
              return details.file_path;
            } catch {
              return null;
            }
          }).filter(Boolean))]
        });
      }
    });
    
    return correlations;
  }

  analyzePromptTrends(promptEvents) {
    const hourlyStats = {};
    
    promptEvents.forEach(event => {
      const hour = new Date(event.timestamp).getHours();
      if (!hourlyStats[hour]) {
        hourlyStats[hour] = { count: 0, complexity: 0 };
      }
      hourlyStats[hour].count++;
      
      try {
        const details = JSON.parse(event.details || '{}');
        const prompt = details.prompt || '';
        const complexity = Math.log(prompt.length + 1);
        hourlyStats[hour].complexity += complexity;
      } catch {
        // Skip invalid events
      }
    });
    
    // Calculate average complexity per hour
    Object.keys(hourlyStats).forEach(hour => {
      hourlyStats[hour].avgComplexity = hourlyStats[hour].complexity / hourlyStats[hour].count;
    });
    
    return hourlyStats;
  }

  renderPromptAnalysis(analysis) {
    const promptStatsElement = document.getElementById('promptStats');
    const promptCategoriesElement = document.getElementById('promptCategories');
    const promptTimelineElement = document.getElementById('promptTimeline');
    
    if (promptStatsElement) {
      promptStatsElement.innerHTML = `
        <div class="stat-item">
          <span class="stat-value">${analysis.totalPrompts}</span>
          <span class="stat-label">Total Prompts</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${analysis.avgComplexity.toFixed(2)}</span>
          <span class="stat-label">Avg Complexity</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${(analysis.responseQuality * 100).toFixed(0)}%</span>
          <span class="stat-label">Response Quality</span>
        </div>
      `;
    }
    
    if (promptCategoriesElement) {
      promptCategoriesElement.innerHTML = Object.entries(analysis.categories || {})
        .sort((a, b) => b[1] - a[1])
        .map(([category, count]) => `
          <div class="category-item">
            <span class="category-name">${category}</span>
            <span class="category-count">${count}</span>
          </div>
        `).join('');
    }
    
    if (promptTimelineElement) {
      const recentPrompts = this.events
        .filter(e => e.type === 'prompt_response')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        ;
      
      promptTimelineElement.innerHTML = recentPrompts.map(event => {
        const time = new Date(event.timestamp).toLocaleTimeString();
        try {
          const details = JSON.parse(event.details || '{}');
          const prompt = details.prompt || 'No prompt';
          const preview = prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt;
          return `
            <div class="timeline-item">
              <span class="timeline-time">${time}</span>
              <span class="timeline-content">${preview}</span>
            </div>
          `;
        } catch {
          return `
            <div class="timeline-item">
              <span class="timeline-time">${time}</span>
              <span class="timeline-content">Invalid prompt data</span>
            </div>
          `;
        }
      }).join('');
    }
  }

  updateConnectionStatus(connected) {
    this.isConnected = connected;
    const indicator = document.getElementById('connectionStatus');
    const text = document.getElementById('connectionText');
    
    console.log('Updating connection status:', connected);
    
    if (connected === true) {
      if (indicator) indicator.className = 'status-indicator connected';
      if (text) text.textContent = 'Connected';
    } else if (connected === false) {
      if (indicator) indicator.className = 'status-indicator';
      if (text) text.textContent = 'Disconnected';
    } else {
      // Handle undefined/null case
      if (indicator) indicator.className = 'status-indicator';
      if (text) text.textContent = 'Connecting...';
    }
  }

  // Data validation and normalization
  validateAndNormalizeData(data) {
    if (!data || typeof data !== 'object') {
      console.warn('Invalid data received:', data);
      return [];
    }

    if (Array.isArray(data)) {
      return data.filter(item => this.isValidEvent(item));
    }

    // Handle single event
    if (this.isValidEvent(data)) {
      return [data];
    }

    return [];
  }

  isValidEvent(event) {
    if (!event || typeof event !== 'object') {
      return false;
    }

    // Must have some identifying information
    if (!event.id && !event.timestamp && !event.time) {
      return false;
    }

    // Must have some meaningful content
    if (!event.file_path && !event.filePath && !event.prompt && !event.title && 
        !event.description && !event.text && !event.before_code && !event.after_code && 
        !event.notes && !event.details && !event.type) {
      return false;
    }

    return true;
  }

  // Old renderActivityFeed function removed - using multi-workspace version below


  getFilteredEvents() {
    // STEP 1: Apply workspace filtering first
    const activeWorkspace = this.getActiveWorkspace();
    let workspaceFilteredData = this.events || [];
    
    if (activeWorkspace) {
      workspaceFilteredData = (this.events || []).filter(event => 
        this.eventMatchesWorkspace(event, activeWorkspace)
      );
    }
    
    // STEP 2: Use workspace-filtered events and remove duplicates
    const allData = [...workspaceFilteredData];
    
    // Remove duplicates based on id and timestamp
    const uniqueData = allData.filter((event, index, self) => {
      return index === self.findIndex(e => 
        (e.id && e.id === event.id) || 
        (e.timestamp && e.timestamp === event.timestamp && e.file_path === event.file_path)
      );
    });
    
    // Filter out invalid/empty events - more lenient filtering
    const validData = uniqueData.filter(event => {
      // Must have some identifying information
      if (!event.id && !event.timestamp && !event.time) {
        return false;
      }
      
      // Must have some meaningful content (more lenient)
      if (!event.file_path && !event.filePath && !event.prompt && !event.title && !event.description && !event.text && !event.before_code && !event.after_code && !event.notes && !event.details) {
        return false;
      }
      
      return true;
    });
    
    console.log('Filtering data:', {
      totalEvents: this.events?.length || 0,
      workspaceFiltered: workspaceFilteredData.length,
      valid: validData.length,
      currentFilter: this.currentFilter,
      activeWorkspace: activeWorkspace?.name || 'All'
    });

    // STEP 3: Apply type filter (All, File Changes, Sessions, Recent)
    let filteredData;
    switch (this.currentFilter) {
      case 'file_change':
        filteredData = validData.filter(e => e.type === 'code_change' || e.type === 'file_change');
        break;
      case 'session':
        filteredData = validData.filter(e => e.session_id);
        break;
      case 'recent':
        filteredData = validData.slice(-20);
        break;
      default:
        filteredData = validData;
    }
    
    // Limit to prevent UI overload
    return filteredData.slice(0, 100);
  }

  renderEventCard(event) {
    const timestamp = new Date(event.timestamp || event.time || Date.now()).toLocaleString();
    let filePath = event.file || event.filePath || event.file_path || '';
    
    // Try to extract file path from details if not directly available
    if (!filePath) {
      try {
        const details = JSON.parse(event.details || '{}');
        filePath = details.file_path || details.file || details.filePath || '';
      } catch (e) {
        // Use fallback
      }
    }
    
    let eventType = event.type || 'file_change';
    let eventTitle = '';
    let eventDescription = '';
    let eventIcon = '';
    let metadata = '';
    
    // Parse the event data properly
    if (event.source === 'filewatcher') {
      eventType = 'file_change';
      eventTitle = `File ${event.action || 'modified'}: ${filePath.split('/').pop()}`;
      eventDescription = `File ${event.action || 'modified'} in ${filePath}`;
      eventIcon = 'F';
      metadata = `Size: ${event.size || 'Unknown'} | ${event.action || 'modified'}`;
    } else if (event.type === 'code_change') {
      eventType = 'code_change';
      eventTitle = `Code Change: ${filePath.split('/').pop()}`;
      eventDescription = `Code modified in ${filePath}`;
      eventIcon = 'E';
      metadata = `Lines: ${event.lines_changed || 'Unknown'}`;
    } else if (event.type === 'prompt_response') {
      eventType = 'prompt_response';
      eventTitle = 'AI Response';
      eventDescription = event.prompt || 'AI interaction';
      eventIcon = 'A';
      metadata = `Model: ${event.model || 'Unknown'}`;
    } else if (event.type === 'session_event') {
      eventType = 'session_event';
      eventTitle = 'Session Activity';
      eventDescription = event.description || 'Session event';
      eventIcon = 'T';
      metadata = `Session: ${event.session_id || 'Unknown'}`;
    } else {
      // Better handling for unknown types - try to infer from context
      if (filePath && (filePath.includes('.js') || filePath.includes('.ts') || filePath.includes('.py'))) {
        eventType = 'code_change';
        eventTitle = `Code Change: ${filePath.split('/').pop()}`;
        eventDescription = `Code modified in ${filePath}`;
        eventIcon = 'E';
        metadata = `File: ${filePath.split('/').pop()}`;
      } else if (event.source === 'filewatcher' || event.action) {
        eventType = 'file_change';
        eventTitle = `File ${event.action || 'modified'}: ${filePath.split('/').pop()}`;
        eventDescription = `File ${event.action || 'modified'} in ${filePath}`;
        eventIcon = 'F';
        metadata = `Action: ${event.action || 'modified'}`;
      } else {
        // Final fallback
        eventType = 'file_change';
        eventTitle = `File Change: ${filePath.split('/').pop() || 'Unknown'}`;
        eventDescription = `File activity detected`;
      eventIcon = 'U';
        metadata = `Activity detected`;
      }
    }
    
    // Format file path for display
    const displayPath = filePath ? filePath.split('/').slice(-2).join('/') : 'Unknown file';
    
    // Create a more informative description
    let contentPreview = '';
    if (event.content && event.content.length > 0) {
      contentPreview = event.content.substring(0, 100) + (event.content.length > 100 ? '...' : '');
    } else if (event.description) {
      contentPreview = event.description.substring(0, 100) + (event.description.length > 100 ? '...' : '');
    }

    return `
      <div class="feed-item" onclick="activityDashboard.showEventDetails('${event.id}')">
        <div class="header">
          <div class="title">
            <span class="event-icon">${eventIcon}</span>
            ${eventTitle}
          </div>
          <div class="timestamp">${timestamp}</div>
        </div>
        <div class="meta-row">
          <span class="source">${eventType}</span>
          <span class="file-path">${displayPath}</span>
          <span class="metadata">${metadata}</span>
        </div>
        <div class="content">
          <div class="description">${eventDescription}</div>
          ${contentPreview ? `<div class="content-preview">${contentPreview}</div>` : ''}
          <div class="session-info">Session: ${event.session_id || 'Unknown'}</div>
        </div>
      </div>
    `;
  }

  getEventTitle(event) {
    let filePath = event.file || event.filePath || event.file_path || '';
    let promptText = '';
    let sessionInfo = '';
    
    // Try to extract file path from details if not directly available
    if (!filePath) {
    try {
    const details = JSON.parse(event.details || '{}');
        filePath = details.file_path || details.file || details.filePath || '';
      promptText = details.prompt || details.user_prompt || '';
      sessionInfo = details.session_phase || details.development_phase || '';
    } catch (e) {
      // Use fallback
      }
    }
    
    // Infer event type if not set
    let eventType = event.type;
    if (!eventType) {
      if (filePath) {
        const fileName = filePath.split('/').pop();
        if (fileName && (fileName.includes('.js') || fileName.includes('.ts') || fileName.includes('.py'))) {
          eventType = 'code_change';
        } else {
          eventType = 'file_change';
        }
      } else if (promptText) {
        eventType = 'prompt_response';
      } else if (event.session_id) {
        eventType = 'session_event';
      } else {
        eventType = 'file_change'; // Default fallback
      }
    }
    
    // If still no file path, try to infer from event data
    if (!filePath) {
      if (event.file) filePath = event.file;
      else if (event.filePath) filePath = event.filePath;
      else if (event.file_path) filePath = event.file_path;
    }
    
    // eventType is already determined above
    
    switch (eventType) {
      case 'code_change':
        return `Code Change: ${filePath}`;
      case 'file_change':
        return `File Modified: ${filePath}`;
      case 'prompt_response':
        return `AI Interaction: ${promptText.substring(0, 50)}${promptText.length > 50 ? '...' : ''}`;
      case 'session_event':
        return `Session: ${sessionInfo || 'Development Activity'}`;
      case 'clipboard':
        return `Clipboard: ${promptText.substring(0, 30)}${promptText.length > 30 ? '...' : ''}`;
      case 'idle':
        return `Idle Time: ${filePath}`;
      default:
        // Try to infer a better title from context
        if (filePath && filePath !== 'Unknown file') {
          return `File Change: ${filePath.split('/').pop()}`;
        } else if (event.file || event.filePath || event.file_path) {
          const fileName = (event.file || event.filePath || event.file_path).split('/').pop();
          return `File Change: ${fileName}`;
        } else {
          return 'File Activity';
        }
    }
  }

  renderEventContent(event) {
    try {
      const details = JSON.parse(event.details || '{}');
      
      if (event.type === 'prompt_response') {
        const prompt = details.prompt || details.user_prompt || '';
        const response = details.response || '';
        const filePath = details.file_path || '';
        const sessionPhase = details.session_phase || '';
        const developmentPhase = details.development_phase || '';
        const model = details.model || details.ai_model || '';
        const confidence = details.confidence || details.confidence_score || '';
        
        return `
          <div class="content">
            <div class="prompt-response-details">
              ${sessionPhase || developmentPhase ? `
                <div class="session-info">
                  ${sessionPhase ? `<span class="session-phase">${sessionPhase}</span>` : ''}
                  ${developmentPhase ? `<span class="dev-phase">${developmentPhase}</span>` : ''}
                </div>
              ` : ''}
              
              ${prompt ? `
                <div class="prompt-section">
                  <div class="prompt-header">
                    <strong>Prompt:</strong>
                    ${model ? `<span class="model-info">Model: ${model}</span>` : ''}
                    ${confidence ? `<span class="confidence">Confidence: ${confidence}</span>` : ''}
                  </div>
                  <div class="prompt-text">${prompt.substring(0, 200)}${prompt.length > 200 ? '...' : ''}</div>
                </div>
              ` : ''}
              
              ${response ? `
                <div class="response-section">
                  <div class="response-header"><strong>Response:</strong></div>
                  <div class="response-text">${response.substring(0, 200)}${response.length > 200 ? '...' : ''}</div>
                </div>
              ` : ''}
              
              ${filePath ? `<div class="file-context">File: ${filePath}</div>` : ''}
            </div>
          </div>
        `;
      } else if (event.type === 'code_change') {
        const diffSummary = details.diff_summary || '';
        const diffSize = details.diff_size || 0;
        const filePath = details.file_path || '';
        
        return `
          <div class="content">
            <div class="code-change-details">
              ${filePath ? `<div class="file-path">${filePath}</div>` : ''}
              ${diffSize ? `<div class="diff-size">${diffSize} bytes changed</div>` : ''}
              ${diffSummary ? `<div class="diff-summary">${diffSummary}</div>` : ''}
            </div>
          </div>
        `;
      } else if (event.type === 'session_event') {
        const sessionPhase = details.session_phase || '';
        const developmentPhase = details.development_phase || '';
        
        return `
          <div class="content">
            <div class="session-details">
              ${sessionPhase ? `<div class="session-phase">Session Phase: ${sessionPhase}</div>` : ''}
              ${developmentPhase ? `<div class="dev-phase">Development Phase: ${developmentPhase}</div>` : ''}
            </div>
          </div>
        `;
      } else if (event.type === 'clipboard') {
        const content = details.content || '';
        return `
          <div class="content">
            <div class="clipboard-content">
              <div class="clipboard-text">${content.substring(0, 100)}${content.length > 100 ? '...' : ''}</div>
            </div>
          </div>
        `;
      } else if (event.type === 'idle') {
        const duration = details.duration || 0;
        return `
          <div class="content">
            <div class="idle-info">
              <div class="idle-duration">Idle for ${Math.round(duration / 60000)} minutes</div>
            </div>
          </div>
        `;
      }
    } catch (e) {
      console.warn('Failed to parse event details:', e);
    }
    
    return '';
  }

  showEventDetails(eventId) {
    console.log('showEventDetails called with eventId:', eventId);
    console.log('Available events:', this.events.length);
    console.log('Event IDs:', this.events.map(e => e.id || e.timestamp || 'no-id'));
    
    // Try to find event by ID first, then by index, then by timestamp
    let event = this.events.find(e => e.id === eventId);
    if (!event) {
      // Try by index if eventId is a number
      const index = parseInt(eventId);
      if (!isNaN(index) && index >= 0 && index < this.events.length) {
        event = this.events[index];
      }
    }
    if (!event) {
      // Try by timestamp
      event = this.events.find(e => e.timestamp === eventId || e.start === eventId);
    }
    
    console.log('Found event:', event);
    
    if (!event) {
      console.error('Event not found with id:', eventId);
      console.log('Available event data:', this.events.slice(0, 3));
      return;
    }

    if (event.type === 'file_change') {
      console.log('Showing diff modal for file_change event');
      this.showDiffModal(event);
    } else {
      console.log('Showing event modal for event type:', event.type);
      // Show the enhanced event modal for other event types
      showEventModal(event);
    }
  }

  showDiffModal(event) {
    const modal = document.getElementById('diffModal');
    const filePath = document.getElementById('diffFilePath');
    const timestamp = document.getElementById('diffTimestamp');
    const beforeCode = document.getElementById('diffBefore');
    const afterCode = document.getElementById('diffAfter');

    filePath.textContent = event.filePath || 'Unknown file';
    timestamp.textContent = new Date(event.timestamp).toLocaleString();
    beforeCode.textContent = 'Previous content not available';
    afterCode.textContent = 'Current content not available';

    modal.style.display = 'block';
  }

  setFilter(filter) {
    this.currentFilter = filter;
    
    // Update filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`[data-filter="${filter}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    // Add visual feedback
    console.log(`Applying filter: ${filter}`);
    
    // Re-render the activity feed with new filter
    this.renderActivityFeed();
    
    // Show brief feedback
    this.showFilterFeedback(filter);
  }

  showFilterFeedback(filter) {
    const filterNames = {
      'all': 'All Events',
      'file_change': 'File Changes',
      'session': 'Sessions',
      'recent': 'Recent Events'
    };
    
    const feedback = document.createElement('div');
    feedback.className = 'filter-feedback';
    feedback.textContent = `Showing: ${filterNames[filter] || filter}`;
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--color-accent);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    
    document.body.appendChild(feedback);
    
    // Fade in
    setTimeout(() => {
      feedback.style.opacity = '1';
    }, 10);
    
    // Fade out and remove
    setTimeout(() => {
      feedback.style.opacity = '0';
      setTimeout(() => {
        if (feedback.parentNode) {
          feedback.parentNode.removeChild(feedback);
        }
      }, 300);
    }, 2000);
  }

  setViewMode(viewMode) {
    console.log(`Setting view mode to: ${viewMode}`);
    this.currentViewMode = viewMode;
    
    // Update view button states
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`[data-view="${viewMode}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }
    
    // Switch between view containers in unified activity view
    const timelineView = document.getElementById('timelineView');
    const listView = document.getElementById('listView');
    const gridView = document.getElementById('gridView');
    
    if (timelineView && listView && gridView) {
      // New unified view structure
      timelineView.classList.remove('active');
      listView.classList.remove('active');
      gridView.classList.remove('active');
      
      if (viewMode === 'timeline' && timelineView) {
        timelineView.classList.add('active');
      } else if (viewMode === 'list' && listView) {
        listView.classList.add('active');
      } else if (viewMode === 'grid' && gridView) {
        gridView.classList.add('active');
      }
    }
    
    this.renderActivityFeed();
    console.log(`Switched to ${viewMode} view`);
  }

  showViewModeFeedback(viewMode) {
    const feedback = document.createElement('div');
    feedback.className = 'view-mode-feedback';
    feedback.textContent = `Switched to ${viewMode} view`;
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--color-accent);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    
    document.body.appendChild(feedback);
    
    // Fade in
    setTimeout(() => {
      feedback.style.opacity = '1';
    }, 10);
    
    // Fade out and remove
    setTimeout(() => {
      feedback.style.opacity = '0';
      setTimeout(() => {
        if (feedback.parentNode) {
          feedback.parentNode.removeChild(feedback);
        }
      }, 300);
    }, 2000);
  }

  setActiveWorkspace(workspaceId) {
    if (workspaceId === 'all') {
      this.clearWorkspaceSelection();
    } else {
      const workspace = this.workspaces.find(w => w.id === workspaceId);
      if (workspace) {
        this.selectWorkspace(workspace);
      }
    }
  }

  async testCompanion() {
    try {
      const response = await fetch(`${this.companionUrl}/health`);
      const data = await response.json();
      alert(`Companion service is running!\n\nStatus: ${data.status}\nUptime: ${Math.round(data.uptime / 60)} minutes`);
                        } catch (error) {
      alert('Failed to connect to companion service. Make sure it is running on port 43917.');
    }
}

  async debugDatabase() {
    try {
      const response = await fetch(`${this.companionUrl}/queue`);
        const data = await response.json();
        
      console.log('Companion Service Data:', data);
      alert(`Debug info logged to console.\n\nEvents: ${data.events?.length || 0}\nCursor: ${data.cursor || 'N/A'}`);
    } catch (error) {
      alert('Failed to fetch debug data: ' + error.message);
    }
  }

  exportJSON() {
    const data = {
      events: this.events,
      sessions: Array.from(this.sessions),
      exported: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cursor-activity-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportMarkdown() {
    const markdown = this.generateMarkdown();
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cursor-activity-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  generateMarkdown() {
    const fileChanges = this.events.filter(e => e.type === 'file_change');
    const sessions = new Set(this.events.map(e => e.sessionId));
    
    return `# Cursor Activity Report

Generated: ${new Date().toLocaleString()}

## Summary
- **Total Events:** ${this.events.length}
- **File Changes:** ${fileChanges.length}
- **Sessions:** ${sessions.size}
- **Total Bytes Changed:** ${this.formatBytes(fileChanges.reduce((sum, e) => sum + (e.added || 0), 0))}

## File Changes
${fileChanges.map(event => `
### ${event.filePath}
- **Time:** ${new Date(event.timestamp).toLocaleString()}
- **Added:** ${event.added || 0} bytes
- **Removed:** ${event.removed || 0} bytes
- **Diff:** ${event.diff || 'N/A'}
`).join('')}
`;
  }

  // Navigation Methods
  switchTab(tabName) {
    this.currentTab = tabName;
    
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
    
    // Load tab-specific data
    this.loadTabData(tabName);
  }

  loadTabData(tabName) {
    console.log('Loading tab data for:', tabName);
    switch (tabName) {
      case 'overview':
        console.log('Rendering activity feed for overview tab');
        this.renderActivityFeed();
        this.renderRecentEvents();
        break;
      case 'analytics':
        this.loadAnalytics();
        this.updateAnalytics();
        this.updateModelAnalytics();
        this.analyzePrompts();
        break;
      case 'semantic':
        this.loadSemanticAnalysis();
        this.loadEmbeddings();
        this.loadTFIDF();
        break;
      case 'performance':
        this.loadPerformanceAnalytics();
        break;
      case 'system':
        this.loadSystemAnalytics();
        break;
      case 'workspaces':
        this.loadWorkspaces();
        this.renderWorkspaceList();
        this.renderWorkspaceComparison();
        this.updateWorkspaceData();
        break;
      case 'timeline':
        this.renderTimeline();
        // Update summary and recent events with all events
        this.updateTimelineSummary(this.events);
        this.renderRecentEventsList(this.events);
        break;
    }
  }

  renderRecentEvents() {
    const container = document.getElementById('recentEventsList');
    if (!container) return;

    // Get recent events (last 10)
    const recentEvents = [...this.events, ...this.entries]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      ;

    if (recentEvents.length === 0) {
      container.innerHTML = '<div class="no-events">No recent events</div>';
      return;
    }

    container.innerHTML = recentEvents.map(event => {
      const time = new Date(event.timestamp).toLocaleTimeString();
      const type = event.type || 'unknown';
      let description = '';

      try {
        const details = JSON.parse(event.details || '{}');
        const filePath = details.file_path || event.file_path || '';
        const fileName = filePath ? filePath.split('/').pop() : '';
        
        switch(type) {
          case 'file_change':
          case 'code_change':
            description = `Changed ${fileName || 'file'}`;
            break;
          case 'prompt_response':
            description = 'AI interaction';
            break;
          case 'session_event':
            description = 'Session event';
            break;
          default:
            description = type.replace(/_/g, ' ');
        }
      } catch (e) {
        description = type.replace(/_/g, ' ');
      }

      return `
        <div class="timeline-event-item">
          <div class="event-time">${time}</div>
          <div class="event-type">${type}</div>
          <div class="event-description">${description}</div>
        </div>
      `;
    }).join('');
  }

  // Analytics Methods
  loadAnalytics() {
    console.log('Loading analytics with', this.events.length, 'events and', this.entries?.length || 0, 'entries');
    
    try {
      // Populate workspace selector
      this.populateAnalyticsWorkspaceSelector();
      
    // Analyze prompts using the new engine
    this.promptData = this.promptAnalytics.analyzePrompts(this.events, this.entries);
    console.log('D Prompt Analytics:', this.promptData);
    
      // Render all analytics sections with error handling
    this.renderTimeSeriesCharts();
    this.renderCodePatterns();
    this.renderFileHeatmap();
    this.renderSessionTimeline();
    this.renderLanguageDistribution();
    this.renderComprehensivePromptAnalytics();
      
      console.log('Analytics loaded successfully');
    } catch (error) {
      console.error('Error loading analytics:', error);
      this.showAnalyticsError(error);
    }
  }

  populateAnalyticsWorkspaceSelector() {
    const selector = document.getElementById('analyticsWorkspaceSelect');
    if (!selector) return;

    // Clear existing options except "All Workspaces"
    selector.innerHTML = '<option value="all">All Workspaces</option>';

    // Add workspace options
    this.workspaces.forEach(workspace => {
      const option = document.createElement('option');
      option.value = workspace.id;
      const workspaceName = this.extractWorkspaceName(workspace.path);
      option.textContent = `${workspaceName} (${workspace.events || 0} events)`;
      selector.appendChild(option);
    });
  }

  setAnalyticsWorkspace(workspaceId) {
    console.log('Setting analytics workspace to:', workspaceId);
    this.analyticsWorkspace = workspaceId;
    this.refreshAnalytics();
  }

  setAnalyticsTimeRange(timeRange) {
    console.log('Setting analytics time range to:', timeRange);
    this.analyticsTimeRange = timeRange;
    this.refreshAnalytics();
  }

  refreshAnalytics() {
    console.log('Refreshing analytics...');
    this.loadAnalytics();
  }

  showAnalyticsError(error) {
    const errorMessage = document.createElement('div');
    errorMessage.className = 'analytics-error';
    errorMessage.innerHTML = `
      <div class="error-content">
        <h3>! Analytics Error</h3>
        <p>Failed to load analytics: ${error.message}</p>
        <button onclick="dashboard.loadAnalytics()" class="retry-btn">Retry</button>
      </div>
    `;
    
    // Add error styling
    errorMessage.style.cssText = `
      background: var(--color-surface);
      border: 1px solid var(--color-error);
      border-radius: var(--border-radius);
      padding: var(--space-lg);
      margin: var(--space-md);
      text-align: center;
    `;
    
    // Insert at the top of analytics content
    const analyticsContent = document.querySelector('#analytics .analytics-grid');
    if (analyticsContent) {
      analyticsContent.insertBefore(errorMessage, analyticsContent.firstChild);
    }
  }

  renderTimeSeriesCharts() {
    // Generate time series data
    const timeSeriesData = this.timeSeriesViz.generateChangesOverTime(
      this.events,
      this.entries,
      this.currentTimeRange
    );

    // Render changes over time chart
    const changesChartContainer = document.getElementById('changesOverTimeChart');
    if (changesChartContainer) {
      // Add time range selector
      changesChartContainer.innerHTML = `
        <div class="chart-header">
          <h4>Changes Over Time</h4>
          <div class="time-range-selector">
            <button class="time-range-btn ${this.currentTimeRange === '24h' ? 'active' : ''}" onclick="dashboard.setTimeRange('24h')">24H</button>
            <button class="time-range-btn ${this.currentTimeRange === '7d' ? 'active' : ''}" onclick="dashboard.setTimeRange('7d')">7D</button>
            <button class="time-range-btn ${this.currentTimeRange === '30d' ? 'active' : ''}" onclick="dashboard.setTimeRange('30d')">30D</button>
            <button class="time-range-btn ${this.currentTimeRange === 'all' ? 'active' : ''}" onclick="dashboard.setTimeRange('all')">ALL</button>
          </div>
        </div>
        <div class="stats-summary">
          <div class="stat-summary-item">
            <span class="stat-summary-value">${timeSeriesData.totals.codeChanges}</span>
            <span class="stat-summary-label">Code Changes</span>
            <span class="stat-summary-trend ${timeSeriesData.trends.codeChanges >= 0 ? 'positive' : 'negative'}">
              ${timeSeriesData.trends.codeChanges >= 0 ? '↑' : '↓'} ${Math.abs(timeSeriesData.trends.codeChanges).toFixed(1)}%
            </span>
          </div>
          <div class="stat-summary-item">
            <span class="stat-summary-value">${timeSeriesData.totals.prompts}</span>
            <span class="stat-summary-label">AI Prompts</span>
            <span class="stat-summary-trend ${timeSeriesData.trends.prompts >= 0 ? 'positive' : 'negative'}">
              ${timeSeriesData.trends.prompts >= 0 ? '↑' : '↓'} ${Math.abs(timeSeriesData.trends.prompts).toFixed(1)}%
            </span>
          </div>
          <div class="stat-summary-item">
            <span class="stat-summary-value">${timeSeriesData.totals.totalEvents}</span>
            <span class="stat-summary-label">Total Events</span>
            <span class="stat-summary-trend ${timeSeriesData.trends.overall >= 0 ? 'positive' : 'negative'}">
              ${timeSeriesData.trends.overall >= 0 ? '↑' : '↓'} ${Math.abs(timeSeriesData.trends.overall).toFixed(1)}%
            </span>
          </div>
        </div>
        <div id="timeSeriesChartSvg"></div>
      `;

      // Render the D3 chart
      setTimeout(() => {
        const chartContainer = document.getElementById('timeSeriesChartSvg');
        if (chartContainer && timeSeriesData && timeSeriesData.data) {
          this.timeSeriesViz.renderChangesOverTime(chartContainer, timeSeriesData.data);
        }
      }, 100);
    }

    // Render activity heatmap
    const heatmapContainer = document.getElementById('activityHeatmap');
    if (heatmapContainer) {
      heatmapContainer.innerHTML = '<h4>Activity Heatmap</h4><div id="heatmapGrid"></div>';
      setTimeout(() => {
        const heatmapGridEl = document.getElementById('heatmapGrid');
        const filteredEvents = this.getFilteredEvents();
        if (heatmapGridEl && filteredEvents && filteredEvents.length > 0) {
          this.timeSeriesViz.renderActivityHeatmap(heatmapGridEl, filteredEvents);
        }
      }, 100);
    }
  }

  setTimeRange(range) {
    this.currentTimeRange = range;
    this.renderTimeSeriesCharts();
  }

  renderComprehensivePromptAnalytics() {
    try {
      if (!this.promptData || this.promptData.totalPrompts === 0) {
        // Show empty state
        const containers = ['promptStats', 'promptCategories', 'promptTimeline'];
        containers.forEach(id => {
          const el = document.getElementById(id);
          if (el) {
            el.innerHTML = `
              <div class="no-data">
                <div class="no-data-icon">🤖</div>
                <div class="no-data-text">No AI interactions detected</div>
                <div class="no-data-hint">AI analytics will appear when you use AI assistance features</div>
              </div>
            `;
          }
        });
        return;
      }
    } catch (error) {
      console.error('Error in renderComprehensivePromptAnalytics:', error);
      const containers = ['promptStats', 'promptCategories', 'promptTimeline'];
      containers.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.innerHTML = '<div class="no-data">Error loading AI analytics</div>';
        }
      });
      return;
    }
    
    const data = this.promptData;

    // Render overview stats
    const statsContainer = document.getElementById('promptStats');
    if (statsContainer) {
      statsContainer.innerHTML = `
        <div class="prompt-stats-grid">
          <div class="stat-card">
            <div class="stat-value">${data.totalPrompts}</div>
            <div class="stat-label">Total Prompts</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${data.avgComplexity}</div>
            <div class="stat-label">Avg Complexity</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${data.responseQuality}</div>
            <div class="stat-label">Response Quality</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${data.avgResponseTime}ms</div>
            <div class="stat-label">Avg Response Time</div>
          </div>
        </div>

        <div class="insights-section">
          <h4>💡 Insights</h4>
          <div class="insights-grid">
            ${data.insights.map(insight => `
              <div class="insight-card">
                <div class="insight-icon">${insight.icon}</div>
                <div class="insight-content">
                  <div class="insight-title">${insight.title}</div>
                  <div class="insight-message">${insight.message}</div>
                </div>
              </div>
            `).join('')}
            ${data.insights.length === 0 ? '<div class="no-insights">More insights will appear as you use AI assistance</div>' : ''}
          </div>
        </div>
      `;
    }

    // Render categories
    const categoriesContainer = document.getElementById('promptCategories');
    if (categoriesContainer) {
      const sortedCategories = (data.promptCategories || [])
        .sort((a, b) => b.count - a.count)
        .filter(cat => cat.count > 0);

      if (sortedCategories.length > 0) {
        categoriesContainer.innerHTML = `
          <h4>Prompt Categories</h4>
          <div class="categories-chart">
            ${sortedCategories.map(catData => {
              const percentage = (catData.count / data.totalPrompts * 100).toFixed(1);
              return `
                <div class="category-bar">
                  <div class="category-label">
                    <span class="category-name">${catData.category}</span>
                    <span class="category-count">${catData.count} (${percentage}%)</span>
                  </div>
                  <div class="category-bar-wrapper">
                    <div class="category-bar-fill" style="width: ${percentage}%"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      } else {
        categoriesContainer.innerHTML = '<div class="no-data">No AI prompt data available yet.</div>';
      }
    }

    // Render recent prompts
    const timelineContainer = document.getElementById('promptTimeline');
    if (timelineContainer && data.recentPrompts && data.recentPrompts.length > 0) {
      timelineContainer.innerHTML = `
        <h4>Recent Prompts</h4>
        <div class="recent-prompts">
          ${data.recentPrompts.map(prompt => `
            <div class="prompt-item">
              <div class="prompt-content">${prompt.content.substring(0, 100)}${prompt.content.length > 100 ? '...' : ''}</div>
              <div class="prompt-meta">
                <span class="prompt-complexity">Complexity: ${prompt.complexity}</span>
                <span class="prompt-time">${new Date(prompt.timestamp).toLocaleString()}</span>
              </div>
            </div>
          `).join('')}
        </div>

        <h4>⏰ Temporal Patterns</h4>
        <div class="temporal-chart">
          <div class="hourly-distribution">
            <div class="chart-title">Activity by Hour</div>
            <div class="hour-bars">
              ${data.temporal.hourlyDistribution.map((count, hour) => {
                const maxCount = Math.max(...data.temporal.hourlyDistribution);
                const height = maxCount > 0 ? (count / maxCount * 100) : 0;
                return `
                  <div class="hour-bar-container" title="${hour}:00 - ${count} prompts">
                    <div class="hour-bar" style="height: ${height}%"></div>
                    <div class="hour-label">${hour}</div>
                  </div>
                `;
              }).join('')}
            </div>
            <div class="peak-info">Peak: ${data.temporal.peakHour} (${data.temporal.peakHourCount} prompts)</div>
          </div>

          <div class="day-distribution">
            <div class="chart-title">Activity by Day of Week</div>
            <div class="day-bars">
              ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
                const count = data.temporal.dayOfWeekDistribution[idx];
                const maxCount = Math.max(...data.temporal.dayOfWeekDistribution);
                const height = maxCount > 0 ? (count / maxCount * 100) : 0;
                return `
                  <div class="day-bar-container">
                    <div class="day-bar" style="height: ${height}%" title="${count} prompts"></div>
                    <div class="day-label">${day}</div>
                  </div>
                `;
              }).join('')}
            </div>
            <div class="peak-info">Most Active: ${data.temporal.mostActiveDay}</div>
          </div>
        </div>

        <h4>🏆 Top Prompts</h4>
        <div class="top-prompts-section">
          <div class="top-prompts-category">
            <h5>By Complexity</h5>
            ${data.topPrompts.byComplexity.slice(0, 3).map((p, i) => `
              <div class="top-prompt-item">
                <div class="rank">#${i + 1}</div>
                <div class="prompt-text">${p.prompt}</div>
                <div class="prompt-meta">
                  Complexity: ${p.complexity.toFixed(1)} | 
                  ${p.promptLength} chars | 
                  ${new Date(p.timestamp).toLocaleString()}
                </div>
              </div>
            `).join('')}
          </div>

          <div class="top-prompts-category">
            <h5>With Code Generation</h5>
            ${data.topPrompts.withCode.slice(0, 3).map((p, i) => `
              <div class="top-prompt-item">
                <div class="rank">#${i + 1}</div>
                <div class="prompt-text">${p.prompt}</div>
                <div class="prompt-meta">
                  Response: ${p.responseLength} chars | 
                  ${new Date(p.timestamp).toLocaleString()}
                </div>
              </div>
            `).join('')}
            ${data.topPrompts.withCode.length === 0 ? '<div class="no-data-small">No code generation detected</div>' : ''}
          </div>
        </div>
      `;
    }
  }

  renderCodePatterns() {
    const container = document.getElementById('codePatterns');
    const patterns = this.analyzeCodePatterns();
    
    if (patterns.length === 0) {
      container.innerHTML = `
        <div class="no-data">
          <div class="no-data-icon">D</div>
          <div class="no-data-text">No code patterns detected yet</div>
          <div class="no-data-hint">Code patterns will appear as you make file changes</div>
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      <div class="chart-container">
        <div class="section-header">Code Patterns Analysis</div>
        <div class="pattern-summary">Most common: ${patterns.slice(0, 5).join(', ')}</div>
        <div class="pattern-details">
          ${patterns.slice(0, 10).map((pattern, index) => `
            <div class="pattern-item">
              <span class="pattern-rank">${index + 1}.</span>
              <span class="pattern-name">${pattern}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderFileHeatmap() {
    const container = document.getElementById('fileHeatmap');
    if (!container) {
      console.log('File heatmap container not found');
      return;
    }
    
    const heatmapData = this.generateFileHeatmap();
    console.log('File heatmap data:', heatmapData);
    
    if (heatmapData.length === 0) {
      container.innerHTML = `
        <div class="no-data">
          <div class="no-data-icon">📁</div>
          <div class="no-data-text">No file activity yet</div>
          <div class="no-data-hint">File changes will appear here as you edit code</div>
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      <div class="file-activity-list">
        <div class="heatmap-header">File Activity (Top ${heatmapData.length} files)</div>
        ${heatmapData.map(file => `
          <div class="file-activity-item">
            <div class="file-name" title="${file.name}">${file.name}</div>
            <div class="activity-bar">
              <div class="activity-fill" style="width: ${Math.max(file.activity * 100, 5)}%"></div>
            </div>
            <div class="activity-count">${file.count} changes</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderSessionTimeline() {
    const container = document.getElementById('sessionTimeline');
    const timeline = this.generateSessionTimeline();
    
    if (timeline.length === 0) {
      container.innerHTML = `
        <div class="no-data">
          <div class="no-data-icon">T</div>
          <div class="no-data-text">No session activity yet</div>
          <div class="no-data-hint">Your development timeline will appear here</div>
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      <div class="timeline">
        ${timeline.map(item => `
          <div class="timeline-item ${item.active ? 'active' : ''}">
            <div class="timeline-time">${item.time}</div>
            <div class="timeline-content">${item.content}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderLanguageDistribution() {
    const container = document.getElementById('languageDistribution');
    const languages = this.analyzeLanguageDistribution();
    
    const sortedLanguages = Object.entries(languages)
      .sort(([,a], [,b]) => b - a)
      ;
    
    if (sortedLanguages.length === 0) {
      container.innerHTML = `
        <div class="no-data">
          <div class="no-data-icon">🔤</div>
          <div class="no-data-text">No language data yet</div>
          <div class="no-data-hint">Language distribution will be calculated from file changes</div>
        </div>
      `;
      return;
    }
    
    const totalFiles = sortedLanguages.reduce((sum, [, count]) => sum + count, 0);
    const maxCount = sortedLanguages[0][1];
    
    // Define color palette for different languages
    const languageColors = {
      'js': '#f7df1e',
      'ts': '#3178c6',
      'tsx': '#3178c6',
      'jsx': '#61dafb',
      'py': '#3776ab',
      'java': '#f89820',
      'cpp': '#00599c',
      'c': '#a8b9cc',
      'go': '#00add8',
      'rust': '#ce422b',
      'html': '#e34c26',
      'css': '#264de4',
      'scss': '#cc6699',
      'json': '#292929',
      'md': '#083fa1',
      'sh': '#89e051',
      'default': '#6366f1'
    };
    
    container.innerHTML = `
      <div class="language-chart">
        ${sortedLanguages.map(([lang, count]) => {
          const percentage = ((count / totalFiles) * 100).toFixed(1);
          const barWidth = (count / maxCount) * 100;
          const color = languageColors[lang.toLowerCase()] || languageColors.default;
          
          return `
            <div class="language-bar-item">
              <div class="language-bar-header">
                <span class="language-bar-name">${lang}</span>
                <span class="language-bar-stats">
                  <span class="language-bar-count">${count}</span>
                  <span class="language-bar-percentage">${percentage}%</span>
                </span>
              </div>
              <div class="language-bar-container">
                <div class="language-bar-fill" 
                     style="width: ${barWidth}%; background-color: ${color};"
                     title="${lang}: ${count} files (${percentage}%)">
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderPromptAnalysis() {
    const promptData = this.analyzePrompts();
    
    if (!promptData) {
      // Show empty state
      const totalPromptsEl = document.getElementById('totalPrompts');
      const avgComplexityEl = document.getElementById('avgComplexity');
      const responseQualityEl = document.getElementById('responseQuality');
      const avgResponseTimeEl = document.getElementById('avgResponseTime');
      const categoriesContainer = document.getElementById('promptCategories');
      const timelineContainer = document.getElementById('promptTimeline');
      
      if (totalPromptsEl) totalPromptsEl.textContent = '0';
      if (avgComplexityEl) avgComplexityEl.textContent = '0';
      if (responseQualityEl) responseQualityEl.textContent = '0';
      if (avgResponseTimeEl) avgResponseTimeEl.textContent = '0ms';
      
      if (categoriesContainer) {
        categoriesContainer.innerHTML = `
          <div class="empty-state-small">
            <p>No prompt data available</p>
          </div>
        `;
      }
      
      if (timelineContainer) {
        timelineContainer.innerHTML = `
          <div class="empty-state-small">
            <p>No recent prompts</p>
          </div>
        `;
      }
      return;
    }
    
    // Update prompt statistics
    const totalPromptsEl = document.getElementById('totalPrompts');
    const avgComplexityEl = document.getElementById('avgComplexity');
    const responseQualityEl = document.getElementById('responseQuality');
    const avgResponseTimeEl = document.getElementById('avgResponseTime');
    
    if (totalPromptsEl) totalPromptsEl.textContent = promptData.totalPrompts || 0;
    if (avgComplexityEl) avgComplexityEl.textContent = (promptData.promptComplexity?.average || 0).toFixed(1);
    if (responseQualityEl) responseQualityEl.textContent = (promptData.responseQuality?.averageLength || 0).toFixed(0);
    if (avgResponseTimeEl) avgResponseTimeEl.textContent = `${(promptData.responseQuality?.averageTime || 0).toFixed(0)}ms`;
    
    // Render prompt categories
    const categoriesContainer = document.getElementById('promptCategories');
    if (categoriesContainer) {
      const categories = promptData.promptCategories || [];
      if (categories.length > 0) {
        categoriesContainer.innerHTML = categories.map(([category, count]) => `
        <div class="category-item">
          <div class="category-bar">
            <div class="category-fill" style="width: ${(count / promptData.totalPrompts) * 100}%"></div>
          </div>
          <div class="category-info">
            <span class="category-name">${category}</span>
            <span class="category-count">${count}</span>
          </div>
        </div>
      `).join('');
      } else {
        categoriesContainer.innerHTML = `
          <div class="empty-state-small">
            <p>No AI prompt data available yet</p>
          </div>
        `;
      }
    }
    
    // Render prompt timeline
    const timelineContainer = document.getElementById('promptTimeline');
    if (timelineContainer && promptData.promptTimeline && promptData.promptTimeline.length > 0) {
      timelineContainer.innerHTML = promptData.promptTimeline.slice(0, 10).map(item => {
        const time = new Date(item.timestamp).toLocaleTimeString();
        const prompt = item.prompt || '';
        const preview = prompt.length > 60 ? prompt.substring(0, 60) + '...' : prompt;
        return `
          <div class="prompt-item">
            <div class="prompt-time">${time}</div>
            <div class="prompt-text">${preview || 'Empty prompt'}</div>
          </div>
        `;
      }).join('');
    } else if (timelineContainer) {
      timelineContainer.innerHTML = `
        <div class="empty-state-small">
          <p>No recent prompts</p>
        </div>
      `;
    }
  }

  // Semantic Analysis Methods
  loadSemanticAnalysis() {
    console.log('Loading semantic analysis...');
    console.log('Events available:', this.events.length);
    console.log('Entries available:', this.entries.length);
    
    this.showLoadingStates();
    
    // Load components with proper error handling
    try {
      console.log('Loading embeddings...');
    this.loadEmbeddings();
    } catch (error) {
      console.error('Error loading embeddings:', error);
    }
    
    try {
      console.log('Loading TF-IDF...');
    this.loadTFIDF();
    } catch (error) {
      console.error('Error loading TF-IDF:', error);
    }
    
    // Automatically generate file graph with default parameters after a short delay
    setTimeout(() => {
      try {
        console.log('Auto-generating file graph with default parameters...');
        this.generateFileGraph();
      } catch (error) {
        console.error('Error generating file graph:', error);
      }
    }, 500);
    
    this.setupNetworkControls();
  }

  // Show loading states for semantic analysis
  showLoadingStates() {
    const embeddingsElement = document.getElementById('codeEmbeddings');
    const tfidfElement = document.getElementById('termFrequency');
    const insightsElement = document.getElementById('semanticInsights');
    
    if (embeddingsElement) {
      embeddingsElement.innerHTML = '<div class="loading-text">Analyzing code embeddings...</div>';
    }
    if (tfidfElement) {
      tfidfElement.innerHTML = '<div class="loading-text">Calculating term frequencies...</div>';
    }
    if (insightsElement) {
      insightsElement.innerHTML = '<div class="loading-text">Generating semantic insights...</div>';
    }
  }

  // Load system analytics
  loadSystemAnalytics() {
    console.log('Loading system analytics...');
    this.renderSystemMetrics();
    this.renderGitMetrics();
    this.renderIDEStateMetrics();
    this.renderDataCollectionMetrics();
  }

  // Load performance analytics
  loadPerformanceAnalytics() {
    console.log('Loading performance analytics...');
    this.renderGitStatus();
    this.renderCommitsTimeline();
    this.renderMemoryUsage();
    this.renderMemoryStats();
    this.renderCPUUsage();
    this.renderLoadAverage();
  }

  // Render system metrics
  renderSystemMetrics() {
    const container = document.getElementById('systemMetrics');
    if (!container) return;
    
    // Get system resource data
    const systemData = this.systemResources || [];
    const latestData = systemData[systemData.length - 1] || {};
    
    container.innerHTML = `
      <div class="metric-list">
        <div class="metric-row">
          <span class="metric-label">Memory</span>
          <span class="metric-value">${latestData.memory || 'N/A'}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">CPU</span>
          <span class="metric-value">${latestData.cpu || 'N/A'}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Load</span>
          <span class="metric-value">${latestData.loadAverage || 'N/A'}</span>
        </div>
      </div>
    `;
  }

  // Render git metrics
  renderGitMetrics() {
    const container = document.getElementById('gitMetrics');
    if (!container) return;
    
    const gitData = this.gitData || {};
    
    container.innerHTML = `
      <div class="metric-list">
        <div class="metric-row">
          <span class="metric-label">Branch</span>
          <span class="metric-value"><code>${gitData.branch || 'master'}</code></span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Modified</span>
          <span class="metric-value">${gitData.modifiedFiles || 0} files</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Commits</span>
          <span class="metric-value">${gitData.recentCommits || 0} recent</span>
        </div>
      </div>
    `;
  }

  // Render IDE state metrics
  renderIDEStateMetrics() {
    const container = document.getElementById('ideStateActivityChart');
    if (!container) return;
    
    const ideState = this.ideState || {};
    const fileName = ideState.currentFile ? ideState.currentFile.split('/').pop() : 'None';
    
    container.innerHTML = `
      <div class="metric-list">
        <div class="metric-row">
          <span class="metric-label">Open Tabs</span>
          <span class="metric-value">${ideState.activeTabs || 0}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Current File</span>
          <span class="metric-value"><code>${fileName}</code></span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Position</span>
          <span class="metric-value">${ideState.cursorPosition || 'Unknown'}</span>
        </div>
      </div>
    `;
  }

  // Render data collection metrics
  renderDataCollectionMetrics() {
    const container = document.getElementById('rawDataMetrics');
    if (!container) return;
    
    const rawData = this.rawData || {};
    
    container.innerHTML = `
      <div class="data-collection-metrics">
        <div class="metric-grid">
          <div class="metric-item">
            <span class="metric-label">System Resources:</span>
            <span class="metric-value">${rawData.systemResources || 0} samples</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Git Data:</span>
            <span class="metric-value">${rawData.gitData || 0} snapshots</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Cursor Database:</span>
            <span class="metric-value">${rawData.cursorDatabase || 0} entries</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">AppleScript:</span>
            <span class="metric-value">${rawData.appleScript || 0} captures</span>
          </div>
        </div>
      </div>
    `;
  }

  // Performance Analytics Methods
  
  // Render Git Status
  renderGitStatus() {
    const currentBranchEl = document.getElementById('gitCurrentBranch');
    const modifiedFilesEl = document.getElementById('gitModifiedFiles');
    const recentCommitsEl = document.getElementById('gitRecentCommits');
    
    if (currentBranchEl) {
      currentBranchEl.textContent = this.gitStatus?.currentBranch || 'master';
    }
    if (modifiedFilesEl) {
      modifiedFilesEl.textContent = this.gitStatus?.modifiedFiles || '0';
    }
    if (recentCommitsEl) {
      recentCommitsEl.textContent = this.gitStatus?.recentCommits || '0';
    }
  }

  // Render Commits Timeline
  renderCommitsTimeline() {
    const container = document.getElementById('commitsTimelineChart');
    if (!container) return;
    
    // For now, show placeholder - in a real implementation, this would create a timeline chart
    container.innerHTML = `
      <div class="chart-placeholder">
        Commits timeline chart will be implemented here
      </div>
    `;
  }

  // Render Memory Usage Chart
  renderMemoryUsage() {
    const container = document.getElementById('memoryUsageChart');
    if (!container) return;
    
    // For now, show placeholder - in a real implementation, this would create a memory usage chart
    container.innerHTML = `
      <div class="chart-placeholder">
        Memory usage timeline chart will be implemented here
      </div>
    `;
  }

  // Render Memory Statistics
  renderMemoryStats() {
    const currentUsageEl = document.getElementById('memoryCurrentUsage');
    const peakUsageEl = document.getElementById('memoryPeakUsage');
    const averageUsageEl = document.getElementById('memoryAverageUsage');
    
    if (currentUsageEl) {
      currentUsageEl.textContent = this.memoryStats?.current || 'Loading...';
    }
    if (peakUsageEl) {
      peakUsageEl.textContent = this.memoryStats?.peak || 'Loading...';
    }
    if (averageUsageEl) {
      averageUsageEl.textContent = this.memoryStats?.average || 'Loading...';
    }
  }

  // Render CPU Usage Chart
  renderCPUUsage() {
    const container = document.getElementById('cpuUsageChart');
    if (!container) return;
    
    // For now, show placeholder - in a real implementation, this would create a CPU usage chart
    container.innerHTML = `
      <div class="chart-placeholder">
        CPU usage timeline chart will be implemented here
      </div>
    `;
  }

  // Render Load Average Chart
  renderLoadAverage() {
    const container = document.getElementById('loadAverageChart');
    if (!container) return;
    
    // For now, show placeholder - in a real implementation, this would create a load average chart
    container.innerHTML = `
      <div class="chart-placeholder">
        Load average timeline chart will be implemented here
      </div>
    `;
  }

  // Load and analyze code embeddings
  loadEmbeddings() {
    const embeddingsElement = document.getElementById('codeEmbeddings');
    if (!embeddingsElement) return;
    
    console.log('Loading code embeddings...');
    
    // Get file events for analysis - handle events without type field
    const fileEvents = this.events.filter(e => {
      // Check if event has file-related content
      const details = JSON.parse(e.details || '{}');
      return details.file_path || details.content || details.before_content || e.file_path;
    });
    console.log('File events for embeddings:', fileEvents.length);
    
    const fileContents = {};
    
    fileEvents.forEach(event => {
      try {
        const details = JSON.parse(event.details || '{}');
        const filePath = details.file_path || event.file_path || 'unknown';
        const content = details.content || details.before_content || details.after_content || '';
        
        if (filePath && content) {
          if (!fileContents[filePath]) {
            fileContents[filePath] = [];
          }
          fileContents[filePath].push(content);
        }
      } catch {
        // Skip invalid events
      }
    });
    
    // Analyze embeddings
    const embeddings = this.analyzeCodeEmbeddings(fileContents);
    
    embeddingsElement.innerHTML = `
      <div class="embeddings-container">
        <h4>Code Embeddings Analysis</h4>
        <div class="embedding-stats">
          <div class="stat-item">
            <span class="stat-label">Files Analyzed:</span>
            <span class="stat-value">${Object.keys(fileContents).length}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Total Changes:</span>
            <span class="stat-value">${Object.values(fileContents).reduce((sum, changes) => sum + changes.length, 0)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Avg Similarity:</span>
            <span class="stat-value">${embeddings.avgSimilarity.toFixed(3)}</span>
          </div>
        </div>
        <div class="embedding-details">
          <h5>Most Similar File Pairs:</h5>
          ${embeddings.similarPairs.slice(0, 5).map(pair => `
            <div class="similarity-item">
              <span class="file-pair">${pair.file1} ↔ ${pair.file2}</span>
              <span class="similarity-score">${pair.similarity.toFixed(3)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Analyze code embeddings using simple text similarity
  analyzeCodeEmbeddings(fileContents) {
    const files = Object.keys(fileContents);
    const similarities = [];
    
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const file1 = files[i];
        const file2 = files[j];
        const content1 = fileContents[file1].join(' ');
        const content2 = fileContents[file2].join(' ');
        
        const similarity = this.calculateTextSimilarity(content1, content2);
        similarities.push({
          file1: file1.split('/').pop(),
          file2: file2.split('/').pop(),
          similarity: similarity
        });
      }
    }
    
    similarities.sort((a, b) => b.similarity - a.similarity);
    const avgSimilarity = similarities.reduce((sum, s) => sum + s.similarity, 0) / similarities.length;
    
    return {
      similarPairs: similarities,
      avgSimilarity: avgSimilarity || 0
    };
  }

  // Calculate text similarity using Jaccard similarity
  calculateTextSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  // Load TF-IDF analysis
  loadTFIDF() {
    const tfidfElement = document.getElementById('termFrequency');
    if (!tfidfElement) return;
    
    console.log('Loading TF-IDF analysis...');
    
    // Get file events for analysis - handle events without type field
    const fileEvents = this.events.filter(e => {
      // Check if event has file-related content
      const details = JSON.parse(e.details || '{}');
      return details.file_path || details.content || details.before_content || e.file_path;
    });
    console.log('File events for TF-IDF:', fileEvents.length);
    
    const fileContents = {};
    
    fileEvents.forEach(event => {
      try {
        const details = JSON.parse(event.details || '{}');
        const filePath = details.file_path || event.file_path || 'unknown';
        const content = details.content || details.before_content || details.after_content || '';
        
        if (filePath && content) {
          if (!fileContents[filePath]) {
            fileContents[filePath] = [];
          }
          fileContents[filePath].push(content);
        }
      } catch {
        // Skip invalid events
      }
    });
    
    // Calculate TF-IDF
    const tfidf = this.calculateTFIDF(fileContents);
    
    tfidfElement.innerHTML = `
      <div class="tfidf-container">
        <h4>Term Frequency Analysis</h4>
        <div class="tfidf-stats">
          <div class="stat-item">
            <span class="stat-label">Total Terms:</span>
            <span class="stat-value">${tfidf.totalTerms}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Unique Terms:</span>
            <span class="stat-value">${tfidf.uniqueTerms}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Avg Term Frequency:</span>
            <span class="stat-value">${tfidf.avgFrequency.toFixed(2)}</span>
          </div>
        </div>
        <div class="tfidf-details">
          <h5>Top Terms by Importance:</h5>
          <div class="tfidf-table">
            <table class="tfidf-results-table">
              <thead>
                <tr>
                  <th>Term</th>
                  <th>TF-IDF Score</th>
                  <th>Frequency</th>
                </tr>
              </thead>
              <tbody>
                ${tfidf.topTerms.map(term => `
                  <tr>
                    <td class="term-name">${term.term}</td>
                    <td class="term-score">${term.tfidf.toFixed(4)}</td>
                    <td class="term-frequency">${term.frequency}</td>
                  </tr>
          `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // Calculate TF-IDF for code analysis
  calculateTFIDF(fileContents) {
    const allTerms = {};
    const fileTerms = {};
    const totalFiles = Object.keys(fileContents).length;
    
    // Extract terms from each file
    Object.entries(fileContents).forEach(([filePath, contents]) => {
      const allContent = contents.join(' ');
      const terms = this.extractCodeTerms(allContent);
      fileTerms[filePath] = terms;
      
      terms.forEach(term => {
        allTerms[term] = (allTerms[term] || 0) + 1;
      });
    });
    
    // Calculate TF-IDF for each term
    const tfidfScores = {};
    Object.entries(fileTerms).forEach(([filePath, terms]) => {
      const termCounts = {};
      terms.forEach(term => {
        termCounts[term] = (termCounts[term] || 0) + 1;
      });
      
      Object.entries(termCounts).forEach(([term, count]) => {
        const tf = count / terms.length;
        const idf = Math.log(totalFiles / (allTerms[term] || 1));
        const tfidf = tf * idf;
        
        if (!tfidfScores[term]) {
          tfidfScores[term] = 0;
        }
        tfidfScores[term] += tfidf;
      });
    });
    
    const topTerms = Object.entries(tfidfScores)
      .map(([term, score]) => ({ term, tfidf: score }))
      .sort((a, b) => b.tfidf - a.tfidf);
    
    return {
      totalTerms: Object.values(allTerms).reduce((sum, count) => sum + count, 0),
      uniqueTerms: Object.keys(allTerms).length,
      avgFrequency: Object.values(allTerms).reduce((sum, count) => sum + count, 0) / Object.keys(allTerms).length,
      topTerms: topTerms
    };
  }

  // Extract meaningful terms from code
  extractCodeTerms(content) {
    // Extract function names, variables, classes, etc.
    const functionMatches = content.match(/\b(function|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
    const classMatches = content.match(/\b(class|interface|type)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
    const importMatches = content.match(/\b(import|from)\s+['"]([^'"]+)['"]/g) || [];
    
    const terms = [
      ...functionMatches.map(m => m.split(/\s+/)[1]),
      ...classMatches.map(m => m.split(/\s+/)[1]),
      ...importMatches.map(m => m.match(/['"]([^'"]+)['"]/)?.[1]).filter(Boolean)
    ];
    
    return terms.filter(term => term && term.length > 2);
  }




  // Setup network controls and filtering
  setupNetworkControls() {
    // Add event listeners for network controls
    const similarityThreshold = document.getElementById('similarityThreshold');
    if (similarityThreshold) {
      similarityThreshold.addEventListener('input', (e) => {
        const value = e.target.value;
        const display = document.getElementById('threshold-value');
        if (display) display.textContent = value;
        
        // Regenerate network with new threshold
        if (this.currentSimulation) {
          this.renderFileNetwork();
        }
      });
    }

    // File type filter
    const fileTypeFilter = document.getElementById('file-type-filter');
    if (fileTypeFilter) {
      fileTypeFilter.addEventListener('change', (e) => {
        this.applyFileTypeFilter(Array.from(e.target.selectedOptions).map(o => o.value));
      });
    }

    // Layout algorithm
    const layoutAlgorithm = document.getElementById('layout-algorithm');
    if (layoutAlgorithm) {
      layoutAlgorithm.addEventListener('change', (e) => {
        this.changeLayoutAlgorithm(e.target.value);
      });
    }

    // Apply filters button
    const applyFilters = document.getElementById('apply-filters');
    if (applyFilters) {
      applyFilters.addEventListener('click', () => {
        this.applyAllFilters();
      });
    }

    // Reset network button
    const resetNetwork = document.getElementById('reset-network');
    if (resetNetwork) {
      resetNetwork.addEventListener('click', () => {
        this.resetNetwork();
      });
    }
  }

  applyFileTypeFilter(selectedTypes) {
    if (!this.currentNodes) return;
    
    // Filter nodes by file type
    const filteredNodes = this.currentNodes.filter(node => 
      selectedTypes.length === 0 || selectedTypes.includes(node.group.toLowerCase())
    );
    
    // Update visualization with filtered nodes
    this.updateNetworkWithFilteredNodes(filteredNodes);
  }

  changeLayoutAlgorithm(algorithm) {
    if (!this.currentSimulation) return;
    
    switch (algorithm) {
      case 'circular':
        this.applyCircularLayout();
        break;
      case 'hierarchical':
        this.applyHierarchicalLayout();
        break;
      default:
        this.applyForceLayout();
    }
  }

  applyCircularLayout() {
    if (!this.currentNodes) return;
    
    const container = document.getElementById('fileGraph');
    const width = container.offsetWidth || 600;
    const height = container.offsetHeight || 400;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 3;
    
    this.currentNodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / this.currentNodes.length;
      node.x = centerX + radius * Math.cos(angle);
      node.y = centerY + radius * Math.sin(angle);
      node.fx = node.x;
      node.fy = node.y;
    });
    
    if (this.currentSimulation) {
      this.currentSimulation.alpha(0.3).restart();
    }
  }

  applyHierarchicalLayout() {
    if (!this.currentNodes) return;
    
    // Group nodes by file type
    const groups = {};
    this.currentNodes.forEach(node => {
      if (!groups[node.group]) groups[node.group] = [];
      groups[node.group].push(node);
    });
    
    const container = document.getElementById('fileGraph');
    const width = container.offsetWidth || 600;
    const height = container.offsetHeight || 400;
    const groupWidth = width / Object.keys(groups).length;
    
    let groupIndex = 0;
    Object.values(groups).forEach(group => {
      const groupHeight = height / group.length;
      group.forEach((node, index) => {
        node.x = groupIndex * groupWidth + groupWidth / 2;
        node.y = index * groupHeight + groupHeight / 2;
        node.fx = node.x;
        node.fy = node.y;
      });
      groupIndex++;
    });
    
    if (this.currentSimulation) {
      this.currentSimulation.alpha(0.3).restart();
    }
  }

  applyForceLayout() {
    if (!this.currentNodes) return;
    
    // Reset fixed positions
    this.currentNodes.forEach(node => {
      node.fx = null;
      node.fy = null;
    });
    
    if (this.currentSimulation) {
      this.currentSimulation.alpha(0.3).restart();
    }
  }

  applyAllFilters() {
    const threshold = parseFloat(document.getElementById('similarityThreshold')?.value || 0.3);
    const selectedTypes = Array.from(document.getElementById('file-type-filter')?.selectedOptions || [])
      .map(option => option.value);
    
    // Apply filters and regenerate network
    this.renderFileNetwork();
  }

  resetNetwork() {
    // Reset all controls to default values
    const threshold = document.getElementById('similarityThreshold');
    if (threshold) threshold.value = 0.3;
    
    const thresholdValue = document.getElementById('threshold-value');
    if (thresholdValue) thresholdValue.textContent = '0.3';
    
    const fileTypeFilter = document.getElementById('file-type-filter');
    if (fileTypeFilter) {
      Array.from(fileTypeFilter.options).forEach(option => option.selected = false);
    }
    
    const layoutAlgorithm = document.getElementById('layout-algorithm');
    if (layoutAlgorithm) layoutAlgorithm.value = 'force';
    
    // Regenerate network with default settings
    this.renderFileNetwork();
  }

  updateNetworkWithFilteredNodes(filteredNodes) {
    // This would update the current visualization to show only filtered nodes
    // Implementation depends on the specific visualization state
    console.log('Filtered nodes:', filteredNodes.length);
  }

  // Advanced Clustering and Visualizations
  addClustering() {
    if (!this.currentNodes) return;
    
    // Use existing embeddings for clustering
    const embeddings = this.currentNodes.map(node => this.getFileEmbedding(node));
    const clusters = this.performClustering(embeddings);
    
    // Color nodes by cluster
    this.currentNodes.forEach((node, index) => {
      node.cluster = clusters[index];
      node.color = this.getClusterColor(node.cluster);
    });
    
    // Add cluster boundaries
    this.addClusterBoundaries(clusters);
  }

  performClustering(embeddings) {
    // Simple K-means clustering (mock implementation)
    const k = Math.min(5, Math.max(2, Math.floor(embeddings.length / 3)));
    const clusters = new Array(embeddings.length).fill(0);
    
    // Initialize centroids randomly
    const centroids = [];
    for (let i = 0; i < k; i++) {
      const randomIndex = Math.floor(Math.random() * embeddings.length);
      centroids.push([...embeddings[randomIndex]]);
    }
    
    // Assign points to nearest centroid
    for (let i = 0; i < embeddings.length; i++) {
      let minDistance = Infinity;
      let closestCluster = 0;
      
      for (let j = 0; j < centroids.length; j++) {
        const distance = this.calculateEuclideanDistance(embeddings[i], centroids[j]);
        if (distance < minDistance) {
          minDistance = distance;
          closestCluster = j;
        }
      }
      
      clusters[i] = closestCluster;
    }
    
    return clusters;
  }

  calculateEuclideanDistance(vec1, vec2) {
    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
      sum += Math.pow(vec1[i] - vec2[i], 2);
    }
    return Math.sqrt(sum);
  }

  getClusterColor(clusterId) {
    const colors = ['#000000', '#333333', '#666666', '#888888', '#444444'];
    return colors[clusterId % colors.length];
  }

  addClusterBoundaries(clusters) {
    if (!this.currentNodes || !this.currentSimulation) return;
    
    // Group nodes by cluster
    const clusterGroups = {};
    this.currentNodes.forEach((node, index) => {
      const clusterId = clusters[index];
      if (!clusterGroups[clusterId]) clusterGroups[clusterId] = [];
      clusterGroups[clusterId].push(node);
    });
    
    // Draw convex hulls around clusters
    Object.values(clusterGroups).forEach((clusterNodes, index) => {
      if (clusterNodes.length > 2) {
        const hull = this.calculateConvexHull(clusterNodes);
        this.drawClusterBoundary(hull, index);
      }
    });
  }

  calculateConvexHull(nodes) {
    // Simple convex hull calculation
    if (nodes.length < 3) return nodes;
    
    // Sort by x-coordinate, then by y-coordinate
    const sorted = nodes.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    
    // Build lower hull
    const lower = [];
    for (const node of sorted) {
      while (lower.length >= 2 && this.cross(lower[lower.length - 2], lower[lower.length - 1], node) <= 0) {
        lower.pop();
      }
      lower.push(node);
    }
    
    // Build upper hull
    const upper = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      while (upper.length >= 2 && this.cross(upper[upper.length - 2], upper[upper.length - 1], sorted[i]) <= 0) {
        upper.pop();
      }
      upper.push(sorted[i]);
    }
    
    // Remove duplicates
    upper.pop();
    lower.pop();
    
    return [...lower, ...upper];
  }

  cross(o, a, b) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  }

  drawClusterBoundary(hull, clusterId) {
    if (!hull || hull.length < 3) return;
    
    const container = document.getElementById('fileGraph');
    const svg = d3.select(container).select('svg');
    
    // Create path for cluster boundary
    const path = d3.path();
    path.moveTo(hull[0].x, hull[0].y);
    for (let i = 1; i < hull.length; i++) {
      path.lineTo(hull[i].x, hull[i].y);
    }
    path.closePath();
    
    // Add boundary to SVG
    svg.append('path')
      .attr('d', path.toString())
      .attr('fill', 'none')
      .attr('stroke', this.getClusterColor(clusterId))
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5')
      .attr('opacity', 0.6)
      .style('pointer-events', 'none');
  }

  // Advanced Network Analytics
  calculateNetworkMetrics() {
    if (!this.currentNodes || !this.currentLinks) return {};
    
    const metrics = {
      totalNodes: this.currentNodes.length,
      totalLinks: this.currentLinks.length,
      averageDegree: this.currentLinks.length * 2 / this.currentNodes.length,
      density: (this.currentLinks.length * 2) / (this.currentNodes.length * (this.currentNodes.length - 1)),
      clusteringCoefficient: this.calculateClusteringCoefficient(),
      averagePathLength: this.calculateAveragePathLength()
    };
    
    return metrics;
  }

  calculateClusteringCoefficient() {
    // Simplified clustering coefficient calculation
    let totalTriangles = 0;
    let totalTriplets = 0;
    
    this.currentNodes.forEach(node => {
      const neighbors = this.getNeighbors(node.id);
      const neighborCount = neighbors.length;
      
      if (neighborCount >= 2) {
        totalTriplets += neighborCount * (neighborCount - 1) / 2;
        
        // Count triangles
        for (let i = 0; i < neighborCount; i++) {
          for (let j = i + 1; j < neighborCount; j++) {
            if (this.areConnected(neighbors[i], neighbors[j])) {
              totalTriangles++;
            }
          }
        }
      }
    });
    
    return totalTriplets > 0 ? totalTriangles / totalTriplets : 0;
  }

  getNeighbors(nodeId) {
    return this.currentLinks
      .filter(link => link.source === nodeId || link.target === nodeId)
      .map(link => link.source === nodeId ? link.target : link.source);
  }

  areConnected(node1, node2) {
    return this.currentLinks.some(link => 
      (link.source === node1 && link.target === node2) ||
      (link.source === node2 && link.target === node1)
    );
  }

  calculateAveragePathLength() {
    // Simplified average path length calculation
    const distances = {};
    
    // Initialize distances
    this.currentNodes.forEach(node => {
      distances[node.id] = {};
      this.currentNodes.forEach(otherNode => {
        distances[node.id][otherNode.id] = node.id === otherNode.id ? 0 : Infinity;
      });
    });
    
    // Set direct connections
    this.currentLinks.forEach(link => {
      distances[link.source][link.target] = 1;
      distances[link.target][link.source] = 1;
    });
    
    // Floyd-Warshall algorithm
    this.currentNodes.forEach(k => {
      this.currentNodes.forEach(i => {
        this.currentNodes.forEach(j => {
          if (distances[i.id][k.id] + distances[k.id][j.id] < distances[i.id][j.id]) {
            distances[i.id][j.id] = distances[i.id][k.id] + distances[k.id][j.id];
          }
        });
      });
    });
    
    // Calculate average
    let totalDistance = 0;
    let pathCount = 0;
    
    this.currentNodes.forEach(node1 => {
      this.currentNodes.forEach(node2 => {
        if (node1.id !== node2.id && distances[node1.id][node2.id] !== Infinity) {
          totalDistance += distances[node1.id][node2.id];
          pathCount++;
        }
      });
    });
    
    return pathCount > 0 ? totalDistance / pathCount : 0;
  }

  // Duplicate showLoadingStates method removed - using the real one above

  generateSemanticInsights(fileEvents) {
    try {
      // Ensure we have valid data
      const events = fileEvents || this.events || [];
      const entries = this.entries || [];
      const patterns = this.codePatterns || {};
      
    // Use semantic engine to generate insights
    const insights = this.semanticEngine.generateSemanticInsights(
        events,
        entries,
        patterns
      );
    
      // Ensure insights has the required structure
      return {
        patterns: insights.patterns || [],
        architecture: insights.architecture || [],
        complexity: insights.complexity || { avg: 0, max: 0 },
        ...insights
      };
    } catch (error) {
      console.error('Error generating semantic insights:', error);
      return {
        patterns: [],
        architecture: [],
        complexity: { avg: 0, max: 0 }
      };
    }
  }

  // Embeddings Methods - removed duplicate

  generateEmbeddings() {
    const method = document.getElementById('embeddingMethod').value;
    const container = document.getElementById('embeddingsChart');
    
    container.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <div class="loading-text">Generating embeddings using ${method}...</div>
            </div>
    `;
    
    // Simulate embedding generation
    setTimeout(() => {
      this.embeddings = this.createMockEmbeddings();
      this.visualizeEmbeddings();
    }, 2000);
  }

  visualizeEmbeddings() {
    if (!this.embeddings) return;
    
    const chartContainer = document.getElementById('embeddingsChart');
    const tableContainer = document.getElementById('embeddingsTable');
    
    chartContainer.innerHTML = `
      <div class="chart-container">
        <div>Embeddings Visualization</div>
        <div>${this.embeddings.length} vectors generated</div>
            </div>
    `;
    
    tableContainer.innerHTML = `
      <table class="data-table">
        <thead>
          <tr><th>File</th><th>Similarity</th><th>Vector</th></tr>
        </thead>
        <tbody>
          ${this.embeddings.slice(0, 10).map(emb => `
            <tr>
              <td>${emb.file}</td>
              <td>${emb.similarity.toFixed(3)}</td>
              <td>[${emb.vector.slice(0, 3).map(v => v.toFixed(2)).join(', ')}...]</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // Duplicate calculateTFIDF function removed - using the real one above
  
  renderTFIDFResults(tfidfResults, container) {
    if (!tfidfResults || tfidfResults.length === 0) {
      container.innerHTML = '<div class="no-data">No terms found in code</div>';
      return;
    }
    
    const html = `
      <div class="tfidf-results">
        <h4>Top Terms by TF-IDF Score</h4>
        <div class="tfidf-chart">
          ${tfidfResults.map((term, i) => `
            <div class="tfidf-bar-container">
              <div class="tfidf-term">${term.term}</div>
              <div class="tfidf-bar-wrapper">
                <div class="tfidf-bar" style="width: ${(term.score / tfidfResults[0].score) * 100}%"></div>
              </div>
              <div class="tfidf-score">${term.score.toFixed(2)}</div>
              <div class="tfidf-freq">Freq: ${term.frequency}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    container.innerHTML = html;
    
    setTimeout(() => {
      this.tfidfData = this.createMockTFIDF();
      this.renderTFIDF();
    }, 1500);
  }

  renderTFIDF() {
    if (!this.tfidfData) return;
    
    const graphContainer = document.getElementById('tfidfGraph');
    const tableContainer = document.getElementById('tfidfTable');
    
    graphContainer.innerHTML = `
      <div class="chart-container">
        <div>TF-IDF Analysis</div>
        <div>Top terms by importance</div>
        </div>
    `;
    
    tableContainer.innerHTML = `
      <table class="data-table">
        <thead>
          <tr><th>Term</th><th>TF-IDF Score</th><th>Frequency</th></tr>
        </thead>
        <tbody>
          ${this.tfidfData.map(item => `
            <tr>
              <td>${item.term}</td>
              <td>${item.score.toFixed(4)}</td>
              <td>${item.frequency}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // Workspaces Methods
  initializeDefaultWorkspaces() {
    // Don't initialize hardcoded workspaces - they will be loaded from the API
    // This prevents showing fake workspace data before the API loads
    console.log('Waiting for workspaces to load from API...');
  }

  async loadWorkspaces() {
    try {
      // Load workspaces from the multi-workspace API
      const response = await fetch(`${this.companionUrl}/api/workspaces`);
      if (response.ok) {
        const workspaceData = await response.json();
        console.log('Raw workspace data from API:', workspaceData);
        
        // Also extract workspaces from events to ensure we capture all unique workspaces
        const workspacesFromEvents = this.extractWorkspacesFromEvents();
        console.log('Workspaces from events:', workspacesFromEvents);
        
        // Merge API and event-discovered workspaces
        const workspaceMap = new Map();
        
        // Add API workspaces
        workspaceData.forEach(ws => {
          if (ws.path) {
            workspaceMap.set(ws.path, ws);
          }
        });
        
        // Add event-discovered workspaces
        workspacesFromEvents.forEach(ws => {
          if (!workspaceMap.has(ws.path)) {
            workspaceMap.set(ws.path, ws);
          }
        });
        
        // Convert to dashboard format and sort by activity
        this.workspaces = Array.from(workspaceMap.values())
          .map((ws, index) => {
            const name = ws.path ? ws.path.split('/').pop() || 'Unknown' : 'Unknown';
            return {
              id: `workspace-${index}`,
              name: name,
              path: ws.path || '',
              active: index === 0,
              events: ws.events || 0,
              files: ws.entries || 0,
              sessions: ws.sessionId ? 1 : 0,
              aiInteractions: 0,
              productivity: 0
            };
          })
          .sort((a, b) => b.events - a.events); // Sort by activity
        
        console.log(`Loaded ${this.workspaces.length} workspaces:`, this.workspaces.map(w => ({ name: w.name, path: w.path, events: w.events })));
      } else {
        console.log('Workspaces API not available, extracting from events');
        this.loadWorkspacesFromEvents();
      }
    } catch (error) {
      console.error('Error loading workspaces:', error);
      this.loadWorkspacesFromEvents();
    }
    
    this.renderWorkspaceList();
    this.renderWorkspaceComparison();
    this.populateWorkspaceSelector();
  }

  // Extract unique workspaces from events data
  extractWorkspacesFromEvents() {
    const workspaceMap = new Map();
    const seenPaths = new Set(); // Track unique file paths for debugging
    
    console.log('Extracting workspaces from events...');
    console.log('Total events:', this.events?.length || 0);
    console.log('Total entries:', this.entries?.length || 0);
    
    // Process all events
    (this.events || []).forEach(event => {
      let workspacePath = null;
      
      // Prioritize file_path over workspace_path for better workspace detection
      if (event.file_path) {
        seenPaths.add(event.file_path);
        workspacePath = this.extractWorkspaceFromPath(event.file_path);
        console.log(`Extracted workspace from file_path: ${event.file_path} -> ${workspacePath}`);
      }
      
      // Fallback to workspace_path if file_path didn't work
      if (!workspacePath && event.workspace_path) {
        workspacePath = this.extractWorkspaceFromPath(event.workspace_path);
        console.log(`Extracted workspace from workspace_path: ${event.workspace_path} -> ${workspacePath}`);
      }
      
      // Final fallback to details
      if (!workspacePath) {
        const details = this.parseEventDetails(event);
        if (details.file_path) {
          seenPaths.add(details.file_path);
          workspacePath = this.extractWorkspaceFromPath(details.file_path);
          console.log(`Extracted workspace from details.file_path: ${details.file_path} -> ${workspacePath}`);
        }
      }
      
      if (workspacePath) {
        if (!workspaceMap.has(workspacePath)) {
          workspaceMap.set(workspacePath, { path: workspacePath, events: 0, entries: 0 });
          console.log(`New workspace detected: ${workspacePath}`);
        }
        workspaceMap.get(workspacePath).events++;
      }
    });
    
    // Process entries
    (this.entries || []).forEach(entry => {
      let workspacePath = entry.workspace_path;
      
      if (!workspacePath && entry.file_path) {
        seenPaths.add(entry.file_path);
        workspacePath = this.extractWorkspaceFromPath(entry.file_path);
      }
      
      if (workspacePath) {
        if (!workspaceMap.has(workspacePath)) {
          workspaceMap.set(workspacePath, { path: workspacePath, events: 0, entries: 0 });
        }
        workspaceMap.get(workspacePath).entries++;
      }
    });
    
    console.log('Workspace extraction:', {
      totalEvents: this.events?.length || 0,
      totalEntries: this.entries?.length || 0,
      uniqueFilePaths: seenPaths.size,
      extractedWorkspaces: workspaceMap.size,
      workspacePaths: Array.from(workspaceMap.keys()),
      samplePaths: Array.from(seenPaths).slice(0, 5)
    });
    
    return Array.from(workspaceMap.values());
  }

  // Extract workspace root from file path
  extractWorkspaceFromPath(filePath) {
    if (!filePath) return null;
    
    console.log(`Extracting workspace from path: ${filePath}`);
    
    // Handle relative paths (companion service provides relative paths)
    if (!filePath.startsWith('/')) {
      const pathSegments = filePath.split('/');
      
      // For relative paths, the first segment is likely the workspace
      if (pathSegments.length > 0 && pathSegments[0]) {
        const workspace = pathSegments[0];
        console.log(`Extracted workspace from relative path: ${workspace}`);
        return workspace;
      }
    }
    
    // Handle absolute paths
    const baseDirectories = [
      '/Users/hamidaho/Desktop',
      '/Users/hamidaho/Documents', 
      '/Users/hamidaho/new_cursor',
      '/Users/hamidaho/new_cursor_dash'
    ];
    
    // Find the base directory this file belongs to
    let baseDir = null;
    for (const dir of baseDirectories) {
      if (filePath.startsWith(dir)) {
        baseDir = dir;
        break;
      }
    }
    
    if (!baseDir) {
      console.log(`No base directory matched for: ${filePath} - skipping`);
      return null;
    }
    
    // Extract the project folder within the base directory
    const relativePath = filePath.substring(baseDir.length + 1); // +1 for the slash
    const pathSegments = relativePath.split('/');
    
    // The first segment after the base directory is likely the project folder
    if (pathSegments.length > 0 && pathSegments[0]) {
      const projectFolder = `${baseDir}/${pathSegments[0]}`;
      console.log(`Extracted project folder: ${projectFolder}`);
      return projectFolder;
    }
    
    // If we can't extract a project folder, don't create a workspace
    console.log(`No project folder found in path: ${filePath} - skipping`);
    return null;
  }

  // Load workspaces entirely from events (fallback)
  loadWorkspacesFromEvents() {
    const workspacesFromEvents = this.extractWorkspacesFromEvents();
    
    this.workspaces = workspacesFromEvents
      .map((ws, index) => {
        const name = ws.path ? ws.path.split('/').pop() || 'Unknown' : 'Unknown';
        return {
          id: `workspace-${index}`,
          name: name,
          path: ws.path || '',
          active: index === 0,
          events: ws.events || 0,
          files: ws.entries || 0,
          sessions: 0,
          aiInteractions: 0,
          productivity: 0
        };
      })
      .sort((a, b) => b.events - a.events);
    
    console.log(`Loaded ${this.workspaces.length} workspaces from events`);
  }

  // Populate the workspace selector dropdown
  populateWorkspaceSelector() {
    const selector = document.getElementById('workspaceSelect');
    const selector2 = document.getElementById('workspaceSelector');
    
    if (!selector && !selector2) {
      console.log('Workspace selector not found');
      return;
    }

    console.log('Populating workspace selector with', this.workspaces.length, 'workspaces');

    // Update both selectors if they exist
    [selector, selector2].forEach(sel => {
      if (sel) {
    // Clear existing options except the first one
        sel.innerHTML = '<option value="all">All Workspaces</option>';

        // Add workspace options with better names
    this.workspaces.forEach(workspace => {
      const option = document.createElement('option');
      option.value = workspace.id;
          
          // Extract workspace name from path for better display
          const workspaceName = this.extractWorkspaceName(workspace.path);
          option.textContent = `${workspaceName} (${workspace.events || 0} events)`;
      option.selected = workspace.active;
          sel.appendChild(option);
          console.log('Added workspace option:', workspaceName, workspace.events);
    });

    // Add change event listener (only once)
        if (!sel.dataset.initialized) {
          sel.addEventListener('change', (e) => {
        const workspaceId = e.target.value;
            console.log('Workspace selector changed to:', workspaceId);
            if (workspaceId === 'all') {
          this.clearWorkspaceSelection();
            } else if (workspaceId) {
              this.selectWorkspace(workspaceId);
            }
          });
          sel.dataset.initialized = 'true';
        }
      }
    });
  }

  // Extract a clean workspace name from the path
  extractWorkspaceName(path) {
    if (!path) return 'Unknown Workspace';
    
    const segments = path.split('/').filter(s => s);
    if (segments.length === 0) return 'Unknown Workspace';
    
    // Handle specific project folders
    if (path.includes('/Desktop/')) {
      const projectName = segments[segments.length - 1];
      return `Desktop/${projectName}`;
    }
    if (path.includes('/Documents/')) {
      const projectName = segments[segments.length - 1];
      return `Documents/${projectName}`;
    }
    if (path.includes('/new_cursor/')) {
      const projectName = segments[segments.length - 1];
      return `new_cursor/${projectName}`;
    }
    if (path.includes('/new_cursor_dash/')) {
      const projectName = segments[segments.length - 1];
      return `new_cursor_dash/${projectName}`;
    }
    
    // Handle direct base directories
    if (path === '/Users/hamidaho/Desktop') return 'Desktop';
    if (path === '/Users/hamidaho/Documents') return 'Documents';
    if (path === '/Users/hamidaho/new_cursor') return 'new_cursor';
    if (path === '/Users/hamidaho/new_cursor_dash') return 'new_cursor_dash';
    
    // Get the last meaningful segment
    const lastSegment = segments[segments.length - 1];
    
    // If it's a generic name like 'cursor-telemetry', try to get the parent directory
    if (lastSegment === 'cursor-telemetry' && segments.length > 1) {
      return segments[segments.length - 2] || lastSegment;
    }
    
    return lastSegment;
  }

  renderWorkspaceList() {
    const workspaceListElement = document.getElementById('workspaceList');
    if (!workspaceListElement) return;

    workspaceListElement.innerHTML = this.workspaces.map(workspace => {
      const workspaceName = this.extractWorkspaceName(workspace.path);
      const lastActivity = this.getLastActivityTime(workspace);
      
      return `
      <div class="workspace-card ${workspace.active ? 'active' : ''}" data-workspace-id="${workspace.id}" onclick="activityDashboard.showWorkspaceDetail('${workspace.id}', event)">
        <div class="workspace-header">
          <h4>${workspaceName}</h4>
          <div class="workspace-status">
            ${workspace.active ? '<span class="status-badge active">Active</span>' : ''}
            <span class="last-activity">Last: ${lastActivity}</span>
          </div>
        </div>
        
        <div class="workspace-path">${workspace.path}</div>
        
        <div class="workspace-metrics">
          <div class="metric-row">
            <div class="metric-item">
              <span class="metric-label">Events:</span>
              <span class="metric-value">${workspace.events || 0}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Files:</span>
              <span class="metric-value">${workspace.files || 0}</span>
            </div>
          </div>
          
          <div class="metric-row">
            <div class="metric-item">
              <span class="metric-label">Sessions:</span>
              <span class="metric-value">${workspace.sessions || 0}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">AI Interactions:</span>
              <span class="metric-value">${workspace.aiInteractions || 0}</span>
            </div>
          </div>
          
          ${workspace.bytesChanged ? `
            <div class="metric-row">
              <div class="metric-item">
                <span class="metric-label">Bytes Changed:</span>
                <span class="metric-value">${this.formatBytes(workspace.bytesChanged)}</span>
              </div>
            </div>
          ` : ''}
          
          ${workspace.complexity && workspace.complexity.total > 0 ? `
            <div class="metric-row">
              <div class="metric-item">
                <span class="metric-label">Avg Complexity:</span>
                <span class="metric-value">${workspace.complexity.avg.toFixed(2)}</span>
              </div>
            </div>
          ` : ''}
          
          ${workspace.productivity ? `
            <div class="productivity-metrics">
              <div class="productivity-item">
                <span class="productivity-label">Recent Activity:</span>
                <span class="productivity-value">${workspace.productivity?.recentActivity || 0} events</span>
              </div>
              <div class="productivity-item">
                <span class="productivity-label">Active Days:</span>
                <span class="productivity-value">${workspace.productivity?.activeDays || 0}/7</span>
              </div>
              <div class="productivity-item">
                <span class="productivity-label">Consistency:</span>
                <span class="productivity-value">${((workspace.productivity?.consistency || 0) * 100).toFixed(0)}%</span>
              </div>
            </div>
          ` : ''}
          
          ${workspace.fileTypes && Object.keys(workspace.fileTypes).length > 0 ? `
            <div class="file-types">
              <div class="file-types-label">File Types:</div>
              <div class="file-types-list">
                ${Object.entries(workspace.fileTypes)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 5)
                  .map(([type, count]) => `
                    <span class="file-type-tag">${type} (${count})</span>
                  `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
        
        <div class="workspace-actions">
          <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); activityDashboard.selectWorkspace('${workspace.id}')">
            ${workspace.active ? 'Selected' : 'Select'}
          </button>
          <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); activityDashboard.toggleWorkspaceComparison('${workspace.id}')">
            ${workspace.comparing ? 'Remove from Comparison' : 'Add to Comparison'}
          </button>
        </div>
      </div>
    `;
    }).join('');
  }

  // Get last activity time for a workspace
  getLastActivityTime(workspace) {
    if (!workspace.lastActivity) return 'Unknown';
    
    const now = new Date();
    const lastActivity = new Date(workspace.lastActivity);
    const diffMs = now - lastActivity;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  // Format relative time
  formatRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  // Select workspace
  selectWorkspace(workspaceId) {
    console.log(`Selecting workspace: ${workspaceId}`);
    
    // Clear all active workspaces
    this.workspaces.forEach(ws => ws.active = false);
    
    // Find and activate the selected workspace
    const workspace = this.workspaces.find(ws => ws.id === workspaceId);
    if (workspace) {
      workspace.active = true;
      console.log(`Activated workspace: ${workspace.name}`);
      
      // Update both dropdown selectors
      const selector = document.getElementById('workspaceSelect');
      const selector2 = document.getElementById('workspaceSelector');
      
      [selector, selector2].forEach(sel => {
        if (sel) {
          sel.value = workspaceId;
          console.log(`Updated dropdown to: ${workspaceId}`);
        }
      });
      
      // Update UI components
      this.renderWorkspaceList();
      this.renderWorkspaceComparison();
      
      // Update the main feed and stats to show only this workspace's data
      this.updateStats();
      this.renderActivityFeed();
      this.updateAnalytics();
      
      // Show feedback
      this.showWorkspaceSelectionFeedback(workspace.name);
    } else {
      console.error(`Workspace not found: ${workspaceId}`);
      // Try to find by index if ID doesn't match
      const workspaceByIndex = this.workspaces.find(ws => 
        ws.id === `workspace-${this.workspaces.indexOf(ws)}` || 
        ws.id === workspaceId.replace('workspace-', '')
      );
      
      if (workspaceByIndex) {
        console.log(`Found workspace by index: ${workspaceByIndex.name}`);
        this.selectWorkspace(workspaceByIndex.id);
      }
    }
  }

  showWorkspaceSelectionFeedback(workspaceName) {
    const feedback = document.createElement('div');
    feedback.className = 'workspace-selection-feedback';
    feedback.textContent = `Showing: ${workspaceName}`;
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--color-accent);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    
    document.body.appendChild(feedback);
    
    // Fade in
    setTimeout(() => {
      feedback.style.opacity = '1';
    }, 10);
    
    // Fade out and remove
    setTimeout(() => {
      feedback.style.opacity = '0';
      setTimeout(() => {
        if (feedback.parentNode) {
          feedback.parentNode.removeChild(feedback);
        }
      }, 300);
    }, 2000);
  }

  // Get currently active workspace
  getActiveWorkspace() {
    return this.workspaces.find(ws => ws.active);
  }

  // Parse event details from JSON
  parseEventDetails(event) {
    try {
      if (event.details && typeof event.details === 'string') {
        return JSON.parse(event.details);
      }
      return event.details || {};
    } catch (e) {
      return {};
    }
  }

  // Check if an event matches a workspace
  eventMatchesWorkspace(event, workspace) {
    // Helper function to check if a path belongs to the workspace
    const pathBelongsToWorkspace = (filePath, workspacePath) => {
      if (!filePath || !workspacePath) return false;
      
      // Exact match
      if (filePath === workspacePath) return true;
      
      // Ensure workspace path ends with / for proper prefix matching
      const normalizedWorkspacePath = workspacePath.endsWith('/') 
        ? workspacePath 
        : workspacePath + '/';
      
      // Check if file path starts with workspace path followed by /
      return filePath.startsWith(normalizedWorkspacePath);
    };
    
    // Direct workspace_path match
    if (event.workspace_path && pathBelongsToWorkspace(event.workspace_path, workspace.path)) return true;
    if (event.workspace_path === workspace.path) return true;
    
    // File path check
    if (event.file_path && pathBelongsToWorkspace(event.file_path, workspace.path)) return true;
    
    // Parse details and check file_path
    const details = this.parseEventDetails(event);
    if (details.file_path && pathBelongsToWorkspace(details.file_path, workspace.path)) return true;
    
    return false;
  }

  // Get events filtered ONLY by workspace (not by type filters)
  // Used for stats and analytics where we want all event types
  getWorkspaceFilteredEvents() {
    const activeWorkspace = this.getActiveWorkspace();
    if (!activeWorkspace) {
      return this.events || [];
    }

    return (this.events || []).filter(event => 
      this.eventMatchesWorkspace(event, activeWorkspace)
    );
  }

  // Get filtered entries based on active workspace
  getFilteredEntries() {
    const activeWorkspace = this.getActiveWorkspace();
    if (!activeWorkspace) {
      return this.entries || [];
    }

    return (this.entries || []).filter(entry => 
      this.eventMatchesWorkspace(entry, activeWorkspace)
    );
  }

  // Toggle workspace comparison
  toggleWorkspaceComparison(workspaceId) {
    const workspace = this.workspaces.find(ws => ws.id === workspaceId);
    if (workspace) {
      workspace.comparing = !workspace.comparing;
      this.renderWorkspaceList();
      this.renderWorkspaceComparison();
    }
  }

  // Select workspace for comparison
  selectWorkspaceForComparison(slot, workspaceId) {
    console.log(`Selecting workspace ${workspaceId} for slot ${slot}`);
    
    // Clear any existing workspace in this slot
    const existingInSlot = this.workspaces.find(ws => ws.comparisonSlot === slot);
    if (existingInSlot) {
      existingInSlot.comparing = false;
      existingInSlot.comparisonSlot = null;
    }
    
    // If no workspace selected, just clear the slot
    if (!workspaceId) {
      this.renderWorkspaceComparison();
      return;
    }
    
    // Find the selected workspace
    const workspace = this.workspaces.find(ws => ws.id === workspaceId);
    if (!workspace) {
      console.error('Workspace not found:', workspaceId);
      return;
    }
    
    // Check if workspace is already in another slot
    if (workspace.comparing && workspace.comparisonSlot !== slot) {
      // Remove from previous slot
      workspace.comparing = false;
      workspace.comparisonSlot = null;
    }
    
    // Add to new slot
    workspace.comparing = true;
    workspace.comparisonSlot = slot;
    
    console.log(`Workspace ${workspace.name} added to slot ${slot}`);
    this.renderWorkspaceComparison();
    this.showComparisonFeedback(workspace.name, slot);
  }
  
  // Remove workspace from comparison
  removeWorkspaceFromComparison(workspaceId) {
    const workspace = this.workspaces.find(ws => ws.id === workspaceId);
    if (workspace) {
      workspace.comparing = false;
      workspace.comparisonSlot = null;
      this.renderWorkspaceComparison();
      console.log(`Workspace ${workspace.name} removed from comparison`);
    }
  }
  
  // Clear all comparisons
  clearAllComparisons() {
    this.workspaces.forEach(ws => {
      ws.comparing = false;
      ws.comparisonSlot = null;
    });
    this.renderWorkspaceComparison();
    console.log('All workspace comparisons cleared');
  }
  
  // Show comparison feedback
  showComparisonFeedback(workspaceName, slot) {
    const feedback = document.createElement('div');
    feedback.className = 'comparison-feedback';
    feedback.innerHTML = `
      <div class="feedback-content">
        <span class="feedback-icon">✅</span>
        <span class="feedback-text">${workspaceName} added to Workspace ${slot}</span>
      </div>
    `;
    
    // Add to page
    document.body.appendChild(feedback);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.parentNode.removeChild(feedback);
      }
    }, 3000);
  }

  // Show add workspace modal
  showAddWorkspaceModal() {
    const availableWorkspaces = this.workspaces.filter(ws => !ws.comparing);
    
    if (availableWorkspaces.length === 0) {
      alert('No more workspaces available to add.');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'workspace-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Add Workspace to Comparison</h3>
          <button class="modal-close" onclick="this.closest('.workspace-modal').remove()">×</button>
        </div>
        <div class="modal-body">
          <p>Select a workspace to add to the comparison:</p>
          <div class="workspace-options">
            ${availableWorkspaces.map(ws => `
              <div class="workspace-option" onclick="activityDashboard.addWorkspaceToComparison('${ws.id}'); this.closest('.workspace-modal').remove();">
                <div class="workspace-option-name">${ws.name}</div>
                <div class="workspace-option-path">${ws.path}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  // Add workspace to comparison
  addWorkspaceToComparison(workspaceId) {
    const workspace = this.workspaces.find(ws => ws.id === workspaceId);
    if (workspace) {
      workspace.comparing = true;
      this.renderWorkspaceList();
      this.renderWorkspaceComparison();
    }
  }

  // Show workspace detail modal
  showWorkspaceDetail(workspaceId, event) {
    // Stop propagation if event is from a button
    if (event && event.target.tagName === 'BUTTON') {
      return;
    }
    
    const workspace = this.workspaces.find(ws => ws.id === workspaceId);
    if (!workspace) return;
    
    // Get workspace-specific events for detailed analysis
    const workspaceEvents = (this.events || []).filter(event => 
      this.eventMatchesWorkspace(event, workspace)
    );
    
    // Calculate additional statistics
    const totalFiles = new Set(workspaceEvents.map(e => {
      if (e.file_path) return e.file_path;
      const details = this.parseEventDetails(e);
      return details?.file_path;
    }).filter(Boolean)).size;
    
    const totalSessions = new Set(workspaceEvents.map(e => e.session_id)).size;
    const aiInteractions = workspaceEvents.filter(e => e.type === 'prompt_response').length;
    const codeChanges = workspaceEvents.filter(e => e.type === 'file_change' || e.type === 'code_change').length;
    
    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentEvents = workspaceEvents.filter(e => {
      const eventDate = new Date(e.timestamp);
      return eventDate >= sevenDaysAgo;
    });
    
    const modal = document.createElement('div');
    modal.className = 'workspace-modal';
    modal.innerHTML = `
      <div class="modal-content workspace-detail-modal">
        <div class="modal-header">
          <div>
            <h3>${workspace.name}</h3>
            <div class="workspace-path-detail">${workspace.path}</div>
          </div>
          <button class="modal-close" onclick="this.closest('.workspace-modal').remove()">×</button>
        </div>
        <div class="modal-body">
          <div class="workspace-detail-section">
            <h4>Overview</h4>
            <div class="detail-metrics-grid">
              <div class="detail-metric">
                <div class="detail-metric-label">Total Events</div>
                <div class="detail-metric-value">${workspaceEvents.length}</div>
              </div>
              <div class="detail-metric">
                <div class="detail-metric-label">Files Modified</div>
                <div class="detail-metric-value">${totalFiles}</div>
              </div>
              <div class="detail-metric">
                <div class="detail-metric-label">Sessions</div>
                <div class="detail-metric-value">${totalSessions}</div>
              </div>
              <div class="detail-metric">
                <div class="detail-metric-label">AI Interactions</div>
                <div class="detail-metric-value">${aiInteractions}</div>
              </div>
              <div class="detail-metric">
                <div class="detail-metric-label">Code Changes</div>
                <div class="detail-metric-value">${codeChanges}</div>
              </div>
              ${workspace.bytesChanged ? `
                <div class="detail-metric">
                  <div class="detail-metric-label">Bytes Changed</div>
                  <div class="detail-metric-value">${this.formatBytes(workspace.bytesChanged)}</div>
                </div>
              ` : ''}
            </div>
          </div>
          
          ${workspace.fileTypes && Object.keys(workspace.fileTypes).length > 0 ? `
            <div class="workspace-detail-section">
              <h4>File Types</h4>
              <div class="file-types-detail">
                ${Object.entries(workspace.fileTypes)
                  .sort(([,a], [,b]) => b - a)
                  .map(([type, count]) => `
                    <div class="file-type-detail-item">
                      <span class="file-type-name">${type}</span>
                      <span class="file-type-count">${count} files</span>
                      <div class="file-type-bar">
                        <div class="file-type-bar-fill" style="width: ${(count / Math.max(...Object.values(workspace.fileTypes))) * 100}%"></div>
                      </div>
                    </div>
                  `).join('')}
              </div>
            </div>
          ` : ''}
          
          <div class="workspace-detail-section">
            <h4>Recent Activity (Last 7 Days)</h4>
            <div class="recent-activity-summary">
              <div class="activity-stat">
                <span class="activity-stat-label">Events:</span>
                <span class="activity-stat-value">${recentEvents.length}</span>
              </div>
              <div class="activity-stat">
                <span class="activity-stat-label">Avg per day:</span>
                <span class="activity-stat-value">${(recentEvents.length / 7).toFixed(1)}</span>
              </div>
            </div>
          </div>
          
          ${workspace.productivity ? `
            <div class="workspace-detail-section">
              <h4>Productivity Metrics</h4>
              <div class="productivity-detail-grid">
                <div class="productivity-detail-item">
                  <span class="productivity-label">Recent Activity:</span>
                  <span class="productivity-value">${workspace.productivity?.recentActivity || 0} events</span>
                </div>
                <div class="productivity-detail-item">
                  <span class="productivity-label">Active Days (Last Week):</span>
                  <span class="productivity-value">${workspace.productivity?.activeDays || 0}/7 days</span>
                </div>
                <div class="productivity-detail-item">
                  <span class="productivity-label">Consistency Score:</span>
                  <span class="productivity-value">${((workspace.productivity?.consistency || 0) * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          ` : ''}
          
          ${workspace.lastActivity ? `
            <div class="workspace-detail-section">
              <h4>Last Activity</h4>
              <p>${this.formatRelativeTime(workspace.lastActivity)}</p>
            </div>
          ` : ''}
          
          <div class="workspace-detail-actions">
            <button class="btn btn-primary" onclick="event.stopPropagation(); activityDashboard.selectWorkspace('${workspace.id}'); this.closest('.workspace-modal').remove();">
              ${workspace.active ? 'Currently Selected' : 'Select This Workspace'}
            </button>
            <button class="btn btn-secondary" onclick="event.stopPropagation(); activityDashboard.toggleWorkspaceComparison('${workspace.id}'); this.closest('.workspace-modal').remove();">
              ${workspace.comparing ? 'Remove from Comparison' : 'Add to Comparison'}
            </button>
            <button class="btn btn-outline" onclick="this.closest('.workspace-modal').remove();">
              Close
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
    
    document.body.appendChild(modal);
  }

  renderWorkspaceComparison() {
    const container = document.getElementById('workspaceComparison');
    const comparingWorkspaces = this.workspaces.filter(ws => ws.comparing);
    const availableWorkspaces = this.workspaces.filter(ws => !ws.comparing);
    
    container.innerHTML = `
      <div class="workspace-comparison">
        <div class="comparison-header">
          <h4>Workspace Comparison</h4>
          <div class="comparison-controls">
            <div class="workspace-selector-group">
              <label for="workspace1Select">Workspace 1:</label>
              <select id="workspace1Select" onchange="activityDashboard.selectWorkspaceForComparison(1, this.value)">
                <option value="">Select workspace...</option>
                ${this.workspaces.map(ws => `
                  <option value="${ws.id}" ${ws.comparing && ws.comparisonSlot === 1 ? 'selected' : ''}>
                    ${ws.name} (${ws.events || 0} events)
                  </option>
                `).join('')}
              </select>
            </div>
            
            <div class="workspace-selector-group">
              <label for="workspace2Select">Workspace 2:</label>
              <select id="workspace2Select" onchange="activityDashboard.selectWorkspaceForComparison(2, this.value)">
                <option value="">Select workspace...</option>
                ${this.workspaces.map(ws => `
                  <option value="${ws.id}" ${ws.comparing && ws.comparisonSlot === 2 ? 'selected' : ''}>
                    ${ws.name} (${ws.events || 0} events)
                  </option>
                `).join('')}
              </select>
            </div>
            
            <div class="workspace-selector-group">
              <label for="workspace3Select">Workspace 3 (Optional):</label>
              <select id="workspace3Select" onchange="activityDashboard.selectWorkspaceForComparison(3, this.value)">
                <option value="">Select workspace...</option>
                ${this.workspaces.map(ws => `
                  <option value="${ws.id}" ${ws.comparing && ws.comparisonSlot === 3 ? 'selected' : ''}>
                    ${ws.name} (${ws.events || 0} events)
                  </option>
                `).join('')}
              </select>
            </div>
            
            <button class="btn btn-secondary btn-small" onclick="activityDashboard.clearAllComparisons()" title="Clear all comparisons">
              <span class="btn-icon">X</span> Clear All
              </button>
          </div>
        </div>
        
        ${comparingWorkspaces.length === 0 ? `
          <div class="no-comparison">
            <div class="no-comparison-content">
              <div class="no-comparison-icon">D</div>
              <h5>No Workspaces Selected</h5>
              <p>Use the dropdowns above to select workspaces for comparison</p>
              <div class="comparison-help">
                <p><strong>How to compare:</strong></p>
                <ul>
                  <li>Select <strong>Workspace 1</strong> and <strong>Workspace 2</strong> (required)</li>
                  <li>Optionally select <strong>Workspace 3</strong> for three-way comparison</li>
                  <li>View side-by-side metrics and activity</li>
                </ul>
              </div>
            </div>
          </div>
        ` : `
          <div class="comparison-grid ${comparingWorkspaces.length === 3 ? 'three-column' : 'two-column'}">
            ${comparingWorkspaces.sort((a, b) => (a.comparisonSlot || 0) - (b.comparisonSlot || 0)).map(ws => `
              <div class="comparison-card workspace-${ws.comparisonSlot || 1}">
                <div class="comparison-card-header">
                  <div class="workspace-slot-indicator">Workspace ${ws.comparisonSlot || 1}</div>
                  <h5>${ws.name}</h5>
                  <button class="btn btn-small btn-danger" onclick="activityDashboard.removeWorkspaceFromComparison('${ws.id}')" title="Remove from comparison">
                    ×
                  </button>
                </div>
                
                <div class="comparison-metrics">
                  <div class="comparison-metric">
                    <span class="metric-label">Events:</span>
                    <span class="metric-value">${ws.events || 0}</span>
                  </div>
                  <div class="comparison-metric">
                    <span class="metric-label">Files:</span>
                    <span class="metric-value">${ws.files || 0}</span>
                  </div>
                  <div class="comparison-metric">
                    <span class="metric-label">Sessions:</span>
                    <span class="metric-value">${ws.sessions || 0}</span>
                  </div>
                  <div class="comparison-metric">
                    <span class="metric-label">AI Interactions:</span>
                    <span class="metric-value">${ws.aiInteractions || 0}</span>
                  </div>
                  ${ws.bytesChanged ? `
                    <div class="comparison-metric">
                      <span class="metric-label">Bytes Changed:</span>
                      <span class="metric-value">${this.formatBytes(ws.bytesChanged)}</span>
                    </div>
                  ` : ''}
                  ${ws.complexity && ws.complexity.total > 0 ? `
                    <div class="comparison-metric">
                      <span class="metric-label">Avg Complexity:</span>
                      <span class="metric-value">${ws.complexity.avg.toFixed(2)}</span>
                    </div>
                  ` : ''}
                  ${ws.productivity ? `
                    <div class="comparison-metric">
                      <span class="metric-label">Recent Activity:</span>
                      <span class="metric-value">${ws.productivity.recentActivity}</span>
                    </div>
                    <div class="comparison-metric">
                      <span class="metric-label">Consistency:</span>
                      <span class="metric-value">${((ws.productivity?.consistency || 0) * 100).toFixed(0)}%</span>
                    </div>
                  ` : ''}
                </div>
              </div>
            `).join('')}
            
            ${availableWorkspaces.length > 0 ? `
              <div class="add-workspace-card" onclick="activityDashboard.showAddWorkspaceModal()">
                <div class="add-workspace-content">
                  <div class="add-icon">+</div>
                  <div class="add-text">Add Workspace</div>
                </div>
              </div>
            ` : ''}
          </div>
          
          ${comparingWorkspaces.length > 1 ? `
            <div class="comparison-summary">
              <h5>Summary</h5>
              <div class="summary-stats">
                <div class="summary-stat">
                  <span class="summary-label">Total Events:</span>
                  <span class="summary-value">${comparingWorkspaces.reduce((sum, ws) => sum + (ws.events || 0), 0)}</span>
                </div>
                <div class="summary-stat">
                  <span class="summary-label">Total Files:</span>
                  <span class="summary-value">${comparingWorkspaces.reduce((sum, ws) => sum + (ws.files || 0), 0)}</span>
                </div>
                <div class="summary-stat">
                  <span class="summary-label">Total AI Interactions:</span>
                  <span class="summary-value">${comparingWorkspaces.reduce((sum, ws) => sum + (ws.aiInteractions || 0), 0)}</span>
                </div>
              </div>
            </div>
          ` : ''}
        `}
      </div>
    `;
  }

  // Duplicate selectWorkspace function removed - using the main one above

  addWorkspace() {
    const name = prompt('Enter workspace name:');
    if (name) {
      this.workspaces.push({
        id: 'new-workspace',
        name: name,
        path: '/Users/hamidaho/Desktop/new-workspace',
        events: 0,
        files: 0,
        sessions: 0,
        aiInteractions: 0
      });
      this.renderWorkspaceList();
    }
  }

  // Analysis Helper Methods
  analyzeCodePatterns() {
    // Analyze actual code patterns from file changes (use workspace filtering only, not type filtering)
    const activeWorkspace = this.getActiveWorkspace();
    let filteredEvents = this.events || [];
    
    if (activeWorkspace) {
      filteredEvents = filteredEvents.filter(event => 
        this.eventMatchesWorkspace(event, activeWorkspace)
      );
    }
    
    const codeEvents = filteredEvents.filter(e => e.type === 'code_change' || e.type === 'file_change');
    const patterns = {};
    
    codeEvents.forEach(event => {
      try {
        const details = JSON.parse(event.details || '{}');
        const content = details.content || details.before_content || '';
        if (content) {
          // Simple pattern detection
          const matches = content.match(/\b(function|class|import|export|const|let|var|async|await|return|if|for|while)\b/g);
          if (matches) {
            matches.forEach(pattern => {
              patterns[pattern] = (patterns[pattern] || 0) + 1;
            });
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });
    
    return Object.entries(patterns)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([pattern]) => pattern);
  }

  // Enhanced prompt analysis methods (using PromptAnalyticsEngine)

  categorizePrompts(promptEvents) {
    const categories = {
      'Code Generation': 0,
      'Debugging': 0,
      'Refactoring': 0,
      'Documentation': 0,
      'Testing': 0,
      'Architecture': 0,
      'General': 0
    };
    
    promptEvents.forEach(event => {
      try {
        const details = JSON.parse(event.details || '{}');
        const prompt = details.prompt || details.user_prompt || '';
        const category = this.categorizePrompt(prompt);
        categories[category]++;
      } catch (e) {
        categories['General']++;
      }
    });
    
    return Object.entries(categories)
      .filter(([, count]) => count > 0)
      .sort(([,a], [,b]) => b - a);
  }

  categorizePrompt(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('generate') || lowerPrompt.includes('create') || lowerPrompt.includes('write')) {
      return 'Code Generation';
    } else if (lowerPrompt.includes('debug') || lowerPrompt.includes('error') || lowerPrompt.includes('fix')) {
      return 'Debugging';
    } else if (lowerPrompt.includes('refactor') || lowerPrompt.includes('optimize') || lowerPrompt.includes('improve')) {
      return 'Refactoring';
    } else if (lowerPrompt.includes('document') || lowerPrompt.includes('comment') || lowerPrompt.includes('explain')) {
      return 'Documentation';
    } else if (lowerPrompt.includes('test') || lowerPrompt.includes('unit') || lowerPrompt.includes('spec')) {
      return 'Testing';
    } else if (lowerPrompt.includes('architecture') || lowerPrompt.includes('design') || lowerPrompt.includes('structure')) {
      return 'Architecture';
    } else {
      return 'General';
    }
  }

  analyzePromptComplexity(promptEvents) {
    const complexities = promptEvents.map(event => {
      try {
        const details = JSON.parse(event.details || '{}');
        const prompt = details.prompt || details.user_prompt || '';
        return this.calculatePromptComplexity(prompt);
      } catch (e) {
        return 0;
      }
    });
    
    return {
      average: complexities.reduce((sum, c) => sum + c, 0) / complexities.length,
      max: Math.max(...complexities),
      min: Math.min(...complexities),
      distribution: this.calculateComplexityDistribution(complexities)
    };
  }

  calculatePromptComplexity(prompt) {
    const words = prompt.split(/\s+/).length;
    const sentences = prompt.split(/[.!?]+/).length;
    const questions = (prompt.match(/\?/g) || []).length;
    const codeBlocks = (prompt.match(/```/g) || []).length / 2;
    const technicalTerms = (prompt.match(/\b(function|class|import|export|async|await|promise|api|database|server|client)\b/gi) || []).length;
    
    return (words * 0.1) + (sentences * 0.5) + (questions * 1) + (codeBlocks * 2) + (technicalTerms * 0.5);
  }

  calculateComplexityDistribution(complexities) {
    const ranges = [
      { label: 'Simple', min: 0, max: 5, count: 0 },
      { label: 'Medium', min: 5, max: 15, count: 0 },
      { label: 'Complex', min: 15, max: 30, count: 0 },
      { label: 'Very Complex', min: 30, max: Infinity, count: 0 }
    ];
    
    complexities.forEach(complexity => {
      const range = ranges.find(r => complexity >= r.min && complexity < r.max);
      if (range) range.count++;
    });
    
    return ranges.filter(r => r.count > 0);
  }

  analyzePromptPatterns(promptEvents) {
    const patterns = {};
    
    promptEvents.forEach(event => {
      try {
        const details = JSON.parse(event.details || '{}');
        const prompt = details.prompt || details.user_prompt || '';
        
        // Extract common prompt patterns
        const patterns_found = this.extractPromptPatterns(prompt);
        patterns_found.forEach(pattern => {
          patterns[pattern] = (patterns[pattern] || 0) + 1;
        });
      } catch (e) {
        // Skip invalid JSON
      }
    });
    
    return Object.entries(patterns)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([pattern, count]) => ({ pattern, count }));
  }

  extractPromptPatterns(prompt) {
    const patterns = [];
    
    // Common prompt starters
    if (prompt.match(/^(can you|please|how do|what is|explain|help me|i need|i want)/i)) {
      patterns.push('Question/Request');
    }
    
    if (prompt.match(/^(add|create|implement|fix|update|modify|change|remove|delete)/i)) {
      patterns.push('Action Request');
    }
    
    if (prompt.match(/^(show me|give me|find|search|look for)/i)) {
      patterns.push('Information Request');
    }
    
    if (prompt.match(/^(write|generate|make|build|develop)/i)) {
      patterns.push('Generation Request');
    }
    
    if (prompt.includes('```')) {
      patterns.push('Code Context');
    }
    
    if (prompt.match(/\?$/)) {
      patterns.push('Question Format');
    }
    
    return patterns;
  }

  analyzeResponseQuality(promptEvents) {
    const qualityMetrics = promptEvents.map(event => {
      try {
        const details = JSON.parse(event.details || '{}');
        const response = details.response || '';
        return this.calculateResponseQuality(response);
      } catch (e) {
        return { length: 0, codeBlocks: 0, explanations: 0, examples: 0 };
      }
    });
    
    return {
      averageLength: qualityMetrics.reduce((sum, m) => sum + m.length, 0) / qualityMetrics.length,
      averageCodeBlocks: qualityMetrics.reduce((sum, m) => sum + m.codeBlocks, 0) / qualityMetrics.length,
      averageExplanations: qualityMetrics.reduce((sum, m) => sum + m.explanations, 0) / qualityMetrics.length,
      averageExamples: qualityMetrics.reduce((sum, m) => sum + m.examples, 0) / qualityMetrics.length
    };
  }

  calculateResponseQuality(response) {
    const length = response.length;
    const codeBlocks = (response.match(/```/g) || []).length / 2;
    const explanations = (response.match(/\b(explains?|because|since|therefore|thus|hence)\b/gi) || []).length;
    const examples = (response.match(/\b(example|for instance|such as|like)\b/gi) || []).length;
    
    return { length, codeBlocks, explanations, examples };
  }

  generatePromptTimeline(promptEvents) {
    return promptEvents
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map(event => {
        try {
          const details = JSON.parse(event.details || '{}');
          return {
            timestamp: event.timestamp,
            prompt: details.prompt || details.user_prompt || '',
            response: details.response || '',
            filePath: details.file_path || '',
            sessionPhase: details.session_phase || '',
            developmentPhase: details.development_phase || ''
          };
        } catch (e) {
          return {
            timestamp: event.timestamp,
            prompt: '',
            response: '',
            filePath: '',
            sessionPhase: '',
            developmentPhase: ''
          };
        }
      });
  }

  generateFileHeatmap() {
    // Generate real file activity heatmap based on actual events
    const activeWorkspace = this.getActiveWorkspace();
    let filteredEvents = this.events || [];
    
    if (activeWorkspace) {
      filteredEvents = filteredEvents.filter(event => 
        this.eventMatchesWorkspace(event, activeWorkspace)
      );
    }
    
    const fileActivity = {};
    
    // Process all events, not just specific types
    filteredEvents.forEach(event => {
      try {
        // Try to get file path from different possible locations
        let filePath = null;
        
        // Check if details contains file_path
        if (event.details) {
          const details = JSON.parse(event.details || '{}');
          filePath = details.file_path;
        }
        
        // Fallback to event.file_path if available
        if (!filePath && event.file_path) {
          filePath = event.file_path;
        }
        
        if (filePath) {
          const fileName = filePath.split('/').pop(); // Get just the filename
          if (fileName && fileName !== 'undefined') {
            fileActivity[fileName] = (fileActivity[fileName] || 0) + 1;
          }
        }
      } catch (e) {
        // Skip invalid JSON or events
        console.log('Skipping invalid event:', event);
      }
    });
    
    // Convert to heatmap format (top 10 files)
    const sortedFiles = Object.entries(fileActivity)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10); // Limit to top 10 files
    
    if (sortedFiles.length === 0) {
      return [];
    }
    
    const maxActivity = Math.max(...sortedFiles.map(([,count]) => count));
    
    return sortedFiles.map(([fileName, count]) => ({
      name: fileName,
      activity: maxActivity > 0 ? count / maxActivity : 0, // Normalize to 0-1
      count: count
    }));
  }

  generateSessionTimeline() {
    // Get session events and other significant events (use workspace filtering only, not type filtering)
    const activeWorkspace = this.getActiveWorkspace();
    let allEvents = this.events || [];
    
    // Apply workspace filtering if needed
    if (activeWorkspace) {
      allEvents = allEvents.filter(event => 
        this.eventMatchesWorkspace(event, activeWorkspace)
      );
    }
    
    const sessionEvents = allEvents.filter(e => e.type === 'session_event');
    const significantEvents = allEvents.filter(e => 
      e.type === 'code_change' || e.type === 'prompt_response' || e.type === 'file_change'
    );
    
    // Combine and sort by timestamp
    const timelineEvents = [...sessionEvents, ...significantEvents]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      ;
    
    console.log('Session timeline:', {
      totalEvents: this.events?.length || 0,
      workspaceFiltered: allEvents.length,
      sessionEvents: sessionEvents.length,
      significantEvents: significantEvents.length,
      timelineEvents: timelineEvents.length
    });
    
    return timelineEvents.map(event => {
      let content = '';
      let active = false;
      
      try {
        const details = JSON.parse(event.details || '{}');
        switch (event.type) {
          case 'session_event':
            content = `Session: ${details.session_phase || 'Activity'}`;
            active = details.session_phase === 'active' || details.session_phase === 'start';
            break;
          case 'code_change':
          case 'file_change':
            const filePath = details.file_path || 'Unknown file';
            const fileName = filePath.split('/').pop() || filePath; // Get just the filename
            
            // Parse diff_summary for better formatting
            let diffInfo = '';
            const diffSummary = details.diff_summary || '';
            if (diffSummary) {
              const charsMatch = diffSummary.match(/([+-])(\d+)\s*chars?/);
              if (charsMatch) {
                const sign = charsMatch[1];
                const chars = charsMatch[2];
                diffInfo = ` (${sign}${chars} chars)`;
              }
            }
            
            content = `E ${fileName}${diffInfo}`;
            active = true;
            break;
          case 'prompt_response':
            const prompt = details.prompt || details.user_prompt || '';
            content = `💬 ${prompt.substring(0, 40)}${prompt.length > 40 ? '...' : ''}`;
            active = true;
            break;
          default:
            const defaultPath = details.file_path || 'Activity';
            const defaultFileName = defaultPath.split('/').pop() || defaultPath;
            content = `${event.type.replace('_', ' ')}: ${defaultFileName}`;
        }
      } catch (e) {
        content = `${event.type.replace('_', ' ')}: Activity`;
      }
      
      return {
        time: new Date(event.timestamp).toLocaleTimeString(),
        content,
        active
      };
    });
  }

  analyzeLanguageDistribution() {
    // Use workspace filtering only, not type filtering
    const activeWorkspace = this.getActiveWorkspace();
    let filteredEvents = this.events || [];
    
    if (activeWorkspace) {
      filteredEvents = filteredEvents.filter(event => 
        this.eventMatchesWorkspace(event, activeWorkspace)
      );
    }
    
    const languages = {};
    filteredEvents.forEach(event => {
      try {
        const details = JSON.parse(event.details || '{}');
        const filePath = details.file_path || event.filePath;
        if (filePath) {
          const ext = filePath.split('.').pop();
          if (ext && ext.length < 10) { // Filter out very long extensions
            languages[ext] = (languages[ext] || 0) + 1;
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });
    return languages;
  }

  createMockEmbeddings() {
    return Array(20).fill().map((_, i) => ({
      file: `file${i}.js`,
      similarity: Math.random(),
      vector: Array(10).fill().map(() => Math.random())
    }));
  }

  createMockTFIDF() {
    const terms = ['function', 'class', 'import', 'export', 'const', 'let', 'var', 'async', 'await', 'return'];
    return terms.map(term => ({
      term,
      score: Math.random(),
      frequency: Math.floor(Math.random() * 100)
    })).sort((a, b) => b.score - a.score);
  }

  // Calculate similarity matrix between files
  calculateSimilarityMatrix() {
    const similarityMatrix = [];
    const files = this.getFileData();
    
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const similarity = this.calculateCosineSimilarity(
          this.getFileEmbedding(files[i]),
          this.getFileEmbedding(files[j])
        );
        
        if (similarity > 0.1) { // Only include meaningful similarities
          similarityMatrix.push({
            file1: files[i].name,
            file2: files[j].name,
            similarity: similarity,
            index1: i,
            index2: j
          });
        }
      }
    }
    
    return similarityMatrix.sort((a, b) => b.similarity - a.similarity);
  }

  // Calculate cosine similarity between two vectors
  calculateCosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    if (norm1 === 0 || norm2 === 0) return 0;
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  // Get file data from events
  getFileData() {
    const fileMap = new Map();
    
    this.events.forEach(event => {
      try {
        const details = JSON.parse(event.details || '{}');
        const filePath = details.file_path || event.file_path;
        
        // Only process events with file paths and content
        if (!filePath) return;
        
        const fileName = filePath.split('/').pop() || 'unknown';
        const content = details.content || details.before_content || details.after_content || '';
        
        // Skip if no meaningful content
        if (!content) return;
        
        if (!fileMap.has(fileName)) {
          fileMap.set(fileName, {
            name: fileName,
            path: filePath,
            eventCount: 0,
            lastModified: new Date(event.timestamp),
            text: content,
            fileType: this.getFileType(fileName)
          });
        } else {
          // Update with latest content and increment count
          const existing = fileMap.get(fileName);
          existing.eventCount++;
          existing.lastModified = new Date(event.timestamp);
          if (content) {
            existing.text = content; // Use latest content
          }
        }
      } catch (e) {
        // Skip invalid events
      }
    });
    
    console.log(`[getFileData] Extracted ${fileMap.size} files from ${this.events.length} events`);
    return Array.from(fileMap.values());
  }

  // Get file type from extension
  getFileType(fileName) {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    const typeMap = {
      'js': 'JavaScript',
      'ts': 'TypeScript', 
      'py': 'Python',
      'html': 'HTML',
      'css': 'CSS',
      'json': 'JSON',
      'md': 'Markdown',
      'txt': 'Text'
    };
    return typeMap[extension] || 'Other';
  }

  // Get file type color
  getFileTypeColor(fileName) {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    const colorMap = {
      'js': '#000000',      // Black
      'ts': '#333333',      // Dark gray  
      'py': '#444444',      // Medium-dark gray
      'html': '#555555',    // Medium gray
      'css': '#666666',     // Mid gray
      'json': '#777777',    // Light-mid gray
      'md': '#888888'       // Light gray
    };
    return colorMap[extension] || '#6b7280';
  }

  // Get embedding for a file (mock implementation)
  getFileEmbedding(file) {
    // Create a mock embedding based on file content
    const text = file.text.toLowerCase();
    const embedding = new Array(50).fill(0);
    
    // Simple word-based embedding
    const words = text.split(/\s+/);
    words.forEach(word => {
      const hash = this.simpleHash(word) % 50;
      embedding[hash] += 1;
    });
    
    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      return embedding.map(val => val / norm);
    }
    
    return embedding;
  }

  // Simple hash function
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  // File Graph Methods
  generateFileGraph() {
    const container = document.getElementById('fileGraph');
    const vizMode = document.getElementById('vizMode').value;
    
    container.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <div class="loading-text">Analyzing file relationships...</div>
      </div>
    `;
    
    setTimeout(() => {
      // Build file graph using semantic engine
      this.fileGraph = this.semanticEngine.buildFileRelationshipGraph(
        this.events, 
        this.entries
      );
      
      console.log('D File Graph:', this.fileGraph);
      
      switch (vizMode) {
        case 'network':
          this.renderFileNetwork();
          break;
        case 'cluster':
          this.render2DClustering();
          break;
        case '3d':
          this.render3DPointCloud();
          break;
        default:
          this.renderFileGraphWithD3();
      }
    }, 500);
  }

  // Create comprehensive file network data structure
  createFileNetwork() {
    const files = this.getFileData();
    const similarityMatrix = this.similarityMatrix || this.calculateSimilarityMatrix();
    
    const nodes = files.map((file, index) => ({
      id: file.name,
      group: file.fileType,
      size: file.eventCount,
      color: this.getFileTypeColor(file.name),
      path: file.path,
      lastModified: file.lastModified,
      index: index,
      // Additional metadata
      wordCount: file.text.split(/\s+/).length,
      complexity: this.calculateComplexity(file.text),
      centrality: this.calculateCentrality(file.name, similarityMatrix)
    }));
    
    const links = similarityMatrix.map(s => ({
      source: s.file1,
      target: s.file2,
      strength: s.similarity,
      weight: s.similarity * 10,
      index1: s.index1,
      index2: s.index2
    }));
    
    return { nodes, links };
  }

  // Calculate file complexity based on content
  calculateComplexity(text) {
    const lines = text.split('\n').length;
    const words = text.split(/\s+/).length;
    const functions = (text.match(/function\s+\w+/g) || []).length;
    const classes = (text.match(/class\s+\w+/g) || []).length;
    
    return (lines * 0.1) + (words * 0.01) + (functions * 2) + (classes * 3);
  }

  // Calculate node centrality in the network
  calculateCentrality(fileName, similarityMatrix) {
    const connections = similarityMatrix.filter(s => 
      s.file1 === fileName || s.file2 === fileName
    );
    
    const totalStrength = connections.reduce((sum, conn) => 
      sum + conn.similarity, 0
    );
    
    return totalStrength / Math.max(connections.length, 1);
  }

  renderFileGraph() {
    const container = document.getElementById('fileGraph');
    const graphData = this.createFileGraphData();
    
    container.innerHTML = '';
    
    // Create file nodes
    graphData.nodes.forEach(node => {
      const nodeElement = document.createElement('div');
      nodeElement.className = `file-node ${node.central ? 'central' : ''}`;
      nodeElement.style.left = `${node.x}px`;
      nodeElement.style.top = `${node.y}px`;
      nodeElement.textContent = node.name;
      nodeElement.title = `${node.name} (${node.connections} connections)`;
      container.appendChild(nodeElement);
    });
    
    // Create connections
    graphData.connections.forEach(conn => {
      const connection = document.createElement('div');
      connection.className = `file-connection ${conn.strong ? 'strong' : ''}`;
      connection.style.left = `${conn.x1}px`;
      connection.style.top = `${conn.y1}px`;
      connection.style.width = `${conn.length}px`;
      connection.style.transform = `rotate(${conn.angle}deg)`;
      container.appendChild(connection);
    });
  }

  createFileGraphData() {
    // Extract real file data from events
    const fileActivity = {};
    this.events.forEach(event => {
      try {
        const details = JSON.parse(event.details || '{}');
        const filePath = details.file_path;
        if (filePath) {
          const fileName = filePath.split('/').pop();
          if (!fileActivity[fileName]) {
            fileActivity[fileName] = { count: 0, connections: [] };
          }
          fileActivity[fileName].count++;
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });

    const files = Object.keys(fileActivity).slice(0, 15); // Top 15 files
    const nodes = [];
    const connections = [];

    // Create nodes in a circular/force layout
    const centerX = 200;
    const centerY = 200;
    const radius = 150;

    files.forEach((fileName, index) => {
      const angle = (index / files.length) * 2 * Math.PI;
      const x = centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 50;
      const y = centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 50;
      
      nodes.push({
        name: fileName,
        x: Math.max(10, Math.min(390, x)),
        y: Math.max(10, Math.min(390, y)),
        central: index === 0,
        connections: Math.floor(Math.random() * 5) + 1
      });
    });

    // Create connections between related files
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (Math.random() < 0.3) { // 30% chance of connection
          const node1 = nodes[i];
          const node2 = nodes[j];
          const dx = node2.x - node1.x;
          const dy = node2.y - node1.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          
          connections.push({
            x1: node1.x,
            y1: node1.y,
            length: length,
            angle: angle,
            strong: Math.random() < 0.2
          });
        }
      }
    }

    return { nodes, connections };
  }

  updateGraph() {
    const layout = document.getElementById('graphLayout').value;
    const metric = document.getElementById('graphMetric').value;
    
    console.log(`Updating graph with ${layout} layout and ${metric} metric`);
    this.renderFileGraph();
  }

  analyzeSemantics() {
    console.log('Analyzing semantic relationships...');
    
    // Analyze code patterns
    this.codePatterns = this.semanticEngine.analyzeCodePatterns(
      this.events,
      this.entries
    );
    
    console.log('D Code Patterns:', this.codePatterns);
    
    // Display code patterns
    this.renderCodePatterns();
    
  }
  
  renderCodePatterns() {
    const container = document.getElementById('codePatterns');
    if (!container || !this.codePatterns) return;
    
    const totalPatterns = Object.values(this.codePatterns).reduce((sum, arr) => sum + arr.length, 0);
    
    if (totalPatterns === 0) {
      container.innerHTML = '<div class="no-data">No code patterns detected yet. Make some file changes to see patterns.</div>';
      return;
    }
    
    const patternTypes = [
      { key: 'refactoring', label: 'Refactoring', color: '#000000' },
      { key: 'bugFixes', label: 'Bug Fixes', color: '#333333' },
      { key: 'features', label: 'New Features', color: '#000000' },
      { key: 'documentation', label: 'Documentation', color: '#666666' },
      { key: 'testing', label: 'Testing', color: '#444444' },
      { key: 'configuration', label: 'Configuration', color: '#555555' }
    ];
    
    let html = '<div class="code-patterns-grid">';
    
    patternTypes.forEach(type => {
      const patterns = this.codePatterns[type.key] || [];
      if (patterns.length > 0) {
        html += `
          <div class="pattern-card" style="border-left-color: ${type.color}">
            <div class="pattern-header">
              <span class="pattern-icon">${type.icon}</span>
              <h4>${type.label}</h4>
              <span class="pattern-count">${patterns.length}</span>
            </div>
            <div class="pattern-list">
              ${patterns.slice(0, 3).map(p => `
                <div class="pattern-item">
                  <div class="pattern-file">${p.file ? p.file.split('/').pop() : 'Unknown file'}</div>
                  <div class="pattern-desc">${p.description || 'Pattern detected'}</div>
                  ${p.complexity ? `<div class="pattern-metric">Complexity: ${p.complexity}</div>` : ''}
                  ${p.linesAdded ? `<div class="pattern-metric">+${p.linesAdded} lines</div>` : ''}
                  ${p.linesChanged ? `<div class="pattern-metric">~${p.linesChanged} lines</div>` : ''}
                </div>
              `).join('')}
              ${patterns.length > 3 ? `<div class="pattern-more">+${patterns.length - 3} more</div>` : ''}
            </div>
          </div>
        `;
      }
    });
    
    html += '</div>';
    container.innerHTML = html;
  }
  
  renderFileGraphWithD3() {
    if (!this.fileGraph || this.fileGraph.nodes.size === 0) {
      document.getElementById('fileGraph').innerHTML = '<div class="no-data">No file relationships detected yet.</div>';
      return;
    }
    
    const container = document.getElementById('fileGraph');
    container.innerHTML = '';
    
    const width = container.clientWidth || 800;
    const height = 600;
    
    // Convert Map to Array for D3
    const nodes = Array.from(this.fileGraph.nodes.values());
    const edges = this.fileGraph.edges;
    
    // Create enhanced SVG with zoom and pan
    const svg = d3.select('#fileGraph')
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('background', 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)')
      .style('border-radius', '8px')
      .style('box-shadow', '0 4px 12px rgba(0,0,0,0.1)');
    
    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    
    svg.call(zoom);
    
    // Create main group for zoom/pan
    const g = svg.append('g');
    
    // Add zoom controls
    const controls = svg.append('g')
      .attr('class', 'zoom-controls')
      .attr('transform', `translate(${width - 100}, 20)`);
    
    controls.append('rect')
      .attr('width', 80)
      .attr('height', 100)
      .attr('fill', 'rgba(255,255,255,0.9)')
      .attr('stroke', '#ddd')
      .attr('rx', 4);
    
    controls.append('text')
      .attr('x', 40)
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .attr('font-size', 12)
      .attr('font-weight', 'bold')
      .text('Controls');
    
    // Zoom in button
    controls.append('rect')
      .attr('x', 10)
      .attr('y', 25)
      .attr('width', 25)
      .attr('height', 25)
      .attr('fill', '#007bff')
      .attr('rx', 3)
      .style('cursor', 'pointer')
      .on('click', () => {
        svg.transition().call(zoom.scaleBy, 1.5);
      });
    
    controls.append('text')
      .attr('x', 22.5)
      .attr('y', 40)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', 14)
      .attr('font-weight', 'bold')
      .text('+');
    
    // Zoom out button
    controls.append('rect')
      .attr('x', 45)
      .attr('y', 25)
      .attr('width', 25)
      .attr('height', 25)
      .attr('fill', '#6c757d')
      .attr('rx', 3)
      .style('cursor', 'pointer')
      .on('click', () => {
        svg.transition().call(zoom.scaleBy, 0.7);
      });
    
    controls.append('text')
      .attr('x', 57.5)
      .attr('y', 40)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', 14)
      .attr('font-weight', 'bold')
      .text('-');
    
    // Reset button
    controls.append('rect')
      .attr('x', 10)
      .attr('y', 55)
      .attr('width', 60)
      .attr('height', 20)
      .attr('fill', '#28a745')
      .attr('rx', 3)
      .style('cursor', 'pointer')
      .on('click', () => {
        svg.transition().call(zoom.transform, d3.zoomIdentity);
      });
    
    controls.append('text')
      .attr('x', 40)
      .attr('y', 68)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', 10)
      .attr('font-weight', 'bold')
      .text('Reset');
    
    // Create force simulation with enhanced physics
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges)
        .id(d => d.id)
        .distance(d => 120 / (d.weight || 1))
        .strength(d => (d.weight || 1) * 0.3)
      )
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => Math.sqrt(d.changeCount) * 4 + 20))
      .force('x', d3.forceX(width / 2).strength(0.1))
      .force('y', d3.forceY(height / 2).strength(0.1));
    
    // Enhanced edges with gradients and animations
    const defs = svg.append('defs');
    
    // Create gradient for edges
    const gradient = defs.append('linearGradient')
      .attr('id', 'edgeGradient')
      .attr('gradientUnits', 'userSpaceOnUse');
    
    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#4A90E2')
      .attr('stop-opacity', 0.8);
    
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#7B68EE')
      .attr('stop-opacity', 0.4);
    
    // Add edges with enhanced styling
    const link = g.append('g')
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('class', 'file-edge')
      .attr('stroke', d => d.type === 'import' ? 'url(#edgeGradient)' : '#95a5a6')
      .attr('stroke-width', d => Math.max(1, (d.weight || 1) * 2))
      .attr('stroke-opacity', 0.7)
      .style('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))');
    
    // Enhanced nodes with better colors and effects
    const node = g.append('g')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', d => Math.sqrt(d.changeCount) * 4 + 8)
      .attr('fill', d => this.getEnhancedFileTypeColor(d.type))
      .attr('stroke', '#fff')
      .attr('stroke-width', 3)
      .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))')
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended))
      .on('mouseover', function(event, d) {
        // Highlight connected nodes
        const connectedNodes = new Set();
        edges.forEach(edge => {
          if (edge.source.id === d.id || edge.target.id === d.id) {
            connectedNodes.add(edge.source.id);
            connectedNodes.add(edge.target.id);
          }
        });
        
        node.style('opacity', n => connectedNodes.has(n.id) ? 1 : 0.3);
        link.style('opacity', l => 
          (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.1
        );
        
        // Show tooltip
        showTooltip(event, d);
      })
      .on('mouseout', function() {
        node.style('opacity', 1);
        link.style('opacity', 0.7);
        hideTooltip();
      })
      .on('click', function(event, d) {
        // Focus on node
        svg.transition()
          .duration(750)
          .call(zoom.transform, d3.zoomIdentity
            .translate(width / 2 - d.x * 1.5, height / 2 - d.y * 1.5)
            .scale(1.5)
          );
      });
    
    // Enhanced labels with better styling
    const label = g.append('g')
      .selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .text(d => d.label)
      .attr('font-size', 11)
      .attr('font-weight', '500')
      .attr('dx', 15)
      .attr('dy', 5)
      .attr('fill', '#2c3e50')
      .style('pointer-events', 'none')
      .style('text-shadow', '1px 1px 2px rgba(255,255,255,0.8)');
    
    // Create tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'graph-tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(0,0,0,0.9)')
      .style('color', 'white')
      .style('padding', '8px 12px')
      .style('border-radius', '6px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 1000);
    
    function showTooltip(event, d) {
      tooltip.transition()
        .duration(200)
        .style('opacity', 1);
      
      tooltip.html(`
        <div style="font-weight: bold; margin-bottom: 4px;">${d.label}</div>
        <div>Changes: ${d.changeCount}</div>
        <div>Type: ${d.type}</div>
        <div>Last modified: ${new Date(d.lastModified).toLocaleString()}</div>
        <div style="margin-top: 4px; font-size: 10px; color: #ccc;">Click to focus</div>
      `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px');
    }
    
    function hideTooltip() {
      tooltip.transition()
        .duration(200)
        .style('opacity', 0);
    }
    
    // Enhanced simulation tick with smooth animations
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      
      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);
      
      label
        .attr('x', d => d.x)
        .attr('y', d => d.y);
    });
    
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  }

  // D3.js Network Visualization
  // Enhanced file network visualization
  renderFileNetwork() {
    const container = document.getElementById('fileGraph');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Create file network data
    const { nodes, links } = this.createFileNetwork();
    
    // Check if we have data to visualize
    if (nodes.length === 0) {
      container.innerHTML = '<div class="empty-state">No file data available. Start making code changes to see relationships.</div>';
      return;
    }
    
    console.log(`[renderFileNetwork] Visualizing ${nodes.length} nodes and ${links.length} links`);
    
    const width = container.offsetWidth || 600;
    const height = container.offsetHeight || 400;
    const threshold = parseFloat(document.getElementById('similarityThreshold')?.value || 0.3);
    
    // Create SVG
    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('background', 'var(--color-bg)');
    
    // Filter links by threshold
    const filteredLinks = links.filter(link => link.strength >= threshold);
    
    console.log(`[renderFileNetwork] ${filteredLinks.length} links above threshold ${threshold}`);
    
    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(filteredLinks)
        .id(d => d.id)
        .distance(d => 200 * (1 - d.strength)) // Closer for higher similarity
        .strength(d => d.strength))
      .force('charge', d3.forceManyBody()
        .strength(-500))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide()
        .radius(d => Math.sqrt(d.size) * 2 + 20));
    
    // Create links with varying thickness (only if we have links)
    const link = filteredLinks.length > 0 ? svg.append('g')
      .selectAll('line')
      .data(filteredLinks)
      .enter().append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', d => d.strength)
      .attr('stroke-width', d => Math.max(1, d.weight))
      .style('cursor', 'pointer')
      .on('mouseover', (event, d) => this.showLinkTooltip(event, d))
      .on('mouseout', () => this.hideTooltip()) : null;
    
    // Create nodes with varying sizes and colors
    const node = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));
    
    // Add circles with file type colors
    node.append('circle')
      .attr('r', d => Math.sqrt(d.size) * 2 + 5)
      .attr('fill', d => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', (event, d) => this.handleNodeClick(d, nodes, filteredLinks))
      .on('mouseover', (event, d) => this.showNodeTooltip(event, d))
      .on('mouseout', () => this.hideTooltip());
    
    // Add labels
    node.append('text')
      .text(d => d.id.substring(0, 15))
      .attr('x', 0)
      .attr('y', 0)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .style('font-size', '10px')
      .style('fill', '#333')
      .style('pointer-events', 'none');
    
    // Update positions
    simulation.on('tick', () => {
      if (link) {
        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);
      }
      
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
    
    // Store references for interaction
    this.currentNodes = nodes;
    this.currentLinks = filteredLinks;
    this.currentSimulation = simulation;
    
    // Drag functions
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  }

  // Legacy D3 network graph (kept for compatibility)
  renderD3NetworkGraph() {
    this.renderFileNetwork();
  }

  // Interactive Features
  showNodeTooltip(event, d) {
    const tooltip = d3.select('body').append('div')
      .attr('class', 'network-tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(0,0,0,0.9)')
      .style('color', 'white')
      .style('padding', '12px')
      .style('border-radius', '6px')
      .style('pointer-events', 'none')
      .style('z-index', '1000')
      .style('font-size', '12px')
      .style('max-width', '250px');
    
    tooltip.html(`
      <div style="font-weight: bold; margin-bottom: 4px;">${d.id}</div>
      <div style="margin-bottom: 2px;">Type: ${d.group}</div>
      <div style="margin-bottom: 2px;">Events: ${d.size}</div>
      <div style="margin-bottom: 2px;">Words: ${d.wordCount}</div>
      <div style="margin-bottom: 2px;">Complexity: ${d.complexity.toFixed(2)}</div>
      <div style="margin-bottom: 2px;">Centrality: ${d.centrality.toFixed(3)}</div>
      <div style="font-size: 10px; color: #ccc;">${d.path}</div>
    `);
    
    tooltip.style('left', (event.pageX + 10) + 'px')
           .style('top', (event.pageY - 10) + 'px');
  }

  showLinkTooltip(event, d) {
    const tooltip = d3.select('body').append('div')
      .attr('class', 'network-tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(0,0,0,0.9)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('pointer-events', 'none')
      .style('z-index', '1000')
      .style('font-size', '11px');
    
    tooltip.html(`
      <div style="font-weight: bold;">Similarity: ${(d.strength * 100).toFixed(1)}%</div>
      <div>${d.source} ↔ ${d.target}</div>
    `);
    
    tooltip.style('left', (event.pageX + 10) + 'px')
           .style('top', (event.pageY - 10) + 'px');
  }

  hideTooltip() {
    d3.selectAll('.network-tooltip').remove();
  }

  handleNodeClick(d, nodes, links) {
    // Find connected files
    const connectedFiles = this.findConnectedFiles(d.id, links);
    
    // Highlight connected nodes
    this.highlightConnectedNodes(d.id, connectedFiles);
    
    // Show file details
    this.showFileDetails(d);
    
    // Update network to focus on selected file
    this.focusOnFile(d.id);
  }

  findConnectedFiles(fileName, links) {
    return links
      .filter(link => link.source === fileName || link.target === fileName)
      .map(link => link.source === fileName ? link.target : link.source);
  }

  highlightConnectedNodes(selectedFile, connectedFiles) {
    // This would highlight connected nodes in the visualization
    // Implementation depends on the specific visualization library
    console.log(`Selected: ${selectedFile}, Connected: ${connectedFiles.join(', ')}`);
  }

  showFileDetails(file) {
    // Create a modal or panel to show detailed file information
    const details = `
      <div class="file-details">
        <h3>${file.id}</h3>
        <p><strong>Type:</strong> ${file.group}</p>
        <p><strong>Path:</strong> ${file.path}</p>
        <p><strong>Events:</strong> ${file.size}</p>
        <p><strong>Complexity:</strong> ${file.complexity.toFixed(2)}</p>
        <p><strong>Centrality:</strong> ${file.centrality.toFixed(3)}</p>
        <p><strong>Last Modified:</strong> ${file.lastModified.toLocaleString()}</p>
      </div>
    `;
    
    // You could show this in a modal or side panel
    console.log('File details:', details);
  }

  focusOnFile(fileName) {
    // Center the network on the selected file
    if (this.currentSimulation) {
      const node = this.currentNodes.find(n => n.id === fileName);
      if (node) {
        // Center the view on this node
        const container = document.getElementById('fileGraph');
        const svg = d3.select(container).select('svg');
        const width = svg.attr('width');
        const height = svg.attr('height');
        
        // Animate to center the node
        svg.transition()
          .duration(750)
          .call(d3.zoom().transform, d3.zoomIdentity
            .translate(width/2 - node.x, height/2 - node.y)
            .scale(1.5));
      }
    }
  }

  // 2D Clustering Visualization
  render2DClustering() {
    const container = document.getElementById('fileGraph');
    container.innerHTML = '';
    
    const width = 400;
    const height = 400;
    
    // Create SVG
    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('background', 'var(--color-bg)');
    
    // Create clustered data
    const clusterData = this.createClusterData();
    
    // Color scale for clusters
    const colorScale = d3.scaleOrdinal()
      .domain(clusterData.clusters.map(c => c.id))
      .range(['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316']);
    
    // Create clusters
    const cluster = svg.append('g')
      .selectAll('g')
      .data(clusterData.clusters)
      .enter().append('g');
    
    // Add cluster circles
    cluster.append('circle')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', d => d.radius)
      .attr('fill', d => colorScale(d.id))
      .attr('opacity', 0.2)
      .attr('stroke', d => colorScale(d.id))
      .attr('stroke-width', 2);
    
    // Add cluster labels
    cluster.append('text')
      .attr('x', d => d.x)
      .attr('y', d => d.y)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('fill', d => colorScale(d.id))
      .text(d => `Cluster ${d.id}`);
    
    // Add file points
    const points = svg.append('g')
      .selectAll('circle')
      .data(clusterData.points)
      .enter().append('circle')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', 4)
      .attr('fill', d => colorScale(d.cluster))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1);
    
    // Add file labels
    const labels = svg.append('g')
      .selectAll('text')
      .data(clusterData.points)
      .enter().append('text')
      .attr('x', d => d.x + 8)
      .attr('y', d => d.y)
      .attr('font-size', '9px')
      .attr('fill', '#374151')
      .text(d => d.name);
  }

  // 3D Point Cloud Visualization
  render3DPointCloud() {
    const container = document.getElementById('fileGraph');
    container.innerHTML = '';
    
    // Create Three.js scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 400 / 400, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    
    renderer.setSize(400, 400);
    renderer.setClearColor(0xf8fafc, 1);
    container.appendChild(renderer.domElement);
    
    // Create point cloud data
    const pointData = this.create3DPointData();
    
    // Create geometry
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const sizes = [];
    
    pointData.forEach((point, index) => {
      positions.push(point.x, point.y, point.z);
      
      // Color based on file type
      const color = this.getFileTypeColor(point.fileType);
      colors.push(color.r, color.g, color.b);
      
      // Size based on importance
      sizes.push(point.importance * 3 + 1);
    });
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    
    // Create material
    const material = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      sizeAttenuation: true
    });
    
    // Create points
    const points = new THREE.Points(geometry, material);
    scene.add(points);
    
    // Position camera
    camera.position.z = 5;
    
    // Add controls
    let mouseX = 0, mouseY = 0;
    let isMouseDown = false;
    
    container.addEventListener('mousedown', (event) => {
      isMouseDown = true;
      mouseX = event.clientX;
      mouseY = event.clientY;
    });
    
    container.addEventListener('mousemove', (event) => {
      if (isMouseDown) {
        const deltaX = event.clientX - mouseX;
        const deltaY = event.clientY - mouseY;
        
        points.rotation.y += deltaX * 0.01;
        points.rotation.x += deltaY * 0.01;
        
        mouseX = event.clientX;
        mouseY = event.clientY;
      }
    });
    
    container.addEventListener('mouseup', () => {
      isMouseDown = false;
    });
    
    // Animation loop
    function animate() {
      requestAnimationFrame(animate);
      points.rotation.y += 0.001;
      renderer.render(scene, camera);
    }
    
    animate();
  }

  // Helper methods for data creation
  createD3GraphData(threshold) {
    const fileActivity = this.extractFileActivity();
    const files = Object.keys(fileActivity).slice(0, 20);
    
    const nodes = files.map((fileName, index) => ({
      id: fileName,
      name: fileName,
      central: index === 0,
      group: Math.floor(index / 5)
    }));
    
    const links = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const similarity = Math.random();
        if (similarity > threshold) {
          links.push({
            source: nodes[i].id,
            target: nodes[j].id,
            similarity: similarity
          });
        }
      }
    }
    
    return { nodes, links };
  }

  createClusterData() {
    const fileActivity = this.extractFileActivity();
    const files = Object.keys(fileActivity).slice(0, 15);
    
    const clusters = [
      { id: 0, x: 100, y: 100, radius: 60 },
      { id: 1, x: 300, y: 100, radius: 50 },
      { id: 2, x: 200, y: 300, radius: 70 }
    ];
    
    const points = files.map((fileName, index) => ({
      name: fileName,
      x: Math.random() * 400,
      y: Math.random() * 400,
      cluster: index % 3
    }));
    
    return { clusters, points };
  }

  create3DPointData() {
    const fileActivity = this.extractFileActivity();
    const files = Object.keys(fileActivity).slice(0, 20);
    
    return files.map(fileName => ({
      name: fileName,
      x: (Math.random() - 0.5) * 10,
      y: (Math.random() - 0.5) * 10,
      z: (Math.random() - 0.5) * 10,
      fileType: fileName.split('.').pop(),
      importance: Math.random()
    }));
  }

  getFileTypeColor(fileType) {
    const colorMap = {
      'js': new THREE.Color(0xf7df1e),
      'ts': new THREE.Color(0x3178c6),
      'py': new THREE.Color(0x3776ab),
      'html': new THREE.Color(0xe34c26),
      'css': new THREE.Color(0x1572b6),
      'json': new THREE.Color(0x000000),
      'md': new THREE.Color(0x083fa1)
    };
    
    return colorMap[fileType] || new THREE.Color(0x6b7280);
  }

  getEnhancedFileTypeColor(fileType) {
    const colorMap = {
      'js': '#f7df1e',      // JavaScript - Yellow
      'ts': '#3178c6',      // TypeScript - Blue
      'py': '#3776ab',      // Python - Blue
      'html': '#e34c26',    // HTML - Orange
      'css': '#1572b6',     // CSS - Blue
      'json': '#000000',    // JSON - Black
      'md': '#083fa1',      // Markdown - Blue
      'txt': '#6c757d',     // Text - Gray
      'sh': '#89e051',      // Shell - Green
      'sql': '#336791',     // SQL - Blue
      'xml': '#ff6600',     // XML - Orange
      'yaml': '#cb171e',    // YAML - Red
      'yml': '#cb171e'      // YAML - Red
    };
    
    return colorMap[fileType] || '#6b7280';
  }

  extractFileActivity() {
    const fileActivity = {};
    this.events.forEach(event => {
      try {
        const details = JSON.parse(event.details || '{}');
        const filePath = details.file_path;
        if (filePath) {
          const fileName = filePath.split('/').pop();
          if (!fileActivity[fileName]) {
            fileActivity[fileName] = { count: 0 };
          }
          fileActivity[fileName].count++;
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });
    return fileActivity;
  }

  updateModelAnalytics() {
    const promptResponseEvents = this.events.filter(e => e.type === 'prompt_response');

    const modelCounts = {};
    let autoModeCount = 0;
    let manualModeCount = 0;

    promptResponseEvents.forEach(event => {
      try {
        const details = JSON.parse(event.details || '{}');
        const modelInfo = this.#extractModelInfo(details); // Use the helper function

        // Aggregate model usage
        const modelName = modelInfo.model;
        modelCounts[modelName] = (modelCounts[modelName] || 0) + 1;

        // Aggregate auto vs. manual mode
        if (modelInfo.isAuto) {
          autoModeCount++;
        } else {
          manualModeCount++;
        }

      } catch (error) {
        console.warn('Error parsing prompt_response event details for model info:', error);
      }
    });

    this.#renderModelDistributionChart(modelCounts);
    this.#renderAutoManualModeChart(autoModeCount, manualModeCount);
  }

  // Helper function to extract model info (mimicking companion service logic)
  #extractModelInfo(data) {
    const modelInfo = {
      model: 'Unknown',
      mode: 'Unknown',
      provider: 'Unknown',
      isAuto: false
    };

    if (data.model) {
      modelInfo.model = data.model;
    } else if (data.ai_model) {
      modelInfo.model = data.ai_model;
    } else if (data.assistant_model) {
      modelInfo.model = data.assistant_model;
    }

    if (data.mode) {
      modelInfo.mode = data.mode;
    } else if (data.assistant_mode) {
      modelInfo.mode = data.assistant_mode;
    }

    if (modelInfo.mode.toLowerCase().includes('auto') || 
        modelInfo.model.toLowerCase().includes('auto') ||
        data.auto_mode === true ||
        data.is_auto === true ||
        data.content?.toLowerCase().includes('auto mode') ||
        data.content?.toLowerCase().includes('automatic model selection')) {
      modelInfo.isAuto = true;
      modelInfo.mode = 'Auto';
    }

    if (modelInfo.model.toLowerCase().includes('gpt') || modelInfo.model.toLowerCase().includes('openai')) {
      modelInfo.provider = 'OpenAI';
    } else if (modelInfo.model.toLowerCase().includes('claude') || modelInfo.model.toLowerCase().includes('anthropic')) {
      modelInfo.provider = 'Anthropic';
    } else if (modelInfo.model.toLowerCase().includes('gemini') || modelInfo.model.toLowerCase().includes('google')) {
      modelInfo.provider = 'Google';
    } else if (modelInfo.isAuto) {
      modelInfo.provider = 'Auto';
    } else if (data.content) {
      const content = data.content.toLowerCase();
      if (content.includes('gpt-') || content.includes('openai')) {
        modelInfo.provider = 'OpenAI';
      } else if (content.includes('claude') || content.includes('anthropic')) {
        modelInfo.provider = 'Anthropic';
      } else if (content.includes('gemini') || content.includes('google')) {
        modelInfo.provider = 'Google';
      }
    }
    return modelInfo;
  }

  #renderModelDistributionChart(modelCounts) {
    const chartContainer = document.getElementById('modelDistributionChart');
    if (!chartContainer) return;
    chartContainer.innerHTML = ''; // Clear previous chart

    const data = Object.entries(modelCounts).map(([model, count]) => ({ model, count }));
    if (data.length === 0) {
      chartContainer.textContent = 'No model data available.';
      return;
    }

    const width = chartContainer.offsetWidth;
    const height = 300;
    const radius = Math.min(width, height) / 2 - 10;

    const svg = d3.select(chartContainer)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    const pie = d3.pie()
      .value(d => d.count)
      .sort(null);

    const arc = d3.arc()
      .innerRadius(0)
      .outerRadius(radius);

    const arcs = svg.selectAll('arc')
      .data(pie(data))
      .enter()
      .append('g')
      .attr('class', 'arc');

    arcs.append('path')
      .attr('d', arc)
      .attr('fill', d => color(d.data.model))
      .attr('stroke', 'white')
      .style('stroke-width', '1px');

    arcs.append('text')
      .attr('transform', d => `translate(${arc.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .style('font-size', '12px')
      .text(d => `${d.data.model} (${d.data.count})`);
  }

  #renderAutoManualModeChart(autoModeCount, manualModeCount) {
    const chartContainer = document.getElementById('autoManualModeChart');
    if (!chartContainer) return;
    chartContainer.innerHTML = ''; // Clear previous chart

    const data = [
      { mode: 'Auto', count: autoModeCount },
      { mode: 'Manual', count: manualModeCount }
    ];

    if (autoModeCount === 0 && manualModeCount === 0) {
      chartContainer.textContent = 'No mode data available.';
      return;
    }

    const width = chartContainer.offsetWidth;
    const height = 200;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const svg = d3.select(chartContainer)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .range([0, chartWidth])
      .padding(0.1)
      .domain(data.map(d => d.mode));

    const y = d3.scaleLinear()
      .range([chartHeight, 0])
      .domain([0, d3.max(data, d => d.count)]);

    svg.append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(x));

    svg.append('g')
      .call(d3.axisLeft(y));

    svg.selectAll('.bar')
      .data(data)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.mode))
      .attr('y', d => y(d.count))
      .attr('width', x.bandwidth())
      .attr('height', d => chartHeight - y(d.count))
      .attr('fill', '#69b3a2');

    svg.selectAll('.text')
      .data(data)
      .enter().append('text')
      .attr('x', d => x(d.mode) + x.bandwidth() / 2)
      .attr('y', d => y(d.count) - 5)
      .attr('text-anchor', 'middle')
      .text(d => d.count)
      .style('font-size', '12px')
      .attr('fill', 'black');
  }

  #renderKeywordTrends() {
    const chartContainer = document.getElementById('keywordTrendsChart');
    if (!chartContainer) return;
    chartContainer.innerHTML = ''; // Clear previous chart

    const allKeywords = [];
    this.events.filter(e => e.type === 'prompt_response').forEach(event => {
      try {
        const details = JSON.parse(event.details || '{}');
        if (details.metadata && details.metadata.keywords) {
          allKeywords.push(...details.metadata.keywords);
        }
      } catch (error) {
        console.warn('Error parsing keywords from prompt_response event:', error);
      }
    });

    const keywordCounts = {};
    allKeywords.forEach(keyword => {
      keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
    });

    const data = Object.entries(keywordCounts)
      .sort(([, a], [, b]) => b - a)
      // Use all keywords for comprehensive analysis
      .map(([text, value]) => ({ text, value }));

    if (data.length === 0) {
      chartContainer.textContent = 'No keyword data available.';
      return;
    }

    const width = chartContainer.offsetWidth;
    const height = 300;

    const svg = d3.select(chartContainer)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const layout = d3.layout.cloud()
      .size([width, height])
      .words(data.map(d => ({ text: d.text, size: d.value * 5 + 10 }))) // Scale font size based on frequency
      .padding(5)
      .rotate(() => ~~(Math.random() * 2) * 90)
      .font('Impact')
      .fontSize(d => d.size)
      .on('end', draw);

    layout.start();

    function draw(words) {
      svg.append('g')
        .attr('transform', `translate(${layout.size()[0] / 2},${layout.size()[1] / 2})`)
        .selectAll('text')
        .data(words)
        .enter().append('text')
        .style('font-size', d => `${d.size}px`)
        .style('font-family', 'Impact')
        .style('fill', (d, i) => d3.schemeCategory10[i % 10])
        .attr('text-anchor', 'middle')
        .attr('transform', d => `translate(${d.x},${d.y})rotate(${d.rotate})`)
        .text(d => d.text);
    }
  }

  #renderPromptToCodeCorrelation() {
    const chartContainer = document.getElementById('promptToCodeCorrelationChart');
    if (!chartContainer) return;
    chartContainer.innerHTML = ''; // Clear previous chart

    const promptEvents = this.events.filter(e => e.type === 'prompt_response');
    const codeChangeEvents = this.events.filter(e => e.type === 'code_change' || e.type === 'file_change');

    const correlations = [];

    promptEvents.forEach(prompt => {
      const promptTimestamp = new Date(prompt.timestamp).getTime();
      const sessionId = prompt.session_id;

      // Find code changes that happened shortly after this prompt in the same session
      const relevantCodeChanges = codeChangeEvents.filter(change => {
        const changeTimestamp = new Date(change.timestamp).getTime();
        return change.session_id === sessionId &&
               changeTimestamp > promptTimestamp &&
               (changeTimestamp - promptTimestamp) < (5 * 60 * 1000); // within 5 minutes
      });

      if (relevantCodeChanges.length > 0) {
        let totalLinesAdded = 0;
        let totalLinesDeleted = 0;

        relevantCodeChanges.forEach(change => {
          try {
            const details = JSON.parse(change.details || '{}');
            if (details.diff) {
              // Simple diff parsing to count lines added/deleted
              const diffLines = details.diff.split('\n');
              diffLines.forEach(line => {
                if (line.startsWith('+') && !line.startsWith('+++')) {
                  totalLinesAdded++;
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                  totalLinesDeleted++;
                }
              });
            }
          } catch (error) {
            console.warn('Error parsing code change diff:', error);
          }
        });

        correlations.push({
          promptId: prompt.id,
          promptContent: prompt.details ? JSON.parse(prompt.details).content : 'N/A',
          timestamp: prompt.timestamp,
          totalLinesAdded,
          totalLinesDeleted,
          numChanges: relevantCodeChanges.length
        });
      }
    });

    if (correlations.length === 0) {
      chartContainer.textContent = 'No prompt-to-code correlations available.';
      return;
    }

    // Render as a simple list for now, can be enhanced with D3 later
    const list = document.createElement('ul');
    correlations.forEach(corr => {
      const listItem = document.createElement('li');
      listItem.innerHTML = `
        <strong>Prompt:</strong> ${corr.promptContent.substring(0, 100)}...<br>
        <strong>Timestamp:</strong> ${new Date(corr.timestamp).toLocaleString()}<br>
        <strong>Code Changes:</strong> ${corr.numChanges} files, +${corr.totalLinesAdded} lines, -${corr.totalLinesDeleted} lines
      `;
      list.appendChild(listItem);
    });
    chartContainer.appendChild(list);
  }

  renderMultiWorkspaceFeed() {
    const workspaceFeedGrid = document.getElementById('workspaceFeedGrid');
    if (!workspaceFeedGrid) {
      console.log('workspaceFeedGrid not found');
      return;
    }

    // Hide loading indicators
    const loadingIndicators = document.querySelectorAll('.loading, [id*="loadingIndicator"]');
    loadingIndicators.forEach(indicator => {
      if (indicator) indicator.style.display = 'none';
    });

    console.log('Rendering multi-workspace feed with', this.workspaces.length, 'workspaces');

    // Clear existing workspace feeds
    workspaceFeedGrid.innerHTML = '';

    // Sort workspaces by most active
    const sortedWorkspaces = [...this.workspaces].sort((a, b) => 
      (b.events || 0) - (a.events || 0)
    );
    
    console.log('Sorted workspaces:', sortedWorkspaces.map(w => ({ name: w.name, events: w.events })));

    // Check if we have workspaces with events
    const workspacesWithEvents = sortedWorkspaces.filter(ws => (ws.events || 0) > 0);
    
    // If no workspaces have events, show a general feed with all recent events
    if (workspacesWithEvents.length === 0 && this.events.length > 0) {
      const feedContainer = document.createElement('div');
      feedContainer.className = 'workspace-feed';
      feedContainer.innerHTML = `
        <div class="workspace-feed-header">
          <h3>Recent Activity</h3>
          <div class="workspace-path">All Workspaces</div>
        </div>
        <div class="activity-feed">
          ${this.events.map(event => this.renderEventCard(event)).join('')}
        </div>
      `;
      workspaceFeedGrid.appendChild(feedContainer);
      return;
    }

    // Limit to top 4 workspaces with events
    const topWorkspaces = sortedWorkspaces.slice(0, 4);

    topWorkspaces.forEach((workspace, index) => {
      // Create workspace feed container
      const workspaceFeedContainer = document.createElement('div');
      workspaceFeedContainer.className = 'workspace-feed';
      workspaceFeedContainer.id = `workspaceFeed-${index}`;

      // Create workspace header
      const workspaceHeader = document.createElement('div');
      workspaceHeader.className = 'workspace-feed-header';
      workspaceHeader.innerHTML = `
        <h3>${workspace.name || `Workspace ${index + 1}`}</h3>
        <div class="workspace-path" id="workspacePath-${index}">
          ${workspace.path || 'Unknown Path'}
        </div>
      `;

      // Create activity feed container
      const activityFeedContainer = document.createElement('div');
      activityFeedContainer.className = 'activity-feed';
      activityFeedContainer.id = `activityFeed-${index}`;

      // Filter events for this workspace - use more flexible matching
      const workspaceEvents = this.events.filter(event => 
        this.eventMatchesWorkspace(event, workspace)
      );  // Use all events per workspace

      // Render events
      if (workspaceEvents.length > 0) {
        activityFeedContainer.innerHTML = workspaceEvents
          .map(event => this.renderEventCard(event))
          .join('');
      } else {
        activityFeedContainer.innerHTML = `
          <div class="loading">No activity in this workspace</div>
        `;
      }

      // Assemble workspace feed
      workspaceFeedContainer.appendChild(workspaceHeader);
      workspaceFeedContainer.appendChild(activityFeedContainer);

      // Add to grid
      workspaceFeedGrid.appendChild(workspaceFeedContainer);
    });
  }

  // Update renderActivityFeed to use unified activity view
  renderActivityFeed() {
    console.log('Rendering activity feed...');
    
    // Check for new unified activity containers
    const timelineView = document.getElementById('activityTimeline');
    const listView = document.getElementById('activityList');
    const gridView = document.getElementById('activityGrid');
    
    if (timelineView || listView || gridView) {
      // New unified view structure
      this.renderUnifiedActivityView();
    } else {
      // Legacy multi-workspace view
      const activeWorkspace = this.getActiveWorkspace();
      this.applyViewMode();
      
      if (activeWorkspace) {
        console.log('Rendering activity feed for workspace:', activeWorkspace.name);
        this.renderSingleWorkspaceFeed(activeWorkspace);
      } else {
        console.log('Rendering multi-workspace activity feed');
        this.renderMultiWorkspaceFeed();
      }
    }
  }
  
  renderUnifiedActivityView() {
    const events = this.getFilteredEvents();
    console.log('Rendering unified view with', events.length, 'events');
    
    // Determine which view is active
    const timelineViewContainer = document.getElementById('timelineView');
    const listViewContainer = document.getElementById('listView');
    const gridViewContainer = document.getElementById('gridView');
    
    if (!timelineViewContainer && !listViewContainer && !gridViewContainer) {
      console.error('No activity view containers found');
      return;
    }
    
    // Render based on current view mode
    if (timelineViewContainer && timelineViewContainer.classList.contains('active')) {
      this.renderTimelineView(events);
    } else if (listViewContainer && listViewContainer.classList.contains('active')) {
      this.renderListView(events);
    } else if (gridViewContainer && gridViewContainer.classList.contains('active')) {
      this.renderGridView(events);
    }
  }
  
  renderTimelineView(events) {
    const container = document.getElementById('activityTimeline');
    if (!container) return;
    
    if (events.length === 0) {
      container.innerHTML = '<div class="no-data">No activity to display</div>';
      return;
    }
    
    container.innerHTML = events.map(event => {
      const time = new Date(event.timestamp).toLocaleTimeString();
      const date = new Date(event.timestamp).toLocaleDateString();
      
      // Extract file path
      let filePath = event.filePath || event.file_path || event.file;
      if (!filePath && event.details) {
        try {
          const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
          filePath = details.file_path || details.filePath || details.file;
        } catch (e) {}
      }
      
      return `
        <div class="timeline-item" onclick="dashboard.showEventModal(${JSON.stringify(event).replace(/"/g, '&quot;')})">
          <div class="timeline-marker"></div>
          <div class="timeline-content">
            <div class="timeline-header">
              <h4 class="timeline-title">${this.getEventTitle(event)}</h4>
              <div class="timeline-meta">
                <span>${time}</span>
                <span>${event.type || 'event'}</span>
              </div>
            </div>
            <div class="timeline-description">${this.getEventDescription(event)}</div>
            ${filePath ? `<div class="timeline-file"><code>${filePath}</code></div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }
  
  renderListView(events) {
    const container = document.getElementById('activityList');
    if (!container) return;
    
    if (events.length === 0) {
      container.innerHTML = '<div class="no-data">No activity to display</div>';
      return;
    }
    
    container.innerHTML = events.map(event => {
      const time = new Date(event.timestamp).toLocaleTimeString();
      
      // Extract file path
      let filePath = event.filePath || event.file_path || event.file;
      if (!filePath && event.details) {
        try {
          const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
          filePath = details.file_path || details.filePath || details.file;
        } catch (e) {}
      }
      
      return `
        <div class="activity-item" onclick="dashboard.showEventModal(${JSON.stringify(event).replace(/"/g, '&quot;')})">
          <div class="activity-icon">${this.getEventIcon(event)}</div>
          <div class="activity-details">
            <h4 class="activity-title">${this.getEventTitle(event)}</h4>
            <div class="activity-meta">
              <span>${time}</span>
              <span>${event.type || 'event'}</span>
              ${filePath ? `<span><code>${this.truncatePath(filePath, 50)}</code></span>` : ''}
            </div>
            <div class="activity-description">${this.getEventDescription(event)}</div>
          </div>
        </div>
      `;
    }).join('');
  }
  
  renderGridView(events) {
    const container = document.getElementById('activityGrid');
    if (!container) return;
    
    if (events.length === 0) {
      container.innerHTML = '<div class="no-data">No activity to display</div>';
      return;
    }
    
    container.innerHTML = events.map(event => {
      const time = new Date(event.timestamp).toLocaleTimeString();
      
      // Extract file path
      let filePath = event.filePath || event.file_path || event.file;
      if (!filePath && event.details) {
        try {
          const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
          filePath = details.file_path || details.filePath || details.file;
        } catch (e) {}
      }
      
      return `
        <div class="activity-card" onclick="dashboard.showEventModal(${JSON.stringify(event).replace(/"/g, '&quot;')})">
          <div class="card-header">
            <div class="card-icon">${this.getEventIcon(event)}</div>
            <h4 class="card-title">${this.getEventTitle(event)}</h4>
          </div>
          <div class="card-meta">${time} • ${event.type || 'event'}</div>
          ${filePath ? `<div class="card-file"><code>${this.truncatePath(filePath, 40)}</code></div>` : ''}
          <div class="card-description">${this.getEventDescription(event)}</div>
        </div>
      `;
    }).join('');
  }
  
  getEventIcon(event) {
    const type = event.type || event.kind || 'unknown';
    const iconMap = {
      'file_change': '📄',
      'code_change': '💻',
      'session_start': '⏱️',
      'session_end': '⏹️',
      'ai_prompt': '🤖',
      'ai_response': '🤖',
      'prompt_response': '🤖',
      'git': '📦',
      'error': '⚠️'
    };
    return iconMap[type] || '📝';
  }
  
  getEventTitle(event) {
    // Extract file path from various possible locations
    let filePath = event.filePath || event.file_path || event.file;
    
    // Try to extract from details JSON if not found
    if (!filePath && event.details) {
      try {
        const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
        filePath = details.file_path || details.filePath || details.file;
      } catch (e) {
        // Ignore parsing errors
      }
    }
    
    if (event.type === 'file_change' || event.type === 'code_change') {
      if (filePath) {
        const fileName = filePath.split('/').pop();
        return fileName || 'File changed';
      }
      return 'File changed';
    }
    if (event.type === 'session_start') return 'Session started';
    if (event.type === 'session_end') return 'Session ended';
    if (event.type === 'ai_prompt' || event.type === 'prompt_response') return 'AI Interaction';
    return event.description || event.type || 'Activity';
  }
  
  getEventDescription(event) {
    if (event.description) return event.description;
    
    // Extract details
    let details = event.details;
    if (typeof details === 'string') {
      try {
        details = JSON.parse(details);
      } catch (e) {
        details = {};
      }
    }
    details = details || {};
    
    if (event.type === 'file_change' || event.type === 'code_change') {
      const changes = event.diff_stats || details.diff_stats || {};
      const additions = changes.additions || details.chars_added || 0;
      const deletions = changes.deletions || details.chars_deleted || 0;
      
      // Show character changes
      if (additions || deletions) {
        return `+${additions} / -${deletions} characters`;
      }
      return 'File change detected';
    }
    
    if (event.prompt) return event.prompt.substring(0, 100) + '...';
    return 'Activity recorded';
  }
  
  truncatePath(path, maxLength) {
    if (path.length <= maxLength) return path;
    const parts = path.split('/');
    if (parts.length <= 2) return path;
    return '.../' + parts.slice(-2).join('/');
  }

  applyViewMode() {
    const workspaceFeedGrid = document.getElementById('workspaceFeedGrid');
    if (!workspaceFeedGrid) return;

    // Remove existing view mode classes
    workspaceFeedGrid.classList.remove('list-view', 'timeline-view');
    
    // Add current view mode class
    workspaceFeedGrid.classList.add(`${this.currentViewMode}-view`);
  }

  // Render feed for a single active workspace
  renderSingleWorkspaceFeed(workspace) {
    const workspaceFeedGrid = document.getElementById('workspaceFeedGrid');
    if (!workspaceFeedGrid) return;

    // Hide loading indicators
    const loadingIndicators = document.querySelectorAll('.loading, [id*="loadingIndicator"]');
    loadingIndicators.forEach(indicator => {
      if (indicator) indicator.style.display = 'none';
    });

    workspaceFeedGrid.innerHTML = '';

    // Create workspace feed container
    const workspaceFeedContainer = document.createElement('div');
    workspaceFeedContainer.className = 'workspace-feed single-workspace';
    
    // Create workspace header
    const workspaceHeader = document.createElement('div');
    workspaceHeader.className = 'workspace-feed-header';
    workspaceHeader.innerHTML = `
      <div class="workspace-header-content">
        <h3>${workspace.name}</h3>
        <div class="workspace-path">${workspace.path}</div>
      </div>
      <button class="btn btn-small btn-secondary" onclick="activityDashboard.clearWorkspaceSelection()">
        View All Workspaces
      </button>
    `;

    // Create activity feed container
    const activityFeedContainer = document.createElement('div');
    activityFeedContainer.className = 'activity-feed';

    // Get filtered events for this workspace
    const filteredEvents = this.getFilteredEvents();
    const recentEvents = filteredEvents; // Show all events for single workspace

    // Render events
    if (recentEvents.length > 0) {
      activityFeedContainer.innerHTML = recentEvents
        .map(event => this.renderEventCard(event))
        .join('');
    } else {
      activityFeedContainer.innerHTML = `
        <div class="no-data">
          <div class="no-data-icon">D</div>
          <div class="no-data-text">No activity in this workspace</div>
          <div class="no-data-hint">Events will appear here as you work in this workspace</div>
        </div>
      `;
    }

    // Assemble workspace feed
    workspaceFeedContainer.appendChild(workspaceHeader);
    workspaceFeedContainer.appendChild(activityFeedContainer);

    // Add to grid
    workspaceFeedGrid.appendChild(workspaceFeedContainer);
  }

  // Clear workspace selection to show all workspaces
  clearWorkspaceSelection() {
    console.log('Clearing workspace selection - showing all workspaces');
    
    this.workspaces.forEach(ws => ws.active = false);
    
    // Update dropdown selector
    const selector = document.getElementById('workspaceSelect');
    if (selector) {
      selector.value = 'all';
      console.log('Updated dropdown to: all');
    }
    
    this.renderWorkspaceList();
    this.updateStats();
    this.renderActivityFeed();
    this.updateAnalytics();
    
    // Show feedback
    this.showWorkspaceSelectionFeedback('All Workspaces');
  }

  // Update workspace filter indicator in the UI (disabled - using dropdown instead)
  updateWorkspaceFilterIndicator(activeWorkspace) {
    // Filter indicator badge removed - using dropdown selector instead
    const filterIndicator = document.getElementById('workspaceFilterIndicator');
    if (filterIndicator) {
      filterIndicator.style.display = 'none';
    }
  }

  // Enhanced timeline rendering method
  renderTimeline() {
    console.log('Rendering timeline...');
    const timelineContainer = document.getElementById('ganttTimeline');
    if (!timelineContainer) {
      console.error('Timeline container not found');
      return;
    }

    console.log('Timeline container found:', timelineContainer);
    console.log('Current events count:', this.events.length);
    console.log('Current timeRange:', this.timeRange);
    console.log('Current visibleLayers:', this.visibleLayers);
    
    // Initialize timeline data if not set
    if (!this.timeRange) {
      this.timeRange = 'all';
    }
    if (!this.visibleLayers) {
      this.visibleLayers = { sessions: true, fileChanges: true, prompts: true };
    }

    // Prepare timeline data
    const timelineEvents = this.prepareTimelineEvents();
    console.log('Timeline events prepared:', timelineEvents.length);
    
    // Render Gantt timeline
    this.renderGanttTimeline(timelineEvents);
    
    // Update summary metrics
    this.updateTimelineSummary(timelineEvents);
    
    // Render recent events list
    this.renderRecentEventsList(timelineEvents);
  }

  // Prepare events for timeline visualization
  prepareTimelineEvents() {
    console.log('Preparing timeline events...');
    // Get filtered events based on active workspace
    const filteredEvents = this.getFilteredEvents();
    console.log('Filtered events:', filteredEvents.length);
    
    // Filter events based on time range and visible layers
    const now = new Date();
    const timeRangeMap = {
      'all': null, // Show all time data
      '1h': 1 * 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    const timeRangeMs = timeRangeMap[this.timeRange || 'all'];
    const cutoffTime = timeRangeMs ? new Date(now.getTime() - timeRangeMs) : null;

    console.log('Time range filter:', this.timeRange, 'cutoff time:', cutoffTime);
    console.log('Visible layers:', this.visibleLayers);

    const finalEvents = filteredEvents.filter(event => {
      const eventTime = new Date(event.timestamp);
      const matchesTimeRange = cutoffTime ? eventTime >= cutoffTime : true;
      
      const layerVisibility = {
        'sessions': event.type === 'session_event',
        'filechanges': event.type === 'file_change' || event.type === 'code_change',
        'prompts': event.type === 'prompt_response'
      };

      const matchesVisibleLayers = 
        (this.visibleLayers.sessions && layerVisibility.sessions) ||
        (this.visibleLayers.fileChanges && layerVisibility.filechanges) ||
        (this.visibleLayers.prompts && layerVisibility.prompts);

      console.log(`Event ${event.id} (${event.type}): timeRange=${matchesTimeRange}, layers=${matchesVisibleLayers}`);
      return matchesTimeRange && matchesVisibleLayers;
    }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    console.log('Final timeline events:', finalEvents.length);
    return finalEvents;
  }

  // Render Gantt timeline visualization
  renderGanttTimeline(events) {
    const timelineContainer = document.getElementById('ganttTimeline');
    if (!timelineContainer) {
      console.error('Timeline container not found in renderGanttTimeline');
      return;
    }

    console.log('Rendering Gantt timeline with', events.length, 'events');

    // Clear previous timeline
    timelineContainer.innerHTML = '';

    // Show message if no events
    if (events.length === 0) {
      console.log('No events to render, showing no-data message');
      timelineContainer.innerHTML = `
        <div class="no-data">
          <div class="no-data-icon">📅</div>
          <div class="no-data-text">No timeline events</div>
          <div class="no-data-hint">Events will appear here as you work in Cursor</div>
        </div>
      `;
      return;
    }

    // Create timeline lanes for different event types
    const lanes = {
      'sessions': [],
      'fileChanges': [],
      'prompts': []
    };

    events.forEach(event => {
      if (event.type === 'session_event') lanes.sessions.push(event);
      if (event.type === 'file_change' || event.type === 'code_change') lanes.fileChanges.push(event);
      if (event.type === 'prompt_response') lanes.prompts.push(event);
    });

    console.log('Lane distribution:', {
      sessions: lanes.sessions.length,
      fileChanges: lanes.fileChanges.length,
      prompts: lanes.prompts.length
    });

    // Check if all lanes are empty
    const hasAnyEvents = Object.values(lanes).some(lane => lane.length > 0);
    console.log('Has any events:', hasAnyEvents);
    
    if (!hasAnyEvents) {
      console.log('No events in any lane, showing filter message');
      timelineContainer.innerHTML = `
        <div class="no-data">
          <div class="no-data-icon">📅</div>
          <div class="no-data-text">No events match current filters</div>
          <div class="no-data-hint">Adjust time range or layer visibility to see more events</div>
        </div>
      `;
      return;
    }

    // Render each lane
    console.log('Rendering lanes...');
    Object.entries(lanes).forEach(([laneName, laneEvents]) => {
      if (laneEvents.length === 0) {
        console.log(`Skipping empty lane: ${laneName}`);
        return;
      }

      console.log(`Rendering lane: ${laneName} with ${laneEvents.length} events`);
      const laneContainer = document.createElement('div');
      laneContainer.className = `timeline-lane ${laneName}`;
      laneContainer.innerHTML = `
        <div class="lane-header">${laneName.replace(/([A-Z])/g, ' $1')}</div>
        <div class="lane-events">
          ${laneEvents.map(event => `
            <div class="timeline-event" 
                 data-type="${event.type}" 
                 data-timestamp="${event.timestamp}"
                 onclick="activityDashboard.showEventDetails('${event.id}')">
              <span class="event-icon">${getEventIcon(event.type)}</span>
              <span class="event-details">
                <span class="event-title">${getEventTitle(event)}</span>
                <span class="event-time">${new Date(event.timestamp).toLocaleTimeString()}</span>
              </span>
            </div>
          `).join('')}
        </div>
      `;

      timelineContainer.appendChild(laneContainer);
      console.log(`Added lane container for ${laneName}`);
    });
    
    console.log('Timeline rendering complete');
  }

  // Update timeline summary metrics
  updateTimelineSummary(events = null) {
    // Use provided events or get all events
    const eventsToAnalyze = events || this.events || [];
    
    const totalSessions = new Set(eventsToAnalyze.map(e => e.session_id)).size;
    const totalWorkspaces = new Set(eventsToAnalyze.map(e => e.workspace_path)).size;
    
    const codeChangeCount = eventsToAnalyze.filter(e => 
      e.type === 'code_change'
    ).length;

    const fileChangeCount = eventsToAnalyze.filter(e => 
      e.type === 'file_change'
    ).length;

    const aiInteractionCount = eventsToAnalyze.filter(e => 
      e.type === 'prompt_response'
    ).length;

    // Calculate total active time
    const sortedEvents = eventsToAnalyze.sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );
    const totalActiveTimeMs = sortedEvents.length > 1 
      ? new Date(sortedEvents[sortedEvents.length - 1].timestamp) - 
        new Date(sortedEvents[0].timestamp)
      : 0;

    const totalActiveTimeHours = Math.floor(totalActiveTimeMs / (1000 * 60 * 60));
    const totalActiveTimeMins = Math.floor((totalActiveTimeMs % (1000 * 60 * 60)) / (1000 * 60));

    // Update DOM elements
    const totalSessionsEl = document.getElementById('totalSessions');
    const totalWorkspacesEl = document.getElementById('totalWorkspaces');
    const totalActiveTimeEl = document.getElementById('totalActiveTime');
    const codeChangeCountEl = document.getElementById('codeChangeCount');
    const fileChangeCountEl = document.getElementById('fileChangeCount');
    const aiInteractionCountEl = document.getElementById('aiInteractionCount');
    
    if (totalSessionsEl) totalSessionsEl.textContent = totalSessions;
    if (totalWorkspacesEl) totalWorkspacesEl.textContent = totalWorkspaces;
    if (totalActiveTimeEl) totalActiveTimeEl.textContent = 
      `${totalActiveTimeHours}h ${totalActiveTimeMins}m`;
    if (codeChangeCountEl) codeChangeCountEl.textContent = codeChangeCount;
    if (fileChangeCountEl) fileChangeCountEl.textContent = fileChangeCount;
    if (aiInteractionCountEl) aiInteractionCountEl.textContent = aiInteractionCount;
  }

  // Render recent events list
  renderRecentEventsList(events = null) {
    const recentEventsList = document.getElementById('recentEventsList');
    if (!recentEventsList) return;

    // Use provided events or get all events
    const eventsToAnalyze = events || this.events || [];

    // Take top 10 most recent events
    const recentEvents = eventsToAnalyze.slice(-10).reverse();

    if (recentEvents.length === 0) {
      recentEventsList.innerHTML = `
        <div class="no-data">
          <div class="no-data-icon">📅</div>
          <div class="no-data-text">No recent events</div>
          <div class="no-data-hint">Events will appear here as you work in Cursor</div>
        </div>
      `;
      return;
    }

    recentEventsList.innerHTML = recentEvents.map(event => `
      <div class="event-list-item" onclick="activityDashboard.showEventDetails('${event.id}')">
        <span class="event-icon">${getEventIcon(event.type)}</span>
        <div class="event-details">
          <div class="event-title">${getEventTitle(event)}</div>
          <div class="event-metadata">
            ${new Date(event.timestamp).toLocaleTimeString()} • 
            ${event.workspace_path ? event.workspace_path.split('/').pop() : 'Unknown Workspace'}
          </div>
        </div>
      </div>
    `).join('');
  }
}

// Global functions for HTML onclick handlers
// Export functions
function exportJSON() {
  if (dashboard) {
    // Get filtered data based on active workspace
    const activeWorkspace = dashboard.getActiveWorkspace();
    const filteredEvents = activeWorkspace ? dashboard.getFilteredEvents() : dashboard.events || [];
    const filteredEntries = activeWorkspace ? dashboard.getFilteredEntries() : dashboard.entries || [];
    
    const data = {
      exportDate: new Date().toISOString(),
      workspace: activeWorkspace ? {
        name: activeWorkspace.name,
        path: activeWorkspace.path
      } : 'All Workspaces',
      summary: {
        totalEvents: filteredEvents.length,
        totalEntries: filteredEntries.length,
        workspaces: dashboard.workspaces?.length || 0
      },
      events: filteredEvents,
      entries: filteredEntries,
      workspaces: dashboard.workspaces || []
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filename = activeWorkspace 
      ? `cursor-activity-${activeWorkspace.name}-${new Date().toISOString().split('T')[0]}.json`
      : `cursor-activity-all-${new Date().toISOString().split('T')[0]}.json`;
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Show success notification
    showNotification(`Exported ${filteredEvents.length} events successfully`, 'success');
  }
}

// Show notification helper
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

// Search Modal Functions
// Quick search handler for the search bar
function handleQuickSearch(event) {
  const query = event.target.value.toLowerCase().trim();
  
  // If Enter is pressed, open advanced search modal
  if (event.key === 'Enter') {
    openSearchModal();
    const modalInput = document.getElementById('searchInput');
    if (modalInput) {
      modalInput.value = query;
      modalInput.dispatchEvent(new Event('input'));
    }
    return;
  }
  
  // Debounce search
  clearTimeout(window.quickSearchTimeout);
  
  if (query.length === 0) {
    // Clear search, show all
    dashboard.currentFilter = 'all';
    dashboard.renderActivityFeed();
    return;
  }
  
  if (query.length < 2) {
    return; // Wait for at least 2 characters
  }
  
  window.quickSearchTimeout = setTimeout(() => {
    performQuickSearch(query);
  }, 300);
}

function performQuickSearch(query) {
  const events = dashboard.events || [];
  
  // Search in events
  const filteredEvents = events.filter(event => {
    const searchableText = [
      event.type,
      event.file_path,
      event.workspace_path,
      event.description,
      event.title,
      JSON.stringify(event.details || {})
    ].join(' ').toLowerCase();
    
    return searchableText.includes(query);
  });
  
  // Update the feed with filtered results
  const feed = document.getElementById('activityFeed');
  if (!feed) return;
  
  if (filteredEvents.length === 0) {
    feed.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">No results found</div>
        <div class="empty-description">Try a different search term</div>
      </div>
    `;
    return;
  }
  
  // Render filtered events
  feed.innerHTML = filteredEvents
    .slice(0, 50)
    .map(event => dashboard.renderEventCard(event))
    .join('');
}

function openSearchModal() {
  const modal = document.getElementById('searchModal');
  const input = document.getElementById('searchInput');
  modal.style.display = 'flex';
  input.focus();
  
  // Setup search functionality
  setupSearch();
}

function closeSearchModal() {
  const modal = document.getElementById('searchModal');
  modal.style.display = 'none';
}

function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  let searchTimeout;
  
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (query.length < 2) {
      searchResults.innerHTML = '<div class="search-result-item">Type at least 2 characters to search...</div>';
      return;
    }
    
    searchTimeout = setTimeout(() => {
      performSearch(query, searchResults);
    }, 300); // 300ms debounce
  });
  
  // Close modal on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSearchModal();
    }
  });
}

function performSearch(query, resultsContainer) {
  if (!dashboard) {
    resultsContainer.innerHTML = '<div class="search-result-item">Dashboard not loaded</div>';
    return;
  }
  
  const allData = [...(dashboard.events || []), ...(dashboard.entries || [])];
  const searchResults = [];
  
  allData.forEach(item => {
    const score = calculateSearchScore(item, query);
    if (score > 0) {
      searchResults.push({ item, score });
    }
  });
  
  // Sort by score (highest first)
  searchResults.sort((a, b) => b.score - a.score);
  
  // Render results
  if (searchResults.length === 0) {
    resultsContainer.innerHTML = '<div class="search-result-item">No results found</div>';
    return;
  }
  
  resultsContainer.innerHTML = searchResults.map(result => {
    return renderSearchResult(result.item, query);
  }).join('');
}

function calculateSearchScore(item, query) {
  let score = 0;
  const queryLower = query.toLowerCase();
  
  // Search in type
  if (item.type && item.type.toLowerCase().includes(queryLower)) {
    score += 10;
  }
  
  // Search in details
  try {
    const details = JSON.parse(item.details || '{}');
    
    // File path
    if (details.file_path && details.file_path.toLowerCase().includes(queryLower)) {
      score += 20;
    }
    
    // Prompt content
    if (details.prompt && details.prompt.toLowerCase().includes(queryLower)) {
      score += 15;
    }
    
    // Response content
    if (details.response && details.response.toLowerCase().includes(queryLower)) {
      score += 15;
    }
    
    // Session phase
    if (details.session_phase && details.session_phase.toLowerCase().includes(queryLower)) {
      score += 5;
    }
    
    // Model info
    if (details.model && details.model.toLowerCase().includes(queryLower)) {
      score += 8;
    }
    
  } catch (e) {
    // Ignore parsing errors
  }
  
  // Search in raw content
  if (item.content && item.content.toLowerCase().includes(queryLower)) {
    score += 12;
  }
  
  return score;
}

function renderSearchResult(item, query) {
  const timestamp = new Date(item.timestamp).toLocaleString();
  let title = 'Unknown Event';
  let preview = '';
  let type = item.type || 'unknown';
  
  try {
    const details = JSON.parse(item.details || '{}');
    
    switch (item.type) {
      case 'prompt_response':
        title = `AI Interaction: ${details.prompt?.substring(0, 50) || 'Unknown prompt'}...`;
        preview = details.response?.substring(0, 100) || '';
        break;
      case 'code_change':
      case 'file_change':
        title = `File Change: ${details.file_path || 'Unknown file'}`;
        preview = details.diff_summary || `Changed ${details.diff_size || 0} bytes`;
        break;
      case 'session_event':
        title = `Session: ${details.session_phase || 'Development Activity'}`;
        preview = `Session ID: ${item.session_id || 'Unknown'}`;
        break;
      default:
        title = `${item.type || 'Event'}: ${details.file_path || 'Unknown'}`;
        preview = details.content?.substring(0, 100) || '';
    }
  } catch (e) {
    title = `${item.type || 'Event'}`;
    preview = item.content?.substring(0, 100) || '';
  }
  
  // Highlight search terms
  const highlightText = (text) => {
    if (!text) return '';
    return text.replace(new RegExp(`(${query})`, 'gi'), '<span class="search-highlight">$1</span>');
  };
  
  return `
    <div class="search-result-item" onclick="openSessionModal('${item.session_id || 'unknown'}')">
      <div class="search-result-header">
        <div class="search-result-title">${highlightText(title)}</div>
        <div class="search-result-type">${type}</div>
      </div>
      <div class="search-result-preview">${highlightText(preview)}</div>
      <div class="search-result-meta">
        <span>${timestamp}</span>
        <span>Session: ${item.session_id || 'Unknown'}</span>
      </div>
    </div>
  `;
}

// Session Modal Functions
function openSessionModal(sessionId) {
  const modal = document.getElementById('sessionModal');
  const title = document.getElementById('sessionModalTitle');
  const content = document.getElementById('sessionModalContent');
  
  title.textContent = `Session: ${sessionId}`;
  
  // Build session data
  const sessionData = buildSessionData(sessionId);
  content.innerHTML = renderSessionModal(sessionData);
  
  modal.style.display = 'flex';
  closeSearchModal(); // Close search modal
}

function closeSessionModal() {
  const modal = document.getElementById('sessionModal');
  modal.style.display = 'none';
}

function buildSessionData(sessionId) {
  if (!dashboard) return null;
  
  const allData = [...(dashboard.events || []), ...(dashboard.entries || [])];
  const sessionEvents = allData.filter(item => item.session_id === sessionId);
  
  if (sessionEvents.length === 0) {
    return {
      sessionId,
      duration: 'Unknown',
      workspace: 'Unknown',
      sessionTimeline: [],
      codeChanges: [],
      aiInteractions: [],
      context: {}
    };
  }
  
  // Calculate duration
  const timestamps = sessionEvents.map(e => new Date(e.timestamp)).sort();
  const startTime = timestamps[0];
  const endTime = timestamps[timestamps.length - 1];
  const duration = formatDuration(endTime - startTime);
  
  // Get workspace from first event
  const workspace = sessionEvents[0].workspace_path || '/Users/hamidaho/new_cursor/cursor-telemetry';
  
  // Build timeline
  const sessionTimeline = sessionEvents
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map(event => {
      const time = new Date(event.timestamp).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      try {
        const details = JSON.parse(event.details || '{}');
        
        switch (event.type) {
          case 'prompt_response':
            return {
              time,
              type: 'prompt',
              content: details.prompt || 'Unknown prompt'
            };
          case 'code_change':
          case 'file_change':
            return {
              time,
              type: 'code',
              file: details.file_path || 'Unknown file',
              diff: `+${details.diff_size || 0} bytes`
            };
          default:
            return {
              time,
              type: 'other',
              content: event.type
            };
        }
      } catch (e) {
        return {
          time,
          type: 'other',
          content: event.type
        };
      }
    });
  
  // Extract code changes
  const codeChanges = sessionEvents
    .filter(e => e.type === 'code_change' || e.type === 'file_change')
    .map(event => {
      try {
        const details = JSON.parse(event.details || '{}');
        return {
          file: details.file_path || 'Unknown file',
          before: details.before_content || '',
          after: details.after_content || '',
          diff: `+${details.diff_size || 0} bytes`,
          bytesChanged: details.diff_size || 0
        };
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);
  
  // Extract AI interactions
  const aiInteractions = sessionEvents
    .filter(e => e.type === 'prompt_response')
    .map(event => {
      try {
        const details = JSON.parse(event.details || '{}');
        return {
          prompt: details.prompt || '',
          response: details.response || '',
          model: details.model || 'Unknown',
          confidence: details.confidence || 0,
          tokens: details.tokens || 0
        };
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);
  
  return {
    sessionId,
    duration,
    workspace: workspace,
    sessionTimeline,
    codeChanges,
    aiInteractions,
    context: {
      filesOpen: ['utils.js', 'test.js', 'README.md'],
      gitBranch: 'feature/error-handling',
      ideState: 'debugging'
    }
  };
}

function renderSessionModal(sessionData) {
  if (!sessionData) {
    return '<div>Session data not available</div>';
  }
  
  return `
    <div class="session-details">
      <div class="session-header">
        <h4>Session: ${sessionData.sessionId}</h4>
        <p>Duration: ${sessionData.duration} | Workspace: ${sessionData.workspace}</p>
      </div>
      
      <div class="session-timeline">
        <h4>Session Timeline</h4>
        ${sessionData.sessionTimeline.map(item => `
          <div class="session-timeline-item ${item.type}">
            <div class="session-timeline-time">${item.time}</div>
            <div class="session-timeline-content">
              ${item.type === 'code' ? `<span class="session-timeline-file">${item.file}</span>` : ''}
              ${item.content}
              ${item.diff ? ` (${item.diff})` : ''}
            </div>
          </div>
        `).join('')}
      </div>
      
      ${sessionData.codeChanges.length > 0 ? `
        <div class="code-diff-container">
          <h4>Code Changes</h4>
          ${sessionData.codeChanges.map(change => `
            <div class="code-diff-header">
              <div class="code-diff-file">${change.file}</div>
              <div class="code-diff-stats">${change.diff} (${change.bytesChanged} bytes)</div>
            </div>
            <div class="code-diff-content">
              <div class="code-diff-before">
                <pre>${change.before}</pre>
              </div>
              <div class="code-diff-after">
                <pre>${change.after}</pre>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      ${sessionData.aiInteractions.length > 0 ? `
        <div class="ai-interactions">
          <h4>AI Interactions</h4>
          ${sessionData.aiInteractions.map(interaction => `
            <div class="ai-interaction">
              <div class="ai-interaction-header">
                <div class="ai-interaction-model">${interaction.model}</div>
                <div class="ai-interaction-confidence">${Math.round(interaction.confidence * 100)}%</div>
              </div>
              <div class="ai-interaction-prompt">
                <strong>Prompt:</strong> ${interaction.prompt}
              </div>
              <div class="ai-interaction-response">
                <strong>Response:</strong> ${interaction.response}
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      <div class="session-context">
        <h4>Context</h4>
        <div class="context-item">
          <div class="context-label">Files Open:</div>
          <div class="context-value">${sessionData.context.filesOpen.join(', ')}</div>
        </div>
        <div class="context-item">
          <div class="context-label">Git Branch:</div>
          <div class="context-value">${sessionData.context.gitBranch}</div>
        </div>
        <div class="context-item">
          <div class="context-label">IDE State:</div>
          <div class="context-value">${sessionData.context.ideState}</div>
        </div>
      </div>
    </div>
  `;
}

function formatDuration(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

let dashboard;

function refreshData() {
  dashboard.refreshData();
}

function debugDatabase() {
  dashboard.debugDatabase();
}

function testCompanion() {
  dashboard.testCompanion();
}

function exportJSON() {
  dashboard.exportJSON();
}

function exportMarkdown() {
  dashboard.exportMarkdown();
}

function setFilter(filter) {
  dashboard.setFilter(filter);
}

function setViewMode(viewMode) {
  dashboard.setViewMode(viewMode);
}

function setActiveWorkspace(workspaceId) {
  dashboard.setActiveWorkspace(workspaceId);
}

function setAnalyticsWorkspace(workspaceId) {
  dashboard.setAnalyticsWorkspace(workspaceId);
}

function setAnalyticsTimeRange(timeRange) {
  dashboard.setAnalyticsTimeRange(timeRange);
}

function refreshAnalytics() {
  dashboard.refreshAnalytics();
}

function closeDiffModal() {
  document.getElementById('diffModal').style.display = 'none';
}

// Analytics functions
function generateEmbeddings() {
  dashboard.generateEmbeddings();
}

function visualizeEmbeddings() {
  dashboard.visualizeEmbeddings();
}

function calculateTFIDF() {
  dashboard.calculateTFIDF();
}

function addWorkspace() {
  dashboard.addWorkspace();
}

// Semantic Analysis functions
function generateFileGraph() {
  dashboard.generateFileGraph();
}

function updateGraph() {
  dashboard.updateGraph();
}

function analyzeSemantics() {
  dashboard.analyzeSemantics();
}

// Gantt Timeline Implementation
class GanttTimeline {
  constructor() {
    this.container = null;
    this.data = [];
    this.timeRange = 'all';
    this.granularity = '5minute';
    this.visibleLayers = {
      sessions: true,
      fileChanges: true,
      prompts: true
    };
    this.zoomLevel = 1;
    this.scrollPosition = 0;
    this.tooltip = null;
    this.selectedBar = null;
    this.timelineWidth = 0;
    this.pixelsPerMinute = 2;
  }

  initialize(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.setupEventListeners();
    this.createTimelineStructure();
    this.loadData();
  }

  setupEventListeners() {
    // Time range change
    const timeRangeSelect = document.getElementById('timeRange');
    if (timeRangeSelect) {
      timeRangeSelect.addEventListener('change', (e) => {
        this.timeRange = e.target.value;
        this.loadData();
      });
    }

    // Granularity change
    const granularitySelect = document.getElementById('timeGranularity');
    if (granularitySelect) {
      granularitySelect.addEventListener('change', (e) => {
        this.granularity = e.target.value;
        this.updateTimeline();
      });
    }

    // Layer toggles
    const layerToggles = ['showSessions', 'showFileChanges', 'showPrompts'];
    layerToggles.forEach(id => {
      const checkbox = document.getElementById(id);
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          const layer = id.replace('show', '').toLowerCase();
          this.visibleLayers[layer] = e.target.checked;
          this.updateTimeline();
        });
      }
    });
  }

  createTimelineStructure() {
    this.container.innerHTML = `
      <div class="gantt-timeline">
        <div class="timeline-axis">
          <div class="timeline-axis-content" id="timelineAxis"></div>
        </div>
        <div class="timeline-content">
          <div class="timeline-lanes" id="timelineLanes"></div>
        </div>
        <div class="timeline-zoom-controls">
          <button class="timeline-zoom-btn" onclick="ganttTimeline.zoomIn()">+</button>
          <button class="timeline-zoom-btn" onclick="ganttTimeline.zoomOut()">-</button>
        </div>
      </div>
    `;

    // Create tooltip
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'timeline-tooltip';
    this.tooltip.style.display = 'none';
    document.body.appendChild(this.tooltip);
  }

  async loadData() {
    try {
      this.showLoading();
      
      // Get data from the main dashboard
      if (window.dashboard && window.dashboard.data) {
        this.data = this.processData(window.dashboard.data);
        this.renderTimeline();
      } else {
        // Fallback: try to fetch data directly
        const response = await fetch('http://localhost:43917/api/activity');
        if (response.ok) {
          const data = await response.json();
          this.data = this.processData(data);
          this.renderTimeline();
        } else {
          this.showError('Failed to load timeline data');
        }
      }
    } catch (error) {
      console.error('Error loading timeline data:', error);
      this.showError('Error loading timeline data');
    }
  }

  processData(rawData) {
    const processedData = {
      sessions: [],
      fileChanges: [],
      prompts: []
    };

    if (!rawData || !Array.isArray(rawData)) return processedData;

    const now = Date.now();
    const timeRangeMs = this.getTimeRangeMs();

    rawData.forEach(item => {
      const timestamp = new Date(item.timestamp || item.time).getTime();
      if (now - timestamp > timeRangeMs) return;

      // Process sessions
      if (item.type === 'session' || item.event === 'session_start') {
        processedData.sessions.push({
          id: item.id || `session-${timestamp}`,
          type: 'session',
          start: timestamp,
          end: timestamp + (item.duration || 3600000), // Default 1 hour
          title: item.title || 'Coding Session',
          description: item.description || '',
          intensity: this.calculateIntensity(item)
        });
      }

      // Process file changes
      if (item.type === 'file_change' || item.event === 'file_modified') {
        processedData.fileChanges.push({
          id: item.id || `file-${timestamp}`,
          type: 'file_change',
          start: timestamp,
          end: timestamp + (item.duration || 60000), // Default 1 minute
          title: item.file || 'File Change',
          description: item.description || '',
          bytesChanged: item.bytesChanged || 0,
          intensity: this.calculateIntensity(item)
        });
      }

      // Process prompts
      if (item.type === 'prompt' || item.event === 'prompt_sent') {
        processedData.prompts.push({
          id: item.id || `prompt-${timestamp}`,
          type: 'prompt',
          start: timestamp,
          end: timestamp + (item.duration || 30000), // Default 30 seconds
          title: item.prompt || 'AI Prompt',
          description: item.description || '',
          intensity: this.calculateIntensity(item)
        });
      }
    });

    return processedData;
  }

  calculateIntensity(item) {
    const bytesChanged = item.bytesChanged || 0;
    const duration = item.duration || 0;
    
    if (bytesChanged > 10000) return 'high';
    if (bytesChanged > 1000) return 'medium';
    return 'low';
  }

  getTimeRangeMs() {
    const ranges = {
      'all': null, // Show all time data
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    return ranges[this.timeRange] || null;
  }

  renderTimeline() {
    this.renderAxis();
    this.renderLanes();
  }

  renderAxis() {
    const axisContainer = document.getElementById('timelineAxis');
    if (!axisContainer) return;

    const timeRangeMs = this.getTimeRangeMs();
    let startTime, endTime;
    
    if (timeRangeMs) {
      startTime = Date.now() - timeRangeMs;
      endTime = Date.now();
    } else {
      // For "all" time range, find the earliest and latest events
      if (this.data.length === 0) {
        startTime = Date.now() - (24 * 60 * 60 * 1000); // Default to 24h if no data
        endTime = Date.now();
      } else {
        const timestamps = this.data.map(item => new Date(item.timestamp || item.time).getTime());
        startTime = Math.min(...timestamps);
        endTime = Math.max(...timestamps);
      }
    }
    
    axisContainer.innerHTML = '';
    
    // Calculate tick intervals based on granularity
    const tickInterval = this.getTickInterval();
    const ticks = this.generateTicks(startTime, endTime, tickInterval);
    
    ticks.forEach(tick => {
      const tickElement = document.createElement('div');
      tickElement.className = `timeline-tick ${tick.major ? 'major' : 'minor'}`;
      tickElement.style.left = `${tick.position}px`;
      
      const label = document.createElement('div');
      label.className = 'timeline-tick-label';
      label.textContent = tick.label;
      tickElement.appendChild(label);
      
      axisContainer.appendChild(tickElement);
    });
  }

  getTickInterval() {
    const intervals = {
      'minute': 5 * 60 * 1000, // 5 minutes
      '5minute': 15 * 60 * 1000, // 15 minutes
      '15minute': 60 * 60 * 1000, // 1 hour
      'hour': 4 * 60 * 60 * 1000 // 4 hours
    };
    return intervals[this.granularity] || intervals['5minute'];
  }

  generateTicks(startTime, endTime, interval) {
    const ticks = [];
    const timeRange = endTime - startTime;
    this.timelineWidth = timeRange * this.pixelsPerMinute / (60 * 1000);
    
    for (let time = startTime; time <= endTime; time += interval) {
      const position = ((time - startTime) / (endTime - startTime)) * this.timelineWidth;
      const isMajor = (time - startTime) % (interval * 4) === 0;
      
      ticks.push({
        position,
        label: this.formatTime(time),
        major: isMajor
      });
    }
    
    return ticks;
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60 * 60 * 1000) { // Less than 1 hour
      return `${Math.floor(diff / (60 * 1000))}m ago`;
    } else if (diff < 24 * 60 * 60 * 1000) { // Less than 1 day
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }

  renderLanes() {
    const lanesContainer = document.getElementById('timelineLanes');
    if (!lanesContainer) return;

    lanesContainer.innerHTML = '';
    
    const lanes = [
      { id: 'sessions', title: 'Sessions', data: this.data.sessions },
      { id: 'fileChanges', title: 'File Changes', data: this.data.fileChanges },
      { id: 'prompts', title: 'Prompts', data: this.data.prompts }
    ];

    lanes.forEach(lane => {
      if (!this.visibleLayers[lane.id]) return;

      const laneElement = document.createElement('div');
      laneElement.className = 'timeline-lane';
      laneElement.innerHTML = `
        <div class="timeline-lane-header">
          <span class="timeline-lane-icon">${lane.icon}</span>
          <span>${lane.title}</span>
        </div>
        <div class="timeline-lane-content" id="lane-${lane.id}"></div>
      `;

      lanesContainer.appendChild(laneElement);
      this.renderLaneBars(lane.id, lane.data);
    });
  }

  renderLaneBars(laneId, data) {
    const laneContent = document.getElementById(`lane-${laneId}`);
    if (!laneContent) return;

    laneContent.innerHTML = '';
    
    const timeRangeMs = this.getTimeRangeMs();
    let startTime;
    
    if (timeRangeMs) {
      startTime = Date.now() - timeRangeMs;
    } else {
      // For "all" time range, find the earliest event
      if (this.data.length === 0) {
        startTime = Date.now() - (24 * 60 * 60 * 1000); // Default to 24h if no data
      } else {
        const timestamps = this.data.map(item => new Date(item.timestamp || item.time).getTime());
        startTime = Math.min(...timestamps);
      }
    }
    
    data.forEach(item => {
      const bar = document.createElement('div');
      bar.className = `timeline-bar ${item.type} intensity-${item.intensity}`;
      
      const left = ((item.start - startTime) / timeRangeMs) * this.timelineWidth;
      const width = Math.max(((item.end - item.start) / timeRangeMs) * this.timelineWidth, 4);
      
      bar.style.left = `${left}px`;
      bar.style.width = `${width}px`;
      bar.textContent = item.title;
      
      // Add event listeners
      bar.addEventListener('mouseenter', (e) => this.showTooltip(e, item));
      bar.addEventListener('mouseleave', () => this.hideTooltip());
      bar.addEventListener('click', (e) => this.selectBar(e, item));
      
      laneContent.appendChild(bar);
    });
  }

  showTooltip(event, item) {
    if (!this.tooltip) return;

    this.tooltip.innerHTML = `
      <div class="timeline-tooltip-header">
        <span>${item.type === 'session' ? 'T' : item.type === 'file_change' ? 'E' : 'A'}</span>
        <span>${item.title}</span>
      </div>
      <div class="timeline-tooltip-content">
        ${item.description || 'No description available'}
      </div>
      <div class="timeline-tooltip-meta">
        <div>Duration: ${this.formatDuration(item.end - item.start)}</div>
        <div>Started: ${new Date(item.start).toLocaleString()}</div>
        ${item.bytesChanged ? `<div>Bytes Changed: ${item.bytesChanged.toLocaleString()}</div>` : ''}
      </div>
    `;

    this.tooltip.style.display = 'block';
    this.tooltip.style.left = `${event.pageX + 10}px`;
    this.tooltip.style.top = `${event.pageY - 10}px`;
  }

  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.style.display = 'none';
    }
  }

  selectBar(event, item) {
    // Remove previous selection
    if (this.selectedBar) {
      this.selectedBar.classList.remove('selected');
    }

    // Add selection to current bar
    event.target.classList.add('selected');
    this.selectedBar = event.target;

    // Trigger detailed view (could open modal or navigate)
    this.showBarDetails(item);
  }

  showBarDetails(item) {
    // Open the enhanced event modal with detailed information
    showEventModal(item);
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  zoomIn() {
    this.zoomLevel = Math.min(this.zoomLevel * 1.5, 5);
    this.updateTimeline();
  }

  zoomOut() {
    this.zoomLevel = Math.max(this.zoomLevel / 1.5, 0.5);
    this.updateTimeline();
  }

  updateTimeline() {
    this.pixelsPerMinute = 2 * this.zoomLevel;
    this.renderTimeline();
  }

  showLoading() {
    this.container.innerHTML = '<div class="timeline-loading">Loading timeline data...</div>';
  }

  showError(message) {
    this.container.innerHTML = `<div class="timeline-loading" style="color: var(--color-error);">${message}</div>`;
  }
}

// Global timeline instance
let ganttTimeline;

// Timeline control functions
function resetTimelineZoom() {
  if (ganttTimeline) {
    ganttTimeline.zoomLevel = 1;
    ganttTimeline.updateTimeline();
  }
}

function exportTimeline() {
  if (ganttTimeline && ganttTimeline.data) {
    const dataStr = JSON.stringify(ganttTimeline.data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timeline-export-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

// Enhanced Event Modal Functions
function showEventModal(eventData) {
  console.log('showEventModal called with:', eventData);
  const modal = document.getElementById('eventModal');
  if (!modal) {
    console.error('Event modal not found in DOM');
    return;
  }

  // Set modal header with clean, non-redundant information
  const icon = getEventIcon(eventData.type || 'unknown');
  const title = getEventTitle(eventData);
  const timeAgo = formatTimeAgo(eventData.timestamp || eventData.start);
  const workspace = extractWorkspaceName(eventData.workspace_path);
  
  document.getElementById('eventIcon').textContent = icon;
  document.getElementById('eventModalTitle').textContent = title;
  document.getElementById('eventModalTimestamp').textContent = timeAgo;
  document.getElementById('eventModalWorkspace').textContent = workspace;
  
  // Set essential event details only (remove redundancy)
  const eventType = (eventData.type || 'unknown').replace('_', ' ').toUpperCase();
  const filePath = eventData.file || eventData.filePath || eventData.file_path || 'N/A';
  const language = getFileLanguage(filePath);
  
  document.getElementById('eventTypeDetail').textContent = eventType;
  document.getElementById('eventSourceDetail').textContent = eventData.source || 'System';
  document.getElementById('eventSessionDetail').textContent = eventData.session_id || 'N/A';
  document.getElementById('eventFilePathDetail').textContent = filePath;
  document.getElementById('eventLanguageDetail').textContent = language;

  // Generate streamlined content
  const content = generateStreamlinedEventContent(eventData);
  const eventContentDiv = document.getElementById('eventContent');
  if (eventContentDiv) {
    eventContentDiv.innerHTML = content;
  }

  // Show modal
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function extractWorkspaceName(workspacePath) {
  if (!workspacePath) return 'Unknown';
  
  const segments = workspacePath.split('/').filter(s => s);
  
  // Handle specific project folders
  if (workspacePath.includes('/Desktop/')) {
    const projectName = segments[segments.length - 1];
    return `Desktop/${projectName}`;
  }
  if (workspacePath.includes('/Documents/')) {
    const projectName = segments[segments.length - 1];
    return `Documents/${projectName}`;
  }
  if (workspacePath.includes('/new_cursor/')) {
    const projectName = segments[segments.length - 1];
    return `new_cursor/${projectName}`;
  }
  if (workspacePath.includes('/new_cursor_dash/')) {
    const projectName = segments[segments.length - 1];
    return `new_cursor_dash/${projectName}`;
  }
  
  // Handle direct base directories
  if (workspacePath === '/Users/hamidaho/Desktop') return 'Desktop';
  if (workspacePath === '/Users/hamidaho/Documents') return 'Documents';
  if (workspacePath === '/Users/hamidaho/new_cursor') return 'new_cursor';
  if (workspacePath === '/Users/hamidaho/new_cursor_dash') return 'new_cursor_dash';
  
  return segments[segments.length - 1] || 'Unknown';
}

function getFileLanguage(filePath) {
  if (!filePath) return 'Unknown';
  const ext = filePath.split('.').pop()?.toLowerCase();
  const languageMap = {
    'js': 'JavaScript',
    'ts': 'TypeScript', 
    'py': 'Python',
    'html': 'HTML',
    'css': 'CSS',
    'json': 'JSON',
    'md': 'Markdown',
    'txt': 'Text',
    'sh': 'Shell',
    'sql': 'SQL',
    'xml': 'XML',
    'yaml': 'YAML',
    'yml': 'YAML'
  };
  return languageMap[ext] || 'Unknown';
}

function truncateCode(code, maxLength = 1000) {
  if (!code) return '';
  if (code.length <= maxLength) return code;
  return code.substring(0, maxLength) + '\n... (truncated)';
}

function closeEventModal() {
  const modal = document.getElementById('eventModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function getEventIcon(eventType) {
  const icons = {
    'session': 'T',
    'file_change': 'E',
    'prompt': 'A',
    'code_change': 'C',
    'git_commit': 'G',
    'error': 'E',
    'warning': '!',
    'info': 'I'
  };
  return icons[eventType] || 'E';
}

function getEventTitle(eventData) {
  if (eventData.title) return eventData.title;
  
  const titles = {
    'session': 'Coding Session',
    'file_change': 'File Modification',
    'prompt': 'AI Interaction',
    'code_change': 'Code Update',
    'git_commit': 'Git Commit',
    'error': 'Error Event',
    'warning': 'Warning Event',
    'info': 'Information Event'
  };
  return titles[eventData.type] || 'Activity Event';
}

function formatTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function generateStreamlinedEventContent(eventData) {
  const eventType = eventData.type || 'unknown';
  
  switch (eventType) {
    case 'file_change':
    case 'code_change':
      return generateFileChangeContent(eventData);
    case 'session':
      return generateSessionContent(eventData);
    case 'prompt':
      return generatePromptContent(eventData);
    default:
      return generateGenericContent(eventData);
  }
}

function generateEventContent(eventData) {
  switch (eventData.type) {
    case 'session':
      return generateSessionContent(eventData);
    case 'file_change':
    case 'code_change':
      return generateFileChangeContent(eventData);
    case 'prompt':
      return generatePromptContent(eventData);
    case 'git_commit':
      return generateGitCommitContent(eventData);
    case 'error':
      return generateErrorContent(eventData);
    default:
      return generateGenericContent(eventData);
  }
}

function generateSessionContent(eventData) {
  const duration = formatDuration(eventData.end - eventData.start);
  const startTime = new Date(eventData.start).toLocaleString();
  const endTime = new Date(eventData.end).toLocaleString();
  
  return `
    <div class="event-section">
      <h4><span class="event-section-icon">T</span>Session Overview</h4>
      <div class="event-details-grid">
        <div class="event-detail-item">
          <div class="event-detail-label">Duration</div>
          <div class="event-detail-value large">${duration}</div>
        </div>
        <div class="event-detail-item">
          <div class="event-detail-label">Started</div>
          <div class="event-detail-value">${startTime}</div>
        </div>
        <div class="event-detail-item">
          <div class="event-detail-label">Ended</div>
          <div class="event-detail-value">${endTime}</div>
        </div>
        <div class="event-detail-item">
          <div class="event-detail-label">Status</div>
          <div class="event-detail-value success">Active</div>
        </div>
      </div>
    </div>
    
    <div class="event-section">
      <h4><span class="event-section-icon">D</span>Session Activity</h4>
      <div class="session-timeline">
        <ul class="session-activity-list">
          <li class="session-activity-item">
            <div class="session-activity-icon">E</div>
            <div class="session-activity-content">
              <div class="session-activity-title">File Changes</div>
              <div class="session-activity-meta">${eventData.fileChanges || 0} files modified</div>
            </div>
          </li>
          <li class="session-activity-item">
            <div class="session-activity-icon">A</div>
            <div class="session-activity-content">
              <div class="session-activity-title">AI Interactions</div>
              <div class="session-activity-meta">${eventData.prompts || 0} prompts sent</div>
            </div>
          </li>
          <li class="session-activity-item">
            <div class="session-activity-icon">C</div>
            <div class="session-activity-content">
              <div class="session-activity-title">Code Lines</div>
              <div class="session-activity-meta">${eventData.linesAdded || 0} added, ${eventData.linesRemoved || 0} removed</div>
            </div>
          </li>
        </ul>
      </div>
    </div>
    
    ${eventData.description ? `
    <div class="event-section">
      <h4><span class="event-section-icon">E</span>Description</h4>
      <div class="prompt-content">
        <div class="prompt-text">${eventData.description}</div>
      </div>
    </div>
    ` : ''}
  `;
}

function generateFileChangeContent(eventData) {
  const filePath = eventData.file || eventData.filePath || eventData.file_path || 'Unknown file';
  const title = eventData.title || 'File Change';
  const description = eventData.description || 'File change detected';
  const timestamp = new Date(eventData.timestamp).toLocaleString();
  const sessionId = eventData.session_id || 'Unknown';
  
  // Parse details if it's a JSON string
  let details = {};
  if (eventData.details) {
    try {
      details = typeof eventData.details === 'string' ? JSON.parse(eventData.details) : eventData.details;
    } catch (e) {
      console.log('Could not parse details:', eventData.details);
    }
  }
  
  return `
    <div class="event-section">
      <h4><span class="event-section-icon">F</span>File Details</h4>
      <div class="file-change-info">
        <div class="file-path">${filePath}</div>
        <div class="file-description">${description}</div>
      </div>
    </div>
    
    <div class="event-section">
      <h4><span class="event-section-icon">I</span>Event Information</h4>
      <div class="event-info-grid">
        <div class="event-info-item">
          <div class="event-info-label">Event ID</div>
          <div class="event-info-value">${eventData.id || 'N/A'}</div>
        </div>
        <div class="event-info-item">
          <div class="event-info-label">Session ID</div>
          <div class="event-info-value">${sessionId}</div>
        </div>
        <div class="event-info-item">
          <div class="event-info-label">Timestamp</div>
          <div class="event-info-value">${timestamp}</div>
        </div>
        <div class="event-info-item">
          <div class="event-info-label">Workspace</div>
          <div class="event-info-value">${eventData.workspace_path || 'Unknown'}</div>
        </div>
      </div>
    </div>
    
    ${Object.keys(details).length > 0 ? `
    <div class="event-section">
      <h4><span class="event-section-icon">D</span>Additional Details</h4>
      <div class="details-content">
        <pre class="details-json">${JSON.stringify(details, null, 2)}</pre>
      </div>
    </div>
    ` : ''}
  `;
}

function generatePromptContent(eventData) {
  const promptText = eventData.prompt || eventData.text || 'No prompt text available';
  const responseText = eventData.response || eventData.answer || '';
  const model = eventData.model || 'Unknown model';
  const tokens = eventData.tokens || 0;
  
  return `
    <div class="event-section">
      <h4><span class="event-section-icon">A</span>AI Interaction</h4>
      <div class="prompt-content">
        <div class="prompt-text">${escapeHtml(promptText)}</div>
        <div class="prompt-metadata">
          <div class="event-detail-item">
            <div class="event-detail-label">Model</div>
            <div class="event-detail-value">${model}</div>
          </div>
          <div class="event-detail-item">
            <div class="event-detail-label">Tokens</div>
            <div class="event-detail-value">${tokens.toLocaleString()}</div>
          </div>
          <div class="event-detail-item">
            <div class="event-detail-label">Temperature</div>
            <div class="event-detail-value">${eventData.temperature || 'N/A'}</div>
          </div>
          <div class="event-detail-item">
            <div class="event-detail-label">Mode</div>
            <div class="event-detail-value">${eventData.mode || 'Manual'}</div>
          </div>
        </div>
      </div>
      
      ${responseText ? `
      <div class="prompt-response">
        <div class="prompt-response-header">
          <span>A</span>
          <span>AI Response</span>
        </div>
        <div class="prompt-response-text">${escapeHtml(responseText)}</div>
      </div>
      ` : ''}
    </div>
    
    <div class="event-section">
      <h4><span class="event-section-icon">D</span>Interaction Metrics</h4>
      <div class="event-details-grid">
        <div class="event-detail-item">
          <div class="event-detail-label">Response Time</div>
          <div class="event-detail-value">${eventData.responseTime || 'N/A'}</div>
        </div>
        <div class="event-detail-item">
          <div class="event-detail-label">Quality Score</div>
          <div class="event-detail-value">${eventData.qualityScore || 'N/A'}</div>
        </div>
        <div class="event-detail-item">
          <div class="event-detail-label">Complexity</div>
          <div class="event-detail-value">${eventData.complexity || 'N/A'}</div>
        </div>
        <div class="event-detail-item">
          <div class="event-detail-label">Category</div>
          <div class="event-detail-value">${eventData.category || 'General'}</div>
        </div>
      </div>
    </div>
  `;
}

function generateGitCommitContent(eventData) {
  const commitHash = eventData.hash || eventData.sha || 'Unknown';
  const author = eventData.author || 'Unknown';
  const message = eventData.message || 'No message';
  
  return `
    <div class="event-section">
      <h4><span class="event-section-icon">G</span>Commit Information</h4>
      <div class="event-details-grid">
        <div class="event-detail-item">
          <div class="event-detail-label">Hash</div>
          <div class="event-detail-value">${commitHash.substring(0, 8)}</div>
        </div>
        <div class="event-detail-item">
          <div class="event-detail-label">Author</div>
          <div class="event-detail-value">${author}</div>
        </div>
        <div class="event-detail-item">
          <div class="event-detail-label">Branch</div>
          <div class="event-detail-value">${eventData.branch || 'main'}</div>
        </div>
        <div class="event-detail-item">
          <div class="event-detail-label">Files Changed</div>
          <div class="event-detail-value">${eventData.filesChanged || 0}</div>
        </div>
      </div>
    </div>
    
    <div class="event-section">
      <h4><span class="event-section-icon">💬</span>Commit Message</h4>
      <div class="prompt-content">
        <div class="prompt-text">${escapeHtml(message)}</div>
      </div>
    </div>
    
    <div class="event-section">
      <h4><span class="event-section-icon">D</span>Commit Statistics</h4>
      <div class="code-stats">
        <div class="code-stat-item">
          <div class="code-stat-value">${eventData.insertions || 0}</div>
          <div class="code-stat-label">Insertions</div>
        </div>
        <div class="code-stat-item">
          <div class="code-stat-value">${eventData.deletions || 0}</div>
          <div class="code-stat-label">Deletions</div>
        </div>
        <div class="code-stat-item">
          <div class="code-stat-value">${eventData.filesChanged || 0}</div>
          <div class="code-stat-label">Files</div>
        </div>
      </div>
    </div>
  `;
}

function generateErrorContent(eventData) {
  const errorMessage = eventData.message || eventData.error || 'Unknown error';
  const stackTrace = eventData.stack || '';
  const severity = eventData.severity || 'error';
  
  return `
    <div class="event-section">
      <h4><span class="event-section-icon">E</span>Error Details</h4>
      <div class="event-details-grid">
        <div class="event-detail-item">
          <div class="event-detail-label">Severity</div>
          <div class="event-detail-value ${severity}">${severity.toUpperCase()}</div>
        </div>
        <div class="event-detail-item">
          <div class="event-detail-label">Type</div>
          <div class="event-detail-value">${eventData.errorType || 'Unknown'}</div>
        </div>
        <div class="event-detail-item">
          <div class="event-detail-label">Source</div>
          <div class="event-detail-value">${eventData.source || 'Unknown'}</div>
        </div>
        <div class="event-detail-item">
          <div class="event-detail-label">Resolved</div>
          <div class="event-detail-value">${eventData.resolved ? 'Yes' : 'No'}</div>
        </div>
      </div>
    </div>
    
    <div class="event-section">
      <h4><span class="event-section-icon">💬</span>Error Message</h4>
      <div class="prompt-content">
        <div class="prompt-text">${escapeHtml(errorMessage)}</div>
      </div>
    </div>
    
    ${stackTrace ? `
    <div class="event-section">
      <h4><span class="event-section-icon">🔍</span>Stack Trace</h4>
      <div class="code-change-content">${escapeHtml(stackTrace)}</div>
    </div>
    ` : ''}
  `;
}

function generateGenericContent(eventData) {
  return `
    <div class="event-section">
      <h4><span class="event-section-icon">E</span>Event Details</h4>
      <div class="event-details-grid">
        <div class="event-detail-item">
          <div class="event-detail-label">Type</div>
          <div class="event-detail-value">${eventData.type}</div>
        </div>
        <div class="event-detail-item">
          <div class="event-detail-label">ID</div>
          <div class="event-detail-value">${eventData.id || 'N/A'}</div>
        </div>
        <div class="event-detail-item">
          <div class="event-detail-label">Source</div>
          <div class="event-detail-value">${eventData.source || 'Unknown'}</div>
        </div>
        <div class="event-detail-item">
          <div class="event-detail-label">Status</div>
          <div class="event-detail-value success">Active</div>
        </div>
      </div>
    </div>
    
    ${eventData.description ? `
    <div class="event-section">
      <h4><span class="event-section-icon">E</span>Description</h4>
      <div class="prompt-content">
        <div class="prompt-text">${escapeHtml(eventData.description)}</div>
      </div>
    </div>
    ` : ''}
    
    <div class="event-section">
      <h4><span class="event-section-icon">🔧</span>Raw Data</h4>
      <div class="code-change-content">${JSON.stringify(eventData, null, 2)}</div>
    </div>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// Event modal control functions
function exportEventData() {
  // Implementation for exporting event data
  console.log('Export event data functionality');
}

function viewRelatedEvents() {
  // Implementation for viewing related events
  console.log('View related events functionality');
}

// Multi-workspace analytics implementations
ActivityDashboard.prototype.renderWorkspaceComparison = function() {
  const container = document.getElementById('workspaceComparison');
  if (!container) return;
  
  const comparisonData = this.generateWorkspaceComparison();
  
  container.innerHTML = `
    <div class="workspace-comparison-container">
      <h4>Workspace Comparison</h4>
      <div class="comparison-grid">
        ${comparisonData.map(workspace => `
          <div class="workspace-card">
            <div class="workspace-header">
              <h5>${workspace.name}</h5>
              <span class="workspace-path">${workspace.path}</span>
            </div>
            <div class="workspace-metrics">
              <div class="metric">
                <span class="metric-label">Events:</span>
                <span class="metric-value">${workspace.events}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Files:</span>
                <span class="metric-value">${workspace.files}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Sessions:</span>
                <span class="metric-value">${workspace.sessions}</span>
              </div>
              <div class="metric">
                <span class="metric-label">AI Interactions:</span>
                <span class="metric-value">${workspace.aiInteractions}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Productivity Score:</span>
                <span class="metric-value">${(parseFloat(workspace.productivity?.score) || 0).toFixed(1)}</span>
              </div>
              ${workspace.productivity ? `
                <div class="metric">
                  <span class="metric-label">Recent Activity:</span>
                  <span class="metric-value">${workspace.productivity.recentActivity || 0} events</span>
                </div>
                <div class="metric">
                  <span class="metric-label">Active Days:</span>
                  <span class="metric-value">${workspace.productivity.activeDays || 0}/7</span>
                </div>
                <div class="metric">
                  <span class="metric-label">Consistency:</span>
                  <span class="metric-value">${((workspace.productivity.consistency || 0) * 100).toFixed(0)}%</span>
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
};

ActivityDashboard.prototype.generateWorkspaceComparison = function() {
  return this.workspaces.map(workspace => ({
    name: workspace.name,
    path: workspace.path,
    events: workspace.events || 0,
    files: workspace.files || 0,
    sessions: workspace.sessions || 0,
    aiInteractions: workspace.aiInteractions || 0,
    productivity: workspace.productivity?.score || 0
  }));
};

ActivityDashboard.prototype.renderGlobalCodePatterns = function() {
  const container = document.getElementById('globalCodePatterns');
  if (!container) return;
  
  const globalPatterns = this.analyzeGlobalCodePatterns();
  
  container.innerHTML = `
    <div class="global-patterns-container">
      <h4>Global Code Patterns (All Workspaces)</h4>
      <div class="patterns-grid">
        ${globalPatterns.map((pattern, index) => `
          <div class="pattern-card">
            <div class="pattern-rank">${index + 1}</div>
            <div class="pattern-info">
              <div class="pattern-name">${pattern.name}</div>
              <div class="pattern-frequency">${pattern.frequency} occurrences</div>
              <div class="pattern-workspaces">Workspaces: ${pattern.workspaces.join(', ')}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
};

ActivityDashboard.prototype.analyzeGlobalCodePatterns = function() {
  const allEvents = this.events || [];
  const patterns = {};
  
  allEvents.forEach(event => {
    try {
      const details = JSON.parse(event.details || '{}');
      const content = details.content || details.before_content || '';
      const workspace = event.workspace_path || 'unknown';
      
      // Extract patterns from content
      const codePatterns = this.extractCodePatterns(content);
      codePatterns.forEach(pattern => {
        if (!patterns[pattern]) {
          patterns[pattern] = { frequency: 0, workspaces: new Set() };
        }
        patterns[pattern].frequency++;
        patterns[pattern].workspaces.add(workspace);
      });
    } catch (e) {
      // Skip invalid events
    }
  });
  
  return Object.entries(patterns)
    .map(([name, data]) => ({
      name,
      frequency: data.frequency,
      workspaces: Array.from(data.workspaces)
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);
};

ActivityDashboard.prototype.renderCrossWorkspaceMetrics = function() {
  const container = document.getElementById('crossWorkspaceMetrics');
  if (!container) return;
  
  const crossMetrics = this.calculateCrossWorkspaceMetrics();
  
  container.innerHTML = `
    <div class="cross-workspace-container">
      <h4>Cross-Workspace Metrics</h4>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-title">Total Workspaces</div>
          <div class="metric-value">${crossMetrics.totalWorkspaces}</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Active Workspaces</div>
          <div class="metric-value">${crossMetrics.activeWorkspaces}</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Total Events</div>
          <div class="metric-value">${crossMetrics.totalEvents}</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Total Files</div>
          <div class="metric-value">${crossMetrics.totalFiles}</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Total Sessions</div>
          <div class="metric-value">${crossMetrics.totalSessions}</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Total AI Interactions</div>
          <div class="metric-value">${crossMetrics.totalAIInteractions}</div>
        </div>
      </div>
    </div>
  `;
};

ActivityDashboard.prototype.calculateCrossWorkspaceMetrics = function() {
  const totalWorkspaces = this.workspaces.length;
  const activeWorkspaces = this.workspaces.filter(w => w.events > 0).length;
  const totalEvents = this.workspaces.reduce((sum, w) => sum + (w.events || 0), 0);
  const totalFiles = this.workspaces.reduce((sum, w) => sum + (w.files || 0), 0);
  const totalSessions = this.workspaces.reduce((sum, w) => sum + (w.sessions || 0), 0);
  const totalAIInteractions = this.workspaces.reduce((sum, w) => sum + (w.aiInteractions || 0), 0);
  
  return {
    totalWorkspaces,
    activeWorkspaces,
    totalEvents,
    totalFiles,
    totalSessions,
    totalAIInteractions
  };
};

ActivityDashboard.prototype.renderGlobalStats = function() {
  const container = document.getElementById('globalStats');
  if (!container) return;
  
  const globalStats = this.calculateGlobalStats();
  
  container.innerHTML = `
    <div class="global-stats-container">
      <h4>Global Statistics</h4>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">Most Active Workspace:</span>
          <span class="stat-value">${globalStats.mostActiveWorkspace}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Most Productive Workspace:</span>
          <span class="stat-value">${globalStats.mostProductiveWorkspace}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Average Productivity:</span>
          <span class="stat-value">${globalStats.averageProductivity.toFixed(1)}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Total Development Time:</span>
          <span class="stat-value">${globalStats.totalDevelopmentTime}</span>
        </div>
      </div>
    </div>
  `;
};

ActivityDashboard.prototype.calculateGlobalStats = function() {
  const mostActiveWorkspace = this.workspaces.reduce((max, w) => 
    (w.events || 0) > (max.events || 0) ? w : max, { events: 0, name: 'None' });
  
  const mostProductiveWorkspace = this.workspaces.reduce((max, w) => 
    (w.productivity || 0) > (max.productivity || 0) ? w : max, { productivity: 0, name: 'None' });
  
  const averageProductivity = this.workspaces.length > 0 
    ? this.workspaces.reduce((sum, w) => sum + (w.productivity || 0), 0) / this.workspaces.length 
    : 0;
  
  const totalDevelopmentTime = this.workspaces.reduce((sum, w) => {
    const lastActivity = w.lastActivity ? new Date(w.lastActivity) : new Date(0);
    const now = new Date();
    return sum + Math.max(0, now - lastActivity);
  }, 0);
  
  return {
    mostActiveWorkspace: mostActiveWorkspace.name,
    mostProductiveWorkspace: mostProductiveWorkspace.name,
    averageProductivity,
    totalDevelopmentTime: this.formatDuration(totalDevelopmentTime)
  };
};

ActivityDashboard.prototype.renderWorkspaceDistribution = function() {
  const container = document.getElementById('workspaceDistribution');
  if (!container) return;
  
  const distribution = this.calculateWorkspaceDistribution();
  
  container.innerHTML = `
    <div class="workspace-distribution-container">
      <h4>Workspace Activity Distribution</h4>
      <div class="distribution-chart">
        ${distribution.map(item => `
          <div class="distribution-item">
            <div class="workspace-name">${item.name}</div>
            <div class="activity-bar">
              <div class="activity-fill" style="width: ${item.percentage}%"></div>
              <span class="activity-percentage">${item.percentage.toFixed(1)}%</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
};

ActivityDashboard.prototype.calculateWorkspaceDistribution = function() {
  const totalEvents = this.workspaces.reduce((sum, w) => sum + (w.events || 0), 0);
  
  return this.workspaces.map(workspace => ({
    name: workspace.name,
    events: workspace.events || 0,
    percentage: totalEvents > 0 ? ((workspace.events || 0) / totalEvents) * 100 : 0
  })).sort((a, b) => b.events - a.events);
};

ActivityDashboard.prototype.renderProductivityInsights = function() {
  const container = document.getElementById('productivityInsights');
  if (!container) return;
  
  const insights = this.generateProductivityInsights();
  
  container.innerHTML = `
    <div class="productivity-insights-container">
      <h4>Productivity Insights</h4>
      <div class="insights-list">
        ${insights.map(insight => `
          <div class="insight-item">
            <div class="insight-icon">${insight.icon}</div>
            <div class="insight-content">
              <div class="insight-title">${insight.title}</div>
              <div class="insight-description">${insight.description}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
};

ActivityDashboard.prototype.generateProductivityInsights = function() {
  const insights = [];
  
  // Most active workspace insight
  const mostActive = this.workspaces.reduce((max, w) => 
    (w.events || 0) > (max.events || 0) ? w : max, { events: 0, name: 'None' });
  
  if (mostActive.events > 0) {
    insights.push({
      icon: 'D',
      title: 'Most Active Workspace',
      description: `${mostActive.name} has ${mostActive.events} events, showing high development activity.`
    });
  }
  
  // Productivity distribution insight
  const productiveWorkspaces = this.workspaces.filter(w => (w.productivity || 0) > 5).length;
  if (productiveWorkspaces > 0) {
    insights.push({
      icon: 'R',
      title: 'Productivity Distribution',
      description: `${productiveWorkspaces} out of ${this.workspaces.length} workspaces show high productivity scores.`
    });
  }
  
  // AI interaction insight
  const totalAIInteractions = this.workspaces.reduce((sum, w) => sum + (w.aiInteractions || 0), 0);
  if (totalAIInteractions > 0) {
    insights.push({
      icon: 'A',
      title: 'AI Collaboration',
      description: `Total of ${totalAIInteractions} AI interactions across all workspaces.`
    });
  }
  
  return insights;
};

ActivityDashboard.prototype.formatDuration = function(ms) {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};

// Missing Modal Functions
function showSessionModal(sessionData) {
  const modal = document.getElementById('sessionModal');
  if (!modal) return;
  
  // Set session details
  document.getElementById('sessionId').textContent = sessionData.id || 'Unknown';
  document.getElementById('sessionDuration').textContent = sessionData.duration || 'Unknown';
  document.getElementById('sessionWorkspace').textContent = sessionData.workspace || 'Unknown';
  
  // Set session timeline
  const timelineContainer = document.getElementById('sessionTimeline');
  if (timelineContainer && sessionData.sessionTimeline) {
    timelineContainer.innerHTML = sessionData.sessionTimeline.map(item => `
      <div class="session-timeline-item ${item.type}">
        <div class="session-timeline-time">${item.time}</div>
        <div class="session-timeline-content">${item.content}</div>
      </div>
    `).join('');
  }
  
  modal.style.display = 'flex';
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => {
      modal.style.display = 'none';
    }, 300);
  }
}

// Global close modal function for event modals
function closeEventModal() {
  const modal = document.getElementById('eventModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Helper functions for modals
function getEventIcon(type) {
  const icons = {
    'code_change': 'E',
    'file_change': 'F',
    'prompt_response': 'A',
    'session_event': 'T',
    'clipboard': 'C',
    'idle': 'I',
    'unknown': 'U'
  };
  return icons[type] || 'U';
}

function getEventTitle(event) {
  if (event.title) return event.title;
  
  // Try to infer type from context if type is undefined
  let eventType = event.type;
  if (!eventType) {
    if (event.file || event.filePath || event.file_path) {
      const fileName = (event.file || event.filePath || event.file_path).split('/').pop();
      if (fileName && (fileName.includes('.js') || fileName.includes('.ts') || fileName.includes('.py'))) {
        eventType = 'code_change';
      } else {
        eventType = 'file_change';
      }
    } else if (event.prompt || event.response) {
      eventType = 'prompt_response';
    } else if (event.session_id) {
      eventType = 'session_event';
    } else {
      eventType = 'file_change'; // Default fallback
    }
  }
  
  if (eventType === 'code_change') return 'Code Change';
  if (eventType === 'file_change') return 'File Change';
  if (eventType === 'prompt_response') return 'AI Response';
  if (eventType === 'session_event') return 'Session Event';
  return 'Activity Event';
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Unknown time';
  const now = new Date();
  const eventTime = new Date(timestamp);
  const diffMs = now - eventTime;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}


// Global function to open file in editor
function openInEditor() {
  const modal = document.getElementById('eventModal');
  if (!modal) return;
  
  const eventContent = document.getElementById('eventContent');
  if (!eventContent) return;
  
  // Try to extract file path from the event content
  const filePathElement = eventContent.querySelector('.file-path');
  if (filePathElement) {
    const filePath = filePathElement.textContent.trim();
    if (filePath) {
      // Try to open in VS Code/Cursor
      const command = `code "${filePath}"`;
      console.log('Opening file in editor:', filePath);
      
      // Show a message to the user
      alert(`Opening file in editor: ${filePath}`);
      
      // Note: In a real implementation, you would need to use an API
      // to communicate with the editor or use a protocol handler
    }
  } else {
    console.log('No file path found in event content');
    alert('No file path available to open in editor');
  }
}

// TimeSeriesVisualizer Class is loaded from time-series-visualizer.js

// PromptAnalyticsEngine Class is loaded from prompt-analytics-engine.js

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  try {
    dashboard = new ActivityDashboard();
    
    // Make dashboard accessible globally as both 'dashboard' and 'activityDashboard'
    window.dashboard = dashboard;
    window.activityDashboard = dashboard;
    
    // Update dashboard status
    const dashboardStatus = document.getElementById('dashboardStatus');
    if (dashboardStatus) {
      dashboardStatus.textContent = 'Loaded';
      dashboardStatus.style.color = 'var(--color-success)';
    }
    
    // Force render activity feed after a short delay to ensure data is loaded
    setTimeout(() => {
      console.log('Force rendering activity feed...');
      if (dashboard && dashboard.renderActivityFeed) {
        dashboard.renderActivityFeed();
      }
    }, 2000);
    
  } catch (error) {
    console.error('Failed to initialize dashboard:', error);
    
    // Update dashboard status
    const dashboardStatus = document.getElementById('dashboardStatus');
    if (dashboardStatus) {
      dashboardStatus.textContent = 'Error';
      dashboardStatus.style.color = 'var(--color-error)';
    }
  }
  
  // Initialize timeline when timeline tab is activated
  const timelineTab = document.querySelector('[data-tab="timeline"]');
  if (timelineTab) {
    timelineTab.addEventListener('click', () => {
      console.log('Timeline tab clicked, initializing timeline...');
      // Force render timeline with current data
      if (window.activityDashboard) {
        window.activityDashboard.renderTimeline();
      }
    });
  }
});

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('diffModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
};
// Event Modal Utility Methods
ActivityDashboard.prototype.detectLanguageFromFilePath = function(filePath) {
  const extensionMap = {
    'js': 'JavaScript',
    'ts': 'TypeScript',
    'py': 'Python',
    'java': 'Java',
    'cpp': 'C++',
    'c': 'C',
    'rb': 'Ruby',
    'go': 'Go',
    'rs': 'Rust',
    'swift': 'Swift',
    'kt': 'Kotlin',
    'php': 'PHP',
    'html': 'HTML',
    'css': 'CSS',
    'scss': 'SCSS',
    'json': 'JSON',
    'yaml': 'YAML',
    'yml': 'YAML',
    'md': 'Markdown'
  };

  const extension = filePath.split('.').pop().toLowerCase();
  return extensionMap[extension] || 'Unknown';
};

ActivityDashboard.prototype.copyEventDetails = function() {
  const eventDetails = `
Event Details:
--------------
Type: ${document.getElementById('eventTypeDetail').textContent}
Source: ${document.getElementById('eventSourceDetail').textContent}
Session: ${document.getElementById('eventSessionDetail').textContent}
Timestamp: ${document.getElementById('eventModalTimestamp').textContent}
Workspace: ${document.getElementById('eventModalWorkspace').textContent}

File Context:
-------------
File Path: ${document.getElementById('eventFilePathDetail').textContent}
Language: ${document.getElementById('eventLanguageDetail').textContent}

Code Changes:
-------------
Lines Added: ${document.getElementById('linesAddedStat').textContent}
Lines Removed: ${document.getElementById('linesRemovedStat').textContent}

Before Code:
${document.getElementById('eventDiffBefore').textContent}

After Code:
${document.getElementById('eventDiffAfter').textContent}
  `;

  navigator.clipboard.writeText(eventDetails).then(() => {
    alert('Event details copied to clipboard!');
  }).catch(err => {
    console.error('Could not copy text: ', err);
  });
};

ActivityDashboard.prototype.openInEditor = function() {
  const filePath = document.getElementById('eventFilePathDetail').textContent;
  alert(`Would open ${filePath} in default editor`);
  // TODO: Implement actual editor opening mechanism
};

// ============================================================================
// Time Series Visualizer Class (loaded from time-series-visualizer.js)
// ============================================================================

// The TimeSeriesVisualizer class is loaded from time-series-visualizer.js
// and made globally available automatically.
