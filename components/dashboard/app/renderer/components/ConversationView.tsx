/**
 * ConversationView - React component for displaying and managing conversations
 */

import React, { useState, useEffect } from 'react';
import './ConversationView.css';

interface ConversationTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  turn_index: number;
  model_name?: string;
  model_provider?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  request_duration_ms?: number;
  time_to_first_token_ms?: number;
  thinking_time?: number;
  thinking_time_seconds?: number;
  streaming?: boolean;
  context_files?: string[];
  referenced_files?: string[];
  code_blocks?: Array<{ language: string; code: string; file?: string }>;
  created_at: string;
}

interface Conversation {
  id: string;
  workspace_id: string;
  workspace_path?: string;
  title?: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_message_at?: string;
  message_count: number;
  turns?: ConversationTurn[];
}

interface ConversationViewProps {
  workspaceId: string;
  onClose?: () => void;
}

export const ConversationView: React.FC<ConversationViewProps> = ({
  workspaceId,
  onClose
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadConversations();
  }, [workspaceId]);

  useEffect(() => {
    if (selectedConversation) {
      loadConversationDetails(selectedConversation.id);
      loadConversationStats(selectedConversation.id);
    }
  }, [selectedConversation]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:43917/api/conversations?workspaceId=${workspaceId}`);
      const data = await response.json();
      
      if (data.success) {
        setConversations(data.data || []);
      } else {
        setError(data.error || 'Failed to load conversations');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const loadConversationDetails = async (conversationId: string) => {
    try {
      const response = await fetch(`http://localhost:43917/api/conversations/${conversationId}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setSelectedConversation(data.data);
      }
    } catch (err) {
      console.error('Failed to load conversation details:', err);
    }
  };

  const loadConversationStats = async (conversationId: string) => {
    try {
      const response = await fetch(`http://localhost:43917/api/conversations/${conversationId}/stats`);
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Failed to load conversation stats:', err);
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const renderCodeBlock = (block: { language: string; code: string; file?: string }) => {
    return (
      <div key={`${block.language}-${block.code.substring(0, 20)}`} className="code-block">
        {block.file && <div className="code-block-file">{block.file}</div>}
        <pre><code className={`language-${block.language}`}>{block.code}</code></pre>
      </div>
    );
  };

  const renderTurn = (turn: ConversationTurn) => {
    const isUser = turn.role === 'user';
    
    return (
      <div key={turn.id} className={`conversation-turn ${turn.role}`}>
        <div className="turn-header">
          <span className="turn-role">{isUser ? 'User' : 'Assistant'}</span>
          <span className="turn-time">{formatDate(turn.created_at)}</span>
          {!isUser && turn.model_name && (
            <span className="turn-model">{turn.model_name}</span>
          )}
        </div>
        
        <div className="turn-content">
          <div className="turn-text">{turn.content}</div>
          
          {turn.code_blocks && turn.code_blocks.length > 0 && (
            <div className="turn-code-blocks">
              {turn.code_blocks.map((block, idx) => renderCodeBlock(block))}
            </div>
          )}
          
          {!isUser && (
            <div className="turn-metadata">
              {turn.request_duration_ms && (
                <span className="metadata-item">
                  Duration: {formatDuration(turn.request_duration_ms)}
                </span>
              )}
              {turn.time_to_first_token_ms && (
                <span className="metadata-item">
                  Time to first token: {formatDuration(turn.time_to_first_token_ms)}
                </span>
              )}
              {turn.thinking_time_seconds && turn.thinking_time_seconds > 0 && (
                <span className="metadata-item">
                  Thinking time: {turn.thinking_time_seconds.toFixed(2)}s
                </span>
              )}
              {turn.total_tokens && (
                <span className="metadata-item">
                  Tokens: {turn.total_tokens} ({turn.prompt_tokens || 0} prompt + {turn.completion_tokens || 0} completion)
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading && conversations.length === 0) {
    return (
      <div className="conversation-view">
        <div className="loading">Loading conversations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="conversation-view">
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="conversation-view">
      <div className="conversation-sidebar">
        <div className="sidebar-header">
          <h2>Conversations</h2>
          {onClose && (
            <button className="close-button" onClick={onClose}>×</button>
          )}
        </div>
        
        <div className="conversation-list">
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={`conversation-item ${selectedConversation?.id === conv.id ? 'selected' : ''}`}
              onClick={() => setSelectedConversation(conv)}
            >
              <div className="conversation-item-title">{conv.title || `Conversation ${conv.id.substring(0, 8)}`}</div>
              <div className="conversation-item-meta">
                <span>{conv.message_count} messages</span>
                <span>{formatDate(conv.last_message_at || conv.updated_at)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="conversation-main">
        {selectedConversation ? (
          <>
            <div className="conversation-header">
              <h3>{selectedConversation.title || `Conversation ${selectedConversation.id.substring(0, 8)}`}</h3>
              {stats && (
                <div className="conversation-stats">
                  <span>Total tokens: {stats.totalTokens}</span>
                  <span>Avg response: {formatDuration(stats.avgResponseTime)}</span>
                  <span>Avg TTF: {formatDuration(stats.avgTimeToFirstToken)}</span>
                  {stats.avgThinkingTime > 0 && (
                    <span>Avg thinking: {stats.avgThinkingTime.toFixed(2)}s</span>
                  )}
                </div>
              )}
            </div>
            
            <div className="conversation-turns">
              {selectedConversation.turns?.map(turn => renderTurn(turn))}
            </div>
          </>
        ) : (
          <div className="no-selection">
            <p>Select a conversation to view details</p>
          </div>
        )}
      </div>
    </div>
  );
};

