/**
 * Chat Widget with Qwen Reasoning Integration
 * Provides intelligent development assistance using temporal analysis
 */

class ChatWidget {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.apiBase = 'http://localhost:43917';
        
        this.init();
    }
    
    init() {
        // Get DOM elements
        this.widget = document.getElementById('chatWidget');
        this.toggle = document.getElementById('chatToggle');
        this.minimize = document.querySelector('.chat-minimize');
        this.input = document.getElementById('chatInput');
        this.sendBtn = document.getElementById('chatSend');
        this.messagesContainer = document.getElementById('chatMessages');
        this.thinkingIndicator = document.getElementById('chatThinking');
        this.charCount = document.getElementById('chatCharCount');
        
        if (!this.widget) {
            console.warn('Chat widget elements not found');
            return;
        }
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('[SUCCESS] Chat widget initialized');
    }
    
    setupEventListeners() {
        // Toggle chat
        this.toggle?.addEventListener('click', () => this.toggleChat());
        this.minimize?.addEventListener('click', () => this.toggleChat());
        
        // Send message
        this.sendBtn?.addEventListener('click', () => this.sendMessage());
        
        // Enter to send (Shift+Enter for new line)
        this.input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Auto-resize textarea
        this.input?.addEventListener('input', () => {
            this.input.style.height = 'auto';
            this.input.style.height = this.input.scrollHeight + 'px';
            this.updateCharCount();
        });
        
        // Suggestion buttons
        document.querySelectorAll('.chat-suggestion').forEach(btn => {
            btn.addEventListener('click', () => {
                const query = btn.getAttribute('data-query');
                if (query) {
                    this.input.value = query;
                    this.sendMessage();
                }
            });
        });
    }
    
    toggleChat() {
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            this.widget.classList.remove('collapsed');
            setTimeout(() => {
                this.input?.focus();
            }, 300);
        } else {
            this.widget.classList.add('collapsed');
        }
    }
    
    updateCharCount() {
        if (this.charCount && this.input) {
            const count = this.input.value.length;
            this.charCount.textContent = count;
            
            if (count > 450) {
                this.charCount.style.color = '#ef4444';
            } else if (count > 400) {
                this.charCount.style.color = '#f59e0b';
            } else {
                this.charCount.style.color = '';
            }
        }
    }
    
    async sendMessage() {
        const query = this.input?.value.trim();
        if (!query) return;
        
        // Clear input
        this.input.value = '';
        this.input.style.height = 'auto';
        this.updateCharCount();
        
        // Add user message
        this.addMessage({
            role: 'user',
            content: query,
            timestamp: new Date()
        });
        
        // Show thinking indicator
        this.showThinking(true);
        
        // Disable input
        this.setInputEnabled(false);
        
        try {
            // Send query to reasoning endpoint
            const response = await this.queryReasoningEngine(query);
            
            // Add assistant message
            this.addMessage({
                role: 'assistant',
                content: response.answer,
                reasoning: response.reasoning,
                confidence: response.confidence,
                sources: response.sources,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error('Chat error:', error);
            this.addMessage({
                role: 'assistant',
                content: 'Sorry, I encountered an error processing your request. Please try again.',
                error: true,
                timestamp: new Date()
            });
        } finally {
            this.showThinking(false);
            this.setInputEnabled(true);
            this.input?.focus();
        }
    }
    
    async queryReasoningEngine(query) {
        // Call the reasoning API endpoint
        const response = await fetch(`${this.apiBase}/api/chat/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query })
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        return await response.json();
    }
    
    addMessage(message) {
        this.messages.push(message);
        
        // Remove welcome message if it exists
        const welcome = this.messagesContainer?.querySelector('.chat-welcome');
        if (welcome) {
            welcome.remove();
        }
        
        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${message.role}`;
        
        const timeStr = message.timestamp.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        if (message.role === 'user') {
            messageEl.innerHTML = `
                <div class="chat-message-avatar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                </div>
                <div class="chat-message-content">
                    <div class="chat-message-bubble">${this.escapeHtml(message.content)}</div>
                    <div class="chat-message-time">${timeStr}</div>
                </div>
            `;
        } else {
            const confidenceBadge = message.confidence 
                ? `<span style="font-size: 11px; background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">${Math.round(message.confidence * 100)}% confident</span>`
                : '';
            
            messageEl.innerHTML = `
                <div class="chat-message-avatar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 6v6l4 2" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/>
                    </svg>
                </div>
                <div class="chat-message-content">
                    <div class="chat-message-bubble">${this.formatMessage(message.content)}</div>
                    <div class="chat-message-time">${timeStr}${confidenceBadge}</div>
                </div>
            `;
        }
        
        this.messagesContainer?.appendChild(messageEl);
        
        // Scroll to bottom
        this.scrollToBottom();
    }
    
    formatMessage(content) {
        // Convert markdown-like formatting
        let formatted = this.escapeHtml(content);
        
        // Bold
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Italic
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Code blocks
        formatted = formatted.replace(/`(.*?)`/g, '<code style="background: rgba(0,0,0,0.05); padding: 2px 4px; border-radius: 3px; font-family: monospace; font-size: 12px;">$1</code>');
        
        // Line breaks
        formatted = formatted.replace(/\n/g, '<br>');
        
        return formatted;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showThinking(show) {
        if (this.thinkingIndicator) {
            this.thinkingIndicator.style.display = show ? 'flex' : 'none';
            if (show) {
                this.scrollToBottom();
            }
        }
    }
    
    setInputEnabled(enabled) {
        if (this.input) {
            this.input.disabled = !enabled;
        }
        if (this.sendBtn) {
            this.sendBtn.disabled = !enabled;
        }
    }
    
    scrollToBottom() {
        if (this.messagesContainer) {
            setTimeout(() => {
                this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
            }, 100);
        }
    }
}

// Initialize chat widget when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.chatWidget = new ChatWidget();
    });
} else {
    window.chatWidget = new ChatWidget();
}

