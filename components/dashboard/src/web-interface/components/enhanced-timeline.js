/**
 * Enhanced Timeline Component
 * Intuitive and maximally informative timeline view for development activities
 */

class EnhancedTimeline {
    constructor() {
        this.sessions = [];
        this.conversations = [];
        this.events = [];
        this.filteredEvents = [];
        this.currentFilters = {
            dateRange: 'all',
            eventType: 'all',
            project: 'all',
            intent: 'all'
        };
        this.sortOrder = 'desc'; // 'asc' or 'desc'
        this.groupBy = 'day'; // 'day', 'hour', 'week'
        this.selectedEvent = null;
        
        this.initializeTimeline();
    }

    /**
     * Initialize the timeline component
     */
    initializeTimeline() {
        this.setupEventListeners();
        this.loadData();
    }

    /**
     * Setup event listeners for timeline interactions
     */
    setupEventListeners() {
        // Filter controls
        document.addEventListener('change', (e) => {
            if (e.target.matches('.timeline-filter-select')) {
                this.handleFilterChange(e.target);
            }
        });

        // Event clicks
        document.addEventListener('click', (e) => {
            if (e.target.closest('.timeline-event-enhanced')) {
                this.handleEventClick(e.target.closest('.timeline-event-enhanced'));
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.target.closest('.enhanced-timeline')) {
                this.handleKeyboardNavigation(e);
            }
        });
    }

    /**
     * Load timeline data from API
     */
    async loadData() {
        try {
            this.showLoading();
            
            // Load sessions and conversations in parallel
            const [sessionsResponse, conversationsResponse] = await Promise.all([
                fetch('/api/sessions'),
                fetch('/api/conversations')
            ]);

            const sessionsData = await sessionsResponse.json();
            const conversationsData = await conversationsResponse.json();

            this.sessions = sessionsData.sessions || [];
            this.conversations = conversationsData.conversations || [];

            // Process and merge data into timeline events
            this.processTimelineEvents();
            this.renderTimeline();

        } catch (error) {
            console.error('Error loading timeline data:', error);
            this.showError('Failed to load timeline data');
        }
    }

    /**
     * Process sessions and conversations into timeline events
     */
    processTimelineEvents() {
        this.events = [];

        // Process sessions
        this.sessions.forEach(session => {
            // Session start event
            this.events.push({
                id: `session-start-${session.id}`,
                type: 'session',
                subtype: 'start',
                timestamp: new Date(session.timestamp),
                title: `Session: ${this.getFileName(session.currentFile) || 'Unknown'}`,
                description: `Started development session`,
                data: session,
                meta: {
                    project: session.workspace || 'Unknown',
                    intent: session.intent || 'unknown',
                    file: session.currentFile,
                    duration: session.duration || 0
                }
            });

            // Session end event
            if (session.lastActivity) {
                this.events.push({
                    id: `session-end-${session.id}`,
                    type: 'session',
                    subtype: 'end',
                    timestamp: new Date(session.lastActivity),
                    title: `Session Ended: ${this.getFileName(session.currentFile) || 'Unknown'}`,
                    description: `Completed development session`,
                    data: session,
                    meta: {
                        project: session.workspace || 'Unknown',
                        intent: session.intent || 'unknown',
                        file: session.currentFile,
                        duration: session.duration || 0
                    }
                });
            }

            // Code changes
            if (session.codeDeltas && session.codeDeltas.length > 0) {
                session.codeDeltas.forEach((delta, index) => {
                    this.events.push({
                        id: `code-change-${session.id}-${index}`,
                        type: 'file-change',
                        subtype: 'code',
                        timestamp: new Date(session.timestamp),
                        title: `Code Change: ${this.getFileName(session.currentFile) || 'Unknown'}`,
                        description: `Modified code`,
                        data: { session, delta },
                        meta: {
                            project: session.workspace || 'Unknown',
                            intent: session.intent || 'unknown',
                            file: session.currentFile,
                            linesChanged: delta.linesAdded + delta.linesRemoved || 0
                        }
                    });
                });
            }
        });

        // Process conversations
        this.conversations.forEach(conversation => {
            this.events.push({
                id: `conversation-${conversation.id}`,
                type: 'conversation',
                subtype: 'chat',
                timestamp: new Date(conversation.timestamp || conversation.created_at),
                title: `AI Conversation`,
                description: this.truncateText(conversation.content || conversation.prompt || 'No content', 60),
                data: conversation,
                meta: {
                    project: conversation.workspace || 'Unknown',
                    intent: conversation.intent || 'unknown',
                    tokens: conversation.tokens || 0,
                    role: conversation.role || 'user'
                }
            });
        });

        // Sort events by timestamp
        this.events.sort((a, b) => {
            return this.sortOrder === 'desc' 
                ? b.timestamp - a.timestamp 
                : a.timestamp - b.timestamp;
        });

        this.applyFilters();
    }

