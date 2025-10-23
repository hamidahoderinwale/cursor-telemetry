/**
 * Reasoning Engine with Qwen Integration
 * Provides intelligent analysis of development patterns using temporal reasoning
 */

// Use dynamic import for node-fetch v3 (ESM)
let fetchModule;
const fetchPromise = import('node-fetch').then(mod => {
    fetchModule = mod.default;
});

class ReasoningEngine {
    constructor() {
        // Try Hugging Face first, then OpenRouter
        this.hfApiKey = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY || '';
        this.openRouterKey = process.env.OPENROUTER_API_KEY || '';
        
        // Hugging Face endpoints
        // Note: Free Inference API may not support all models. For Qwen models, consider:
        // 1. Dedicated Inference Endpoints: https://ui.endpoints.huggingface.co/
        // 2. Set HF_ENDPOINT in .env to your custom endpoint URL
        // 3. Use OpenRouter as fallback (set OPENROUTER_API_KEY)
        this.hfEndpoint = process.env.HF_ENDPOINT || 'https://api-inference.huggingface.co/models/Qwen/Qwen2.5-7B-Instruct';
        
        // OpenRouter endpoint (fallback)
        this.openRouterEndpoint = 'https://openrouter.ai/api/v1/chat/completions';
        this.openRouterModel = 'qwen/qwen-2.5-7b-instruct';
        
        // Determine which API to use
        if (this.hfApiKey) {
            console.log('🤗 Using Hugging Face API for Qwen model');
            this.useHuggingFace = true;
        } else if (this.openRouterKey) {
            console.log('🔀 Using OpenRouter API for Qwen model');
            this.useHuggingFace = false;
        } else {
            console.warn('⚠️ No API key found (HF_TOKEN, HUGGINGFACE_API_KEY, or OPENROUTER_API_KEY)');
            this.useHuggingFace = false;
        }
    }
    
    /**
     * Process a user query and generate a response
     */
    async query(userQuery, telemetryData) {
        try {
            console.log('🧠 Processing query:', userQuery);
            
            // Extract temporal context from query
            const temporalContext = this.extractTemporalContext(userQuery);
            
            // Aggregate relevant data
            const aggregatedData = this.aggregateData(telemetryData, temporalContext);
            
            // Build context for the model
            const context = this.buildContext(aggregatedData, userQuery);
            
            // Generate response using Qwen
            const response = await this.generateResponse(userQuery, context);
            
            return {
                answer: response.content,
                reasoning: response.reasoning,
                confidence: response.confidence,
                sources: aggregatedData.sources,
                temporalContext: temporalContext
            };
            
        } catch (error) {
            console.error('❌ Reasoning engine error:', error);
            throw error;
        }
    }
    
    /**
     * Extract temporal references from the query
     */
    extractTemporalContext(query) {
        const now = new Date();
        const queryLower = query.toLowerCase();
        
        // Temporal patterns
        const patterns = {
            'today': {
                start: new Date(now.setHours(0, 0, 0, 0)),
                end: new Date(now.setHours(23, 59, 59, 999))
            },
            'yesterday': {
                start: new Date(now.setDate(now.getDate() - 1)).setHours(0, 0, 0, 0),
                end: new Date(now.setHours(23, 59, 59, 999))
            },
            'this week': {
                start: new Date(now.setDate(now.getDate() - now.getDay())).setHours(0, 0, 0, 0),
                end: new Date()
            },
            'last week': {
                start: new Date(now.setDate(now.getDate() - now.getDay() - 7)).setHours(0, 0, 0, 0),
                end: new Date(now.setDate(now.getDate() + 6)).setHours(23, 59, 59, 999)
            },
            'this month': {
                start: new Date(now.getFullYear(), now.getMonth(), 1),
                end: new Date()
            },
            'last month': {
                start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
                end: new Date(now.getFullYear(), now.getMonth(), 0)
            }
        };
        
        // Find matching pattern
        for (const [pattern, timeRange] of Object.entries(patterns)) {
            if (queryLower.includes(pattern)) {
                return {
                    pattern,
                    start: new Date(timeRange.start),
                    end: new Date(timeRange.end),
                    detected: true
                };
            }
        }
        
        // Default: last 7 days
        return {
            pattern: 'recent',
            start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            end: new Date(),
            detected: false
        };
    }
    
