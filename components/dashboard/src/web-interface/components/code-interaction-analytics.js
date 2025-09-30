/**
 * Code Interaction Analytics Component
 * Displays real-time analytics for code acceptance/rejection patterns
 */

class CodeInteractionAnalytics {
    constructor() {
        this.analytics = null;
        this.updateInterval = null;
        this.isVisible = false;
        
        console.log('Code Interaction Analytics initialized');
    }

    async initialize() {
        try {
            await this.loadAnalytics();
            this.setupAutoRefresh();
            console.log('Code Interaction Analytics loaded and ready');
        } catch (error) {
            console.error('Failed to initialize Code Interaction Analytics:', error);
        }
    }

    async loadAnalytics() {
        try {
            const response = await fetch('/api/conversations/code-analytics');
            const data = await response.json();
            
            if (data.success) {
                this.analytics = data.analytics;
                this.render();
            } else {
                console.error('Failed to load analytics:', data.error);
            }
        } catch (error) {
            console.error('Error loading analytics:', error);
        }
    }

    setupAutoRefresh() {
        // Refresh analytics every 5 seconds
        this.updateInterval = setInterval(() => {
            this.loadAnalytics();
        }, 5000);
    }

    render() {
        if (!this.analytics) return;

        const container = document.getElementById('code-interaction-analytics');
        if (!container) return;

        container.innerHTML = `
            <div class="analytics-container">
                <div class="analytics-header">
                    <h3>Code Interaction Analytics</h3>
                    <div class="analytics-stats">
                        <span class="stat-item">
                            <span class="stat-label">Total Interactions:</span>
                            <span class="stat-value">${this.analytics.totalInteractions}</span>
                        </span>
                        <span class="stat-item">
                            <span class="stat-label">Acceptance Rate:</span>
                            <span class="stat-value acceptance-rate">${this.analytics.acceptanceRate}%</span>
                        </span>
                    </div>
                </div>

                <div class="analytics-grid">
                    ${this.renderInteractionBreakdown()}
                    ${this.renderMethodBreakdown()}
                    ${this.renderActionBreakdown()}
                    ${this.renderRecentActivity()}
                </div>
            </div>
        `;

        this.addStyles();
    }

    renderInteractionBreakdown() {
        const { acceptances, rejections, suggestionInteractions } = this.analytics;
        const total = acceptances + rejections + suggestionInteractions;
        
        return `
            <div class="analytics-card">
                <h4>Interaction Breakdown</h4>
                <div class="breakdown-chart">
                    <div class="breakdown-item acceptance">
                        <div class="breakdown-bar" style="width: ${total > 0 ? (acceptances / total * 100) : 0}%"></div>
                        <span class="breakdown-label">Acceptances: ${acceptances}</span>
                    </div>
                    <div class="breakdown-item rejection">
                        <div class="breakdown-bar" style="width: ${total > 0 ? (rejections / total * 100) : 0}%"></div>
                        <span class="breakdown-label">Rejections: ${rejections}</span>
                    </div>
                    <div class="breakdown-item suggestion">
                        <div class="breakdown-bar" style="width: ${total > 0 ? (suggestionInteractions / total * 100) : 0}%"></div>
                        <span class="breakdown-label">Suggestions: ${suggestionInteractions}</span>
                    </div>
                </div>
            </div>
        `;
    }

