/**
 * Security API Endpoints
 * Provides security analytics and monitoring
 */

const SecurityAnalyzer = require('./security-analyzer');
const DataStorage = require('../data-processing/data-storage');

class SecurityAPI {
  constructor() {
    this.analyzer = new SecurityAnalyzer();
    this.dataStorage = new DataStorage();
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get comprehensive security analytics
   */
  async getSecurityAnalytics() {
    const cacheKey = 'security-analytics';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    
    try {
      const entries = await this.dataStorage.getAllEntries();
      const analysis = await this.analyzer.analyzeAllData(entries);
      
      const analytics = {
        summary: {
          totalIssues: analysis.metrics.totalIssues,
          riskScore: analysis.metrics.riskScore,
          issuesByType: analysis.metrics.issuesByType,
          issuesBySeverity: analysis.metrics.issuesBySeverity
        },
        issues: analysis.issues,
        recommendations: analysis.recommendations,
        trends: await this.calculateTrends(entries),
        topRisks: this.getTopRisks(analysis.issues)
      };
      
      this.cache.set(cacheKey, {
        data: analytics,
        timestamp: Date.now()
      });
      
      return analytics;
    } catch (error) {
      console.error('Error getting security analytics:', error);
      throw error;
    }
  }

  /**
   * Get issues by specific type
   */
  async getIssuesByType(type) {
    try {
      const entries = await this.dataStorage.getAllEntries();
      const allIssues = [];
      
      for (const entry of entries) {
        const textFields = [
          entry.prompt,
          entry.response,
          entry.before_code,
          entry.after_code
        ].filter(Boolean);
        
        for (const text of textFields) {
          const issues = await this.analyzer.analyzeText(text, {
            filePath: entry.file_path,
            source: entry.source,
            timestamp: entry.timestamp
          });
          
          const filteredIssues = issues.filter(issue => issue.type === type);
          allIssues.push(...filteredIssues);
        }
      }
      
      return {
        type: type,
        count: allIssues.length,
        issues: allIssues
      };
    } catch (error) {
      console.error(`Error getting issues by type ${type}:`, error);
      throw error;
    }
  }

  /**
   * Get critical security issues
   */
  async getCriticalIssues() {
    try {
      const analytics = await this.getSecurityAnalytics();
      const criticalIssues = analytics.issues.filter(issue => issue.severity === 'critical');
      
      return {
        count: criticalIssues.length,
        issues: criticalIssues
      };
    } catch (error) {
      console.error('Error getting critical issues:', error);
      throw error;
    }
  }

  /**
   * Get security trends over time
   */
  async getSecurityTrends(timeRange = '7d') {
    try {
      const entries = await this.dataStorage.getAllEntries();
      const now = new Date();
      const timeRangeMs = this.parseTimeRange(timeRange);
      const startTime = new Date(now.getTime() - timeRangeMs);
      
      // Filter entries by time range
      const filteredEntries = entries.filter(entry => {
        const entryTime = new Date(entry.timestamp);
        return entryTime >= startTime;
      });
      
      // Group by day
      const dailyGroups = this.groupByDay(filteredEntries);
      const trends = [];
      
      for (const [date, dayEntries] of dailyGroups) {
        const dayIssues = [];
        
        for (const entry of dayEntries) {
          const textFields = [
            entry.prompt,
            entry.response,
            entry.before_code,
            entry.after_code
          ].filter(Boolean);
          
          for (const text of textFields) {
            const issues = await this.analyzer.analyzeText(text, {
              filePath: entry.file_path,
              source: entry.source,
              timestamp: entry.timestamp
            });
            dayIssues.push(...issues);
          }
        }
        
        trends.push({
          date: date,
          totalIssues: dayIssues.length,
          criticalIssues: dayIssues.filter(i => i.severity === 'critical').length,
          highIssues: dayIssues.filter(i => i.severity === 'high').length,
          riskScore: this.analyzer.calculateRiskScore(dayIssues)
        });
      }
      
      return trends.sort((a, b) => new Date(a.date) - new Date(b.date));
    } catch (error) {
      console.error('Error getting security trends:', error);
      throw error;
    }
  }

  /**
   * Get security recommendations
   */
  async getSecurityRecommendations() {
    try {
      const analytics = await this.getSecurityAnalytics();
      return analytics.recommendations;
    } catch (error) {
      console.error('Error getting security recommendations:', error);
      throw error;
    }
  }

  /**
   * Get security risk assessment
   */
  async getRiskAssessment() {
    try {
      const analytics = await this.getSecurityAnalytics();
      
      const riskLevel = this.calculateRiskLevel(analytics.summary.riskScore);
      const riskFactors = this.identifyRiskFactors(analytics.issues);
      
      return {
        riskLevel: riskLevel,
        riskScore: analytics.summary.riskScore,
        riskFactors: riskFactors,
        recommendations: analytics.recommendations,
        nextSteps: this.generateNextSteps(riskLevel, riskFactors)
      };
    } catch (error) {
      console.error('Error getting risk assessment:', error);
      throw error;
    }
  }

  /**
   * Calculate trends from entries
   */
  async calculateTrends(entries) {
    const trends = {
      totalIssues: 0,
      criticalIssues: 0,
      highIssues: 0,
      mediumIssues: 0,
      lowIssues: 0,
      riskScore: 0
    };
    
    for (const entry of entries) {
      const textFields = [
        entry.prompt,
        entry.response,
        entry.before_code,
        entry.after_code
      ].filter(Boolean);
      
      for (const text of textFields) {
        const issues = await this.analyzer.analyzeText(text, {
          filePath: entry.file_path,
          source: entry.source,
          timestamp: entry.timestamp
        });
        
        trends.totalIssues += issues.length;
        trends.criticalIssues += issues.filter(i => i.severity === 'critical').length;
        trends.highIssues += issues.filter(i => i.severity === 'high').length;
        trends.mediumIssues += issues.filter(i => i.severity === 'medium').length;
        trends.lowIssues += issues.filter(i => i.severity === 'low').length;
        trends.riskScore += this.analyzer.calculateRiskScore(issues);
      }
    }
    
    return trends;
  }

  /**
   * Get top risks
   */
  getTopRisks(issues) {
    const riskGroups = this.analyzer.groupBy(issues, 'type');
    
    return Object.entries(riskGroups)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Group entries by day
   */
  groupByDay(entries) {
    const groups = new Map();
    
    for (const entry of entries) {
      const date = new Date(entry.timestamp).toISOString().split('T')[0];
      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date).push(entry);
    }
    
    return groups;
  }

  /**
   * Parse time range string
   */
  parseTimeRange(timeRange) {
    const units = {
      'd': 24 * 60 * 60 * 1000,
      'h': 60 * 60 * 1000,
      'm': 60 * 1000
    };
    
    const match = timeRange.match(/^(\d+)([dhm])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // Default to 7 days
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    return value * units[unit];
  }

  /**
   * Calculate risk level
   */
  calculateRiskLevel(riskScore) {
    if (riskScore >= 50) return 'critical';
    if (riskScore >= 20) return 'high';
    if (riskScore >= 10) return 'medium';
    return 'low';
  }

  /**
   * Identify risk factors
   */
  identifyRiskFactors(issues) {
    const factors = [];
    
    const issueTypes = this.analyzer.groupBy(issues, 'type');
    
    if (issueTypes.aws_access_key > 0) {
      factors.push({
        factor: 'AWS credentials exposed',
        severity: 'critical',
        count: issueTypes.aws_access_key
      });
    }
    
    if (issueTypes.private_key > 0) {
      factors.push({
        factor: 'Private keys exposed',
        severity: 'critical',
        count: issueTypes.private_key
      });
    }
    
    if (issueTypes.github_token > 0) {
      factors.push({
        factor: 'GitHub tokens exposed',
        severity: 'high',
        count: issueTypes.github_token
      });
    }
    
    return factors;
  }

  /**
   * Generate next steps
   */
  generateNextSteps(riskLevel, riskFactors) {
    const steps = [];
    
    if (riskLevel === 'critical') {
      steps.push('Immediately rotate all exposed credentials');
      steps.push('Review and secure all private keys');
      steps.push('Implement proper secret management');
    } else if (riskLevel === 'high') {
      steps.push('Rotate exposed tokens and keys');
      steps.push('Implement environment variables');
      steps.push('Review access controls');
    } else if (riskLevel === 'medium') {
      steps.push('Review exposed configuration');
      steps.push('Implement security best practices');
      steps.push('Monitor for new issues');
    } else {
      steps.push('Continue monitoring');
      steps.push('Maintain security practices');
    }
    
    return steps;
  }
}

module.exports = SecurityAPI;
