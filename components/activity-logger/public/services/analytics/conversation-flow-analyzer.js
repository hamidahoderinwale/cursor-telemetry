/**
 * Conversation Flow Analyzer
 * Analyzes conversation patterns, thread structures, and flow characteristics
 */

class ConversationFlowAnalyzer {
  constructor() {
    this.analyticsCache = new Map();
    this.abandonmentThreshold = 30 * 60 * 1000; // 30 minutes of inactivity
  }

  /**
   * Analyze conversation flow for all conversations in the map
   * @param {Map} conversationMap - Map of conversationId -> conversation object
   * @returns {Object} Analytics object with metrics per conversation
   */
  analyzeConversationFlow(conversationMap) {
    if (!conversationMap || conversationMap.size === 0) {
      return {};
    }

    const analytics = {};
    const conversationTree = this.buildConversationTree(conversationMap);

    // Analyze each conversation
    conversationMap.forEach((conversation, conversationId) => {
      const analysis = this.analyzeConversation(conversation, conversationTree, conversationMap);
      // Use multiple keys to ensure we can find analytics by different IDs
      const threadId = conversation.thread?.composerId || conversation.thread?.conversationId || conversationId;
      analytics[conversationId] = analysis;
      if (threadId !== conversationId) {
        analytics[threadId] = analysis; // Also store by thread ID
      }
    });

    return analytics;
  }

  /**
   * Analyze a single conversation
   */
  analyzeConversation(conversation, conversationTree, conversationMap) {
    const { thread, messages } = conversation;
    const sortedMessages = [...messages].sort((a, b) => (a.sortTime || 0) - (b.sortTime || 0));

    // Basic metrics
    const messageCount = messages.length;
    const userMessages = messages.filter(m => m.messageRole === 'user' || !m.messageRole).length;
    const assistantMessages = messages.filter(m => m.messageRole === 'assistant').length;
    const messageRatio = userMessages > 0 ? (assistantMessages / userMessages).toFixed(2) : 0;

    // Pattern detection
    const turnPattern = this.detectTurnPattern(sortedMessages);
    const conversationType = this.determineConversationType(conversation, conversationTree);
    
    // Response time analysis
    const responseTime = this.calculateResponseTime(sortedMessages);
    
    // Conversation health
    const health = this.assessConversationHealth(conversation, sortedMessages);
    
    // Thread relationships
    const relationships = this.analyzeRelationships(conversation, conversationTree, conversationMap);
    
    // Depth calculation
    const depth = this.calculateDepth(conversation, conversationTree);

    return {
      messageCount,
      userMessages,
      assistantMessages,
      messageRatio: parseFloat(messageRatio),
      turnPattern,
      conversationType,
      responseTime,
      health,
      relationships,
      depth,
      hasBranching: relationships.childCount > 0,
      isMultiThreaded: relationships.siblingCount > 0
    };
  }

  /**
   * Detect turn-taking pattern in messages
   */
  detectTurnPattern(messages) {
    if (messages.length < 2) return 'single';
    
    const roles = messages.map(m => m.messageRole || 'user');
    let alternations = 0;
    let clusters = 0;
    let currentCluster = 1;
    
    for (let i = 1; i < roles.length; i++) {
      if (roles[i] !== roles[i - 1]) {
        alternations++;
        if (currentCluster > 1) clusters++;
        currentCluster = 1;
      } else {
        currentCluster++;
      }
    }
    if (currentCluster > 1) clusters++;
    
    const totalTransitions = roles.length - 1;
    const alternationRatio = alternations / totalTransitions;
    
    if (alternationRatio > 0.8) return 'alternating';
    if (clusters > 0) return 'clustered';
    return 'mixed';
  }

  /**
   * Determine conversation type based on structure
   */
  determineConversationType(conversation, conversationTree) {
    const relationships = conversationTree.get(conversation.thread?.composerId || conversation.timestamp);
    
    if (!relationships) return 'linear';
    
    if (relationships.children && relationships.children.length > 1) {
      return 'multi-threaded';
    }
    if (relationships.children && relationships.children.length === 1) {
      return 'branched';
    }
    if (relationships.depth > 2) {
      return 'deep';
    }
    return 'linear';
  }

  /**
   * Calculate average response time between messages
   */
  calculateResponseTime(messages) {
    if (messages.length < 2) return null;
    
    const sorted = [...messages].sort((a, b) => (a.sortTime || 0) - (b.sortTime || 0));
    const times = [];
    
    for (let i = 1; i < sorted.length; i++) {
      const prevTime = sorted[i - 1].sortTime || sorted[i - 1].timestamp;
      const currTime = sorted[i].sortTime || sorted[i].timestamp;
      
      if (prevTime && currTime) {
        const timeDiff = new Date(currTime).getTime() - new Date(prevTime).getTime();
        if (timeDiff > 0 && timeDiff < 3600000) { // Less than 1 hour
          times.push(timeDiff);
        }
      }
    }
    
    if (times.length === 0) return null;
    
    const avgMs = times.reduce((sum, t) => sum + t, 0) / times.length;
    return {
      average: avgMs,
      averageSeconds: (avgMs / 1000).toFixed(1),
      min: Math.min(...times),
      max: Math.max(...times)
    };
  }