    /**
     * Apply current filters to events
     */
    applyFilters() {
        this.filteredEvents = this.events.filter(event => {
            // Date range filter
            if (this.currentFilters.dateRange !== 'all') {
                const now = new Date();
                const eventDate = new Date(event.timestamp);
                
                switch (this.currentFilters.dateRange) {
                    case 'today':
                        if (!this.isSameDay(eventDate, now)) return false;
                        break;
                    case 'week':
                        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        if (eventDate < weekAgo) return false;
                        break;
                    case 'month':
                        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        if (eventDate < monthAgo) return false;
                        break;
                }
            }

            // Event type filter
            if (this.currentFilters.eventType !== 'all' && event.type !== this.currentFilters.eventType) {
                return false;
            }

            // Project filter
            if (this.currentFilters.project !== 'all' && event.meta.project !== this.currentFilters.project) {
                return false;
            }

            // Intent filter
            if (this.currentFilters.intent !== 'all' && event.meta.intent !== this.currentFilters.intent) {
                return false;
            }

            return true;
        });
    }

    /**
     * Render the enhanced timeline
     */
    renderTimeline() {
        const container = document.getElementById('sessions-list');
        if (!container) return;

        if (this.filteredEvents.length === 0) {
            this.renderEmptyState(container);
            return;
        }

        // Group events by date
        const groupedEvents = this.groupEventsByDate(this.filteredEvents);
        
        // Calculate stats
        const stats = this.calculateStats();

        container.innerHTML = `
            <div class="enhanced-timeline">
                ${this.renderTimelineHeader(stats)}
                ${this.renderTimelineStats(stats)}
                <div class="timeline-content-enhanced">
                    ${this.renderTimelineEvents(groupedEvents)}
                </div>
            </div>
        `;
    }

