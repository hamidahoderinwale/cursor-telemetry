/**
 * Security Dashboard UI Component
 * Provides real-time security monitoring and analytics
 */

class SecurityDashboard {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.updateInterval = 30000; // 30 seconds
    this.intervalId = null;
    this.analytics = null;
  }

  /**
   * Initialize the security dashboard
   */
  async init() {
    try {
      await this.loadAnalytics();
      this.render();
      this.startAutoUpdate();
    } catch (error) {
      console.error('Error initializing security dashboard:', error);
      this.renderError(error);
    }
  }

  /**
   * Load security analytics
   */
  async loadAnalytics() {
    try {
      const response = await fetch('/api/security/analytics');
      const data = await response.json();
      
      if (data.success) {
        this.analytics = data.data;
      } else {
        throw new Error(data.error || 'Failed to load security analytics');
      }
    } catch (error) {
      console.error('Error loading security analytics:', error);
      throw error;
    }
  }

  /**
   * Render the security dashboard
   */
  render() {
    if (!this.analytics) {
      this.renderLoading();
      return;
    }

    this.container.innerHTML = `
      <div class="security-dashboard">
        <div class="security-header">
          <h2>Security Dashboard</h2>
          <div class="security-status">
            <span class="status-indicator ${this.getRiskClass(this.analytics.summary.riskScore)}">
              ${this.getRiskLevel(this.analytics.summary.riskScore)}
            </span>
          </div>
        </div>

        <div class="security-overview">
          <div class="metrics-grid">
            <div class="metric-card critical">
              <div class="metric-icon"></div>
              <div class="metric-content">
                <div class="metric-label">Total Issues</div>
                <div class="metric-value">${this.analytics.summary.totalIssues}</div>
              </div>
            </div>
            
            <div class="metric-card ${this.getRiskClass(this.analytics.summary.riskScore)}">
              <div class="metric-icon"></div>
              <div class="metric-content">
                <div class="metric-label">Risk Score</div>
                <div class="metric-value">${this.analytics.summary.riskScore}</div>
              </div>
            </div>
            
            <div class="metric-card high">
              <div class="metric-icon"></div>
              <div class="metric-content">
                <div class="metric-label">Critical Issues</div>
                <div class="metric-value">${this.analytics.summary.issuesBySeverity.critical || 0}</div>
              </div>
            </div>
            
            <div class="metric-card medium">
              <div class="metric-icon"></div>
              <div class="metric-content">
                <div class="metric-label">High Issues</div>
                <div class="metric-value">${this.analytics.summary.issuesBySeverity.high || 0}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="security-details">
          <div class="issues-breakdown">
            <h3>Issues by Type</h3>
            <div class="issues-list">
              ${this.renderIssuesByType()}
            </div>
          </div>

          <div class="top-risks">
            <h3>Top Risks</h3>
            <div class="risks-list">
              ${this.renderTopRisks()}
            </div>
          </div>
        </div>

        <div class="security-recommendations">
          <h3> Security Recommendations</h3>
          <div class="recommendations-list">
            ${this.renderRecommendations()}
          </div>
        </div>

        <div class="security-actions">
          <button class="btn btn-primary" onclick="securityDashboard.refresh()">
            Refresh
          </button>
          <button class="btn btn-secondary" onclick="securityDashboard.exportReport()">
            Export Report
          </button>
          <button class="btn btn-danger" onclick="securityDashboard.showCriticalIssues()">
            Critical Issues
          </button>
        </div>
      </div>
    `;

    this.addStyles();
  }

  /**
   * Render issues by type
   */
  renderIssuesByType() {
    const issues = this.analytics.summary.issuesByType;
    const total = this.analytics.summary.totalIssues;
    
    return Object.entries(issues)
      .sort(([,a], [,b]) => b - a)
      .map(([type, count]) => {
        const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
        return `
          <div class="issue-type">
            <div class="issue-type-header">
              <span class="issue-type-name">${this.formatIssueType(type)}</span>
              <span class="issue-type-count">${count}</span>
            </div>
            <div class="issue-type-bar">
              <div class="issue-type-progress" style="width: ${percentage}%"></div>
            </div>
            <div class="issue-type-percentage">${percentage}%</div>
          </div>
        `;
      }).join('');
  }

  /**
   * Render top risks
   */
  renderTopRisks() {
    return this.analytics.topRisks.map(risk => `
      <div class="risk-item">
        <div class="risk-type">${this.formatIssueType(risk.type)}</div>
        <div class="risk-count">${risk.count}</div>
      </div>
    `).join('');
  }

  /**
   * Render recommendations
   */
  renderRecommendations() {
    return this.analytics.recommendations.map(rec => `
      <div class="recommendation ${rec.severity}">
        <div class="recommendation-header">
          <span class="recommendation-type">${rec.type}</span>
          <span class="recommendation-severity ${rec.severity}">${rec.severity}</span>
        </div>
        <div class="recommendation-message">${rec.message}</div>
        <div class="recommendation-action">${rec.action}</div>
      </div>
    `).join('');
  }

  /**
   * Render loading state
   */
  renderLoading() {
    this.container.innerHTML = `
      <div class="security-dashboard loading">
        <div class="loading-spinner"></div>
        <div class="loading-text">Loading security analytics...</div>
      </div>
    `;
  }

  /**
   * Render error state
   */
  renderError(error) {
    this.container.innerHTML = `
      <div class="security-dashboard error">
        <div class="error-icon"></div>
        <div class="error-message">Failed to load security analytics</div>
        <div class="error-details">${error.message}</div>
        <button class="btn btn-primary" onclick="securityDashboard.init()">
          Retry
        </button>
      </div>
    `;
  }

  /**
   * Add CSS styles
   */
  addStyles() {
    if (document.getElementById('security-dashboard-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'security-dashboard-styles';
    styles.textContent = `
      .security-dashboard {
        padding: 20px;
        background: #f8f9fa;
        border-radius: 8px;
        margin: 20px 0;
      }

      .security-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      }

      .security-header h2 {
        margin: 0;
        color: #333;
      }

      .status-indicator {
        padding: 8px 16px;
        border-radius: 20px;
        font-weight: bold;
        text-transform: uppercase;
      }

      .status-indicator.critical {
        background: #dc3545;
        color: white;
      }

      .status-indicator.high {
        background: #fd7e14;
        color: white;
      }

      .status-indicator.medium {
        background: #ffc107;
        color: #333;
      }

      .status-indicator.low {
        background: #28a745;
        color: white;
      }

      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
      }

      .metric-card {
        background: white;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        display: flex;
        align-items: center;
        gap: 15px;
      }

      .metric-card.critical {
        border-left: 4px solid #dc3545;
      }

      .metric-card.high {
        border-left: 4px solid #fd7e14;
      }

      .metric-card.medium {
        border-left: 4px solid #ffc107;
      }

      .metric-card.low {
        border-left: 4px solid #28a745;
      }

      .metric-icon {
        font-size: 24px;
      }

      .metric-content {
        flex: 1;
      }

      .metric-label {
        font-size: 14px;
        color: #666;
        margin-bottom: 5px;
      }

      .metric-value {
        font-size: 24px;
        font-weight: bold;
        color: #333;
      }

      .security-details {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 30px;
        margin-bottom: 30px;
      }

      .issues-breakdown h3,
      .top-risks h3 {
        margin: 0 0 15px 0;
        color: #333;
      }

      .issue-type {
        margin-bottom: 15px;
        padding: 10px;
        background: white;
        border-radius: 6px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }

      .issue-type-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
      }

      .issue-type-name {
        font-weight: 500;
        color: #333;
      }

      .issue-type-count {
        font-weight: bold;
        color: #666;
      }

      .issue-type-bar {
        height: 6px;
        background: #e9ecef;
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 5px;
      }

      .issue-type-progress {
        height: 100%;
        background: #007bff;
        transition: width 0.3s ease;
      }

      .issue-type-percentage {
        font-size: 12px;
        color: #666;
      }

      .risk-item {
        display: flex;
        justify-content: space-between;
        padding: 10px;
        background: white;
        border-radius: 6px;
        margin-bottom: 10px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }

      .risk-type {
        font-weight: 500;
        color: #333;
      }

      .risk-count {
        font-weight: bold;
        color: #dc3545;
      }

      .security-recommendations {
        margin-bottom: 30px;
      }

      .security-recommendations h3 {
        margin: 0 0 15px 0;
        color: #333;
      }

      .recommendation {
        background: white;
        border-radius: 6px;
        padding: 15px;
        margin-bottom: 10px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        border-left: 4px solid #007bff;
      }

      .recommendation.critical {
        border-left-color: #dc3545;
      }

      .recommendation.high {
        border-left-color: #fd7e14;
      }

      .recommendation.medium {
        border-left-color: #ffc107;
      }

      .recommendation-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
      }

      .recommendation-type {
        font-weight: 500;
        color: #333;
      }

      .recommendation-severity {
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: bold;
        text-transform: uppercase;
      }

      .recommendation-severity.critical {
        background: #dc3545;
        color: white;
      }

      .recommendation-severity.high {
        background: #fd7e14;
        color: white;
      }

      .recommendation-severity.medium {
        background: #ffc107;
        color: #333;
      }

      .recommendation-message {
        color: #666;
        margin-bottom: 5px;
      }

      .recommendation-action {
        font-size: 14px;
        color: #007bff;
        font-weight: 500;
      }

      .security-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .btn {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        text-decoration: none;
        display: inline-block;
        transition: all 0.2s ease;
      }

      .btn-primary {
        background: #007bff;
        color: white;
      }

      .btn-primary:hover {
        background: #0056b3;
      }

      .btn-secondary {
        background: #6c757d;
        color: white;
      }

      .btn-secondary:hover {
        background: #545b62;
      }

      .btn-danger {
        background: #dc3545;
        color: white;
      }

      .btn-danger:hover {
        background: #c82333;
      }

      .loading {
        text-align: center;
        padding: 40px;
      }

      .loading-spinner {
        font-size: 24px;
        margin-bottom: 10px;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      .error {
        text-align: center;
        padding: 40px;
        background: #f8d7da;
        border: 1px solid #f5c6cb;
        border-radius: 6px;
      }

      .error-icon {
        font-size: 24px;
        margin-bottom: 10px;
      }

      .error-message {
        font-weight: bold;
        color: #721c24;
        margin-bottom: 5px;
      }

      .error-details {
        color: #721c24;
        margin-bottom: 15px;
      }
    `;

    document.head.appendChild(styles);
  }

  /**
   * Get risk class based on score
   */
  getRiskClass(riskScore) {
    if (riskScore >= 50) return 'critical';
    if (riskScore >= 20) return 'high';
    if (riskScore >= 10) return 'medium';
    return 'low';
  }

  /**
   * Get risk level text
   */
  getRiskLevel(riskScore) {
    if (riskScore >= 50) return 'Critical';
    if (riskScore >= 20) return 'High';
    if (riskScore >= 10) return 'Medium';
    return 'Low';
  }

  /**
   * Format issue type for display
   */
  formatIssueType(type) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Start auto-update
   */
  startAutoUpdate() {
    this.intervalId = setInterval(() => {
      this.refresh();
    }, this.updateInterval);
  }

  /**
   * Stop auto-update
   */
  stopAutoUpdate() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Refresh the dashboard
   */
  async refresh() {
    try {
      await this.loadAnalytics();
      this.render();
    } catch (error) {
      console.error('Error refreshing security dashboard:', error);
    }
  }

  /**
   * Export security report
   */
  async exportReport() {
    try {
      const response = await fetch('/api/security/analytics');
      const data = await response.json();
      
      if (data.success) {
        const report = {
          timestamp: new Date().toISOString(),
          summary: data.data.summary,
          issues: data.data.issues,
          recommendations: data.data.recommendations
        };
        
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `security-report-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting security report:', error);
      alert('Failed to export security report');
    }
  }

  /**
   * Show critical issues
   */
  async showCriticalIssues() {
    try {
      const response = await fetch('/api/security/critical');
      const data = await response.json();
      
      if (data.success) {
        const issues = data.data.issues;
        if (issues.length === 0) {
          alert('No critical issues found');
          return;
        }
        
        const issuesList = issues.map(issue => `
          <div class="critical-issue">
            <strong>${this.formatIssueType(issue.type)}</strong><br>
            <small>File: ${issue.context}</small><br>
            <small>Value: ${issue.value.substring(0, 50)}...</small>
          </div>
        `).join('');
        
        alert(`Critical Issues Found:\n\n${issuesList}`);
      }
    } catch (error) {
      console.error('Error getting critical issues:', error);
      alert('Failed to load critical issues');
    }
  }

  /**
   * Destroy the dashboard
   */
  destroy() {
    this.stopAutoUpdate();
    this.container.innerHTML = '';
  }
}

// Global instance
let securityDashboard = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('security-dashboard');
  if (container) {
    securityDashboard = new SecurityDashboard('security-dashboard');
    securityDashboard.init();
  }
});

module.exports = SecurityDashboard;