  /**
   * Assess conversation health (completed, abandoned, ongoing)
   */
  assessConversationHealth(conversation, messages) {
    if (messages.length === 0) return { status: 'empty', confidence: 0 };
    
    const sorted = [...messages].sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0));
    const lastMessage = sorted[0];
    const lastMessageTime = new Date(lastMessage.sortTime || lastMessage.timestamp).getTime();
    const now = Date.now();
    const timeSinceLastMessage = now - lastMessageTime;
    
    // Check if conversation appears completed (ends with assistant message and no recent activity)
    const lastRole = lastMessage.messageRole || 'user';
    const isCompleted = lastRole === 'assistant' && timeSinceLastMessage > this.abandonmentThreshold;
    
    // Check if abandoned (no activity for threshold)
    const isAbandoned = timeSinceLastMessage > this.abandonmentThreshold;
    
    // Check if ongoing (recent activity)
    const isOngoing = timeSinceLastMessage < (5 * 60 * 1000); // Last 5 minutes
    
    let status = 'ongoing';
    let confidence = 0.5;
    
    if (isCompleted) {
      status = 'completed';
      confidence = 0.8;
    } else if (isAbandoned && !isOngoing) {
      status = 'abandoned';
      confidence = 0.7;
    } else if (isOngoing) {
      status = 'ongoing';
      confidence = 0.9;
    }
    
    return {
      status,
      confidence,
      lastActivity: lastMessageTime,
      timeSinceLastActivity: timeSinceLastMessage,
      timeSinceLastActivitySeconds: (timeSinceLastMessage / 1000).toFixed(0)
    };
  }

  /**
   * Analyze relationships (parent, children, siblings)
   */
  analyzeRelationships(conversation, conversationTree, conversationMap) {
    const conversationId = conversation.thread?.composerId || 
                          conversation.thread?.conversationId ||
                          conversation.timestamp;
    
    const treeNode = conversationTree.get(conversationId);
    
    if (!treeNode) {
      return {
        parentConversationId: null,
        parentConversation: null,
        childCount: 0,
        children: [],
        siblingCount: 0,
        siblings: [],
        depth: 0
      };
    }
    
    // Find parent conversation
    let parentConversation = null;
    if (treeNode.parentId) {
      for (const [id, conv] of conversationMap.entries()) {
        const convId = conv.thread?.composerId || conv.thread?.conversationId || conv.timestamp;
        if (convId === treeNode.parentId) {
          parentConversation = conv;
          break;
        }
      }
    }
    
    // Find sibling conversations
    const siblings = [];
    if (treeNode.parentId) {
      const parentNode = conversationTree.get(treeNode.parentId);
      if (parentNode && parentNode.children) {
        siblings.push(...parentNode.children.filter(c => c.id !== conversationId));
      }
    }
    
    return {
      parentConversationId: treeNode.parentId || null,
      parentConversation: parentConversation,
      childCount: treeNode.children ? treeNode.children.length : 0,
      children: treeNode.children || [],
      siblingCount: siblings.length,
      siblings: siblings,
      depth: treeNode.depth || 0
    };
  }

  /**
   * Calculate conversation depth in the tree
   */
  calculateDepth(conversation, conversationTree) {
    const conversationId = conversation.thread?.composerId || 
                          conversation.thread?.conversationId ||
                          conversation.timestamp;
    
    const treeNode = conversationTree.get(conversationId);
    return treeNode ? (treeNode.depth || 0) : 0;
  }

  /**
   * Build conversation tree structure
   */
  buildConversationTree(conversationMap) {
    const tree = new Map();
    const rootNodes = [];
    
    // First pass: create all nodes
    conversationMap.forEach((conversation, conversationId) => {
      const id = conversation.thread?.composerId || 
                conversation.thread?.conversationId ||
                conversation.timestamp;
      
      const parentId = conversation.thread?.parentConversationId ||
                      conversation.messages?.[0]?.parentConversationId ||
                      null;
      
      tree.set(id, {
        id,
        conversationId,
        parentId,
        children: [],
        depth: 0,
        conversation
      });
    });
    
    // Second pass: build parent-child relationships and calculate depth
    tree.forEach((node, id) => {
      if (node.parentId && tree.has(node.parentId)) {
        const parent = tree.get(node.parentId);
        parent.children.push(node);
      } else {
        rootNodes.push(node);
      }
    });
    
    // Third pass: calculate depth recursively
    const calculateDepth = (node, currentDepth = 0) => {
      node.depth = currentDepth;
      node.children.forEach(child => {
        calculateDepth(child, currentDepth + 1);
      });
    };
    
    rootNodes.forEach(root => calculateDepth(root, 0));
    
    return tree;
  }

  /**
   * Get flow pattern badge class
   */
  getPatternBadgeClass(pattern) {
    const map = {
      'alternating': 'timeline-badge-success',
      'clustered': 'timeline-badge-warning',
      'mixed': 'timeline-badge-muted',
      'single': 'timeline-badge-muted'
    };
    return map[pattern] || 'timeline-badge-muted';
  }

  /**
   * Get conversation type badge class
   */
  getTypeBadgeClass(type) {
    const map = {
      'linear': 'timeline-badge-success',
      'branched': 'timeline-badge-accent',
      'multi-threaded': 'timeline-badge-warning',
      'deep': 'timeline-badge-primary'
    };
    return map[type] || 'timeline-badge-muted';
  }

  /**
   * Get health status badge class
   */
  getHealthBadgeClass(status) {
    const map = {
      'completed': 'timeline-badge-success',
      'abandoned': 'timeline-badge-error',
      'ongoing': 'timeline-badge-primary',
      'empty': 'timeline-badge-muted'
    };
    return map[status] || 'timeline-badge-muted';
  }
}

// Export to window for global access
window.ConversationFlowAnalyzer = ConversationFlowAnalyzer;

