/**
 * Basic usage examples for Cursor Telemetry JavaScript SDK
 */

import { CursorTelemetryAPI } from '../src/index';

async function basicUsage() {
  // Initialize the API client
  const api = new CursorTelemetryAPI({
    baseUrl: 'http://localhost:3000',
    apiKey: 'your-api-key', // Optional
    debug: true
  });

  try {
    // Connect to real-time updates
    await api.connect({
      autoReconnect: true,
      onConnect: () => console.log('Connected to WebSocket'),
      onDisconnect: () => console.log('Disconnected from WebSocket'),
      onError: (error) => console.error('WebSocket error:', error)
    });
    
    // Listen for real-time events
    api.onSessionsUpdated((data) => {
      console.log('Sessions updated:', data);
    });
    
    api.onSessionCreated((data) => {
      console.log('New session created:', data);
    });
    
    // Get all sessions
    console.log('Fetching all sessions...');
    const sessions = await api.sessions.getAll({ limit: 10 });
    console.log(`Found ${sessions.length} sessions`);
    
    // Search sessions
    console.log('Searching sessions...');
    const searchResults = await api.sessions.search({
      query: 'jupyter',
      limit: 5
    });
    console.log(`Found ${searchResults.length} sessions matching 'jupyter'`);
    
    // Get specific session
    if (sessions.length > 0) {
      const sessionId = sessions[0].id;
      console.log(`Getting details for session: ${sessionId}`);
      const session = await api.sessions.getById(sessionId);
      console.log('Session details:', session);
      
      // Generate notebook from session
      console.log('Generating notebook...');
      const notebook = await api.sessions.generateNotebook(sessionId, {
        includeMetadata: true,
        format: 'jupyter',
        addCells: true
      });
      console.log('Generated notebook:', notebook);
      
      // Get session visualizations
      console.log('Getting visualizations...');
      const visualizations = await api.sessions.getVisualizations(sessionId);
      console.log('Visualizations:', visualizations);
    }
    
    // Get analytics
    console.log('Fetching analytics...');
    const analytics = await api.analytics.getStats();
    console.log('Analytics:', analytics);
    
    // Get memories
    console.log('Fetching memories...');
    const memories = await api.memory.getAll({ limit: 10 });
    console.log(`Found ${memories.length} memories`);
    
    // Health check
    const isHealthy = await api.healthCheck();
    console.log('API health:', isHealthy ? 'OK' : 'ERROR');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Disconnect
    await api.disconnect();
  }
}

async function memoryWorkflow() {
  const api = new CursorTelemetryAPI({
    baseUrl: 'http://localhost:3000',
    apiKey: 'your-api-key'
  });

  try {
    // Get sessions with data science focus
    const sessions = await api.sessions.search({
      query: 'data analysis',
      limit: 5
    });
    
    for (const session of sessions) {
      console.log(`Processing session: ${session.name}`);
      
      // Generate notebook
      const notebook = await api.sessions.generateNotebook(session.id, {
        includeMetadata: true,
        format: 'jupyter',
        addCells: true
      });
      
      // Create memory for future reference
      const memory = await api.sessions.createMemory(session.id, {
        name: `Analysis: ${session.name}`,
        type: 'notebook',
        tags: ['data-science', 'analysis'],
        description: 'Generated from data analysis session'
      });
      
      console.log(`Created memory: ${memory.name}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

async function realTimeMonitoring() {
  const api = new CursorTelemetryAPI({
    baseUrl: 'http://localhost:3000',
    apiKey: 'your-api-key'
  });

  try {
    // Connect to WebSocket
    await api.connect();
    
    // Subscribe to all events
    api.subscribeToEvents();
    
    // Set up event handlers
    api.onSessionsUpdated((data) => {
      console.log('Sessions updated:', data);
    });
    
    api.onFileChanged((data) => {
      console.log('File changed:', data);
    });
    
    api.onAnalysisComplete((data) => {
      console.log('Analysis complete:', data);
    });
    
    // Keep the connection alive
    console.log('Monitoring for real-time updates...');
    console.log('Press Ctrl+C to stop');
    
    // In a real application, you would keep this running
    // For this example, we'll wait for 30 seconds
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await api.disconnect();
  }
}

// Run examples
if (require.main === module) {
  console.log('=== Basic Usage ===');
  basicUsage().catch(console.error);
  
  // Uncomment to run other examples
  // console.log('\n=== Memory Workflow ===');
  // memoryWorkflow().catch(console.error);
  
  // console.log('\n=== Real-time Monitoring ===');
  // realTimeMonitoring().catch(console.error);
}
