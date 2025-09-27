/**
 * Test setup and configuration
 */

// Mock fetch for Node.js environment
global.fetch = require('jest-fetch-mock');

// Mock WebSocket for testing
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  public readyState = MockWebSocket.CONNECTING;
  public url: string;
  public onopen: ((event: Event) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string) {
    // Mock send implementation
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }

  addEventListener(type: string, listener: EventListener) {
    // Mock addEventListener
  }

  removeEventListener(type: string, listener: EventListener) {
    // Mock removeEventListener
  }
}

// Mock socket.io-client
jest.mock('socket.io-client', () => {
  return {
    io: jest.fn(() => ({
      connected: true,
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      onAny: jest.fn()
    }))
  };
});

// Mock axios
jest.mock('axios', () => {
  return {
    create: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      interceptors: {
        request: {
          use: jest.fn()
        },
        response: {
          use: jest.fn()
        }
      },
      defaults: {
        baseURL: '',
        timeout: 30000,
        headers: {}
      }
    }))
  };
});

// Global test utilities
global.testUtils = {
  createMockSession: (overrides = {}) => ({
    id: 'test-session-123',
    name: 'Test Session',
    startTime: '2024-01-01T00:00:00.000Z',
    endTime: '2024-01-01T01:00:00.000Z',
    duration: 3600,
    projectPath: '/test/project',
    files: ['test.py', 'test.ipynb'],
    events: [],
    metadata: {},
    ...overrides
  }),

  createMockMemory: (overrides = {}) => ({
    id: 'test-memory-123',
    sessionId: 'test-session-123',
    name: 'Test Memory',
    content: 'Test content',
    type: 'notebook',
    createdAt: '2024-01-01T00:00:00.000Z',
    metadata: {},
    ...overrides
  }),

  createMockEvent: (overrides = {}) => ({
    id: 'test-event-123',
    type: 'file_change',
    timestamp: '2024-01-01T00:00:00.000Z',
    data: {},
    ...overrides
  })
};

// Suppress console.log in tests unless explicitly enabled
const originalConsoleLog = console.log;
console.log = (...args) => {
  if (process.env.DEBUG_TESTS === 'true') {
    originalConsoleLog(...args);
  }
};
