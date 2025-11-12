#!/usr/bin/env node

/**
 * Reasoning Server for Chat Widget
 * Provides intelligent analysis using Qwen or similar reasoning models
 *
 * This server can be extended to use:
 * - Local Qwen models via Ollama
 * - OpenAI API
 * - Anthropic Claude API
 * - Custom fine-tuned models
 */

const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ReasoningServer {
  constructor(port = 3001) {
    this.port = port;
    this.app = express();
    this.modelType = process.env.MODEL_TYPE || 'builtin'; // 'builtin', 'ollama', 'openai', 'anthropic'
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', model: this.modelType });
    });

    // Main reasoning endpoint
    this.app.post('/api/reason', async (req, res) => {
      try {
        const { query, context, temporalContext } = req.body;
        const result = await this.processReasoning(query, context, temporalContext);
        res.json(result);
      } catch (error) {
        console.error('Reasoning error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Query classification
    this.app.post('/api/classify', async (req, res) => {
      try {
        const { query } = req.body;
        const classification = await this.classifyQuery(query);
        res.json(classification);
      } catch (error) {
        console.error('Classification error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Proactive insights
    this.app.post('/api/insights', async (req, res) => {
      try {
        const { data } = req.body;
        const insights = await this.generateProactiveInsights(data);
        res.json({ insights });
      } catch (error) {
        console.error('Insights error:', error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  async processReasoning(query, context, temporalContext) {
    const { events, prompts, workspaces, systemData } = context;

    // Build comprehensive context for reasoning
    const enrichedContext = this.enrichContext({
      query,
      events,
      prompts,
      workspaces,
      systemData,
      temporalContext,
    });

    // Select reasoning strategy
    const strategy = this.selectReasoningStrategy(query, enrichedContext);

    // Generate reasoning steps
    const reasoningSteps = await strategy.generateSteps(enrichedContext);

    // Generate final answer
    const answer = await this.generateAnswer(query, enrichedContext, reasoningSteps);

    return {
      answer: answer.text,
      reasoning: reasoningSteps,
      confidence: answer.confidence,
      sources: answer.sources,
      insights: answer.insights,
    };
  }

  enrichContext(context) {
    const { events, prompts, temporalContext } = context;

    // Calculate aggregate statistics
    const stats = {
      totalEvents: events.length,
      totalPrompts: prompts.length,
      timeRange: temporalContext,

      // File statistics
      uniqueFiles: new Set(
        events
          .map((e) => {
            const details = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
            return details?.file_path;
          })
          .filter(Boolean)
      ).size,

      totalLinesChanged: events.reduce((sum, e) => {
        const details = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
        return sum + (details?.lines_added || 0) + (details?.lines_removed || 0);
      }, 0),

      // AI usage statistics
      aiModes: this.countByField(prompts, 'mode'),
      avgContextUsage: this.average(prompts.map((p) => p.contextUsage).filter(Boolean)),

      // Temporal patterns
      hourlyDistribution: this.getHourlyDistribution(events),
      sessionCount: this.detectSessions(events).length,
    };

    return { ...context, stats };
  }

  selectReasoningStrategy(query, context) {
    const queryLower = query.toLowerCase();

    if (queryLower.includes('productive') || queryLower.includes('productivity')) {
      return new ProductivityReasoning();
    } else if (queryLower.includes('file') || queryLower.includes('work on')) {
      return new FileAnalysisReasoning();
    } else if (queryLower.includes('ai') || queryLower.includes('model')) {
      return new AIUsageReasoning();
    } else if (queryLower.includes('session') || queryLower.includes('time')) {
      return new SessionReasoning();
    } else if (queryLower.includes('pattern') || queryLower.includes('trend')) {
      return new PatternReasoning();
    }

    return new GeneralReasoning();
  }

  async generateAnswer(query, context, reasoningSteps) {
    // Choose model based on configuration
    switch (this.modelType) {
      case 'ollama':
        return await this.generateWithOllama(query, context, reasoningSteps);
      case 'openai':
        return await this.generateWithOpenAI(query, context, reasoningSteps);
      case 'anthropic':
        return await this.generateWithAnthropic(query, context, reasoningSteps);
      default:
        return this.generateWithBuiltin(query, context, reasoningSteps);
    }
  }

  async generateWithOllama(query, context, reasoningSteps) {
    // Use Ollama with Qwen or other local models
    const prompt = this.buildPrompt(query, context, reasoningSteps);

    try {
      const { stdout } = await execAsync(`ollama run qwen2:7b "${prompt.replace(/"/g, '\\"')}"`);
      return {
        text: stdout.trim(),
        confidence: 0.85,
        sources: this.extractSources(context),
        insights: [],
      };
    } catch (error) {
      console.error('Ollama error:', error);
      return this.generateWithBuiltin(query, context, reasoningSteps);
    }
  }

  async generateWithOpenAI(query, context, reasoningSteps) {
    // Placeholder for OpenAI integration
    // Would use openai npm package
    return this.generateWithBuiltin(query, context, reasoningSteps);
  }

  async generateWithAnthropic(query, context, reasoningSteps) {
    // Placeholder for Anthropic integration
    // Would use @anthropic-ai/sdk npm package
    return this.generateWithBuiltin(query, context, reasoningSteps);
  }

  generateWithBuiltin(query, context, reasoningSteps) {
    // Use built-in heuristic reasoning
    const { stats } = context;
    const strategy = reasoningSteps[0]?.strategy || 'general';

    let text = '';
    let insights = [];

    switch (strategy) {
      case 'productivity':
        text = this.generateProductivityAnswer(stats, context);
        insights = this.generateProductivityInsights(stats);
        break;
      case 'files':
        text = this.generateFileAnswer(stats, context);
        insights = this.generateFileInsights(stats, context);
        break;
      case 'ai-usage':
        text = this.generateAIAnswer(stats, context);
        insights = this.generateAIInsights(stats);
        break;
      case 'sessions':
        text = this.generateSessionAnswer(stats, context);
        insights = this.generateSessionInsights(stats);
        break;
      default:
        text = this.generateGeneralAnswer(query, stats, context);
    }

    return {
      text,
      confidence: 0.75,
      sources: this.extractSources(context),
      insights,
    };
  }

  buildPrompt(query, context, reasoningSteps) {
    const { stats, temporalContext } = context;

    return `You are an AI assistant helping a developer understand their coding patterns.

Context:
- Time period: ${temporalContext.label}
- Total events: ${stats.totalEvents}
- Files modified: ${stats.uniqueFiles}
- Lines changed: ${stats.totalLinesChanged}
- AI interactions: ${stats.totalPrompts}
- Sessions detected: ${stats.sessionCount}

Reasoning steps completed:
${reasoningSteps.map((step, i) => `${i + 1}. ${step.description}`).join('\n')}

User question: ${query}

Provide a clear, insightful answer with specific numbers and actionable insights. Format your response in markdown.`;
  }

  generateProductivityAnswer(stats, context) {
    const { temporalContext } = context;
    const label = temporalContext.label;

    let level = 'moderate';
    if (stats.totalLinesChanged > 500 || stats.totalPrompts > 20) level = 'high';
    else if (stats.totalLinesChanged < 100 && stats.totalPrompts < 5) level = 'low';

    return (
      `**Productivity Analysis for ${label}**\n\n` +
      `You've been **${level}ly productive** with:\n\n` +
      `• **${stats.totalLinesChanged} lines** of code changed\n` +
      `• **${stats.uniqueFiles} files** modified\n` +
      `• **${stats.totalPrompts} AI interactions**\n` +
      `• **${stats.sessionCount} coding sessions**\n\n` +
      `${this.getProductivityInsight(level, stats)}`
    );
  }

  getProductivityInsight(level, stats) {
    if (level === 'high') {
      return "[IDEA] *Excellent work! You're in a highly productive flow. Remember to take breaks to maintain this momentum.*";
    } else if (level === 'low') {
      return '[IDEA] *Lighter activity detected. This could be planning time, learning, or a well-deserved break.*';
    }
    return '[IDEA] *Steady progress with consistent development activity.*';
  }

  generateFileAnswer(stats, context) {
    const { events } = context;
    const fileStats = {};

    events.forEach((e) => {
      const details = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
      const path = details?.file_path;
      if (!path) return;

      const fileName = path.split('/').pop();
      if (!fileStats[fileName]) {
        fileStats[fileName] = { count: 0, lines: 0 };
      }
      fileStats[fileName].count++;
      fileStats[fileName].lines += (details?.lines_added || 0) + (details?.lines_removed || 0);
    });

    const topFiles = Object.entries(fileStats)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    let text = `**Most Active Files**\n\n`;
    topFiles.forEach(([file, data], i) => {
      text += `${i + 1}. **${file}**\n`;
      text += `   • ${data.count} modifications\n`;
      text += `   • ${data.lines} lines changed\n\n`;
    });

    return text;
  }

  generateAIAnswer(stats, context) {
    const { prompts } = context;
    let text = `**AI Usage Patterns**\n\n`;
    text += `Total interactions: **${stats.totalPrompts}**\n`;
    text += `Average context: **${stats.avgContextUsage.toFixed(1)}%**\n\n`;

    if (stats.aiModes && Object.keys(stats.aiModes).length > 0) {
      text += '**By Interface:**\n';
      Object.entries(stats.aiModes).forEach(([mode, count]) => {
        const pct = ((count / stats.totalPrompts) * 100).toFixed(0);
        text += `• ${mode}: ${count} (${pct}%)\n`;
      });
    }

    return text;
  }

  generateSessionAnswer(stats, context) {
    const sessions = this.detectSessions(context.events);
    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
    const avgDuration = sessions.length > 0 ? totalDuration / sessions.length : 0;

    let text = `**Coding Sessions Analysis**\n\n`;
    text += `• **${sessions.length} sessions** detected\n`;
    text += `• Total time: **${this.formatDuration(totalDuration)}**\n`;
    text += `• Average length: **${this.formatDuration(avgDuration)}**\n\n`;

    if (sessions.length > 0) {
      const longest = sessions.reduce((max, s) => (s.duration > max.duration ? s : max));
      text += `[IDEA] *Longest session: ${this.formatDuration(longest.duration)} with ${longest.events} changes*`;
    }

    return text;
  }

  generateGeneralAnswer(query, stats, context) {
    return (
      `I've analyzed your development activity:\n\n` +
      `• ${stats.totalEvents} file changes\n` +
      `• ${stats.uniqueFiles} files modified\n` +
      `• ${stats.totalPrompts} AI interactions\n` +
      `• ${stats.sessionCount} coding sessions\n\n` +
      `For more specific insights, try asking about:\n` +
      `• Productivity patterns\n` +
      `• File activity\n` +
      `• AI usage\n` +
      `• Session analysis`
    );
  }

  // Utility methods
  countByField(array, field) {
    return array.reduce((acc, item) => {
      const value = item[field] || 'unknown';
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }

  average(array) {
    if (array.length === 0) return 0;
    return array.reduce((sum, val) => sum + val, 0) / array.length;
  }

  getHourlyDistribution(events) {
    const distribution = new Array(24).fill(0);
    events.forEach((e) => {
      const hour = new Date(e.timestamp).getHours();
      distribution[hour]++;
    });
    return distribution;
  }

  detectSessions(events) {
    const sessions = [];
    let currentSession = null;
    const sorted = events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    sorted.forEach((event) => {
      const time = new Date(event.timestamp).getTime();

      if (!currentSession || time - currentSession.lastEvent > 30 * 60 * 1000) {
        if (currentSession) sessions.push(currentSession);
        currentSession = {
          start: time,
          lastEvent: time,
          events: 1,
          duration: 0,
        };
      } else {
        currentSession.lastEvent = time;
        currentSession.events++;
        currentSession.duration = currentSession.lastEvent - currentSession.start;
      }
    });

    if (currentSession) sessions.push(currentSession);
    return sessions;
  }

  formatDuration(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  extractSources(context) {
    return [
      `${context.stats.totalEvents} events`,
      `${context.stats.uniqueFiles} files`,
      `${context.stats.totalPrompts} prompts`,
    ];
  }

  async classifyQuery(query) {
    const queryLower = query.toLowerCase();

    const categories = {
      productivity: ['productive', 'productivity', 'output', 'efficiency'],
      files: ['file', 'work on', 'modify', 'edit', 'change'],
      'ai-usage': ['ai', 'model', 'prompt', 'assistant', 'claude', 'gpt'],
      sessions: ['session', 'time', 'coding', 'work time'],
      patterns: ['pattern', 'trend', 'habit', 'behavior'],
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some((kw) => queryLower.includes(kw))) {
        return { category, confidence: 0.8 };
      }
    }

    return { category: 'general', confidence: 0.5 };
  }

  async generateProactiveInsights(data) {
    const { events, prompts, systemData } = data;
    const insights = [];

    // Detect productivity decline
    const recentActivity = events.filter((e) => {
      const age = Date.now() - new Date(e.timestamp).getTime();
      return age < 2 * 60 * 60 * 1000; // Last 2 hours
    });

    if (recentActivity.length === 0 && events.length > 0) {
      insights.push({
        type: 'warning',
        title: 'Low Activity',
        message: 'No file changes in the last 2 hours. Time for a break?',
        action: 'View session history',
      });
    }

    // Detect high AI usage
    const recentPrompts = prompts.filter((p) => {
      const age = Date.now() - new Date(p.timestamp).getTime();
      return age < 60 * 60 * 1000; // Last hour
    });

    if (recentPrompts.length > 10) {
      insights.push({
        type: 'info',
        title: 'High AI Usage',
        message: `${recentPrompts.length} AI interactions in the last hour. You're actively problem-solving!`,
        action: 'View AI patterns',
      });
    }

    return insights;
  }

  generateProductivityInsights(stats) {
    return [];
  }

  generateFileInsights(stats, context) {
    return [];
  }

  generateAIInsights(stats) {
    return [];
  }

  generateSessionInsights(stats) {
    return [];
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`Reasoning Server running on port ${this.port}`);
      console.log(`[DATA] Model type: ${this.modelType}`);
      console.log(`[LINK] API: http://localhost:${this.port}`);
    });
  }
}

// Reasoning Strategies
class ProductivityReasoning {
  async generateSteps(context) {
    return [
      {
        step: 1,
        strategy: 'productivity',
        description: `Analyzed ${context.stats.totalEvents} file change events`,
      },
      {
        step: 2,
        strategy: 'productivity',
        description: `Examined ${context.stats.totalPrompts} AI interactions`,
      },
      {
        step: 3,
        strategy: 'productivity',
        description: 'Calculated productivity metrics and patterns',
      },
    ];
  }
}

class FileAnalysisReasoning {
  async generateSteps(context) {
    return [
      {
        step: 1,
        strategy: 'files',
        description: `Grouped ${context.stats.totalEvents} events by file`,
      },
      { step: 2, strategy: 'files', description: 'Ranked files by modification frequency' },
    ];
  }
}

class AIUsageReasoning {
  async generateSteps(context) {
    return [
      {
        step: 1,
        strategy: 'ai-usage',
        description: `Analyzed ${context.stats.totalPrompts} AI prompts`,
      },
      { step: 2, strategy: 'ai-usage', description: 'Categorized by interface and model' },
    ];
  }
}

class SessionReasoning {
  async generateSteps(context) {
    return [
      {
        step: 1,
        strategy: 'sessions',
        description: 'Detected coding sessions from activity patterns',
      },
      { step: 2, strategy: 'sessions', description: 'Calculated session durations and intensity' },
    ];
  }
}

class PatternReasoning {
  async generateSteps(context) {
    return [
      { step: 1, strategy: 'patterns', description: 'Analyzed temporal activity patterns' },
      { step: 2, strategy: 'patterns', description: 'Identified trends and anomalies' },
    ];
  }
}

class GeneralReasoning {
  async generateSteps(context) {
    return [{ step: 1, strategy: 'general', description: 'Analyzed general development activity' }];
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new ReasoningServer();
  server.start();
}

module.exports = ReasoningServer;
