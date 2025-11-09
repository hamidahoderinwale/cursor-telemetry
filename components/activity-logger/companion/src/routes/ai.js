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
  
  const openRouterKey = process.env.OPENROUTER_API_KEY || '';
  const openRouterEndpoint = 'https://openrouter.ai/api/v1';
  
  // Use a good embedding model - text-embedding-3-small is cost-effective and high quality
  const embeddingModel = process.env.OPENROUTER_EMBEDDING_MODEL || 'openai/text-embedding-3-small';
  // Use a good chat model for generating labels - phi-3-mini is free and fast
  const chatModel = process.env.OPENROUTER_CHAT_MODEL || 'microsoft/phi-3-mini-128k-instruct:free';

  // Log API key status on startup
  if (openRouterKey) {
    console.log('[AI] OpenRouter API key detected - semantic search and cluster labeling enabled');
    console.log(`[AI] Embedding model: ${embeddingModel}`);
    console.log(`[AI] Chat model: ${chatModel}`);
  } else {
    console.log('[AI] OpenRouter API key not found - set OPENROUTER_API_KEY in .env to enable AI features');
  }

  /**
   * Generate embeddings using OpenRouter API
   */
  app.post('/api/ai/embeddings', async (req, res) => {
    if (!openRouterKey) {
      return res.status(503).json({
        success: false,
        error: 'OpenRouter API key not configured. Set OPENROUTER_API_KEY in environment variables.'
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
   */
  app.post('/api/ai/chat', async (req, res) => {
    if (!openRouterKey) {
      return res.status(503).json({
        success: false,
        error: 'OpenRouter API key not configured. Set OPENROUTER_API_KEY in environment variables.'
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
    res.json({
      success: true,
      available: !!openRouterKey,
      embeddingModel: embeddingModel,
      chatModel: chatModel,
      hasApiKey: !!openRouterKey
    });
  });
}

module.exports = createAIRoutes;

