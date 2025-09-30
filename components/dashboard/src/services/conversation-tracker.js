/**
 * Conversation Tracker Service
 * Captures and stores conversations from various sources
 */

class ConversationTracker {
    constructor() {
        this.conversations = [];
        this.isTracking = false;
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
        
        console.log('Conversation Tracker initialized');
    }

    generateSessionId() {
        return `conv-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    startTracking() {
        this.isTracking = true;
        console.log('Conversation tracking started');
        
        // Set up periodic conversation capture (reduced frequency)
        this.captureInterval = setInterval(() => {
            this.captureCurrentConversation();
        }, 300000); // Capture every 5 minutes instead of 30 seconds to reduce spam
        
        // Set up keyboard event monitoring (browser only)
        if (typeof window !== 'undefined') {
            this.setupKeyboardMonitoring();
            this.setupGUIMonitoring();
        }
    }

    stopTracking() {
        this.isTracking = false;
        if (this.captureInterval) {
            clearInterval(this.captureInterval);
        }
        
        // Remove event listeners (browser only)
        if (typeof window !== 'undefined') {
            this.removeEventListeners();
        }
        
        console.log('Conversation tracking stopped');
    }

    setupKeyboardMonitoring() {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        
        // Monitor keyboard events for Cursor shortcuts
        this.keyboardHandler = (event) => {
            this.handleKeyboardEvent(event);
        };
        
        document.addEventListener('keydown', this.keyboardHandler, true);
        console.log('Keyboard monitoring setup for Cursor shortcuts');
    }

    setupGUIMonitoring() {
        if (typeof window === 'undefined') return;
        
        // Monitor for Cursor GUI elements
        this.setupCursorGUIMonitoring();
        
        // Monitor for code suggestion elements
        this.setupCodeSuggestionMonitoring();
        
        console.log('GUI monitoring setup for Cursor interactions');
    }

    setupCursorGUIMonitoring() {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        
        // Look for Cursor-specific UI elements
        const cursorSelectors = [
            '[data-testid*="accept"]',
            '[data-testid*="reject"]',
            '[data-testid*="apply"]',
            '[data-testid*="dismiss"]',
            '.cursor-accept',
            '.cursor-reject',
            '.cursor-apply',
            '.cursor-dismiss',
            '[aria-label*="Accept"]',
            '[aria-label*="Reject"]',
            '[aria-label*="Apply"]',
            '[aria-label*="Dismiss"]'
        ];

        // Set up mutation observer to watch for new elements
        this.mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Node.ELEMENT_NODE = 1
                        this.checkForCursorElements(node);
                    }
                });
            });
        });

        this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Check existing elements
        cursorSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                this.attachCursorElementListeners(element);
            });
        });
    }

    setupCodeSuggestionMonitoring() {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        
        // Monitor for code suggestion containers
        const suggestionSelectors = [
            '.suggestion-container',
            '.code-suggestion',
            '.ai-suggestion',
            '.cursor-suggestion',
            '[data-testid*="suggestion"]',
            '.inline-suggestion'
        ];

        // Set up periodic checking for suggestion elements
        this.suggestionCheckInterval = setInterval(() => {
            suggestionSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (!element.dataset.cursorTracked) {
                        this.attachSuggestionListeners(element);
                        element.dataset.cursorTracked = 'true';
                    }
                });
            });
        }, 5000); // Check every 5 seconds instead of 1 to reduce spam
    }

    checkForCursorElements(element) {
        const cursorSelectors = [
            '[data-testid*="accept"]',
            '[data-testid*="reject"]',
            '[data-testid*="apply"]',
            '[data-testid*="dismiss"]',
            '.cursor-accept',
            '.cursor-reject',
            '.cursor-apply',
            '.cursor-dismiss'
        ];

        cursorSelectors.forEach(selector => {
            if (element.matches && element.matches(selector)) {
                this.attachCursorElementListeners(element);
            }
            
            // Check child elements
            const children = element.querySelectorAll(selector);
            children.forEach(child => {
                this.attachCursorElementListeners(child);
            });
        });
    }

    attachCursorElementListeners(element) {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        if (element.dataset.cursorTracked) return;
        
        element.addEventListener('click', (event) => {
            this.handleCursorGUIClick(event, element);
        });
        
        element.dataset.cursorTracked = 'true';
    }

    attachSuggestionListeners(element) {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        
        // Monitor for suggestion acceptance/rejection
        element.addEventListener('click', (event) => {
            this.handleSuggestionInteraction(event, element);
        });
        
        // Monitor for keyboard interactions within suggestions
        element.addEventListener('keydown', (event) => {
            this.handleSuggestionKeyboard(event, element);
        });
    }

    handleKeyboardEvent(event) {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
        
        // Check for Cursor-specific keyboard shortcuts
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const cmdKey = isMac ? event.metaKey : event.ctrlKey;
        
        // Command+N (Accept suggestion)
        if (cmdKey && event.key === 'n' && !event.shiftKey) {
            this.captureCodeAcceptance('keyboard', 'Command+N', event);
        }
        
        // Command+Y (Reject suggestion) 
        if (cmdKey && event.key === 'y' && !event.shiftKey) {
            this.captureCodeRejection('keyboard', 'Command+Y', event);
        }
        
        // Tab (Accept suggestion)
        if (event.key === 'Tab' && !event.shiftKey) {
            this.captureCodeAcceptance('keyboard', 'Tab', event);
        }
        
        // Escape (Reject suggestion)
        if (event.key === 'Escape') {
            this.captureCodeRejection('keyboard', 'Escape', event);
        }
    }

    handleCursorGUIClick(event, element) {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        
        const elementText = element.textContent?.toLowerCase() || '';
        const elementId = element.id || '';
        const elementClass = element.className || '';
        
        // Determine action based on element properties
        if (elementText.includes('accept') || elementText.includes('apply') || 
            elementId.includes('accept') || elementClass.includes('accept')) {
            this.captureCodeAcceptance('gui', 'click', event, element);
        } else if (elementText.includes('reject') || elementText.includes('dismiss') ||
                   elementId.includes('reject') || elementClass.includes('reject')) {
            this.captureCodeRejection('gui', 'click', event, element);
        }
    }

    handleSuggestionInteraction(event, element) {
        // Capture suggestion interactions
        const suggestionText = this.extractSuggestionText(element);
        if (suggestionText) {
            this.captureSuggestionInteraction('click', suggestionText, element);
        }
    }

    handleSuggestionKeyboard(event, element) {
        // Handle keyboard interactions within suggestions
        if (event.key === 'Enter') {
            const suggestionText = this.extractSuggestionText(element);
            if (suggestionText) {
                this.captureCodeAcceptance('suggestion', 'Enter', event, element);
            }
        }
    }

    extractSuggestionText(element) {
        if (typeof window === 'undefined' || typeof document === 'undefined') return '';
        
        // Try to extract the suggested code from the element
        const codeElements = element.querySelectorAll('code, pre, .code, .suggestion-code');
        if (codeElements.length > 0) {
            return codeElements[0].textContent?.trim();
        }
        
        // Fallback to element text
        return element.textContent?.trim();
    }

    captureCodeAcceptance(method, action, event, element = null) {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        
        const code = this.getCurrentCodeContext();
        const suggestion = element ? this.extractSuggestionText(element) : null;
        
        const conversation = {
            id: `accept-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            role: 'system',
            content: `Code accepted via ${method} (${action})`,
            metadata: {
                source: 'cursor_interaction',
                captureType: 'code_acceptance',
                method: method,
                action: action,
                codeContext: code,
                suggestion: suggestion,
                element: element ? {
                    tagName: element.tagName,
                    className: element.className,
                    id: element.id
                } : null
            },
            referencedFiles: this.getReferencedFiles(),
            codeBlocks: suggestion ? [{
                language: this.detectLanguage(suggestion),
                content: suggestion
            }] : []
        };

