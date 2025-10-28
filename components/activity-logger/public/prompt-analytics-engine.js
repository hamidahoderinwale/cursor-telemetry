/**
 * Prompt Analytics Engine
 * Comprehensive AI interaction and prompt analysis
 */

class PromptAnalyticsEngine {
  constructor() {
    this.promptCache = new Map();
    this.modelStats = new Map();
  }

  /**
   * Analyze all prompts comprehensively
   */
  analyzePrompts(events, entries) {
    const allItems = [...events, ...entries];
    const promptEvents = allItems.filter(item => {
      const type = item.type;
      return type === 'prompt_response' || type === 'prompt' || type === 'ai_interaction';
    });

    if (promptEvents.length === 0) {
      return this.getEmptyAnalytics();
    }

    return {
      overview: this.calculateOverviewMetrics(promptEvents),
      temporal: this.analyzeTemporalPatterns(promptEvents),
      categories: this.categorizePrompts(promptEvents),
      models: this.analyzeModelUsage(promptEvents),
      tokens: this.estimateTokenUsage(promptEvents),
      effectiveness: this.measureEffectiveness(promptEvents, allItems),
      topPrompts: this.identifyTopPrompts(promptEvents),
      insights: this.generateInsights(promptEvents)
    };
  }

  /**
   * Calculate overview metrics
   */
  calculateOverviewMetrics(promptEvents) {
    const totalPrompts = promptEvents.length;
    const totalChars = promptEvents.reduce((sum, e) => {
      const details = this.parseDetails(e);
      return sum + (details.prompt || '').length + (details.response || '').length;
    }, 0);

    const avgPromptLength = promptEvents.reduce((sum, e) => {
      const details = this.parseDetails(e);
      return sum + (details.prompt || '').length;
    }, 0) / totalPrompts;

    const avgResponseLength = promptEvents.reduce((sum, e) => {
      const details = this.parseDetails(e);
      return sum + (details.response || '').length;
    }, 0) / totalPrompts;

    // Calculate time range
    const timestamps = promptEvents.map(e => new Date(e.timestamp).getTime()).filter(t => !isNaN(t));
    const timeSpan = timestamps.length > 0 ? Math.max(...timestamps) - Math.min(...timestamps) : 0;
    const promptsPerHour = timestamps.length > 0 ? (totalPrompts / (timeSpan / (1000 * 60 * 60))) : 0;

    return {
      totalPrompts,
      totalChars,
      avgPromptLength: Math.round(avgPromptLength),
      avgResponseLength: Math.round(avgResponseLength),
      promptsPerHour: promptsPerHour.toFixed(2),
      timeSpan: this.formatDuration(timeSpan)
    };
  }