    /**
     * Aggregate relevant telemetry data based on temporal context
     */
    aggregateData(telemetryData, temporalContext) {
        const { events, prompts, sessions, files } = telemetryData;
        const { start, end } = temporalContext;
        
        // Filter by time range
        const filteredEvents = (events || []).filter(e => {
            const t = new Date(e.timestamp);
            return t >= start && t <= end;
        });
        
        const filteredPrompts = (prompts || []).filter(p => {
            const t = new Date(p.timestamp);
            return t >= start && t <= end;
        });
        
        // Calculate statistics
        const stats = {
            totalEvents: filteredEvents.length,
            totalPrompts: filteredPrompts.length,
            fileChanges: filteredEvents.filter(e => e.type === 'file_change').length,
            uniqueFiles: new Set(filteredEvents.map(e => {
                try {
                    const details = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
                    return details?.file_path;
                } catch {
                    return null;
                }
            }).filter(Boolean)).size,
            aiInteractions: filteredPrompts.filter(p => {
                const text = p.text || p.prompt || p.preview || '';
                return !text.startsWith('{') && text.length > 20;
            }).length
        };
        
        // Extract most modified files
        const fileModifications = {};
        filteredEvents.forEach(e => {
            try {
                const details = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
                const filePath = details?.file_path;
                if (filePath) {
                    fileModifications[filePath] = (fileModifications[filePath] || 0) + 1;
                }
            } catch {}
        });
        
        const topFiles = Object.entries(fileModifications)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([path, count]) => ({ path, modifications: count }));
        
        // Extract AI usage patterns
        const aiModes = {};
        filteredPrompts.forEach(p => {
            const mode = p.mode || 'unknown';
            aiModes[mode] = (aiModes[mode] || 0) + 1;
        });
        
