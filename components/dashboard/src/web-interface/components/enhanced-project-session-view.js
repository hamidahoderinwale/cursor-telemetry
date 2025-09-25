/**
 * Enhanced Project/Session View Component
 * Consolidates project and session views with improved organization
 */

class EnhancedProjectSessionView {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.currentProject = null;
        this.currentView = 'projects'; // 'projects' or 'sessions'
        this.filteredProjects = [];
        this.filteredSessions = [];
        this.searchQuery = '';
        this.categoryFilter = '';
        this.sortBy = 'activity'; // 'activity', 'name', 'sessions', 'size'
        this.sortOrder = 'desc'; // 'asc' or 'desc'
        
        this.initializeView();
    }

    /**
     * Initialize the enhanced project/session view
     */
    initializeView() {
        this.createViewHTML();
        this.setupEventListeners();
        this.loadProjects();
    }

    /**
     * Create the HTML structure for the enhanced view
     */
    createViewHTML() {
        const container = document.getElementById('sessions-list');
        if (!container) return;

        container.innerHTML = `
            <div class="enhanced-project-session-view">
                <!-- Header with controls -->
                <div class="view-header">
                    <div class="view-title-section">
                        <h2 class="view-title">Projects & Sessions</h2>
                        <p class="view-description">Organized by project directories with comprehensive session analysis</p>
                    </div>
                    <div class="view-controls">
                        <div class="view-toggle">
                            <button class="toggle-btn ${this.currentView === 'projects' ? 'active' : ''}" 
                                    onclick="enhancedProjectSessionView.switchView('projects')">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                                    <polyline points="9,22 9,12 15,12 15,22"></polyline>
                                </svg>
                                Projects
                            </button>
                            <button class="toggle-btn ${this.currentView === 'sessions' ? 'active' : ''}" 
                                    onclick="enhancedProjectSessionView.switchView('sessions')">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14,2 14,8 20,8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                </svg>
                                Sessions
                            </button>
                        </div>
                        <button class="btn btn-secondary btn-sm" onclick="enhancedProjectSessionView.refreshData()">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="23 4 23 10 17 10"></polyline>
                                <polyline points="1 20 1 14 7 14"></polyline>
                                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                            </svg>
                            Refresh
                        </button>
                    </div>
                </div>

                <!-- Search and filters -->
                <div class="search-filters-section">
                    <div class="search-container">
                        <div class="search-input-wrapper">
                            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="11" cy="11" r="8"></circle>
                                <path d="m21 21-4.35-4.35"></path>
                            </svg>
                            <input type="text" class="search-input" id="project-session-search" 
                                   placeholder="Search projects or sessions..." 
                                   oninput="enhancedProjectSessionView.handleSearch(this.value)">
                        </div>
                    </div>
                    <div class="filters-container">
                        <select class="filter-select" id="category-filter" onchange="enhancedProjectSessionView.handleCategoryFilter(this.value)">
                            <option value="">All Categories</option>
                            <option value="machine_learning">Machine Learning</option>
                            <option value="development_tools">Development Tools</option>
                            <option value="python">Python</option>
                            <option value="javascript">JavaScript</option>
                            <option value="experiments">Experiments</option>
                            <option value="other">Other</option>
                        </select>
                        <select class="filter-select" id="sort-select" onchange="enhancedProjectSessionView.handleSort(this.value)">
                            <option value="activity">Sort by Activity</option>
                            <option value="name">Sort by Name</option>
                            <option value="sessions">Sort by Sessions</option>
                            <option value="size">Sort by Size</option>
                        </select>
                    </div>
                </div>

                <!-- Content area -->
                <div class="content-area">
                    <div class="projects-view" id="projects-view" style="display: ${this.currentView === 'projects' ? 'block' : 'none'}">
                        <div class="projects-grid" id="projects-grid">
                            <!-- Projects will be rendered here -->
                        </div>
                    </div>
                    <div class="sessions-view" id="sessions-view" style="display: ${this.currentView === 'sessions' ? 'block' : 'none'}">
                        <div class="sessions-list" id="sessions-list-content">
                            <!-- Sessions will be rendered here -->
                        </div>
                    </div>
                </div>

                <!-- Project detail modal -->
                <div class="modal" id="projectDetailModal">
                    <div class="modal-content project-detail-modal">
                        <div class="modal-header">
                            <h2 class="modal-title" id="project-detail-title">Project Details</h2>
                            <button class="modal-close" onclick="enhancedProjectSessionView.closeProjectDetail()">&times;</button>
                        </div>
                        <div class="modal-body" id="project-detail-body">
                            <!-- Project details will be loaded here -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add styles
        this.addStyles();
    }

    /**
     * Add CSS styles for the enhanced view
     */
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .enhanced-project-session-view {
                padding: 20px;
                max-width: 1200px;
                margin: 0 auto;
            }

            .view-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 24px;
                padding-bottom: 16px;
                border-bottom: 1px solid var(--border-color);
            }

            .view-title-section {
                flex: 1;
            }

            .view-title {
                font-size: 24px;
                font-weight: var(--font-weight-bold);
                color: var(--text-primary);
                margin: 0 0 8px 0;
            }

            .view-description {
                font-size: 14px;
                color: var(--text-secondary);
                margin: 0;
            }

            .view-controls {
                display: flex;
                align-items: center;
                gap: 16px;
            }

            .view-toggle {
                display: flex;
                background: var(--background-secondary);
                border-radius: 8px;
                padding: 4px;
                border: 1px solid var(--border-color);
            }

            .toggle-btn {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 16px;
                border: none;
                background: transparent;
                color: var(--text-secondary);
                font-size: 14px;
                font-weight: var(--font-weight-medium);
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .toggle-btn:hover {
                background: var(--background-primary);
                color: var(--text-primary);
            }

            .toggle-btn.active {
                background: var(--accent-primary);
                color: white;
            }

            .search-filters-section {
                display: flex;
                gap: 16px;
                margin-bottom: 24px;
                align-items: center;
            }

            .search-container {
                flex: 1;
            }

            .search-input-wrapper {
                position: relative;
                display: flex;
                align-items: center;
            }

            .search-icon {
                position: absolute;
                left: 12px;
                color: var(--text-tertiary);
                z-index: 1;
            }

            .search-input {
                width: 100%;
                padding: 12px 12px 12px 40px;
                border: 1px solid var(--border-color);
                border-radius: 8px;
                background: var(--background-primary);
                color: var(--text-primary);
                font-size: 14px;
                transition: border-color 0.2s ease;
            }

            .search-input:focus {
                outline: none;
                border-color: var(--accent-primary);
            }

            .filters-container {
                display: flex;
                gap: 12px;
            }

            .filter-select {
                padding: 12px 16px;
                border: 1px solid var(--border-color);
                border-radius: 8px;
                background: var(--background-primary);
                color: var(--text-primary);
                font-size: 14px;
                cursor: pointer;
                transition: border-color 0.2s ease;
            }

            .filter-select:focus {
                outline: none;
                border-color: var(--accent-primary);
            }

            .content-area {
                min-height: 400px;
            }

            .projects-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                gap: 20px;
            }

            .project-card {
                background: var(--background-primary);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 20px;
                transition: all 0.2s ease;
                cursor: pointer;
            }

            .project-card:hover {
                border-color: var(--accent-primary);
                transform: translateY(-2px);
                box-shadow: var(--shadow-md);
            }

            .project-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 12px;
            }

            .project-name {
                font-size: 18px;
                font-weight: var(--font-weight-bold);
                color: var(--text-primary);
                margin: 0;
                flex: 1;
            }

            .project-category {
                background: var(--background-secondary);
                color: var(--text-secondary);
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: var(--font-weight-medium);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .project-path {
                font-size: 12px;
                color: var(--text-tertiary);
                margin-bottom: 12px;
                font-family: var(--font-family-mono);
            }

            .project-stats {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
                margin-bottom: 16px;
            }

            .stat-item {
                text-align: center;
                padding: 8px;
                background: var(--background-secondary);
                border-radius: 6px;
            }

            .stat-value {
                font-size: 16px;
                font-weight: var(--font-weight-bold);
                color: var(--text-primary);
                display: block;
            }

            .stat-label {
                font-size: 11px;
                color: var(--text-secondary);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .project-indicators {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                margin-bottom: 12px;
            }

            .indicator-badge {
                background: var(--accent-primary);
                color: white;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 10px;
                font-weight: var(--font-weight-bold);
            }

            .project-actions {
                display: flex;
                gap: 8px;
            }

            .action-btn {
                flex: 1;
                padding: 8px 12px;
                border: 1px solid var(--border-color);
                background: var(--background-primary);
                color: var(--text-primary);
                font-size: 12px;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .action-btn:hover {
                background: var(--background-secondary);
                border-color: var(--accent-primary);
            }

            .action-btn.primary {
                background: var(--accent-primary);
                color: white;
                border-color: var(--accent-primary);
            }

            .action-btn.primary:hover {
                background: var(--accent-primary-hover);
            }

            .sessions-list {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .session-card {
                background: var(--background-primary);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                padding: 16px;
                transition: all 0.2s ease;
            }

            .session-card:hover {
                border-color: var(--accent-primary);
                transform: translateY(-1px);
            }

            .session-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }

            .session-title {
                font-size: 16px;
                font-weight: var(--font-weight-bold);
                color: var(--text-primary);
                margin: 0;
            }

            .session-status {
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: var(--font-weight-medium);
                text-transform: uppercase;
            }

            .session-status.success {
                background: var(--status-success-bg);
                color: var(--status-success);
            }

            .session-status.in_progress {
                background: var(--status-warning-bg);
                color: var(--status-warning);
            }

            .session-status.failed {
                background: var(--status-error-bg);
                color: var(--status-error);
            }

            .session-meta {
                display: flex;
                gap: 16px;
                font-size: 12px;
                color: var(--text-secondary);
                margin-bottom: 8px;
            }

            .session-description {
                font-size: 14px;
                color: var(--text-primary);
                line-height: 1.4;
            }

            .project-detail-modal {
                max-width: 800px;
                max-height: 90vh;
                overflow-y: auto;
            }

            .project-detail-content {
                display: flex;
                flex-direction: column;
                gap: 20px;
            }

            .detail-section {
                background: var(--background-secondary);
                padding: 16px;
                border-radius: 8px;
                border: 1px solid var(--border-color);
            }

            .detail-section h3 {
                font-size: 16px;
                font-weight: var(--font-weight-bold);
                color: var(--text-primary);
                margin: 0 0 12px 0;
            }

            .detail-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 12px;
            }

            .detail-item {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .detail-label {
                font-size: 12px;
                color: var(--text-secondary);
                font-weight: var(--font-weight-medium);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .detail-value {
                font-size: 14px;
                color: var(--text-primary);
                font-family: var(--font-family-mono);
            }

            .sessions-preview {
                max-height: 300px;
                overflow-y: auto;
            }

            .session-preview-item {
                padding: 8px 12px;
                border-bottom: 1px solid var(--border-color);
                cursor: pointer;
                transition: background-color 0.2s ease;
            }

            .session-preview-item:hover {
                background: var(--background-primary);
            }

            .session-preview-item:last-child {
                border-bottom: none;
            }

            .session-preview-title {
                font-size: 14px;
                font-weight: var(--font-weight-medium);
                color: var(--text-primary);
                margin-bottom: 4px;
            }

            .session-preview-meta {
                font-size: 12px;
                color: var(--text-secondary);
            }

            @media (max-width: 768px) {
                .view-header {
                    flex-direction: column;
                    gap: 16px;
                    align-items: stretch;
                }

                .search-filters-section {
                    flex-direction: column;
                    gap: 12px;
                }

                .filters-container {
                    flex-direction: column;
                }

                .projects-grid {
                    grid-template-columns: 1fr;
                }

                .project-stats {
                    grid-template-columns: 1fr;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Search input
        const searchInput = document.getElementById('project-session-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }
    }

    /**
     * Switch between projects and sessions view
     */
    switchView(viewType) {
        this.currentView = viewType;
        
        // Update toggle buttons
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.querySelector(`[onclick*="'${viewType}'"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        // Show/hide views
        document.getElementById('projects-view').style.display = viewType === 'projects' ? 'block' : 'none';
        document.getElementById('sessions-view').style.display = viewType === 'sessions' ? 'block' : 'none';
        
        // Render appropriate content
        if (viewType === 'projects') {
            this.renderProjects();
        } else {
            this.renderSessions();
        }
    }

    /**
     * Load projects data
     */
    async loadProjects() {
        try {
            const response = await fetch('/api/projects');
            if (response.ok) {
                const data = await response.json();
                this.projects = data.projects || [];
                this.filteredProjects = [...this.projects];
                this.renderProjects();
            }
        } catch (error) {
            console.error('Error loading projects:', error);
        }
    }

    /**
     * Render projects
     */
    renderProjects() {
        const container = document.getElementById('projects-grid');
        if (!container) return;

        if (this.filteredProjects.length === 0) {
            container.innerHTML = '<div class="no-projects">No projects found</div>';
            return;
        }

        const projectsHtml = this.filteredProjects.map(project => `
            <div class="project-card" onclick="enhancedProjectSessionView.viewProjectDetail('${project.id}')">
                <div class="project-header">
                    <h3 class="project-name">${project.name}</h3>
                    <span class="project-category">${this.formatCategory(project.category)}</span>
                </div>
                <div class="project-path">${project.relativePath}</div>
                <div class="project-stats">
                    <div class="stat-item">
                        <span class="stat-value">${project.stats.totalSessions}</span>
                        <span class="stat-label">Sessions</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${this.formatDuration(project.stats.totalDuration)}</span>
                        <span class="stat-label">Duration</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${this.formatDate(project.lastActivity)}</span>
                        <span class="stat-label">Last Activity</span>
                    </div>
                </div>
                <div class="project-indicators">
                    ${project.indicators.map(indicator => 
                        `<span class="indicator-badge">${indicator}</span>`
                    ).join('')}
                </div>
                <div class="project-actions">
                    <button class="action-btn primary" onclick="event.stopPropagation(); enhancedProjectSessionView.viewProjectSessions('${project.id}')">
                        View Sessions
                    </button>
                    <button class="action-btn" onclick="event.stopPropagation(); enhancedProjectSessionView.openProjectInCursor('${project.path}')">
                        Open in Cursor
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = projectsHtml;
    }

    /**
     * Render sessions
     */
    renderSessions() {
        const container = document.getElementById('sessions-list-content');
        if (!container) return;

        const sessions = this.dashboard.sessions || [];
        this.filteredSessions = this.filterSessions(sessions);

        if (this.filteredSessions.length === 0) {
            container.innerHTML = '<div class="no-sessions">No sessions found</div>';
            return;
        }

        const sessionsHtml = this.filteredSessions.map(session => `
            <div class="session-card" onclick="enhancedProjectSessionView.viewSessionDetail('${session.id}')">
                <div class="session-header">
                    <h3 class="session-title">${session.intent || 'Unknown Intent'}</h3>
                    <span class="session-status ${session.outcome || 'in_progress'}">${session.outcome || 'In Progress'}</span>
                </div>
                <div class="session-meta">
                    <span>Project: ${this.getProjectName(session.currentFile)}</span>
                    <span>File: ${session.currentFile ? session.currentFile.split('/').pop() : 'Unknown'}</span>
                    <span>Time: ${this.formatDate(session.timestamp)}</span>
                </div>
                <div class="session-description">
                    ${session.summary || 'No description available'}
                </div>
            </div>
        `).join('');

        container.innerHTML = sessionsHtml;
    }

    /**
     * Handle search
     */
    handleSearch(query) {
        this.searchQuery = query.toLowerCase();
        this.applyFilters();
    }

    /**
     * Handle category filter
     */
    handleCategoryFilter(category) {
        this.categoryFilter = category;
        this.applyFilters();
    }

    /**
     * Handle sort
     */
    handleSort(sortBy) {
        this.sortBy = sortBy;
        this.applyFilters();
    }

    /**
     * Apply all filters
     */
    applyFilters() {
        if (this.currentView === 'projects') {
            this.filterProjects();
            this.renderProjects();
        } else {
            this.renderSessions();
        }
    }

    /**
     * Filter projects
     */
    filterProjects() {
        let filtered = [...this.projects];

        // Search filter
        if (this.searchQuery) {
            filtered = filtered.filter(project => 
                project.name.toLowerCase().includes(this.searchQuery) ||
                project.relativePath.toLowerCase().includes(this.searchQuery) ||
                project.category.toLowerCase().includes(this.searchQuery)
            );
        }

        // Category filter
        if (this.categoryFilter) {
            filtered = filtered.filter(project => project.category === this.categoryFilter);
        }

        // Sort
        filtered.sort((a, b) => {
            let aValue, bValue;
            
            switch (this.sortBy) {
                case 'name':
                    aValue = a.name.toLowerCase();
                    bValue = b.name.toLowerCase();
                    break;
                case 'sessions':
                    aValue = a.stats.totalSessions;
                    bValue = b.stats.totalSessions;
                    break;
                case 'size':
                    aValue = a.analysis?.size?.size || 0;
                    bValue = b.analysis?.size?.size || 0;
                    break;
                default: // activity
                    aValue = new Date(a.lastActivity || 0);
                    bValue = new Date(b.lastActivity || 0);
            }

            if (this.sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        this.filteredProjects = filtered;
    }

    /**
     * Filter sessions
     */
    filterSessions(sessions) {
        let filtered = [...sessions];

        // Search filter
        if (this.searchQuery) {
            filtered = filtered.filter(session => 
                (session.intent && session.intent.toLowerCase().includes(this.searchQuery)) ||
                (session.currentFile && session.currentFile.toLowerCase().includes(this.searchQuery)) ||
                (session.summary && session.summary.toLowerCase().includes(this.searchQuery))
            );
        }

        // Category filter
        if (this.categoryFilter) {
            filtered = filtered.filter(session => {
                const projectName = this.getProjectName(session.currentFile);
                const project = this.projects.find(p => p.name === projectName);
                return project && project.category === this.categoryFilter;
            });
        }

        return filtered;
    }

    /**
     * View project detail
     */
    async viewProjectDetail(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        const modal = document.getElementById('projectDetailModal');
        const title = document.getElementById('project-detail-title');
        const body = document.getElementById('project-detail-body');

        title.textContent = project.name;
        body.innerHTML = `
            <div class="project-detail-content">
                <div class="detail-section">
                    <h3>Project Information</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Name</span>
                            <span class="detail-value">${project.name}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Category</span>
                            <span class="detail-value">${this.formatCategory(project.category)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Type</span>
                            <span class="detail-value">${project.type}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Path</span>
                            <span class="detail-value">${project.path}</span>
                        </div>
                    </div>
                </div>
                <div class="detail-section">
                    <h3>Statistics</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Total Sessions</span>
                            <span class="detail-value">${project.stats.totalSessions}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Total Duration</span>
                            <span class="detail-value">${this.formatDuration(project.stats.totalDuration)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Last Activity</span>
                            <span class="detail-value">${this.formatDate(project.lastActivity)}</span>
                        </div>
                    </div>
                </div>
                <div class="detail-section">
                    <h3>Recent Sessions</h3>
                    <div class="sessions-preview">
                        ${project.sessions ? project.sessions.slice(0, 10).map(session => `
                            <div class="session-preview-item" onclick="enhancedProjectSessionView.viewSessionDetail('${session.id}')">
                                <div class="session-preview-title">${session.intent || 'Unknown Intent'}</div>
                                <div class="session-preview-meta">${this.formatDate(session.timestamp)} • ${session.outcome || 'In Progress'}</div>
                            </div>
                        `).join('') : '<div class="no-sessions">No sessions found</div>'}
                    </div>
                </div>
            </div>
        `;

        modal.classList.add('active');
    }

    /**
     * Close project detail modal
     */
    closeProjectDetail() {
        const modal = document.getElementById('projectDetailModal');
        modal.classList.remove('active');
    }

    /**
     * View project sessions
     */
    viewProjectSessions(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        // Filter sessions by project and switch to sessions view
        this.currentProject = project;
        this.switchView('sessions');
    }

    /**
     * View session detail
     */
    viewSessionDetail(sessionId) {
        if (this.dashboard && this.dashboard.viewSession) {
            this.dashboard.viewSession(sessionId);
        }
    }

    /**
     * Open project in Cursor
     */
    async openProjectInCursor(projectPath) {
        try {
            const response = await fetch('/api/project/open', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: projectPath })
            });
            
            if (response.ok) {
                console.log('Project opened in Cursor');
            }
        } catch (error) {
            console.error('Error opening project:', error);
        }
    }

    /**
     * Refresh data
     */
    async refreshData() {
        await this.loadProjects();
        if (this.dashboard && this.dashboard.loadSessions) {
            await this.dashboard.loadSessions();
        }
    }

    /**
     * Helper methods
     */
    formatCategory(category) {
        return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    formatDuration(seconds) {
        if (!seconds) return '0s';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes}m`;
        return `${Math.floor(seconds)}s`;
    }

    formatDate(dateString) {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    }

    getProjectName(filePath) {
        if (!filePath) return 'Unknown';
        const parts = filePath.split('/');
        const homeIndex = parts.findIndex(part => part === 'hamidaho');
        if (homeIndex >= 0 && parts[homeIndex + 1]) {
            return parts[homeIndex + 1];
        }
        return 'Unknown';
    }
}

// Make it globally available
window.enhancedProjectSessionView = null;

module.exports = EnhancedProjectSessionView;
