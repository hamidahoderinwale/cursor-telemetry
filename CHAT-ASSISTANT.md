# 🧠 AI Chat Assistant with Reasoning Engine

An intelligent development assistant powered by Qwen 2.5 that analyzes your coding patterns and provides actionable insights.

## ✨ Features

### **Chat Widget**
- **Expandable UI** - Bottom-right corner widget that expands to full chat interface
- **Elegant Design** - Modern, responsive design with smooth animations
- **Quick Suggestions** - Pre-built questions to get started quickly
- **Real-time Typing** - Auto-resizing input with character count
- **Message History** - Persistent conversation history

### **Reasoning Engine**
- **Temporal Analysis** - Automatically detects time references (today, this week, last month)
- **Multi-Modal Data Aggregation** - Combines events, prompts, files, and sessions
- **Pattern Recognition** - Identifies productivity patterns and trends
- **Evidence-Based Answers** - All responses backed by actual telemetry data
- **Confidence Scoring** - Shows how confident the AI is in its response

### **Intelligent Query Processing**
- Understands natural language queries
- Extracts temporal context automatically
- Aggregates relevant data from multiple sources
- Generates human-readable insights
- Provides actionable recommendations

## 🚀 Usage

### **Setup**

1. **Add API Key** (optional - works without it too!)
   ```bash
   export OPENROUTER_API_KEY="your-key-here"
   ```
   
2. **Start the companion service**
   ```bash
   cd cursor-telemetry/components/activity-logger/companion
   npm start
   ```

3. **Open the dashboard**
   ```
   http://localhost:43917/new-dashboard.html
   ```

4. **Click the chat button** in the bottom-right corner!

### **Example Queries**

Try asking:
- "What did I work on today?"
- "Show me my productivity patterns this week"
- "Which files have I modified the most?"
- "Analyze my AI usage patterns"
- "How productive was I yesterday?"
- "What are my coding habits?"

## 🏗️ Architecture

### **Frontend** (`chat-widget.js`)
- Chat UI management
- Message rendering
- API communication
- User interaction handling

### **Backend** (`reasoning-engine.js`)
- **Temporal Query Processor** - Extracts time context from queries
- **Data Aggregator** - Combines telemetry from multiple sources
- **Statistics Calculator** - Computes productivity metrics
- **Response Generator** - Creates intelligent responses

### **API Endpoint** (`/api/chat/query`)
```javascript
POST /api/chat/query
{
  "query": "What did I work on today?"
}

Response:
{
  "answer": "...",
  "reasoning": "...",
  "confidence": 0.9,
  "sources": {...},
  "temporalContext": {...}
}
```

## 🔧 How It Works

1. **Query Processing**
   - User types a question
   - Frontend sends to `/api/chat/query`
   - Backend parses query for temporal context

2. **Data Aggregation**
   - Filters events by time range
   - Calculates statistics
   - Identifies top files
   - Extracts AI usage patterns

3. **Response Generation**
   - **With API Key**: Uses Qwen 2.5 model via OpenRouter
   - **Without API Key**: Falls back to rule-based analysis
   - Formats response in friendly, conversational tone

4. **Display**
   - Shows response in chat bubble
   - Displays confidence score
   - Provides data sources

## 🎓 Qwen 2.5 Integration

The system uses **Qwen 2.5 7B Instruct** model via OpenRouter:

### **Model Selection**
```javascript
modelName: 'qwen/qwen-2.5-7b-instruct'
```

### **Prompt Engineering**
```javascript
System: "You are an AI assistant that helps developers understand their coding patterns..."

User: "[Context with stats and metrics] Based on this data, please answer: [query]"
```

### **Parameters**
- **Temperature**: 0.7 (balanced creativity/accuracy)
- **Max Tokens**: 500 (concise responses)
- **Format**: Conversational and actionable

## 📊 Data Sources

The reasoning engine analyzes:
- **Events** - File changes, modifications
- **Prompts** - AI interactions from Cursor
- **Sessions** - Development sessions
- **Files** - Code files and modifications
- **Time Series** - Activity over time
- **Productivity Metrics** - Calculated statistics

## 🔄 Fallback Mode

When API key is not available, the system uses **rule-based analysis**:
- Pattern matching on common queries
- Statistical analysis of telemetry data
- Pre-defined response templates
- Confidence score: 0.6 (vs 0.9 with AI)

## 🎨 UI/UX Features

- **Smooth Animations** - Slide-in transitions and fade effects
- **Responsive Design** - Works on mobile and desktop
- **Keyboard Shortcuts** - Coming soon (Cmd+/ to open)
- **Thinking Indicator** - Shows when processing
- **Character Limit** - Visual feedback at 400/450 chars
- **Auto-scroll** - Always shows latest message
- **Status Indicator** - Green dot shows connection status

## 🚧 Future Enhancements

- [ ] WebSocket for streaming responses
- [ ] Conversation history persistence
- [ ] Multi-turn conversations with context
- [ ] Voice input/output
- [ ] Code snippet suggestions
- [ ] Proactive insights
- [ ] Custom training on user data
- [ ] Export conversations
- [ ] Keyboard shortcuts
- [ ] Mobile-optimized view

## 🐛 Troubleshooting

**Chat not showing?**
- Check that `chat-widget.html` and `chat-widget.js` are in the `public/` folder
- Verify the companion service is running on port 43917

**No responses?**
- Check the browser console for errors
- Verify `/api/chat/query` endpoint is accessible
- Check companion service logs

**API errors?**
- Verify `OPENROUTER_API_KEY` is set correctly
- Check OpenRouter account has credits
- System falls back to rule-based responses automatically

## 📝 Example Conversation

```
User: What did I work on today?