        // Calculate productivity metrics
        const productivity = {
            avgEventsPerDay: stats.totalEvents / Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000))),
            avgPromptsPerDay: stats.totalPrompts / Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000))),
            filesPerSession: stats.uniqueFiles / Math.max(1, stats.totalEvents)
        };
        
        return {
            stats,
            topFiles,
            aiModes,
            productivity,
            events: filteredEvents.slice(0, 20), // Sample for context
            prompts: filteredPrompts.slice(0, 10),
            sources: {
                events: filteredEvents.length,
                prompts: filteredPrompts.length,
                timeRange: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
            }
        };
    }
    
    /**
     * Build context string for the model
     */
    buildContext(aggregatedData, query) {
        const { stats, topFiles, aiModes, productivity } = aggregatedData;
        
        return `
# Development Activity Analysis

## Time Period
${aggregatedData.sources.timeRange}

## Summary Statistics
- Total Events: ${stats.totalEvents}
- File Changes: ${stats.fileChanges}
- Unique Files Modified: ${stats.uniqueFiles}
- AI Interactions: ${stats.aiInteractions}

## Top Modified Files
${topFiles.map(f => `- ${f.path.split('/').pop()}: ${f.modifications} modifications`).join('\n')}

## AI Usage Patterns
${Object.entries(aiModes).map(([mode, count]) => `- ${mode.toUpperCase()}: ${count} uses`).join('\n')}

## Productivity Metrics
- Average events per day: ${productivity.avgEventsPerDay.toFixed(1)}
- Average AI prompts per day: ${productivity.avgPromptsPerDay.toFixed(1)}
- Files per session: ${productivity.filesPerSession.toFixed(2)}

## User Query
${query}
        `.trim();
    }
    
    /**
     * Generate response using Qwen model via Hugging Face or OpenRouter
     */
    async generateResponse(query, context) {
        if (!this.hfApiKey && !this.openRouterKey) {
            // Fallback response without API
            return {
                content: this.generateFallbackResponse(query, context),
                reasoning: 'API key not configured - using rule-based analysis',
                confidence: 0.6
            };
        }
        
        try {
            if (this.useHuggingFace) {
                return await this.generateWithHuggingFace(query, context);
            } else {
                return await this.generateWithOpenRouter(query, context);
            }
        } catch (error) {
            console.error('API error:', error);
            // Fallback to rule-based
            return {
                content: this.generateFallbackResponse(query, context),
                reasoning: `API error: ${error.message} - using rule-based analysis`,
                confidence: 0.6
            };
        }
    }
    
    /**
     * Generate response using Hugging Face Inference API
     */
    async generateWithHuggingFace(query, context) {
        // Ensure fetch is loaded
        await fetchPromise;
        
        // Format as a single prompt for text generation models
        const systemPrompt = `You are an AI assistant that helps developers understand their coding patterns and productivity. 
You have access to their development telemetry data and can provide insights about their work.
Be concise, specific, and actionable. Use the data provided to give evidence-based answers.
Format your response in a friendly, conversational tone.`;
        
        const prompt = `<|im_start|>system
${systemPrompt}<|im_end|>
<|im_start|>user
${context}

Based on this data, please answer: ${query}<|im_end|>
<|im_start|>assistant
`;
        
        const response = await fetchModule(this.hfEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.hfApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    max_new_tokens: 500,
                    temperature: 0.7,
                    top_p: 0.95,
                    return_full_text: false,
                    do_sample: true
                }
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        
        // Handle standard HF inference response format
        let content;
        if (Array.isArray(data) && data[0]?.generated_text) {
            content = data[0].generated_text;
        } else if (data.generated_text) {
            content = data.generated_text;
        } else if (data[0]?.text) {
            content = data[0].text;
        } else {
            console.error('Unexpected HF response:', JSON.stringify(data).substring(0, 200));
            throw new Error('Unexpected response format from Hugging Face');
        }
        
        // Clean up any remaining prompt markers
        content = content.replace(/<\|im_end\|>/g, '').trim();
        
        return {
            content: content || this.generateFallbackResponse(query, context),
            reasoning: 'Generated using Qwen 2.5 via Hugging Face',
            confidence: 0.9
        };
    }
    
    /**
     * Generate response using OpenRouter API
     */
    async generateWithOpenRouter(query, context) {
        // Ensure fetch is loaded
        await fetchPromise;
        
        const messages = [
            {
                role: 'system',
                content: `You are an AI assistant that helps developers understand their coding patterns and productivity. 
You have access to their development telemetry data and can provide insights about their work.
Be concise, specific, and actionable. Use the data provided to give evidence-based answers.
Format your response in a friendly, conversational tone.`
            },
            {
                role: 'user',
                content: `${context}\n\nBased on this data, please answer: ${query}`
            }
        ];
        
        const response = await fetchModule(this.openRouterEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.openRouterKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:43917',
                'X-Title': 'Cursor Telemetry Dashboard'
            },
            body: JSON.stringify({
                model: this.openRouterModel,
                messages: messages,
                temperature: 0.7,
                max_tokens: 500
            })
        });
        
        if (!response.ok) {
            throw new Error(`OpenRouter API error: ${response.status}`);
        }
        
        const data = await response.json();
        const content = data.choices[0].message.content;
        
        return {
            content: content,
            reasoning: 'Generated using Qwen 2.5 via OpenRouter',
            confidence: 0.9
        };
    }
    
    /**
     * Generate rule-based response when API is unavailable
     */
    generateFallbackResponse(query, context) {
        const queryLower = query.toLowerCase();
        
        // Parse context for key metrics
        const stats = {
            events: parseInt(context.match(/Total Events: (\d+)/)?.[1] || '0'),
            files: parseInt(context.match(/Unique Files Modified: (\d+)/)?.[1] || '0'),
            aiInteractions: parseInt(context.match(/AI Interactions: (\d+)/)?.[1] || '0')
        };
        
        // Pattern matching responses
        if (queryLower.includes('what') && (queryLower.includes('work') || queryLower.includes('do'))) {
            return `Based on your activity, you've been quite busy! You made **${stats.events} changes** across **${stats.files} different files**. You also used AI assistance **${stats.aiInteractions} times**. Your most active files are listed above in the data.`;
        }
        
        if (queryLower.includes('productivity') || queryLower.includes('productive')) {
            const eventsPerDay = context.match(/Average events per day: ([\d.]+)/)?.[1];
            return `Your productivity metrics show you're averaging **${eventsPerDay} events per day**. This indicates ${parseFloat(eventsPerDay) > 20 ? 'high' : 'moderate'} activity levels. You're using AI assistance regularly, which can boost productivity.`;
        }
        
        if (queryLower.includes('file') && queryLower.includes('most')) {
            const topFile = context.match(/- ([^:]+): (\d+) modifications/)?.[1];
            const topCount = context.match(/- ([^:]+): (\d+) modifications/)?.[2];
            return topFile 
                ? `Your most modified file is **${topFile}** with **${topCount} modifications**. This suggests it's a key part of your current focus.`
                : 'I need more data to determine your most modified files.';
        }
        
        if (queryLower.includes('ai') && (queryLower.includes('usage') || queryLower.includes('use'))) {
            return `You've used AI assistance **${stats.aiInteractions} times**. Your AI usage patterns show a mix of different modes. This indicates you're leveraging AI effectively for various tasks.`;
        }
        
        // Generic response
        return `Based on the data: You had **${stats.events} events**, modified **${stats.files} files**, and used AI **${stats.aiInteractions} times**. Your development activity shows consistent engagement with your codebase.`;
    }
}

module.exports = { ReasoningEngine };

