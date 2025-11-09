/**
 * AI/OpenRouter API routes for embeddings and chat completions
 */

// Use dynamic import for node-fetch v3 (ESM)
let fetchModule;
const fetchPromise = import('node-fetch').then(mod => {
    fetchModule = mod.default;
});

function createAIRoutes(deps) {
  const { app } = deps;
  
  // Clean API key extraction - accept any non-empty value from .env
  const openRouterKey = (process.env.OPENROUTER_API_KEY || '').trim();
  const openRouterEndpoint = 'https://openrouter.ai/api/v1';
  
  // Use free models by default - no API key required
  // These work without authentication via OpenRouter's free tier
  const embeddingModel = process.env.OPENROUTER_EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
  // Use a free chat model - Qwen2.5 is free and works well
  const chatModel = process.env.OPENROUTER_CHAT_MODEL || 'qwen/qwen-2.5-0.5b-instruct:free';

  // Log status on startup
  if (openRouterKey && openRouterKey.length > 0) {
    console.log('[AI] ✓ OpenRouter API key found - attempting to use OpenRouter API');
    console.log(`[AI]   Embedding model: ${embeddingModel}`);
    console.log(`[AI]   Chat model: ${chatModel}`);
    console.log(`[AI]   Key length: ${openRouterKey.length} characters`);
  } else {
    console.log('[AI] ℹ OpenRouter API key not set - using free local models');
    console.log('[AI]   Free models: Transformers.js (local, no API key needed)');
  }

  /**
   * Generate embeddings using OpenRouter API or local models
   */
  app.post('/api/ai/embeddings', async (req, res) => {
    // If no API key, return instructions to use local Transformers.js
    if (!openRouterKey) {
      return res.status(503).json({
        success: false,
        error: 'OpenRouter API key not configured. Use Transformers.js in browser for free embeddings, or set OPENROUTER_API_KEY in .env for server-side embeddings.',
        useLocal: true,
        suggestion: 'The frontend will automatically use Transformers.js for free embeddings'
      });
    }

    try {
      const { texts } = req.body;
      
      if (!texts || !Array.isArray(texts) || texts.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Texts array is required and must not be empty'
        });
      }

      // Ensure fetch is loaded
      await fetchPromise;

      // OpenRouter embeddings endpoint
      const response = await fetchModule(`${openRouterEndpoint}/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:43917',
          'X-Title': 'Cursor Telemetry Dashboard'
        },
        body: JSON.stringify({
          model: embeddingModel,
          input: texts
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenRouter embeddings error (${response.status}):`, errorText);
        return res.status(response.status).json({
          success: false,
          error: `OpenRouter API error: ${response.status} - ${errorText}`
        });
      }

      const data = await response.json();
      
      // Extract embeddings from response
      const embeddings = data.data.map(item => item.embedding);
      
      res.json({
        success: true,
        embeddings,
        model: embeddingModel
      });
    } catch (error) {
      console.error('Error generating embeddings:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Generate chat completion using OpenRouter API (for cluster labels, descriptions, etc.)
   * Falls back to rule-based generation if no API key
   */
  app.post('/api/ai/chat', async (req, res) => {
    // If no API key, provide a helpful fallback response
    if (!openRouterKey) {
      const { messages } = req.body;
      const userMessage = messages && messages.length > 0 
        ? messages[messages.length - 1].content 
        : '';
      
      // Simple rule-based fallback for common cases
      let fallbackResponse = 'Cluster';
      if (userMessage.toLowerCase().includes('cluster')) {
        if (userMessage.includes('test') || userMessage.includes('spec')) {
          fallbackResponse = 'Test Files';
        } else if (userMessage.includes('component') || userMessage.includes('ui')) {
          fallbackResponse = 'UI Components';
        } else if (userMessage.includes('api') || userMessage.includes('route')) {
          fallbackResponse = 'API Routes';
        } else if (userMessage.includes('util') || userMessage.includes('helper')) {
          fallbackResponse = 'Utilities';
        }
      }
      
      return res.json({
        success: true,
        content: fallbackResponse,
        model: 'rule-based-fallback',
        note: 'OpenRouter API key not configured. Set OPENROUTER_API_KEY in .env for AI-generated labels.'
      });
    }

    try {
      const { messages, model, temperature = 0.7, max_tokens = 200 } = req.body;
      
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Messages array is required and must not be empty'
        });
      }

      // Ensure fetch is loaded
      await fetchPromise;

      const response = await fetchModule(`${openRouterEndpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:43917',
          'X-Title': 'Cursor Telemetry Dashboard'
        },
        body: JSON.stringify({
          model: model || chatModel,
          messages: messages,
          temperature: temperature,
          max_tokens: max_tokens
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenRouter chat error (${response.status}):`, errorText);
        return res.status(response.status).json({
          success: false,
          error: `OpenRouter API error: ${response.status} - ${errorText}`
        });
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      res.json({
        success: true,
        content: content,
        model: data.model || (model || chatModel)
      });
    } catch (error) {
      console.error('Error generating chat completion:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Check if AI services are available
   */
  app.get('/api/ai/status', (req, res) => {
    const hasValidKey = !!openRouterKey;
    
    res.json({
      success: true,
      available: hasValidKey,
      embeddingModel: embeddingModel,
      chatModel: chatModel,
      hasApiKey: hasValidKey,
      // Always available via Transformers.js in browser
      localAvailable: true,
      localModel: 'Xenova/all-MiniLM-L6-v2',
      message: hasValidKey 
        ? 'OpenRouter API configured - using premium models'
        : 'Using free local models (Transformers.js) - set OPENROUTER_API_KEY for better quality'
    });
  });
}

module.exports = createAIRoutes;

