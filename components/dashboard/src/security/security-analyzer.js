/**
 * Robust Security Analyzer
 * Inspired by GitHub's secret detection approach
 * Uses patterns and heuristics for known secret types
 */

class SecurityAnalyzer {
  constructor() {
    this.secretPatterns = this.initializeSecretPatterns();
    this.entropyThreshold = 3.5;
    this.minSecretLength = 8;
    this.maxSecretLength = 200;
  }

  /**
   * Initialize secret patterns based on GitHub's approach
   * Covers API keys, tokens, private keys, passwords, etc.
   */
  initializeSecretPatterns() {
    return {
      // API Keys and Tokens
      githubToken: {
        pattern: /ghp_[0-9a-zA-Z]{36}|gho_[0-9a-zA-Z]{36}|ghu_[0-9a-zA-Z]{36}|ghs_[0-9a-zA-Z]{36}|ghr_[0-9a-zA-Z]{36}/,
        type: 'github_token',
        severity: 'high',
        confidence: 0.95
      },
      
      slackToken: {
        pattern: /xox[baprs]-[0-9a-zA-Z-]+/,
        type: 'slack_token',
        severity: 'high',
        confidence: 0.9
      },
      
      awsAccessKey: {
        pattern: /AKIA[0-9A-Z]{16}/,
        type: 'aws_access_key',
        severity: 'critical',
        confidence: 0.95
      },
      
      awsSecretKey: {
        pattern: /[A-Za-z0-9/+=]{40}/,
        type: 'aws_secret_key',
        severity: 'critical',
        confidence: 0.8,
        context: 'aws'
      },
      
      googleApiKey: {
        pattern: /AIza[0-9A-Za-z\\-_]{35}/,
        type: 'google_api_key',
        severity: 'high',
        confidence: 0.9
      },
      
      stripeKey: {
        pattern: /sk_live_[0-9a-zA-Z]{24}|pk_live_[0-9a-zA-Z]{24}|sk_test_[0-9a-zA-Z]{24}|pk_test_[0-9a-zA-Z]{24}/,
        type: 'stripe_key',
        severity: 'high',
        confidence: 0.95
      },
      
      // Database Credentials
      postgresUrl: {
        pattern: /postgres:\/\/[^:]+:[^@]+@[^\/]+\/[^\/\s]+/,
        type: 'postgres_url',
        severity: 'critical',
        confidence: 0.9
      },
      
      mysqlUrl: {
        pattern: /mysql:\/\/[^:]+:[^@]+@[^\/]+\/[^\/\s]+/,
        type: 'mysql_url',
        severity: 'critical',
        confidence: 0.9
      },
      
      mongodbUrl: {
        pattern: /mongodb:\/\/[^:]+:[^@]+@[^\/\s]+/,
        type: 'mongodb_url',
        severity: 'critical',
        confidence: 0.9
      },
      
      // JWT and Authentication
      jwtSecret: {
        pattern: /(?:jwt[_-]?secret|jwt[_-]?key|jwt[_-]?token)[=:]\s*['"`]([^'"`]{20,})['"`]/i,
        type: 'jwt_secret',
        severity: 'high',
        confidence: 0.85
      },
      
      // Environment Variables
      envSecret: {
        pattern: /(?:secret|key|token|password|passwd|pwd)[=:]\s*['"`]([^'"`]{8,})['"`]/i,
        type: 'env_secret',
        severity: 'medium',
        confidence: 0.7
      },
      
      // Private Keys
      privateKey: {
        pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/,
        type: 'private_key',
        severity: 'critical',
        confidence: 0.95
      },
      
      // SSH Keys
      sshKey: {
        pattern: /ssh-[a-z0-9]{3}\s+[A-Za-z0-9+/]{100,}={0,2}/,
        type: 'ssh_key',
        severity: 'high',
        confidence: 0.9
      },
      
      // Generic High Entropy Strings
      highEntropy: {
        pattern: /[A-Za-z0-9+/]{32,}={0,2}/,
        type: 'high_entropy',
        severity: 'medium',
        confidence: 0.6,
        requiresEntropy: true
      }
    };
  }

  /**
   * Analyze text for security issues
   */
  async analyzeText(text, metadata = {}) {
    const issues = [];
    
    // Check each secret pattern
    for (const [name, pattern] of Object.entries(this.secretPatterns)) {
      const matches = this.findPatternMatches(text, pattern, name);
      issues.push(...matches);
    }
    
    // Add context analysis
    const contextualIssues = this.analyzeContext(text, metadata);
    issues.push(...contextualIssues);
    
    // Deduplicate and rank by severity
    return this.deduplicateAndRank(issues);
  }

  /**
   * Find matches for a specific pattern
   */
  findPatternMatches(text, pattern, patternName) {
    const matches = [];
    let match;
    
    while ((match = pattern.pattern.exec(text)) !== null) {
      const secret = match[1] || match[0];
      
      // Validate secret length
      if (secret.length < this.minSecretLength || secret.length > this.maxSecretLength) {
        continue;
      }
      
      // Check entropy if required
      if (pattern.requiresEntropy && !this.hasHighEntropy(secret)) {
        continue;
      }
      
      matches.push({
        type: pattern.type,
        severity: pattern.severity,
        confidence: pattern.confidence,
        value: secret,
        context: this.getContext(text, match.index),
        pattern: patternName,
        position: match.index
      });
    }
    
    return matches;
  }

  /**
   * Analyze context for additional security issues
   */
  analyzeContext(text, metadata) {
    const issues = [];
    
    // Check file type context
    if (metadata.filePath) {
      const fileType = this.getFileType(metadata.filePath);
      const contextIssues = this.analyzeFileContext(text, fileType);
      issues.push(...contextIssues);
    }
    
    // Check for hardcoded credentials
    const hardcodedIssues = this.findHardcodedCredentials(text);
    issues.push(...hardcodedIssues);
    
    // Check for exposed configuration
    const configIssues = this.findExposedConfiguration(text);
    issues.push(...configIssues);
    
    return issues;
  }

  /**
   * Analyze file-specific context
   */
  analyzeFileContext(text, fileType) {
    const issues = [];
    
    switch (fileType) {
      case 'env':
        // Environment files are high risk
        issues.push(...this.findEnvironmentSecrets(text));
        break;
      case 'config':
        // Configuration files are medium risk
        issues.push(...this.findConfigurationSecrets(text));
        break;
      case 'code':
        // Code files are lower risk but still important
        issues.push(...this.findCodeSecrets(text));
        break;
    }
    
    return issues;
  }

  /**
   * Find hardcoded credentials
   */
  findHardcodedCredentials(text) {
    const issues = [];
    
    // Look for common credential patterns
    const credentialPatterns = [
      {
        pattern: /(?:username|user|login)[=:]\s*['"`]([^'"`]+)['"`]/i,
        type: 'hardcoded_username',
        severity: 'medium'
      },
      {
        pattern: /(?:password|passwd|pwd)[=:]\s*['"`]([^'"`]+)['"`]/i,
        type: 'hardcoded_password',
        severity: 'high'
      },
      {
        pattern: /(?:host|server|endpoint)[=:]\s*['"`]([^'"`]+)['"`]/i,
        type: 'hardcoded_host',
        severity: 'low'
      }
    ];
    
    for (const credPattern of credentialPatterns) {
      const matches = [...text.matchAll(credPattern.pattern)];
      for (const match of matches) {
        issues.push({
          type: credPattern.type,
          severity: credPattern.severity,
          confidence: 0.8,
          value: match[1],
          context: this.getContext(text, match.index),
          position: match.index
        });
      }
    }
    
    return issues;
  }

  /**
   * Find exposed configuration
   */
  findExposedConfiguration(text) {
    const issues = [];
    
    // Look for configuration that might expose secrets
    const configPatterns = [
      {
        pattern: /(?:debug|verbose|log)[=:]\s*true/i,
        type: 'debug_enabled',
        severity: 'medium'
      },
      {
        pattern: /(?:test|development)[=:]\s*true/i,
        type: 'test_mode',
        severity: 'low'
      }
    ];
    
    for (const configPattern of configPatterns) {
      const matches = [...text.matchAll(configPattern.pattern)];
      for (const match of matches) {
        issues.push({
          type: configPattern.type,
          severity: configPattern.severity,
          confidence: 0.7,
          value: match[0],
          context: this.getContext(text, match.index),
          position: match.index
        });
      }
    }
    
    return issues;
  }

  /**
   * Check if string has high entropy
   */
  hasHighEntropy(str) {
    const entropy = this.calculateEntropy(str);
    return entropy >= this.entropyThreshold;
  }

  /**
   * Calculate Shannon entropy
   */
  calculateEntropy(str) {
    const freq = {};
    for (let char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }
    
    let entropy = 0;
    for (let count of Object.values(freq)) {
      const p = count / str.length;
      entropy -= p * Math.log2(p);
    }
    
    return entropy;
  }

  /**
   * Get file type from path
   */
  getFileType(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    
    if (['env', 'environment'].includes(ext)) return 'env';
    if (['json', 'yaml', 'yml', 'toml', 'ini'].includes(ext)) return 'config';
    if (['js', 'ts', 'py', 'java', 'cpp', 'c', 'go', 'rs'].includes(ext)) return 'code';
    
    return 'unknown';
  }

  /**
   * Get context around a match
   */
  getContext(text, position, contextLength = 50) {
    const start = Math.max(0, position - contextLength);
    const end = Math.min(text.length, position + contextLength);
    return text.substring(start, end);
  }

  /**
   * Deduplicate and rank issues
   */
  deduplicateAndRank(issues) {
    // Remove duplicates based on value and position
    const unique = new Map();
    
    for (const issue of issues) {
      const key = `${issue.type}:${issue.value}:${issue.position}`;
      if (!unique.has(key) || unique.get(key).confidence < issue.confidence) {
        unique.set(key, issue);
      }
    }
    
    // Sort by severity and confidence
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    
    return Array.from(unique.values()).sort((a, b) => {
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.confidence - a.confidence;
    });
  }

  /**
   * Analyze all data for security issues
   */
  async analyzeAllData(entries) {
    const allIssues = [];
    const metrics = {
      totalIssues: 0,
      issuesByType: {},
      issuesBySeverity: {},
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
        const issues = await this.analyzeText(text, {
          filePath: entry.file_path,
          source: entry.source,
          timestamp: entry.timestamp
        });
        
        allIssues.push(...issues);
      }
    }
    
    // Calculate metrics
    metrics.totalIssues = allIssues.length;
    metrics.issuesByType = this.groupBy(allIssues, 'type');
    metrics.issuesBySeverity = this.groupBy(allIssues, 'severity');
    metrics.riskScore = this.calculateRiskScore(allIssues);
    
    return {
      issues: allIssues,
      metrics: metrics,
      recommendations: this.generateRecommendations(allIssues)
    };
  }

  /**
   * Group issues by property
   */
  groupBy(issues, property) {
    const groups = {};
    for (const issue of issues) {
      const key = issue[property];
      groups[key] = (groups[key] || 0) + 1;
    }
    return groups;
  }

  /**
   * Calculate risk score
   */
  calculateRiskScore(issues) {
    const weights = { critical: 10, high: 5, medium: 2, low: 1 };
    return issues.reduce((score, issue) => {
      return score + (weights[issue.severity] || 0);
    }, 0);
  }

  /**
   * Generate security recommendations
   */
  generateRecommendations(issues) {
    const recommendations = [];
    
    const issueTypes = this.groupBy(issues, 'type');
    
    if (issueTypes.github_token > 0) {
      recommendations.push({
        type: 'github_token',
        message: `${issueTypes.github_token} GitHub tokens detected. Consider using environment variables.`,
        severity: 'high',
        action: 'Use environment variables for GitHub tokens'
      });
    }
    
    if (issueTypes.aws_access_key > 0) {
      recommendations.push({
        type: 'aws_credentials',
        message: `${issueTypes.aws_access_key} AWS credentials detected. Use IAM roles instead.`,
        severity: 'critical',
        action: 'Use IAM roles instead of hardcoded credentials'
      });
    }
    
    if (issueTypes.private_key > 0) {
      recommendations.push({
        type: 'private_key',
        message: `${issueTypes.private_key} private keys detected. Store in secure key management.`,
        severity: 'critical',
        action: 'Use secure key management for private keys'
      });
    }
    
    return recommendations;
  }
}

module.exports = SecurityAnalyzer;