  /**
   * Analyze temporal patterns
   */
  analyzeTemporalPatterns(promptEvents) {
    const hourlyDistribution = new Array(24).fill(0);
    const dailyActivity = new Map();

    promptEvents.forEach(event => {
      const date = new Date(event.timestamp);
      const hour = date.getHours();
      const day = date.toISOString().split('T')[0];

      hourlyDistribution[hour]++;
      dailyActivity.set(day, (dailyActivity.get(day) || 0) + 1);
    });

    // Find peak hours
    const peakHour = hourlyDistribution.indexOf(Math.max(...hourlyDistribution));
    const peakHourCount = hourlyDistribution[peakHour];

    // Calculate activity by day of week
    const dayOfWeek = new Array(7).fill(0);
    promptEvents.forEach(event => {
      const day = new Date(event.timestamp).getDay();
      dayOfWeek[day]++;
    });

    return {
      hourlyDistribution,
      dailyActivity: Array.from(dailyActivity.entries()).map(([date, count]) => ({ date, count })),
      peakHour: `${peakHour}:00`,
      peakHourCount,
      dayOfWeekDistribution: dayOfWeek,
      mostActiveDay: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
        dayOfWeek.indexOf(Math.max(...dayOfWeek))
      ]
    };
  }

  /**
   * Categorize prompts by intent
   */
  categorizePrompts(promptEvents) {
    const categories = {
      'Code Generation': { count: 0, examples: [] },
      'Code Review': { count: 0, examples: [] },
      'Debugging': { count: 0, examples: [] },
      'Explanation': { count: 0, examples: [] },
      'Refactoring': { count: 0, examples: [] },
      'Testing': { count: 0, examples: [] },
      'Documentation': { count: 0, examples: [] },
      'Optimization': { count: 0, examples: [] },
      'General': { count: 0, examples: [] }
    };

    promptEvents.forEach(event => {
      const details = this.parseDetails(event);
      const prompt = (details.prompt || '').toLowerCase();
      let categorized = false;

      // Code Generation
      if (prompt.match(/generate|create|write|build|make|implement/)) {
        categories['Code Generation'].count++;
        categories['Code Generation'].examples.push(this.truncate(prompt, 50));
        categorized = true;
      }

      // Code Review
      if (prompt.match(/review|check|validate|verify|assess/)) {
        categories['Code Review'].count++;
        categories['Code Review'].examples.push(this.truncate(prompt, 50));
        categorized = true;
      }

      // Debugging
      if (prompt.match(/debug|fix|error|bug|issue|problem|wrong/)) {
        categories['Debugging'].count++;
        categories['Debugging'].examples.push(this.truncate(prompt, 50));
        categorized = true;
      }

      // Explanation
      if (prompt.match(/explain|what|how|why|understand|describe/)) {
        categories['Explanation'].count++;
        categories['Explanation'].examples.push(this.truncate(prompt, 50));
        categorized = true;
      }

      // Refactoring
      if (prompt.match(/refactor|improve|clean|restructure|optimize code/)) {
        categories['Refactoring'].count++;
        categories['Refactoring'].examples.push(this.truncate(prompt, 50));
        categorized = true;
      }

      // Testing
      if (prompt.match(/test|unit test|integration|coverage/)) {
        categories['Testing'].count++;
        categories['Testing'].examples.push(this.truncate(prompt, 50));
        categorized = true;
      }

      // Documentation
      if (prompt.match(/document|comment|readme|docs/)) {
        categories['Documentation'].count++;
        categories['Documentation'].examples.push(this.truncate(prompt, 50));
        categorized = true;
      }

      // Optimization
      if (prompt.match(/optimize|performance|faster|efficient/)) {
        categories['Optimization'].count++;
        categories['Optimization'].examples.push(this.truncate(prompt, 50));
        categorized = true;
      }

      if (!categorized) {
        categories['General'].count++;
        categories['General'].examples.push(this.truncate(prompt, 50));
      }
    });

    // Keep only top 3 examples per category
    Object.keys(categories).forEach(key => {
      categories[key].examples = categories[key].examples.slice(0, 3);
    });

    return categories;
  }

  /**
   * Analyze model usage
   */
  analyzeModelUsage(promptEvents) {
    const modelCounts = new Map();
    const modelTokens = new Map();
    const modelResponseTimes = new Map();

    promptEvents.forEach(event => {
      const details = this.parseDetails(event);
      const model = details.model || details.ai_model || 'unknown';
      const tokens = details.tokens || this.estimateTokens(details.prompt, details.response);

      modelCounts.set(model, (modelCounts.get(model) || 0) + 1);
      modelTokens.set(model, (modelTokens.get(model) || 0) + tokens);
      
      // Estimate response time if available
      if (details.response_time) {
        if (!modelResponseTimes.has(model)) {
          modelResponseTimes.set(model, []);
        }
        modelResponseTimes.get(model).push(details.response_time);
      }
    });

    const modelStats = [];
    modelCounts.forEach((count, model) => {
      const tokens = modelTokens.get(model) || 0;
      const times = modelResponseTimes.get(model) || [];
      const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;

      modelStats.push({
        model,
        count,
        tokens,
        avgTokensPerPrompt: Math.round(tokens / count),
        avgResponseTime: avgTime.toFixed(2),
        percentage: ((count / promptEvents.length) * 100).toFixed(1)
      });
    });

    return modelStats.sort((a, b) => b.count - a.count);
  }

  /**
   * Estimate token usage
   */
  estimateTokenUsage(promptEvents) {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;

    promptEvents.forEach(event => {
      const details = this.parseDetails(event);
      const prompt = details.prompt || '';
      const response = details.response || '';
      
      const inputTokens = this.estimateTokens(prompt);
      const outputTokens = this.estimateTokens(response);
      
      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;
      
      // Estimate cost (rough approximation for GPT-4 pricing)
      const model = details.model || 'gpt-4';
      totalCost += this.estimateCost(model, inputTokens, outputTokens);
    });

    return {
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      estimatedCost: totalCost.toFixed(2),
      avgInputTokens: Math.round(totalInputTokens / promptEvents.length),
      avgOutputTokens: Math.round(totalOutputTokens / promptEvents.length)
    };
  }

  /**
   * Measure effectiveness
   */
  measureEffectiveness(promptEvents, allItems) {
    const codeChanges = allItems.filter(e => e.type === 'code_change' || e.type === 'file_change');
    
    // Calculate prompt-to-code correlation
    let promptsWithCodeChanges = 0;
    const timeWindow = 5 * 60 * 1000; // 5 minutes

    promptEvents.forEach(promptEvent => {
      const promptTime = new Date(promptEvent.timestamp).getTime();
      const hasRelatedCodeChange = codeChanges.some(codeEvent => {
        const codeTime = new Date(codeEvent.timestamp).getTime();
        return Math.abs(codeTime - promptTime) < timeWindow;
      });
      
      if (hasRelatedCodeChange) {
        promptsWithCodeChanges++;
      }
    });

    const effectivenessRate = (promptsWithCodeChanges / promptEvents.length) * 100;

    // Calculate average complexity
    const complexityScores = promptEvents.map(event => {
      const details = this.parseDetails(event);
      return this.calculateComplexity(details.prompt || '');
    });
    const avgComplexity = complexityScores.reduce((a, b) => a + b, 0) / complexityScores.length;

    return {
      promptsWithCodeChanges,
      totalPrompts: promptEvents.length,
      effectivenessRate: effectivenessRate.toFixed(1),
      avgComplexity: avgComplexity.toFixed(2),
      timeWindow: '5 minutes'
    };
  }

  /**
   * Identify top prompts
   */
  identifyTopPrompts(promptEvents) {
    const promptsWithMetrics = promptEvents.map(event => {
      const details = this.parseDetails(event);
      const prompt = details.prompt || '';
      const response = details.response || '';
      
      return {
        prompt: this.truncate(prompt, 100),
        fullPrompt: prompt,
        response: this.truncate(response, 200),
        promptLength: prompt.length,
        responseLength: response.length,
        complexity: this.calculateComplexity(prompt),
        timestamp: event.timestamp,
        hasCode: /```/.test(response),
        model: details.model || 'unknown'
      };
    });

    // Sort by different metrics
    const byLength = [...promptsWithMetrics].sort((a, b) => b.promptLength - a.promptLength).slice(0, 5);
    const byComplexity = [...promptsWithMetrics].sort((a, b) => b.complexity - a.complexity).slice(0, 5);
    const byResponseSize = [...promptsWithMetrics].sort((a, b) => b.responseLength - a.responseLength).slice(0, 5);
    const withCode = promptsWithMetrics.filter(p => p.hasCode).slice(0, 5);

    return {
      byLength,
      byComplexity,
      byResponseSize,
      withCode
    };
  }

  /**
   * Generate insights
   */
  generateInsights(promptEvents) {
    const insights = [];

    // Analyze prompt frequency
    const timestamps = promptEvents.map(e => new Date(e.timestamp).getTime());
    const timeSpan = Math.max(...timestamps) - Math.min(...timestamps);
    const promptsPerHour = (promptEvents.length / (timeSpan / (1000 * 60 * 60)));

    if (promptsPerHour > 10) {
      insights.push({
        type: 'high_activity',
        title: 'High AI Interaction',
        message: `You're averaging ${promptsPerHour.toFixed(1)} prompts per hour, indicating heavy AI assistance usage.`,
        icon: '🔥'
      });
    }

    // Analyze prompt complexity
    const complexities = promptEvents.map(e => {
      const details = this.parseDetails(e);
      return this.calculateComplexity(details.prompt || '');
    });
    const avgComplexity = complexities.reduce((a, b) => a + b, 0) / complexities.length;

    if (avgComplexity > 7) {
      insights.push({
        type: 'complex_prompts',
        title: 'Complex Prompts',
        message: 'Your prompts are quite detailed and complex, which typically yields better results.',
        icon: '[TARGET]'
      });
    }

    // Analyze code generation
    const codePrompts = promptEvents.filter(e => {
      const details = this.parseDetails(e);
      const response = details.response || '';
      return /```/.test(response);
    });

    if (codePrompts.length > promptEvents.length * 0.5) {
      insights.push({
        type: 'code_heavy',
        title: 'Code-Focused Usage',
        message: `${((codePrompts.length / promptEvents.length) * 100).toFixed(0)}% of your prompts resulted in code generation.`,
        icon: '💻'
      });
    }

    return insights;
  }

  /**
   * Helper: estimate tokens from text
   */
  estimateTokens(text, text2 = '') {
    const combined = text + ' ' + text2;
    // Rough estimation: ~4 characters per token
    return Math.ceil(combined.length / 4);
  }

  /**
   * Helper: estimate cost
   */
  estimateCost(model, inputTokens, outputTokens) {
    const pricing = {
      'gpt-4': { input: 0.03 / 1000, output: 0.06 / 1000 },
      'gpt-3.5-turbo': { input: 0.0015 / 1000, output: 0.002 / 1000 },
      'claude': { input: 0.008 / 1000, output: 0.024 / 1000 },
      'default': { input: 0.01 / 1000, output: 0.03 / 1000 }
    };

    const rates = pricing[model] || pricing.default;
    return (inputTokens * rates.input) + (outputTokens * rates.output);
  }

  /**
   * Helper: calculate prompt complexity
   */
  calculateComplexity(prompt) {
    const length = prompt.length;
    const words = prompt.split(/\s+/).length;
    const sentences = (prompt.match(/[.!?]+/g) || []).length;
    const hasCode = /```|function|class|const|let|var/.test(prompt);
    const hasQuestions = /\?/g.test(prompt);
    const questionCount = (prompt.match(/\?/g) || []).length;

    let complexity = Math.log(length + 1) * 0.5;
    complexity += Math.log(words + 1) * 0.3;
    complexity += sentences * 0.2;
    complexity += hasCode ? 2 : 0;
    complexity += questionCount * 0.5;

    return complexity;
  }

  /**
   * Helper: parse details
   */
  parseDetails(item) {
    if (typeof item.details === 'string') {
      try {
        return JSON.parse(item.details);
      } catch {
        return {};
      }
    }
    return item.details || item || {};
  }

  /**
   * Helper: truncate text
   */
  truncate(text, length) {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
  }

  /**
   * Helper: format duration
   */
  formatDuration(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  /**
   * Get empty analytics
   */
  getEmptyAnalytics() {
    return {
      overview: {
        totalPrompts: 0,
        totalChars: 0,
        avgPromptLength: 0,
        avgResponseLength: 0,
        promptsPerHour: 0,
        timeSpan: '0h 0m'
      },
      temporal: {
        hourlyDistribution: new Array(24).fill(0),
        dailyActivity: [],
        peakHour: 'N/A',
        peakHourCount: 0,
        dayOfWeekDistribution: new Array(7).fill(0),
        mostActiveDay: 'N/A'
      },
      categories: {},
      models: [],
      tokens: {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        estimatedCost: '0.00',
        avgInputTokens: 0,
        avgOutputTokens: 0
      },
      effectiveness: {
        promptsWithCodeChanges: 0,
        totalPrompts: 0,
        effectivenessRate: '0.0',
        avgComplexity: '0.00',
        timeWindow: '5 minutes'
      },
      topPrompts: {
        byLength: [],
        byComplexity: [],
        byResponseSize: [],
        withCode: []
      },
      insights: []
    };
  }
}

// Export for use in dashboard
window.PromptAnalyticsEngine = PromptAnalyticsEngine;