    renderMethodBreakdown() {
        const { methods } = this.analytics;
        const total = Object.values(methods).reduce((sum, count) => sum + count, 0);
        
        return `
            <div class="analytics-card">
                <h4>Interaction Methods</h4>
                <div class="method-list">
                    ${Object.entries(methods).map(([method, count]) => `
                        <div class="method-item">
                            <span class="method-name">${method}</span>
                            <span class="method-count">${count}</span>
                            <div class="method-bar">
                                <div class="method-fill" style="width: ${total > 0 ? (count / total * 100) : 0}%"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderActionBreakdown() {
        const { actions } = this.analytics;
        const total = Object.values(actions).reduce((sum, count) => sum + count, 0);
        
        // Filter out keyboard shortcuts from display (keep tracking but don't show in UI)
        const displayActions = Object.entries(actions).filter(([action, count]) => {
            // Hide keyboard shortcuts from UI display
            const keyboardShortcuts = ['Command+N', 'Command+Y', 'Tab', 'Escape'];
            return !keyboardShortcuts.includes(action);
        });
        
        if (displayActions.length === 0) {
            return `
                <div class="analytics-card">
                    <h4>Code Interaction Actions</h4>
                    <div class="action-grid">
                        <div class="no-data">No GUI actions recorded yet</div>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="analytics-card">
                <h4>Code Interaction Actions</h4>
                <div class="action-grid">
                    ${displayActions.map(([action, count]) => `
                        <div class="action-item">
                            <span class="action-key">${action}</span>
                            <span class="action-count">${count}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="tracking-note">
                    <small>Keyboard shortcuts (Command+N, Command+Y, Tab, Escape) are tracked but not displayed</small>
                </div>
            </div>
        `;
    }

    renderRecentActivity() {
        const { recentActivity } = this.analytics;
        
        // Filter out keyboard shortcuts from recent activity display
        const displayActivity = recentActivity.filter(activity => {
            const keyboardShortcuts = ['Command+N', 'Command+Y', 'Tab', 'Escape'];
            return !keyboardShortcuts.includes(activity.action);
        });
        
        if (displayActivity.length === 0) {
            return `
                <div class="analytics-card recent-activity">
                    <h4>Recent Activity</h4>
                    <div class="activity-list">
                        <div class="no-data">No GUI interactions recorded yet</div>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="analytics-card recent-activity">
                <h4>Recent Activity</h4>
                <div class="activity-list">
                    ${displayActivity.map(activity => `
                        <div class="activity-item ${activity.type}">
                            <div class="activity-time">${this.formatTime(activity.timestamp)}</div>
                            <div class="activity-content">
                                <span class="activity-type">${activity.type.replace('_', ' ')}</span>
                                <span class="activity-method">${activity.method} (${activity.action})</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    }

    addStyles() {
        if (document.getElementById('code-analytics-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'code-analytics-styles';
        styles.textContent = `
            .analytics-container {
                padding: var(--space-6);
                background: var(--background-primary);
                min-height: 100vh;
                font-family: var(--font-family-base);
            }

            .analytics-header {
                background: var(--background-secondary);
                color: var(--text-primary);
                padding: var(--space-8);
                border: 1px solid var(--border-color);
                margin-bottom: var(--space-8);
                box-shadow: var(--shadow-sm);
            }

            .analytics-header h3 {
                margin: 0 0 var(--space-5) 0;
                font-size: var(--text-3xl);
                font-weight: var(--font-semibold);
                color: var(--text-primary);
            }

            .analytics-stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: var(--space-6);
            }

            .stat-item {
                background: var(--background-secondary);
                padding: var(--space-5);
                border: 1px solid var(--border-color);
                text-align: center;
                box-shadow: var(--shadow-sm);
            }

            .stat-label {
                font-size: var(--text-sm);
                color: var(--text-secondary);
                margin-bottom: var(--space-2);
                font-weight: var(--font-medium);
            }

            .stat-value {
                font-size: var(--text-2xl);
                font-weight: var(--font-bold);
                color: var(--text-primary);
            }

            .acceptance-rate {
                color: var(--text-primary);
            }

            .analytics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                gap: var(--space-6);
            }

            .analytics-card {
                background: var(--background-secondary);
                padding: var(--space-6);
                border: 1px solid var(--border-color);
                box-shadow: var(--shadow-sm);
                transition: var(--transition);
            }

            .analytics-card:hover {
                box-shadow: var(--shadow-md);
            }

            .analytics-card h4 {
                margin: 0 0 var(--space-5) 0;
                color: var(--text-primary);
                font-size: var(--text-lg);
                font-weight: var(--font-semibold);
                padding-bottom: var(--space-3);
                border-bottom: 1px solid var(--border-color);
            }

            .breakdown-chart {
                display: flex;
                flex-direction: column;
                gap: var(--space-4);
            }

            .breakdown-item {
                position: relative;
                height: 40px;
                background: var(--background-primary);
                overflow: hidden;
                border: 1px solid var(--border-color);
                display: flex;
                align-items: center;
                padding: 0 var(--space-4);
            }

            .breakdown-bar {
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
                transition: width 0.4s ease;
                background: var(--text-primary);
            }

            .breakdown-item.acceptance .breakdown-bar {
                background: var(--text-primary);
            }

            .breakdown-item.rejection .breakdown-bar {
                background: var(--text-secondary);
            }

            .breakdown-item.suggestion .breakdown-bar {
                background: var(--text-primary);
            }

            .breakdown-label {
                position: relative;
                z-index: 1;
                color: var(--text-primary);
                font-weight: var(--font-semibold);
                font-size: var(--text-sm);
            }

            .method-list {
                display: flex;
                flex-direction: column;
                gap: var(--space-4);
            }

            .method-item {
                display: flex;
                align-items: center;
                gap: var(--space-4);
                padding: var(--space-4);
                background: var(--background-primary);
                border: 1px solid var(--border-color);
            }

            .method-name {
                min-width: 100px;
                font-weight: var(--font-semibold);
                color: var(--text-primary);
                text-transform: capitalize;
            }

            .method-count {
                min-width: 40px;
                text-align: right;
                color: var(--text-primary);
                font-weight: var(--font-bold);
                font-size: var(--text-lg);
            }

            .method-bar {
                flex: 1;
                height: 12px;
                background: var(--border-color);
                overflow: hidden;
            }

            .method-fill {
                height: 100%;
                background: var(--text-primary);
                transition: width 0.4s ease;
            }

            .action-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                gap: var(--space-4);
            }

            .action-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: var(--space-5) var(--space-4);
                background: var(--background-primary);
                border: 1px solid var(--border-color);
                transition: var(--transition);
            }

            .action-item:hover {
                background: var(--background-hover);
                transform: translateY(-1px);
            }

            .action-key {
                font-family: var(--font-mono);
                font-weight: var(--font-semibold);
                color: var(--text-primary);
                margin-bottom: var(--space-2);
                text-transform: capitalize;
            }

            .action-count {
                font-size: var(--text-xl);
                color: var(--text-primary);
                font-weight: var(--font-bold);
            }

            .action-item:hover .action-key,
            .action-item:hover .action-count {
                color: var(--text-primary);
            }

            .activity-list {
                display: flex;
                flex-direction: column;
                gap: var(--space-3);
                max-height: 320px;
                overflow-y: auto;
                border: 1px solid var(--border-color);
                padding: var(--space-4);
            }

            .activity-item {
                display: flex;
                align-items: center;
                gap: var(--space-2);
                padding: var(--space-2);
                background: var(--background-primary);
            }

            .activity-item.acceptance {
                border-left: 3px solid var(--text-primary);
            }

            .activity-item.rejection {
                border-left: 3px solid var(--text-secondary);
            }

            .activity-item.suggestion_interaction {
                border-left: 3px solid var(--text-primary);
            }

            .activity-time {
                font-size: var(--text-xs);
                color: var(--text-secondary);
                min-width: 60px;
            }

            .activity-content {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .activity-type {
                font-weight: var(--font-medium);
                color: var(--text-primary);
                text-transform: capitalize;
            }

            .activity-method {
                font-size: var(--text-xs);
                color: var(--text-secondary);
            }
            
            .no-data {
                text-align: center;
                color: var(--text-secondary);
                font-style: italic;
                padding: var(--space-8);
            }
            
            .tracking-note {
                margin-top: var(--space-4);
                padding: var(--space-3);
                background: var(--background-primary);
                border-left: 3px solid var(--text-primary);
            }
            
            .tracking-note small {
                color: var(--text-secondary);
                font-size: var(--text-xs);
                line-height: 1.4;
            }
        `;

        document.head.appendChild(styles);
    }

    show() {
        this.isVisible = true;
        const container = document.getElementById('code-interaction-analytics');
        if (container) {
            container.style.display = 'block';
        }
    }

    hide() {
        this.isVisible = false;
        const container = document.getElementById('code-interaction-analytics');
        if (container) {
            container.style.display = 'none';
        }
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        const styles = document.getElementById('code-analytics-styles');
        if (styles) {
            styles.remove();
        }
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CodeInteractionAnalytics };
} else if (typeof window !== 'undefined') {
    window.CodeInteractionAnalytics = CodeInteractionAnalytics;
}

// Auto-initialize if in browser
if (typeof window !== 'undefined') {
    window.codeInteractionAnalytics = new CodeInteractionAnalytics();
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.codeInteractionAnalytics.initialize();
        });
    } else {
        window.codeInteractionAnalytics.initialize();
    }
}
