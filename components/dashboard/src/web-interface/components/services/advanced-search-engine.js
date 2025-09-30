/**
 * Advanced Search Engine
 * Provides enhanced search functionality for the dashboard
 */

class AdvancedSearchEngine {
    constructor() {
        this.index = new Map();
        this.sessions = [];
        this.conversations = [];
        this.isInitialized = false;
        console.log('Advanced Search Engine initialized');
    }

    /**
     * Initialize the search engine with data
     */
    async initialize(sessions = [], conversations = []) {
        try {
            this.sessions = sessions;
            this.conversations = conversations;
            
            // Build search index
            this.buildIndex();
            
            this.isInitialized = true;
            console.log('Advanced search engine initialized with', sessions.length, 'sessions and', conversations.length, 'conversations');
        } catch (error) {
            console.error('Failed to initialize advanced search engine:', error);
        }
    }

    /**
     * Build search index from sessions and conversations
     */
    buildIndex() {
        this.index.clear();
        
        // Index sessions
        this.sessions.forEach(session => {
            const terms = this.extractTerms(session);
            terms.forEach(term => {
                if (!this.index.has(term)) {
                    this.index.set(term, []);
                }
                this.index.get(term).push({ type: 'session', id: session.id, data: session });
            });
        });

        // Index conversations
        this.conversations.forEach(conversation => {
            const terms = this.extractTerms(conversation);
            terms.forEach(term => {
                if (!this.index.has(term)) {
                    this.index.set(term, []);
                }
                this.index.get(term).push({ type: 'conversation', id: conversation.id, data: conversation });
            });
        });
    }

    /**
     * Extract search terms from data
     */
    extractTerms(data) {
        const terms = new Set();
        
        // Extract from text content
        const text = JSON.stringify(data).toLowerCase();
        const words = text.match(/\b\w+\b/g) || [];
        words.forEach(word => {
            if (word.length > 2) {
                terms.add(word);
            }
        });

        return Array.from(terms);
    }

    /**
     * Search for terms
     */
    search(query, options = {}) {
        if (!this.isInitialized) {
            return { results: [], total: 0 };
        }

        const terms = query.toLowerCase().split(/\s+/);
        const results = new Map();
        
        terms.forEach(term => {
            if (this.index.has(term)) {
                this.index.get(term).forEach(item => {
                    if (!results.has(item.id)) {
                        results.set(item.id, { ...item, score: 0 });
                    }
                    results.get(item.id).score += 1;
                });
            }
        });

        // Convert to array and sort by score
        const sortedResults = Array.from(results.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, options.limit || 50);

        return {
            results: sortedResults,
            total: sortedResults.length,
            query: query
        };
    }

    /**
     * Get search suggestions
     */
    getSuggestions(query, limit = 10) {
        if (!this.isInitialized || query.length < 2) {
            return [];
        }

        const suggestions = new Set();
        const queryLower = query.toLowerCase();
        
        for (const term of this.index.keys()) {
            if (term.startsWith(queryLower)) {
                suggestions.add(term);
                if (suggestions.size >= limit) break;
            }
        }

        return Array.from(suggestions);
    }

    /**
     * Index a single session
     */
    indexSession(session) {
        if (!session || !session.id) return;
        
        const terms = this.extractTerms(session);
        terms.forEach(term => {
            if (!this.index.has(term)) {
                this.index.set(term, []);
            }
            // Remove existing entries for this session
            const existing = this.index.get(term).filter(item => item.id !== session.id);
            existing.push({ type: 'session', id: session.id, data: session });
            this.index.set(term, existing);
        });
    }

    /**
     * Index multiple sessions
     */
    indexSessions(sessions) {
        sessions.forEach(session => this.indexSession(session));
    }

    /**
     * Update data
     */
    updateData(sessions, conversations) {
        this.sessions = sessions;
        this.conversations = conversations;
        this.buildIndex();
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AdvancedSearchEngine };
} else if (typeof window !== 'undefined') {
    window.AdvancedSearchEngine = AdvancedSearchEngine;
}
