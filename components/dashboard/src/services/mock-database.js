/**
 * Mock Database Service
 * Provides mock data for development without requiring SQLite compilation
 */

class MockDatabase {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.mockData = this.generateMockData();
  }

  generateMockData() {
    return {
      events: [
        {
          id: 1,
          session_id: 'session-1758780443854',
          event_type: 'file_change',
          timestamp: new Date().toISOString(),
          data: JSON.stringify({
            file: '/test/file.py',
            change: 'modified',
            content: 'import pandas as pd\ndf = pd.read_csv("data.csv")'
          })
        },
        {
          id: 2,
          session_id: 'session-1758780443854',
          event_type: 'conversation',
          timestamp: new Date().toISOString(),
          data: JSON.stringify({
            role: 'user',
            content: 'How do I analyze this data?'
          })
        }
      ],
      embeddings: [
        {
          id: 1,
          session_id: 'session-1758780443854',
          embedding_type: 'conversation',
          embedding_data: JSON.stringify([0.1, 0.2, 0.3, 0.4, 0.5]),
          metadata: JSON.stringify({
            model: 'mock-model',
            dimensions: 5
          })
        }
      ],
      sessions: [
        {
          id: 'session-1758780443854',
          start_time: new Date(Date.now() - 3600000).toISOString(),
          end_time: new Date().toISOString(),
          status: 'completed',
          metadata: JSON.stringify({
            intent: 'data_analysis',
            files: ['/test/file.py'],
            conversations: 2
          })
        }
      ]
    };
  }

  prepare(query) {
    return {
      all: (params = {}) => {
        if (query.includes('FROM events')) {
          return this.mockData.events;
        } else if (query.includes('FROM embeddings')) {
          return this.mockData.embeddings;
        } else if (query.includes('FROM sessions')) {
          return this.mockData.sessions;
        }
        return [];
      },
      get: (params = {}) => {
        if (query.includes('FROM events')) {
          return this.mockData.events[0];
        } else if (query.includes('FROM embeddings')) {
          return this.mockData.embeddings[0];
        } else if (query.includes('FROM sessions')) {
          return this.mockData.sessions[0];
        }
        return null;
      }
    };
  }

  close() {
    // Mock close
  }
}

module.exports = MockDatabase;

