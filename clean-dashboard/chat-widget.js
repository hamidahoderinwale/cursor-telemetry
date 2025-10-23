/**
 * Intelligent Chat Widget with Temporal Reasoning
 * Integrates with Cursor Telemetry Dashboard
 */

class ChatWidget {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.apiBase = 'http://localhost:43917';
        this.reasoningEngine = new ReasoningEngine();
        
        this.initializeElements();
        this.attachEventListeners();
        this.loadWelcomeMessage();
    }
    
    initializeElements() {
        this.toggleBtn = document.getElementById('chatToggleBtn');
        this.widget = document.getElementById('chatWidget');
        this.messagesContainer = document.getElementById('chatMessages');
        this.input = document.getElementById('chatInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.minimizeBtn = document.getElementById('minimizeBtn');
        this.notificationBadge = document.getElementById('notificationBadge');
    }
    
    attachEventListeners() {
        // Toggle widget
        this.toggleBtn.addEventListener('click', () => this.toggle());
        this.minimizeBtn.addEventListener('click', () => this.toggle());
        
        // Send message
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Auto-resize textarea
        this.input.addEventListener('input', () => {
            this.input.style.height = 'auto';
            this.input.style.height = Math.min(this.input.scrollHeight, 120) + 'px';
        });
        
        // Quick actions
        document.querySelectorAll('.quick-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleQuickAction(action);
            });
        });
        
        // Suggestion chips
        document.querySelectorAll('.suggestion-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                this.input.value = e.target.textContent;
                this.sendMessage();
            });
        });
    }
    
    toggle() {
        this.isOpen = !this.isOpen;
        this.widget.classList.toggle('open', this.isOpen);
        
        if (this.isOpen) {
            this.input.focus();
            this.clearNotifications();
        }
    }
    
    clearNotifications() {
        this.notificationBadge.style.display = 'none';
    }
    
    showNotification(count) {
        if (!this.isOpen) {
            this.notificationBadge.textContent = count;
            this.notificationBadge.style.display = 'flex';
        }
    }
    
    async sendMessage() {
        const text = this.input.value.trim();
        if (!text) return;
        
        // Add user message
        this.addMessage({
            role: 'user',
            content: text,
            timestamp: new Date()
        });
        
        // Clear input
        this.input.value = '';
        this.input.style.height = 'auto';
        
        // Show typing indicator
        this.showTypingIndicator();
        
        // Process message
        try {
            const response = await this.processQuery(text);
            this.hideTypingIndicator();
            this.addMessage({
                role: 'assistant',
                content: response.answer,
                reasoning: response.reasoning,
                sources: response.sources,
                timestamp: new Date()
            });
        } catch (error) {
            console.error('Error processing query:', error);
            this.hideTypingIndicator();
            this.addMessage({
                role: 'assistant',
                content: 'I apologize, but I encountered an error processing your request. Please try again.',
                timestamp: new Date()
            });
        }
    }
    
    async processQuery(query) {
        // Extract temporal context
        const temporalContext = this.reasoningEngine.extractTimeContext(query);
        
        // Fetch relevant data
        const data = await this.fetchRelevantData(temporalContext);
        
        // Analyze and reason
        const response = await this.reasoningEngine.reason(query, data);
        
        return response;
    }
    
    async fetchRelevantData(temporalContext) {
        const { start, end } = temporalContext;
        
        try {
            const [events, prompts, workspaces, systemData] = await Promise.all([
                fetch(`${this.apiBase}/api/activity`).then(r => r.json()),
                fetch(`${this.apiBase}/api/prompts`).then(r => r.json()),
                fetch(`${this.apiBase}/api/workspaces`).then(r => r.json()),
                fetch(`${this.apiBase}/raw-data/system-resources`).then(r => r.json())
            ]);
            
            // Filter by time range
            const filteredEvents = events.filter(e => {
                const eventTime = new Date(e.timestamp).getTime();
                return eventTime >= start && eventTime <= end;
            });
            
            const filteredPrompts = prompts.filter(p => {
                const promptTime = new Date(p.timestamp).getTime();
                return promptTime >= start && promptTime <= end;
            });
            
            return {
                events: filteredEvents,
                prompts: filteredPrompts,
                workspaces: workspaces,
                systemData: systemData,
                temporalContext: temporalContext
            };
        } catch (error) {
            console.error('Error fetching data:', error);
            return {
                events: [],
                prompts: [],
                workspaces: [],
                systemData: [],
                temporalContext: temporalContext
            };
        }
    }
    
    addMessage(message) {
        this.messages.push(message);
        this.renderMessage(message);
        this.scrollToBottom();
    }
    
    renderMessage(message) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${message.role}`;
        
        const avatar = message.role === 'user' ? '👤' : '🧠';
        const time = this.formatTime(message.timestamp);
        
        let content = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <div class="message-bubble">${this.formatMessageContent(message.content)}</div>
                <div class="message-time">${time}</div>
        `;
        
        // Add reasoning steps if available
        if (message.reasoning && message.reasoning.length > 0) {
            content += `
                <div class="reasoning-steps">
                    <strong style="color: var(--chat-accent); font-size: 11px; text-transform: uppercase;">Reasoning Process:</strong>
                    ${message.reasoning.map(step => `
                        <div class="reasoning-step">
                            <strong>Step ${step.step}:</strong> ${step.description}
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        // Add sources if available
        if (message.sources && message.sources.length > 0) {
            content += `
                <div class="suggestions">
                    ${message.sources.map(source => `
                        <div class="suggestion-chip">${source}</div>
                    `).join('')}
                </div>
            `;
        }
        
        content += '</div>';
        messageEl.innerHTML = content;
        
        // Remove welcome message if present
        const welcome = this.messagesContainer.querySelector('.welcome-message');
        if (welcome) {
            welcome.remove();
        }
        
        this.messagesContainer.appendChild(messageEl);
    }
    
    formatMessageContent(content) {
        // Convert markdown-like syntax to HTML
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code style="background: var(--chat-bg); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px;">$1</code>')
            .replace(/\n/g, '<br>');
    }
    
    formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'message assistant';
        indicator.id = 'typingIndicator';
        indicator.innerHTML = `
            <div class="message-avatar">🧠</div>
            <div class="typing-indicator">
                <div class="typing-dots">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
        this.messagesContainer.appendChild(indicator);
        this.scrollToBottom();
    }
    
    hideTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
    
    loadWelcomeMessage() {
        // Can be used to load proactive insights
        setTimeout(() => {
            if (this.messages.length === 0 && !this.isOpen) {
                this.showNotification(1);
            }
        }, 5000);
    }
    
    async handleQuickAction(action) {
        const queries = {
            'productivity': 'How productive was I today?',
            'files': 'What files did I work on most?',
            'ai-usage': 'Show my AI usage patterns',
            'sessions': 'Analyze my coding sessions today'
        };
        
        const query = queries[action];
        if (query) {
            this.input.value = query;
            this.sendMessage();
        }
    }
}

/**
 * Reasoning Engine
 * Processes queries and generates intelligent responses
 */
class ReasoningEngine {
    constructor() {
        this.timePatterns = {
            'today': () => this.getTodayRange(),
            'yesterday': () => this.getYesterdayRange(),
            'this week': () => this.getThisWeekRange(),
            'this month': () => this.getThisMonthRange(),
            'last week': () => this.getLastWeekRange(),
            'last month': () => this.getLastMonthRange()
        };
    }
    
    extractTimeContext(query) {
        const queryLower = query.toLowerCase();
        
        for (const [pattern, rangeFunc] of Object.entries(this.timePatterns)) {
            if (queryLower.includes(pattern)) {
                return rangeFunc();
            }
        }
        
        // Default to last 24 hours
        return this.getTodayRange();
    }
    
    getTodayRange() {
        const now = new Date();
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return { start: start.getTime(), end: now.getTime(), label: 'today' };
    }
    
    getYesterdayRange() {
        const now = new Date();
        const start = new Date(now);
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setHours(23, 59, 59, 999);
        return { start: start.getTime(), end: end.getTime(), label: 'yesterday' };
    }
    
    getThisWeekRange() {
        const now = new Date();
        const start = new Date(now);
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);
        return { start: start.getTime(), end: now.getTime(), label: 'this week' };
    }
    
    getThisMonthRange() {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: start.getTime(), end: now.getTime(), label: 'this month' };
    }
    
    getLastWeekRange() {
        const now = new Date();
        const end = new Date(now);
        end.setDate(end.getDate() - end.getDay() - 1);
        end.setHours(23, 59, 59, 999);
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        return { start: start.getTime(), end: end.getTime(), label: 'last week' };
    }
    
    getLastMonthRange() {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return { start: start.getTime(), end: end.getTime(), label: 'last month' };
    }
    
    async reason(query, data) {
        const { events, prompts, workspaces, temporalContext } = data;
        
        // Classify query type
        const queryType = this.classifyQuery(query);
        
        // Generate reasoning steps
        const reasoning = [];
        let answer = '';
        let sources = [];
        
        switch (queryType) {
            case 'productivity':
                const productivityAnalysis = this.analyzeProductivity(events, prompts, temporalContext);
                reasoning.push(...productivityAnalysis.reasoning);
                answer = productivityAnalysis.answer;
                sources = productivityAnalysis.sources;
                break;
                
            case 'files':
                const fileAnalysis = this.analyzeFiles(events, temporalContext);
                reasoning.push(...fileAnalysis.reasoning);
                answer = fileAnalysis.answer;
                sources = fileAnalysis.sources;
                break;
                
            case 'ai-usage':
                const aiAnalysis = this.analyzeAIUsage(prompts, temporalContext);
                reasoning.push(...aiAnalysis.reasoning);
                answer = aiAnalysis.answer;
                sources = aiAnalysis.sources;
                break;
                
            case 'sessions':
                const sessionAnalysis = this.analyzeSessions(events, temporalContext);
                reasoning.push(...sessionAnalysis.reasoning);
                answer = sessionAnalysis.answer;
                sources = sessionAnalysis.sources;
                break;
                
            default:
                answer = this.generateGeneralResponse(query, data);
                reasoning.push({ step: 1, description: 'Analyzed your general development data' });
        }
        
        return { answer, reasoning, sources };
    }
    
    classifyQuery(query) {
        const queryLower = query.toLowerCase();
        
        if (queryLower.includes('productive') || queryLower.includes('productivity')) {
            return 'productivity';
        } else if (queryLower.includes('file') || queryLower.includes('work on')) {
            return 'files';
        } else if (queryLower.includes('ai') || queryLower.includes('model') || queryLower.includes('prompt')) {
            return 'ai-usage';
        } else if (queryLower.includes('session') || queryLower.includes('coding time')) {
            return 'sessions';
        }
        
        return 'general';
    }
    
    analyzeProductivity(events, prompts, temporalContext) {
        const reasoning = [
            { step: 1, description: `Analyzed ${events.length} file change events ${temporalContext.label}` },
            { step: 2, description: `Examined ${prompts.length} AI interactions` },
            { step: 3, description: 'Calculated productivity metrics and patterns' }
        ];
        
        const totalChanges = events.reduce((sum, e) => {
            const details = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
            return sum + (details?.lines_added || 0) + (details?.lines_removed || 0);
        }, 0);
        
        const aiInteractions = prompts.length;
        const uniqueFiles = new Set(events.map(e => {
            const details = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
            return details?.file_path || '';
        })).size;
        
        let productivityLevel = 'moderate';
        if (totalChanges > 500 || aiInteractions > 20) productivityLevel = 'high';
        else if (totalChanges < 100 && aiInteractions < 5) productivityLevel = 'low';
        
        const answer = `**Productivity Analysis ${temporalContext.label.charAt(0).toUpperCase() + temporalContext.label.slice(1)}**\n\n` +
            `You've been **${productivityLevel}ly productive** with:\n\n` +
            `• **${totalChanges} lines** of code changed\n` +
            `• **${uniqueFiles} unique files** modified\n` +
            `• **${aiInteractions} AI interactions** for assistance\n\n` +
            `${this.generateProductivityInsight(productivityLevel, events, prompts)}`;
        
        const sources = [
            `${events.length} events`,
            `${prompts.length} prompts`,
            `${uniqueFiles} files`
        ];
        
        return { reasoning, answer, sources };
    }
    
    generateProductivityInsight(level, events, prompts) {
        if (level === 'high') {
            return '💡 *Great work! You\'re in a productive flow. Consider taking short breaks to maintain this momentum.*';
        } else if (level === 'low') {
            return '💡 *It looks like a lighter day. This could be a good time for planning, learning, or tackling smaller tasks.*';
        }
        return '💡 *Steady progress! You\'re maintaining a consistent development pace.*';
    }
    
    analyzeFiles(events, temporalContext) {
        const reasoning = [
            { step: 1, description: `Grouped ${events.length} events by file` },
            { step: 2, description: 'Ranked files by modification frequency and impact' }
        ];
        
        const fileStats = {};
        events.forEach(e => {
            const details = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
            const filePath = details?.file_path || 'unknown';
            const fileName = filePath.split('/').pop();
            
            if (!fileStats[fileName]) {
                fileStats[fileName] = { changes: 0, lines: 0, path: filePath };
            }
            fileStats[fileName].changes++;
            fileStats[fileName].lines += (details?.lines_added || 0) + (details?.lines_removed || 0);
        });
        
        const topFiles = Object.entries(fileStats)
            .sort((a, b) => b[1].changes - a[1].changes)
            .slice(0, 5);
        
        let answer = `**Most Active Files ${temporalContext.label.charAt(0).toUpperCase() + temporalContext.label.slice(1)}**\n\n`;
        topFiles.forEach(([file, stats], i) => {
            answer += `**${i + 1}. ${file}**\n`;
            answer += `   • ${stats.changes} modifications\n`;
            answer += `   • ${stats.lines} lines changed\n\n`;
        });
        
        const sources = topFiles.map(([file]) => file);
        
        return { reasoning, answer, sources };
    }
    
    analyzeAIUsage(prompts, temporalContext) {
        const reasoning = [
            { step: 1, description: `Analyzed ${prompts.length} AI prompts` },
            { step: 2, description: 'Categorized by interface type and model' },
            { step: 3, description: 'Identified usage patterns' }
        ];
        
        const modeCount = {};
        let totalContext = 0;
        let contextCount = 0;
        
        prompts.forEach(p => {
            const mode = p.mode || 'unknown';
            modeCount[mode] = (modeCount[mode] || 0) + 1;
            if (p.contextUsage) {
                totalContext += p.contextUsage;
                contextCount++;
            }
        });
        
        const avgContext = contextCount > 0 ? (totalContext / contextCount).toFixed(1) : 0;
        
        let answer = `**AI Usage Patterns ${temporalContext.label.charAt(0).toUpperCase() + temporalContext.label.slice(1)}**\n\n`;
        answer += `Total Interactions: **${prompts.length}**\n`;
        answer += `Average Context: **${avgContext}%**\n\n`;
        answer += '**By Interface:**\n';
        
        Object.entries(modeCount).forEach(([mode, count]) => {
            const percentage = ((count / prompts.length) * 100).toFixed(0);
            answer += `• ${mode}: ${count} (${percentage}%)\n`;
        });
        
        const sources = Object.keys(modeCount);
        
        return { reasoning, answer, sources };
    }
    
    analyzeSessions(events, temporalContext) {
        const reasoning = [
            { step: 1, description: 'Detected coding sessions from activity patterns' },
            { step: 2, description: 'Calculated session durations and intensity' }
        ];
        
        // Group events into sessions (events within 30 minutes = same session)
        const sessions = [];
        let currentSession = null;
        const sortedEvents = events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        sortedEvents.forEach(event => {
            const eventTime = new Date(event.timestamp).getTime();
            
            if (!currentSession || (eventTime - currentSession.lastEvent) > 30 * 60 * 1000) {
                if (currentSession) sessions.push(currentSession);
                currentSession = {
                    start: eventTime,
                    lastEvent: eventTime,
                    events: [event],
                    duration: 0
                };
            } else {
                currentSession.lastEvent = eventTime;
                currentSession.events.push(event);
                currentSession.duration = currentSession.lastEvent - currentSession.start;
            }
        });
        if (currentSession) sessions.push(currentSession);
        
        const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
        const avgDuration = sessions.length > 0 ? totalDuration / sessions.length : 0;
        
        let answer = `**Coding Sessions ${temporalContext.label.charAt(0).toUpperCase() + temporalContext.label.slice(1)}**\n\n`;
        answer += `• **${sessions.length} sessions** detected\n`;
        answer += `• Total time: **${this.formatDuration(totalDuration)}**\n`;
        answer += `• Average session: **${this.formatDuration(avgDuration)}**\n\n`;
        
        if (sessions.length > 0) {
            const longestSession = sessions.reduce((max, s) => s.duration > max.duration ? s : max);
            answer += `💡 *Your longest session was ${this.formatDuration(longestSession.duration)} with ${longestSession.events.length} file changes.*`;
        }
        
        const sources = [`${sessions.length} sessions`, `${events.length} events`];
        
        return { reasoning, answer, sources };
    }
    
    formatDuration(ms) {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }
    
    generateGeneralResponse(query, data) {
        return `I understand you're asking about: "${query}"\n\n` +
            `I've analyzed your development data and found:\n` +
            `• ${data.events.length} file change events\n` +
            `• ${data.prompts.length} AI interactions\n` +
            `• ${data.workspaces.length} active workspaces\n\n` +
            `Could you rephrase your question to be more specific? Try asking about your productivity, files, AI usage, or coding sessions.`;
    }
}

// Initialize chat widget when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.chatWidget = new ChatWidget();
});