    /**
     * Render timeline header with controls
     */
    renderTimelineHeader(stats) {
        const projects = [...new Set(this.events.map(e => e.meta.project))].filter(Boolean);
        const intents = [...new Set(this.events.map(e => e.meta.intent))].filter(Boolean);

        return `
            <div class="timeline-header-enhanced">
                <div class="timeline-title-enhanced">
                    <h2>Development Timeline</h2>
                    <p class="timeline-subtitle">Real-time view of your coding activities and AI interactions</p>
                </div>
                <div class="timeline-controls-enhanced">
                    <div class="timeline-filter-group">
                        <label for="date-filter">Date Range:</label>
                        <select id="date-filter" class="timeline-filter-select">
                            <option value="all">All Time</option>
                            <option value="today">Today</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                        </select>
                    </div>
                    <div class="timeline-filter-group">
                        <label for="type-filter">Event Type:</label>
                        <select id="type-filter" class="timeline-filter-select">
                            <option value="all">All Events</option>
                            <option value="session">Sessions</option>
                            <option value="conversation">Conversations</option>
                            <option value="file-change">File Changes</option>
                        </select>
                    </div>
                    <div class="timeline-filter-group">
                        <label for="project-filter">Project:</label>
                        <select id="project-filter" class="timeline-filter-select">
                            <option value="all">All Projects</option>
                            ${projects.map(project => `<option value="${project}">${project}</option>`).join('')}
                        </select>
                    </div>
                    <div class="timeline-filter-group">
                        <label for="intent-filter">Intent:</label>
                        <select id="intent-filter" class="timeline-filter-select">
                            <option value="all">All Intents</option>
                            ${intents.map(intent => `<option value="${intent}">${intent}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render timeline statistics bar
     */
    renderTimelineStats(stats) {
        return `
            <div class="timeline-stats-bar">
                <div class="timeline-stats-group">
                    <div class="timeline-stat">
                        <div class="timeline-stat-icon sessions"></div>
                        <span class="timeline-stat-value">${stats.totalSessions}</span>
                        <span>Sessions</span>
                    </div>
                    <div class="timeline-stat">
                        <div class="timeline-stat-icon conversations">💬</div>
                        <span class="timeline-stat-value">${stats.totalConversations}</span>
                        <span>Conversations</span>
                    </div>
                    <div class="timeline-stat">
                        <div class="timeline-stat-icon files">📁</div>
                        <span class="timeline-stat-value">${stats.totalFiles}</span>
                        <span>Files Modified</span>
                    </div>
                    <div class="timeline-stat">
                        <div class="timeline-stat-icon duration"></div>
                        <span class="timeline-stat-value">${stats.totalDuration}</span>
                        <span>Total Time</span>
                    </div>
                </div>
                <div class="timeline-stats-group">
                    <span class="timeline-stat-value">${this.filteredEvents.length}</span>
                    <span>Events Shown</span>
                </div>
            </div>
        `;
    }

    /**
     * Render timeline events grouped by date
     */
    renderTimelineEvents(groupedEvents) {
        return Object.entries(groupedEvents).map(([date, events]) => `
            <div class="timeline-day-group">
                <div class="timeline-day-header">
                    <div class="timeline-day-date">
                        <h3 class="timeline-day-date-main">${this.formatDateHeader(date)}</h3>
                        <p class="timeline-day-date-sub">${this.getRelativeDate(date)}</p>
                    </div>
                    <div class="timeline-day-stats">
                        <div class="timeline-day-stat">
                            <span class="timeline-day-stat-value">${events.length}</span>
                            <span class="timeline-day-stat-label">Events</span>
                        </div>
                        <div class="timeline-day-stat">
                            <span class="timeline-day-stat-value">${this.getUniqueProjects(events)}</span>
                            <span class="timeline-day-stat-label">Projects</span>
                        </div>
                        <div class="timeline-day-stat">
                            <span class="timeline-day-stat-value">${this.getTotalDuration(events)}</span>
                            <span class="timeline-day-stat-label">Duration</span>
                        </div>
                    </div>
                </div>
                <div class="timeline-events-container">
                    ${events.map(event => this.renderTimelineEvent(event)).join('')}
                </div>
            </div>
        `).join('');
    }

    /**
     * Render individual timeline event
     */
    renderTimelineEvent(event) {
        const isActive = this.selectedEvent && this.selectedEvent.id === event.id;
        
        return `
            <div class="timeline-event-enhanced ${isActive ? 'active' : ''}" 
                 data-event-id="${event.id}"
                 onclick="enhancedTimeline.viewEventDetails('${event.id}')"
                 style="cursor: pointer;"
                 onmouseover="this.style.backgroundColor='var(--background-hover)'"
                 onmouseout="this.style.backgroundColor=''">
                <div class="timeline-event-marker ${event.type}"></div>
                <div class="timeline-event-content">
                    <div class="timeline-event-header">
                        <h4 class="timeline-event-title">${event.title}</h4>
                        <span class="timeline-event-time">${this.formatTime(event.timestamp)}</span>
                    </div>
                    <div class="timeline-event-details">
                        <p class="timeline-event-description">${this.truncateText(event.description, 80)}</p>
                        <div class="timeline-event-meta">
                            ${this.renderEventMeta(event)}
                        </div>
                        ${this.renderEventTags(event)}
                    </div>
                    <div class="timeline-event-actions">
                        <button class="timeline-event-action" onclick="event.stopPropagation(); enhancedTimeline.viewEventDetails('${event.id}')">
                            Details
                        </button>
                        <button class="timeline-event-action" onclick="event.stopPropagation(); enhancedTimeline.openInContext('${event.id}')">
                            Context
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render event metadata
     */
    renderEventMeta(event) {
        const metaItems = [];

        if (event.meta.project) {
            metaItems.push(`
                <div class="timeline-event-meta-item">
                    <div class="timeline-event-meta-icon">📁</div>
                    <span>${event.meta.project}</span>
                </div>
            `);
        }

        if (event.meta.file) {
            metaItems.push(`
                <div class="timeline-event-meta-item">
                    <div class="timeline-event-meta-icon"></div>
                    <span>${this.getFileName(event.meta.file)}</span>
                </div>
            `);
        }

        if (event.meta.duration) {
            metaItems.push(`
                <div class="timeline-event-meta-item">
                    <div class="timeline-event-meta-icon"></div>
                    <span>${this.formatDuration(event.meta.duration)}</span>
                </div>
            `);
        }

        if (event.meta.tokens) {
            metaItems.push(`
                <div class="timeline-event-meta-item">
                    <div class="timeline-event-meta-icon">🔤</div>
                    <span>${event.meta.tokens} tokens</span>
                </div>
            `);
        }

        return metaItems.join('');
    }

    /**
     * Render event tags
     */
    renderEventTags(event) {
        const tags = [];

        if (event.meta.intent) {
            tags.push(`<span class="timeline-event-tag intent">${event.meta.intent}</span>`);
        }

        if (event.type) {
            tags.push(`<span class="timeline-event-tag">${event.type}</span>`);
        }

        if (event.meta.file) {
            const extension = this.getFileExtension(event.meta.file);
            if (extension) {
                tags.push(`<span class="timeline-event-tag file">${extension}</span>`);
            }
        }

        return tags.length > 0 ? `
            <div class="timeline-event-tags">
                ${tags.join('')}
            </div>
        ` : '';
    }

    /**
     * Handle filter changes
     */
    handleFilterChange(selectElement) {
        const filterType = selectElement.id.replace('-filter', '');
        this.currentFilters[filterType] = selectElement.value;
        this.applyFilters();
        this.renderTimeline();
    }

    /**
     * Handle event clicks
     */
    handleEventClick(eventElement) {
        const eventId = eventElement.dataset.eventId;
        const event = this.events.find(e => e.id === eventId);
        
        if (event) {
            this.selectedEvent = event;
            this.renderTimeline(); // Re-render to show active state
            this.showEventDetails(event);
        }
    }

    /**
     * Show event details in a modal or sidebar
     */
    showEventDetails(event) {
        console.log('Showing event details:', event);
        
        // Remove any existing modals
        const existingModals = document.querySelectorAll('.event-detail-modal-overlay');
        existingModals.forEach(modal => {
            try {
                document.body.removeChild(modal);
            } catch (e) {
                console.warn('Error removing existing modal:', e);
            }
        });

        // Create a modal to show event details
        const modal = document.createElement('div');
        modal.className = 'event-detail-modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: var(--space-4);
        `;

        const modalContent = document.createElement('div');
        modalContent.className = 'event-detail-modal-content';
        modalContent.style.cssText = `
            background: var(--background-primary);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            max-width: 600px;
            width: 100%;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            box-shadow: var(--shadow-xl);
        `;

        modalContent.innerHTML = `
            <div class="event-detail-header" style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: var(--space-3);
                border-bottom: 1px solid var(--border-color);
                flex-shrink: 0;
            ">
                <h3 style="margin: 0; color: var(--text-primary); font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold);">
                    ${event.title || 'Event Details'}
                </h3>
                <button class="event-detail-close" style="
                    background: none;
                    border: none;
                    font-size: var(--font-size-xl);
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: var(--space-1);
                ">&times;</button>
            </div>
            
            <div class="event-detail-body" style="
                flex: 1;
                overflow-y: auto;
                padding: var(--space-3);
            ">
                <div class="event-detail-content">
                    <div class="event-detail-section" style="margin-bottom: var(--space-3);">
                        <div class="event-detail-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2);">
                            <div class="event-detail-item" style="display: flex; flex-direction: column; gap: var(--space-1);">
                                <label style="font-weight: var(--font-weight-medium); color: var(--text-secondary); font-size: var(--font-size-xs);">Type:</label>
                                <span style="color: var(--text-primary); font-size: var(--font-size-sm);">${event.type || 'Unknown'}</span>
                            </div>
                            <div class="event-detail-item" style="display: flex; flex-direction: column; gap: var(--space-1);">
                                <label style="font-weight: var(--font-weight-medium); color: var(--text-secondary); font-size: var(--font-size-xs);">Time:</label>
                                <span style="color: var(--text-primary); font-size: var(--font-size-sm);">${this.formatTime(event.timestamp)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="event-detail-section" style="margin-bottom: var(--space-3);">
                        <label style="font-weight: var(--font-weight-medium); color: var(--text-secondary); font-size: var(--font-size-xs); margin-bottom: var(--space-1); display: block;">Description:</label>
                        <p style="color: var(--text-primary); font-size: var(--font-size-sm); margin: 0; line-height: 1.5;">${event.description || 'No description available'}</p>
                    </div>
                    
                    ${event.meta ? `
                        <div class="event-detail-section" style="margin-bottom: var(--space-3);">
                            <label style="font-weight: var(--font-weight-medium); color: var(--text-secondary); font-size: var(--font-size-xs); margin-bottom: var(--space-1); display: block;">Metadata:</label>
                            <pre style="color: var(--text-primary); font-size: var(--font-size-xs); margin: 0; background: var(--background-secondary); padding: var(--space-2); border-radius: 4px; overflow-x: auto;">${JSON.stringify(event.meta, null, 2)}</pre>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Add close functionality
        const closeBtn = modal.querySelector('.event-detail-close');
        const closeModal = () => {
            try {
                document.body.removeChild(modal);
            } catch (e) {
                console.warn('Error closing modal:', e);
            }
        };

        closeBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }
}

// Make it globally available
window.EnhancedTimeline = EnhancedTimeline;
