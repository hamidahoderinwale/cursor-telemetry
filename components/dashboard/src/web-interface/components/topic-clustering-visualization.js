/**
 * Topic Clustering Visualization
 * Replaces session clustering with OpenClio topic clustering
 * Uses semantic similarity color-coding instead of UMAP
 */

class TopicClusteringVisualization {
    constructor() {
        this.sessions = [];
        this.topics = [];
        this.topicAssignments = {};
        this.semanticColors = {};
        this.selectedTopic = null;
        this.hoveredSession = null;
        this.isLoading = false;
        this.lastUpdateTime = null;
        
        // Semantic similarity color palette
        this.semanticColorPalette = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#FFB347', '#87CEEB',
            '#D8BFD8', '#F0E68C', '#FFA07A', '#20B2AA', '#87CEFA',
            '#DDA0DD', '#F5DEB3', '#FF6347', '#40E0D0', '#EE82EE'
        ];
        
        // Topic categories and their semantic colors
        this.topicCategories = {
            'data_exploration': { color: '#3B82F6', name: 'Data Exploration' },
            'code_development': { color: '#10B981', name: 'Code Development' },
            'debugging': { color: '#EF4444', name: 'Debugging' },
            'documentation': { color: '#8B5CF6', name: 'Documentation' },
            'testing': { color: '#F59E0B', name: 'Testing' },
            'refactoring': { color: '#06B6D4', name: 'Refactoring' },
            'analysis': { color: '#84CC16', name: 'Analysis' },
            'visualization': { color: '#F97316', name: 'Visualization' },
            'machine_learning': { color: '#EC4899', name: 'Machine Learning' },
            'web_development': { color: '#6366F1', name: 'Web Development' },
            'api_integration': { color: '#14B8A6', name: 'API Integration' },
            'database': { color: '#A855F7', name: 'Database' },
            'deployment': { color: '#DC2626', name: 'Deployment' },
            'optimization': { color: '#059669', name: 'Optimization' },
            'research': { color: '#7C3AED', name: 'Research' }
        };
    }

    /**
     * Initialize the topic clustering visualization
     */
    async initialize(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('Container not found:', containerId);
            return;
        }

        console.log('Initializing Topic Clustering Visualization...');
        this.isLoading = true;
        
        try {
            // Load session data and perform topic analysis
            await this.loadSessionData();
            await this.performTopicAnalysis();
            this.renderVisualization();
            
            console.log('Topic clustering visualization initialized successfully');
        } catch (error) {
            console.error('Error initializing topic clustering:', error);
            this.renderError('Failed to initialize topic clustering analysis');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Load comprehensive data from the API (sessions, conversations, events)
     */
    async loadSessionData() {
        try {
            // Load sessions data
            const sessionsResponse = await fetch('/api/sessions');
            const sessionsData = await sessionsResponse.json();
            
            // Load conversations data
            const conversationsResponse = await fetch('/api/conversations');
            const conversationsData = await conversationsResponse.json();
            
            // Load events data
            const eventsResponse = await fetch('/api/events');
            const eventsData = await eventsResponse.json();
            
            if (sessionsData && sessionsData.length > 0) {
                this.sessions = sessionsData;
                console.log(`Loaded ${this.sessions.length} sessions for comprehensive topic analysis`);
            } else {
                console.warn('No session data available for topic analysis');
                this.sessions = [];
            }
            
            if (conversationsData && conversationsData.length > 0) {
                this.conversations = conversationsData;
                console.log(`Loaded ${this.conversations.length} conversations for comprehensive topic analysis`);
            } else {
                this.conversations = [];
            }
            
            if (eventsData && eventsData.length > 0) {
                this.events = eventsData;
                console.log(`Loaded ${this.events.length} events for comprehensive topic analysis`);
            } else {
                this.events = [];
            }
            
            console.log(`Comprehensive data loaded: ${this.sessions.length} sessions, ${this.conversations.length} conversations, ${this.events.length} events`);
        } catch (error) {
            console.error('Error loading comprehensive data:', error);
            this.sessions = [];
            this.conversations = [];
            this.events = [];
        }
    }

    /**
     * Perform comprehensive topic analysis using OpenClio-style analysis
     */
    async performTopicAnalysis() {
        const totalDataItems = this.sessions.length + this.conversations.length + this.events.length;
        
        if (totalDataItems === 0) {
            console.warn('No data available for comprehensive topic analysis');
            return;
        }

        try {
            // Extract topics from comprehensive data using semantic analysis
            this.topics = this.extractTopicsFromSessions();
            
            // Assign data items to topics based on semantic similarity
            this.topicAssignments = this.assignSessionsToTopics();
            
            // Generate semantic colors for topics
            this.generateSemanticColors();
            
            console.log(`Identified ${this.topics.length} topics from comprehensive data: ${this.sessions.length} sessions, ${this.conversations.length} conversations, ${this.events.length} events`);
        } catch (error) {
            console.error('Error performing comprehensive topic analysis:', error);
            this.topics = [];
            this.topicAssignments = {};
        }
    }

    /**
     * Extract topics from comprehensive data using semantic analysis
     */
    extractTopicsFromSessions() {
        const topicMap = new Map();
        
        // Process sessions
        this.sessions.forEach(session => {
            const topic = this.identifySessionTopic(session);
            
            if (topic) {
                if (!topicMap.has(topic.name)) {
                    topicMap.set(topic.name, {
                        name: topic.name,
                        category: topic.category,
                        sessions: [],
                        conversations: [],
                        events: [],
                        keywords: new Set(),
                        confidence: 0,
                        description: topic.description,
                        dataTypes: new Set()
                    });
                }
                
                const topicData = topicMap.get(topic.name);
                topicData.sessions.push(session);
                topicData.confidence += topic.confidence;
                topicData.dataTypes.add('session');
                
                // Add keywords from session
                if (session.codeDeltas) {
                    session.codeDeltas.forEach(delta => {
                        if (delta.afterContent) {
                            const words = this.extractKeywords(delta.afterContent);
                            words.forEach(word => topicData.keywords.add(word));
                        }
                    });
                }
            }
        });

        // Process conversations if available
        if (this.conversations) {
            this.conversations.forEach(conversation => {
                const topic = this.identifyConversationTopic(conversation);
                
                if (topic) {
                    if (!topicMap.has(topic.name)) {
                        topicMap.set(topic.name, {
                            name: topic.name,
                            category: topic.category,
                            sessions: [],
                            conversations: [],
                            events: [],
                            keywords: new Set(),
                            confidence: 0,
                            description: topic.description,
                            dataTypes: new Set()
                        });
                    }
                    
                    const topicData = topicMap.get(topic.name);
                    topicData.conversations.push(conversation);
                    topicData.confidence += topic.confidence;
                    topicData.dataTypes.add('conversation');
                    
                    // Add keywords from conversation
                    if (conversation.content) {
                        const words = this.extractKeywords(conversation.content);
                        words.forEach(word => topicData.keywords.add(word));
                    }
                }
            });
        }

        // Process events if available
        if (this.events) {
            this.events.forEach(event => {
                const topic = this.identifyEventTopic(event);
                
                if (topic) {
                    if (!topicMap.has(topic.name)) {
                        topicMap.set(topic.name, {
                            name: topic.name,
                            category: topic.category,
                            sessions: [],
                            conversations: [],
                            events: [],
                            keywords: new Set(),
                            confidence: 0,
                            description: topic.description,
                            dataTypes: new Set()
                        });
                    }
                    
                    const topicData = topicMap.get(topic.name);
                    topicData.events.push(event);
                    topicData.confidence += topic.confidence;
                    topicData.dataTypes.add('event');
                    
                    // Add keywords from event
                    if (event.description) {
                        const words = this.extractKeywords(event.description);
                        words.forEach(word => topicData.keywords.add(word));
                    }
                }
            });
        }

        // Convert to array and calculate final confidence scores
        const topics = Array.from(topicMap.values()).map(topic => ({
            ...topic,
            keywords: Array.from(topic.keywords).slice(0, 15), // Top 15 keywords
            confidence: topic.confidence / (topic.sessions.length + topic.conversations.length + topic.events.length),
            sessionCount: topic.sessions.length,
            conversationCount: topic.conversations.length,
            eventCount: topic.events.length,
            totalCount: topic.sessions.length + topic.conversations.length + topic.events.length,
            dataTypes: Array.from(topic.dataTypes)
        }));

        // Sort by total count and confidence
        return topics.sort((a, b) => b.totalCount - a.totalCount || b.confidence - a.confidence);
    }

    /**
     * Identify the primary topic for a session
     */
    identifySessionTopic(session) {
        // Use session intent if available
        if (session.intent) {
            const intent = session.intent.toLowerCase();
            return this.mapIntentToTopic(intent, session);
        }

        // Analyze code deltas for topic identification
        if (session.codeDeltas && session.codeDeltas.length > 0) {
            return this.analyzeCodeDeltasForTopic(session.codeDeltas);
        }

        // Fallback to file changes analysis
        if (session.fileChanges && session.fileChanges.length > 0) {
            return this.analyzeFileChangesForTopic(session.fileChanges);
        }

        return null;
    }

    /**
     * Identify the primary topic for a conversation
     */
    identifyConversationTopic(conversation) {
        if (!conversation.content) {
            return {
                name: 'general_discussion',
                category: 'communication',
                confidence: 0.3,
                description: 'General conversation without specific topic'
            };
        }

        const content = conversation.content.toLowerCase();
        
        // Topic detection based on content
        if (content.includes('bug') || content.includes('error') || content.includes('fix') || content.includes('debug')) {
            return {
                name: 'debugging_discussion',
                category: 'problem_solving',
                confidence: 0.8,
                description: 'Conversation about debugging and error resolution'
            };
        } else if (content.includes('feature') || content.includes('implement') || content.includes('add') || content.includes('create')) {
            return {
                name: 'feature_development',
                category: 'development',
                confidence: 0.8,
                description: 'Conversation about feature development and implementation'
            };
        } else if (content.includes('refactor') || content.includes('clean') || content.includes('optimize') || content.includes('improve')) {
            return {
                name: 'code_improvement',
                category: 'maintenance',
                confidence: 0.8,
                description: 'Conversation about code refactoring and optimization'
            };
        } else if (content.includes('test') || content.includes('spec') || content.includes('assert') || content.includes('coverage')) {
            return {
                name: 'testing_discussion',
                category: 'quality_assurance',
                confidence: 0.8,
                description: 'Conversation about testing and quality assurance'
            };
        } else if (content.includes('document') || content.includes('comment') || content.includes('readme') || content.includes('guide')) {
            return {
                name: 'documentation',
                category: 'communication',
                confidence: 0.8,
                description: 'Conversation about documentation and guides'
            };
        } else if (content.includes('deploy') || content.includes('build') || content.includes('ci') || content.includes('pipeline')) {
            return {
                name: 'deployment_discussion',
                category: 'operations',
                confidence: 0.8,
                description: 'Conversation about deployment and build processes'
            };
        } else if (content.includes('question') || content.includes('how') || content.includes('what') || content.includes('why')) {
            return {
                name: 'question_answer',
                category: 'communication',
                confidence: 0.7,
                description: 'Question and answer discussion'
            };
        } else {
            return {
                name: 'general_discussion',
                category: 'communication',
                confidence: 0.5,
                description: 'General development discussion'
            };
        }
    }

    /**
     * Identify the primary topic for an event
     */
    identifyEventTopic(event) {
        if (!event.description && !event.event_type) {
            return {
                name: 'unknown_event',
                category: 'system',
                confidence: 0.2,
                description: 'Event without clear topic identification'
            };
        }

        const content = (event.description || event.event_type || '').toLowerCase();
        
        // Event type based topic detection
        if (event.event_type === 'session_start') {
            return {
                name: 'session_management',
                category: 'workflow',
                confidence: 0.9,
                description: 'Development session start event'
            };
        } else if (event.event_type === 'code_change') {
            return {
                name: 'code_modification',
                category: 'development',
                confidence: 0.9,
                description: 'Code change event'
            };
        } else if (event.event_type === 'file_change') {
            return {
                name: 'file_management',
                category: 'system',
                confidence: 0.9,
                description: 'File change event'
            };
        } else if (event.event_type === 'conversation') {
            return {
                name: 'communication_event',
                category: 'communication',
                confidence: 0.8,
                description: 'Conversation event'
            };
        } else if (content.includes('error') || content.includes('exception') || content.includes('fail')) {
            return {
                name: 'error_event',
                category: 'problem_solving',
                confidence: 0.8,
                description: 'Error or exception event'
            };
        } else if (content.includes('build') || content.includes('compile') || content.includes('test')) {
            return {
                name: 'build_test_event',
                category: 'quality_assurance',
                confidence: 0.8,
                description: 'Build or test related event'
            };
        } else {
            return {
                name: 'system_event',
                category: 'system',
                confidence: 0.6,
                description: 'General system event'
            };
        }
    }

    /**
     * Map session intent to topic
     */
    mapIntentToTopic(intent, session) {
        const intentMappings = {
            'data_exploration': { name: 'Data Exploration', category: 'data_exploration' },
            'explore': { name: 'Data Exploration', category: 'data_exploration' },
            'development': { name: 'Code Development', category: 'code_development' },
            'debugging': { name: 'Debugging', category: 'debugging' },
            'testing': { name: 'Testing', category: 'testing' },
            'refactoring': { name: 'Refactoring', category: 'refactoring' },
            'analysis': { name: 'Analysis', category: 'analysis' },
            'visualization': { name: 'Visualization', category: 'visualization' },
            'ml': { name: 'Machine Learning', category: 'machine_learning' },
            'machine_learning': { name: 'Machine Learning', category: 'machine_learning' },
            'web': { name: 'Web Development', category: 'web_development' },
            'api': { name: 'API Integration', category: 'api_integration' },
            'database': { name: 'Database', category: 'database' },
            'deployment': { name: 'Deployment', category: 'deployment' },
            'optimization': { name: 'Optimization', category: 'optimization' },
            'research': { name: 'Research', category: 'research' }
        };

        const mapping = intentMappings[intent] || { name: 'General Development', category: 'code_development' };
        
        return {
            name: mapping.name,
            category: mapping.category,
            confidence: session.confidence || 0.7,
            description: `Sessions focused on ${mapping.name.toLowerCase()} activities`
        };
    }

    /**
     * Analyze code deltas to identify topic
     */
    analyzeCodeDeltasForTopic(codeDeltas) {
        const content = codeDeltas.map(delta => delta.afterContent || '').join(' ').toLowerCase();
        
        // Topic detection based on code patterns
        if (content.includes('import pandas') || content.includes('import numpy') || content.includes('plt.')) {
            return { name: 'Data Analysis', category: 'data_exploration', confidence: 0.8, description: 'Data analysis and visualization sessions' };
        }
        
        if (content.includes('def ') || content.includes('class ') || content.includes('function')) {
            return { name: 'Code Development', category: 'code_development', confidence: 0.7, description: 'Code development and implementation sessions' };
        }
        
        if (content.includes('test') || content.includes('assert') || content.includes('unittest')) {
            return { name: 'Testing', category: 'testing', confidence: 0.8, description: 'Testing and quality assurance sessions' };
        }
        
        if (content.includes('debug') || content.includes('print(') || content.includes('console.log')) {
            return { name: 'Debugging', category: 'debugging', confidence: 0.7, description: 'Debugging and troubleshooting sessions' };
        }
        
        if (content.includes('import tensorflow') || content.includes('import torch') || content.includes('sklearn')) {
            return { name: 'Machine Learning', category: 'machine_learning', confidence: 0.9, description: 'Machine learning and AI development sessions' };
        }
        
        return { name: 'General Development', category: 'code_development', confidence: 0.5, description: 'General development activities' };
    }

    /**
     * Analyze file changes to identify topic
     */
    analyzeFileChangesForTopic(fileChanges) {
        const fileExtensions = fileChanges.map(change => {
            const fileName = change.fileName || change.filePath || '';
            return fileName.split('.').pop().toLowerCase();
        });

        const extensionCounts = fileExtensions.reduce((acc, ext) => {
            acc[ext] = (acc[ext] || 0) + 1;
            return acc;
        }, {});

        // Topic detection based on file types
        if (extensionCounts['ipynb'] > 0) {
            return { name: 'Data Analysis', category: 'data_exploration', confidence: 0.8, description: 'Jupyter notebook analysis sessions' };
        }
        
        if (extensionCounts['py'] > 0 && extensionCounts['py'] > extensionCounts['js']) {
            return { name: 'Python Development', category: 'code_development', confidence: 0.7, description: 'Python development sessions' };
        }
        
        if (extensionCounts['js'] > 0 || extensionCounts['ts'] > 0) {
            return { name: 'Web Development', category: 'web_development', confidence: 0.7, description: 'JavaScript/TypeScript development sessions' };
        }
        
        if (extensionCounts['html'] > 0 || extensionCounts['css'] > 0) {
            return { name: 'Frontend Development', category: 'web_development', confidence: 0.8, description: 'Frontend development sessions' };
        }
        
        return { name: 'General Development', category: 'code_development', confidence: 0.5, description: 'General development activities' };
    }

    /**
     * Extract keywords from content
     */
    extractKeywords(content) {
        const words = content.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3)
            .filter(word => !this.isStopWord(word));
        
        // Count word frequency
        const wordCounts = words.reduce((acc, word) => {
            acc[word] = (acc[word] || 0) + 1;
            return acc;
        }, {});
        
        // Return top keywords
        return Object.entries(wordCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([word]) => word);
    }

    /**
     * Check if word is a stop word
     */
    isStopWord(word) {
        const stopWords = new Set([
            'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'man', 'men', 'put', 'say', 'she', 'too', 'use'
        ]);
        return stopWords.has(word);
    }

    /**
     * Assign sessions to topics based on semantic similarity
     */
    assignSessionsToTopics() {
        const assignments = {};
        
        this.sessions.forEach(session => {
            const topic = this.identifySessionTopic(session);
            if (topic) {
                assignments[session.id] = {
                    topicName: topic.name,
                    topicCategory: topic.category,
                    confidence: topic.confidence
                };
            }
        });
        
        return assignments;
    }

    /**
     * Generate semantic colors for topics
     */
    generateSemanticColors() {
        this.semanticColors = {};
        
        this.topics.forEach((topic, index) => {
            // Use predefined category colors or assign from palette
            if (this.topicCategories[topic.category]) {
                this.semanticColors[topic.name] = this.topicCategories[topic.category].color;
            } else {
                this.semanticColors[topic.name] = this.semanticColorPalette[index % this.semanticColorPalette.length];
            }
        });
    }

    /**
     * Render the topic clustering visualization
     */
    renderVisualization() {
        if (this.topics.length === 0) {
            this.renderNoData();
            return;
        }

        const html = `
            <div class="topic-clustering-container">
                <div class="topic-clustering-header">
                    <h3>Topic Clustering Analysis</h3>
                    <p>${this.topics.length} topics identified from ${this.sessions.length} sessions</p>
                </div>
                
                <div class="topic-clustering-content">
                    <div class="topic-overview">
                        ${this.renderTopicOverview()}
                    </div>
                    
                    <div class="topic-details">
                        ${this.renderTopicDetails()}
                    </div>
                    
                    <div class="semantic-similarity-map">
                        ${this.renderSemanticSimilarityMap()}
                    </div>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.attachEventListeners();
    }

    /**
     * Render topic overview section
     */
    renderTopicOverview() {
        const totalSessions = this.sessions.length;
        
        return `
            <div class="topic-overview-grid">
                ${this.topics.slice(0, 6).map(topic => `
                    <div class="topic-card" data-topic="${topic.name}">
                        <div class="topic-color" style="background-color: ${this.semanticColors[topic.name]}"></div>
                        <div class="topic-info">
                            <h4>${topic.name}</h4>
                            <p>${topic.sessionCount} sessions</p>
                            <div class="topic-confidence">
                                <div class="confidence-bar">
                                    <div class="confidence-fill" style="width: ${topic.confidence * 100}%"></div>
                                </div>
                                <span>${(topic.confidence * 100).toFixed(0)}% confidence</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Render detailed topic information
     */
    renderTopicDetails() {
        return `
            <div class="topic-details-section">
                <h4>Topic Analysis</h4>
                <div class="topic-list">
                    ${this.topics.map(topic => `
                        <div class="topic-item" data-topic="${topic.name}">
                            <div class="topic-header">
                                <div class="topic-color-indicator" style="background-color: ${this.semanticColors[topic.name]}"></div>
                                <span class="topic-name">${topic.name}</span>
                                <span class="topic-count">${topic.sessionCount} sessions</span>
                            </div>
                            <div class="topic-description">${topic.description}</div>
                            <div class="topic-keywords">
                                ${topic.keywords.slice(0, 5).map(keyword => 
                                    `<span class="keyword-tag">${keyword}</span>`
                                ).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render semantic similarity map (replaces UMAP)
     */
    renderSemanticSimilarityMap() {
        return `
            <div class="semantic-similarity-section">
                <h4>Semantic Similarity Map</h4>
                <div class="similarity-explanation">
                    <p>Sessions are color-coded by semantic similarity to topics. Similar colors indicate related development activities.</p>
                </div>
                <div class="session-grid">
                    ${this.sessions.slice(0, 50).map(session => {
                        const assignment = this.topicAssignments[session.id];
                        const color = assignment ? this.semanticColors[assignment.topicName] : '#6B7280';
                        const topicName = assignment ? assignment.topicName : 'Unclassified';
                        
                        return `
                            <div class="session-dot" 
                                 style="background-color: ${color}" 
                                 data-session-id="${session.id}"
                                 title="${topicName}: ${session.id}">
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="similarity-legend">
                    <h5>Topic Legend</h5>
                    <div class="legend-items">
                        ${this.topics.slice(0, 8).map(topic => `
                            <div class="legend-item">
                                <div class="legend-color" style="background-color: ${this.semanticColors[topic.name]}"></div>
                                <span>${topic.name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render no data state
     */
    renderNoData() {
        this.container.innerHTML = `
            <div class="no-data-state">
                <div class="no-data-icon"></div>
                <h3>No Topic Data Available</h3>
                <p>Start some coding sessions to see topic clustering analysis.</p>
            </div>
        `;
    }

    /**
     * Render error state
     */
    renderError(message) {
        this.container.innerHTML = `
            <div class="error-state">
                <div class="error-icon"></div>
                <h3>Analysis Error</h3>
                <p>${message}</p>
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Topic card click handlers
        this.container.querySelectorAll('.topic-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const topicName = e.currentTarget.dataset.topic;
                this.selectTopic(topicName);
            });
        });

        // Session dot hover handlers
        this.container.querySelectorAll('.session-dot').forEach(dot => {
            dot.addEventListener('mouseenter', (e) => {
                const sessionId = e.currentTarget.dataset.sessionId;
                this.hoverSession(sessionId);
            });
            
            dot.addEventListener('mouseleave', () => {
                this.unhoverSession();
            });
        });
    }

    /**
     * Select a topic
     */
    selectTopic(topicName) {
        this.selectedTopic = topicName;
        
        // Update UI to show selected topic
        this.container.querySelectorAll('.topic-card').forEach(card => {
            card.classList.toggle('selected', card.dataset.topic === topicName);
        });
        
        console.log(`Selected topic: ${topicName}`);
    }

    /**
     * Hover over a session
     */
    hoverSession(sessionId) {
        this.hoveredSession = sessionId;
        console.log(`Hovering session: ${sessionId}`);
    }

    /**
     * Unhover session
     */
    unhoverSession() {
        this.hoveredSession = null;
    }
}

// Make it globally available
window.TopicClusteringVisualization = TopicClusteringVisualization;