        this.conversations.push(conversation);
        this.emitConversation(conversation);
        
        console.log(`Code accepted: ${method} (${action})`);
    }

    captureCodeRejection(method, action, event, element = null) {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        
        const code = this.getCurrentCodeContext();
        const suggestion = element ? this.extractSuggestionText(element) : null;
        
        const conversation = {
            id: `reject-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            role: 'system',
            content: `Code rejected via ${method} (${action})`,
            metadata: {
                source: 'cursor_interaction',
                captureType: 'code_rejection',
                method: method,
                action: action,
                codeContext: code,
                suggestion: suggestion,
                element: element ? {
                    tagName: element.tagName,
                    className: element.className,
                    id: element.id
                } : null
            },
            referencedFiles: this.getReferencedFiles(),
            codeBlocks: suggestion ? [{
                language: this.detectLanguage(suggestion),
                content: suggestion
            }] : []
        };

        this.conversations.push(conversation);
        this.emitConversation(conversation);
        
        console.log(`Code rejected: ${method} (${action})`);
    }

    captureSuggestionInteraction(method, suggestionText, element) {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        
        const conversation = {
            id: `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            role: 'system',
            content: `Suggestion interaction via ${method}`,
            metadata: {
                source: 'cursor_interaction',
                captureType: 'suggestion_interaction',
                method: method,
                suggestion: suggestionText,
                element: {
                    tagName: element.tagName,
                    className: element.className,
                    id: element.id
                }
            },
            referencedFiles: this.getReferencedFiles(),
            codeBlocks: [{
                language: this.detectLanguage(suggestionText),
                content: suggestionText
            }]
        };

        this.conversations.push(conversation);
        this.emitConversation(conversation);
        
        console.log(`Suggestion interaction: ${method}`);
    }

    getCurrentCodeContext() {
        if (typeof window === 'undefined' || typeof document === 'undefined') return '';
        
        // Try to get current code context from active editor
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.contentEditable === 'true')) {
            return activeElement.value || activeElement.textContent || '';
        }
        
        // Look for code editor elements
        const codeEditors = document.querySelectorAll('.monaco-editor, .code-editor, [data-testid*="editor"]');
        if (codeEditors.length > 0) {
            return codeEditors[0].textContent || '';
        }
        
        return '';
    }

    removeEventListeners() {
        if (typeof document === 'undefined') return;
        
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler, true);
        }
        
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
        
        if (this.suggestionCheckInterval) {
            clearInterval(this.suggestionCheckInterval);
        }
    }

    captureCurrentConversation() {
        try {
            // Capture current conversation context
            const conversation = {
                id: `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                sessionId: this.sessionId,
                timestamp: new Date().toISOString(),
                role: 'user',
                content: typeof window !== 'undefined' ? this.getCurrentConversationContext() : 'Periodic conversation capture',
                metadata: {
                    source: 'conversation_tracker',
                    captureType: 'periodic',
                    sessionDuration: Date.now() - this.startTime
                },
                referencedFiles: this.getReferencedFiles(),
                codeBlocks: this.getCodeBlocks()
            };

            // Only add if we have meaningful content
            if (conversation.content && conversation.content.length > 10) {
                this.conversations.push(conversation);
                console.log(`Captured conversation: ${conversation.id}`);
                
                // Emit to dashboard if available
                this.emitConversation(conversation);
            }
        } catch (error) {
            console.error('Error capturing conversation:', error);
        }
    }

    getCurrentConversationContext() {
        // Try to get current conversation context from various sources
        const context = [];
        
        // Check if we're in a browser environment with chat history
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            // Look for chat elements
            const chatElements = document.querySelectorAll('[data-testid*="message"], .message, .chat-message');
            if (chatElements.length > 0) {
                const recentMessages = Array.from(chatElements)
                    .slice(-3) // Last 3 messages
                    .map(el => el.textContent?.trim())
                    .filter(text => text && text.length > 0);
                
                if (recentMessages.length > 0) {
                    context.push(`Recent conversation: ${recentMessages.join(' | ')}`);
                }
            }
        }

        // Add current page context
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            const pageTitle = document.title;
            const currentUrl = window.location.href;
            context.push(`Page: ${pageTitle} (${currentUrl})`);
        }

        // Add timestamp context
        context.push(`Timestamp: ${new Date().toISOString()}`);

        return context.join('\n');
    }

    getReferencedFiles() {
        const files = [];
        
        // Check for open files in editor
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            // Look for file tabs or editor elements
            const fileElements = document.querySelectorAll('[data-testid*="tab"], .file-tab, .editor-tab');
            fileElements.forEach(el => {
                const fileName = el.textContent?.trim();
                if (fileName && fileName.includes('.')) {
                    files.push(fileName);
                }
            });
        }

        return files;
    }

    getCodeBlocks() {
        const codeBlocks = [];
        
        // Look for code elements in the current page
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            const codeElements = document.querySelectorAll('code, pre, .code-block');
            codeElements.forEach(el => {
                const code = el.textContent?.trim();
                if (code && code.length > 10) {
                    codeBlocks.push({
                        language: this.detectLanguage(code),
                        content: code.substring(0, 500) // Limit size
                    });
                }
            });
        }

        return codeBlocks;
    }

    detectLanguage(code) {
        // Simple language detection
        if (code.includes('import ') || code.includes('def ') || code.includes('class ')) {
            return 'python';
        } else if (code.includes('function ') || code.includes('const ') || code.includes('let ')) {
            return 'javascript';
        } else if (code.includes('SELECT ') || code.includes('FROM ')) {
            return 'sql';
        } else if (code.includes('curl ') || code.includes('http')) {
            return 'bash';
        }
        return 'text';
    }

    emitConversation(conversation) {
        // Only emit in browser environment
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return;
        }

        // Emit to dashboard via WebSocket if available
        if (window.io) {
            const socket = window.io();
            if (socket) {
                socket.emit('conversation-captured', conversation);
            }
        }

        // Also try to send via fetch API
        if (typeof fetch !== 'undefined') {
            const baseUrl = window.location.origin;
            fetch(`${baseUrl}/api/conversations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(conversation)
            }).catch(error => {
                console.log('Could not send conversation to API:', error.message);
            });
        }
    }

    // Manual conversation capture
    captureConversation(content, role = 'user', metadata = {}) {
        const conversation = {
            id: `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            role: role,
            content: content,
            metadata: {
                source: 'manual_capture',
                captureType: 'manual',
                ...metadata
            },
            referencedFiles: typeof window !== 'undefined' ? this.getReferencedFiles() : [],
            codeBlocks: typeof window !== 'undefined' ? this.getCodeBlocks() : []
        };

        this.conversations.push(conversation);
        
        // Only emit in browser environment
        if (typeof window !== 'undefined') {
            this.emitConversation(conversation);
        }
        
        return conversation;
    }

    getAllConversations() {
        return this.conversations;
    }

    getConversationsBySession(sessionId) {
        return this.conversations.filter(conv => conv.sessionId === sessionId);
    }

    getRecentConversations(limit = 10) {
        return this.conversations
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }

    clearConversations() {
        this.conversations = [];
        console.log('Conversations cleared');
    }

    getStats() {
        return {
            totalConversations: this.conversations.length,
            sessionId: this.sessionId,
            isTracking: this.isTracking,
            startTime: this.startTime,
            sessionDuration: Date.now() - this.startTime
        };
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ConversationTracker };
} else if (typeof window !== 'undefined') {
    window.ConversationTracker = ConversationTracker;
}

// Auto-initialize if in browser only
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.conversationTracker = new ConversationTracker();
    window.conversationTracker.startTracking();
    
    // Capture this conversation
    window.conversationTracker.captureConversation(
        "User asked to fix conversation tracking system to ensure conversations are properly captured. This is a test of the conversation tracking functionality.",
        'user',
        { source: 'cursor_chat', test: true }
    );
}
