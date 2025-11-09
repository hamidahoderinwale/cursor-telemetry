/**
 * Frontend Annotation Service
 * Fetches and manages AI-generated annotations for events
 */

class AnnotationService {
  constructor() {
    this.apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    this.cache = new Map();
  }

  /**
   * Annotate a single event
   */
  async annotateEvent(event, context = {}) {
    try {
      const response = await fetch(`${this.apiBase}/api/annotations/event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ event, context })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.annotation) {
          // Update event in place
          event.annotation = data.annotation;
          event.ai_generated = true;
          return data.annotation;
        }
      }
    } catch (error) {
      console.warn('[ANNOTATION] Error annotating event:', error.message);
    }
    return null;
  }

  /**
   * Batch annotate events
   */
  async annotateEventsBatch(events, context = {}) {
    try {
      const response = await fetch(`${this.apiBase}/api/annotations/events/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ events, context })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.events) {
          return data.events;
        }
      }
    } catch (error) {
      console.warn('[ANNOTATION] Error batch annotating events:', error.message);
    }
    return events;
  }

  /**
   * Classify intent for a session
   */
  async classifyIntent(events) {
    try {
      const response = await fetch(`${this.apiBase}/api/annotations/intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ events })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.classification) {
          return data.classification;
        }
      }
    } catch (error) {
      console.warn('[ANNOTATION] Error classifying intent:', error.message);
    }
    return { intent: 'general', confidence: 0.5, tags: [], summary: 'General development activity' };
  }

  /**
   * Generate state summary
   */
  async generateStateSummary(events, fileChanges = []) {
    try {
      const response = await fetch(`${this.apiBase}/api/annotations/state-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ events, fileChanges })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.summary) {
          return data.summary;
        }
      }
    } catch (error) {
      console.warn('[ANNOTATION] Error generating state summary:', error.message);
    }
    return 'Development session';
  }

  /**
   * Refresh annotations for events
   */
  async refreshAnnotations(eventIds = null, sessionId = null) {
    try {
      const response = await fetch(`${this.apiBase}/api/annotations/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ eventIds, sessionId })
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (error) {
      console.warn('[ANNOTATION] Error refreshing annotations:', error.message);
    }
    return { success: false, annotated: 0 };
  }
}

// Export singleton
if (typeof window !== 'undefined') {
  window.AnnotationService = AnnotationService;
  window.annotationService = new AnnotationService();
}

