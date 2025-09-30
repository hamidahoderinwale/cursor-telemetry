/**
 * Basic usage examples for Cursor Telemetry JavaScript SDK
 */

import { CursorTelemetryAPI } from '@cursor-telemetry/sdk';

// Initialize the API client
const api = new CursorTelemetryAPI({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-api-key' // Optional
});

async function basicUsage() {
  try {
    // Connect to real-time updates
    await api.connect();
    
    // Listen for real-time events
    api.on('sessions-updated', (data) => {
      console.log('Sessions updated:', data);
    });
    
    api.on('session-created', (data) => {
      console.log('New session created:', data);
    });
    
    // Get all sessions
    console.log('Fetching all sessions...');
    const sessions = await api.sessions.getAll();
    console.log(`Found ${sessions.length} sessions`);
    
    // Search sessions
    console.log('Searching sessions...');
    const searchResults = await api.sessions.search('jupyter');
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
        format: 'jupyter'
      });
      console.log('Generated notebook:', notebook);
      
      // Get session visualizations
      console.log('Getting visualizations...');
      const visualizations = await api.sessions.getVisualizations(sessionId);
      console.log('Visualizations:', visualizations);
    }
    
    // Get projects
    console.log('Fetching projects...');
    const projects = await api.projects.getAll();
    console.log(`Found ${projects.length} projects`);
    
    // Get analytics
    console.log('Fetching analytics...');
    const analytics = await api.analytics.getStats();
    console.log('Analytics:', analytics);
    
    // Get memories
    console.log('Fetching memories...');
    const memories = await api.memory.getAll();
    console.log(`Found ${memories.length} memories`);
    
    // Health check
    const isHealthy = await api.healthCheck();
    console.log('API health:', isHealthy ? 'OK' : 'ERROR');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    // Disconnect
    await api.disconnect();
  }
}

// Run the example
basicUsage();
