# 🧠 Intelligent Chat Widget with Temporal Reasoning

An AI-powered chat assistant that understands your coding patterns and provides personalized insights based on your telemetry data.

![Chat Widget Preview](./screenshots/chat-widget.png)

## 🎯 Features

### Core Capabilities

1. **Temporal Query Understanding**
   - Natural language time references ("today", "this week", "last month")
   - Automatic time range extraction and context building
   - Historical pattern analysis

2. **Multi-Modal Data Analysis**
   - File change analysis
   - AI usage patterns
   - Productivity metrics
   - Session detection and analysis

3. **Reasoning Engine**
   - Built-in heuristic reasoning
   - Ollama/Qwen integration for local LLMs
   - OpenAI API support (extensible)
   - Anthropic Claude API support (extensible)

4. **Proactive Insights**
   - Automatic pattern detection
   - Productivity suggestions
   - Break reminders
   - Learning opportunities

5. **Interactive UI**
   - Expandable bottom-right widget
   - Real-time typing indicators
   - Reasoning process visualization
   - Quick action buttons
   - Suggestion chips

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│              Chat Widget (Frontend)              │
│  ┌─────────────┐  ┌────────────────────────┐   │
│  │ UI Component│  │  Reasoning Engine      │   │
│  │  - Messages │  │  - Query Processing    │   │
│  │  - Input    │  │  - Time Extraction     │   │
│  │  - Actions  │  │  - Data Aggregation    │   │
│  └─────────────┘  └────────────────────────┘   │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│          Reasoning Server (Backend)              │
│  ┌─────────────┐  ┌────────────────────────┐   │
│  │ Strategy    │  │  Model Integration     │   │
│  │ Selection   │  │  - Built-in            │   │
│  │             │  │  - Ollama (Qwen)       │   │
│  │             │  │  - OpenAI              │   │
│  │             │  │  - Anthropic           │   │
│  └─────────────┘  └────────────────────────┘   │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│       Companion Service (Data Layer)             │
│  - File events      - AI prompts                 │
│  - System metrics   - Git data                   │
│  - IDE state        - Workspaces                 │
└─────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### 1. Basic Setup (Built-in Reasoning)

The widget works out-of-the-box with built-in heuristic reasoning:

```bash
# Just include in your dashboard
<script src="chat-widget.js"></script>
```

The widget will automatically connect to your companion service on `http://localhost:43917`.

### 2. Advanced Setup (Ollama + Qwen)

For AI-powered reasoning with Qwen:

#### Install Ollama
```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh
```

#### Pull Qwen Model
```bash
# Qwen 2 7B (recommended)
ollama pull qwen2:7b

# Or Qwen 2 1.5B (faster, lower memory)
ollama pull qwen2:1.5b
```

#### Start Reasoning Server
```bash
cd cursor-telemetry/components/activity-logger/companion
MODEL_TYPE=ollama npm run reasoning-server
```

#### Update Widget Configuration
```javascript
// In chat-widget.js
this.apiBase = 'http://localhost:43917'; // Companion service
this.reasoningBase = 'http://localhost:3001'; // Reasoning server
```

### 3. OpenAI Setup (Optional)

```bash
export OPENAI_API_KEY="your-key"
export MODEL_TYPE=openai
npm run reasoning-server
```

### 4. Anthropic Setup (Optional)

```bash
export ANTHROPIC_API_KEY="your-key"
export MODEL_TYPE=anthropic
npm run reasoning-server
```

## 💬 Usage Examples

### Query Types

#### 1. Productivity Analysis
```
User: "How productive was I today?"
Assistant: 
**Productivity Analysis for today**

You've been highly productive with:
• 847 lines of code changed
• 23 files modified
• 15 AI interactions
• 3 coding sessions

💡 Great work! You're in a productive flow...
```

#### 2. File Analysis
```
User: "What files did I work on this week?"
Assistant:
**Most Active Files This Week**

1. **dashboard.js**
   • 45 modifications
   • 1,203 lines changed

2. **chat-widget.js**
   • 23 modifications
   • 567 lines changed
...
```

#### 3. AI Usage Patterns
```
User: "Show my AI usage patterns"
Assistant:
**AI Usage Patterns Today**

Total Interactions: 15
Average Context: 68.3%

**By Interface:**
• agent: 8 (53%)
• chat: 5 (33%)
• edit: 2 (13%)
```

#### 4. Session Analysis
```
User: "Analyze my coding sessions today"
Assistant:
**Coding Sessions Today**

• 3 sessions detected
• Total time: 5h 34m
• Average session: 1h 51m

💡 Your longest session was 2h 45m with 67 file changes.
```

### Natural Time References

The widget understands various time expressions:
- "today", "yesterday"
- "this week", "last week"
- "this month", "last month"
- "in the last 3 days"
- "since Monday"

## 🎨 UI Components

### Widget States

1. **Collapsed** - Floating button in bottom-right
2. **Expanded** - 420x600px chat interface
3. **With Notifications** - Badge showing unread insights

### Message Types

1. **User Messages**
   - Right-aligned
   - Gradient background
   - User avatar

2. **Assistant Messages**
   - Left-aligned
   - Dark surface background
   - Brain avatar (🧠)
   - Optional reasoning steps
   - Optional source chips

3. **Typing Indicator**
   - Animated dots
   - Shows during processing

### Quick Actions

Pre-defined queries for common tasks:
- 📊 Productivity today
- 📁 Most edited files
- 🤖 AI usage patterns
- ⏱️ Session analysis

## 🧠 Reasoning Strategies

The system uses different reasoning strategies based on query type:

### 1. Productivity Reasoning
- Analyzes file changes and AI interactions
- Calculates productivity level (low/moderate/high)
- Provides contextual insights and suggestions

### 2. File Analysis Reasoning
- Groups events by file
- Ranks by modification frequency
- Shows lines changed per file

### 3. AI Usage Reasoning
- Categorizes by interface (agent/chat/edit)
- Calculates average context usage
- Identifies usage patterns

### 4. Session Reasoning
- Detects sessions (events within 30min = one session)
- Calculates session durations
- Identifies longest/shortest sessions

### 5. Temporal Reasoning
- Analyzes patterns over time
- Identifies peak productivity hours
- Detects trends and anomalies

### 6. Pattern Reasoning
- Discovers recurring behaviors
- Suggests optimizations
- Highlights unusual activity

## 🔧 Configuration

### Environment Variables

```bash
# Model selection
MODEL_TYPE=builtin  # Options: builtin, ollama, openai, anthropic

# API keys (if using external models)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...

# Ports
COMPANION_PORT=43917
REASONING_PORT=3001
```

### Widget Options

```javascript
const chatWidget = new ChatWidget({
    apiBase: 'http://localhost:43917',
    reasoningBase: 'http://localhost:3001',
    enableProactiveInsights: true,
    notificationThreshold: 3,
    sessionTimeout: 30 * 60 * 1000 // 30 minutes
});
```

## 📊 Data Flow

### Query Processing Pipeline

1. **User Input** → Chat widget
2. **Time Extraction** → ReasoningEngine.extractTimeContext()
3. **Data Fetching** → Companion API (events, prompts, etc.)
4. **Context Enrichment** → Add statistics and patterns
5. **Strategy Selection** → Choose appropriate reasoning method
6. **Reasoning Steps** → Generate step-by-step analysis
7. **Answer Generation** → Format final response
8. **UI Rendering** → Display with reasoning and sources

### API Endpoints

#### Companion Service (Port 43917)
- `GET /api/activity` - File change events
- `GET /api/prompts` - AI interactions
- `GET /api/workspaces` - Workspace list
- `GET /raw-data/system-resources` - System metrics

#### Reasoning Server (Port 3001)
- `POST /api/reason` - Main reasoning endpoint
- `POST /api/classify` - Query classification
- `POST /api/insights` - Proactive insights
- `GET /health` - Server health check

## 🎓 Training Custom Models

### Fine-tuning Qwen for Your Data

```python
from transformers import Qwen2ForCausalLM, Qwen2Tokenizer
from datasets import Dataset

# 1. Prepare training data
training_data = []
for session in your_telemetry_data:
    training_data.append({
        'question': f"What was I working on during {session.time}?",
        'answer': generate_answer(session),
        'context': extract_context(session),
        'reasoning': generate_reasoning_steps(session)
    })

# 2. Format for Qwen
def format_example(example):
    return f"""<|im_start|>system
You are a development productivity assistant.
<|im_end|>
<|im_start|>user
{example['question']}
Context: {example['context']}
<|im_end|>
<|im_start|>assistant
{example['answer']}
Reasoning: {example['reasoning']}
<|im_end|>"""

# 3. Train model
trainer = QwenTrainer(model_name="Qwen/Qwen2-7B-Instruct")
dataset = trainer.prepare_dataset(training_data)
trainer.train(dataset, output_dir="./qwen-productivity")
```

### Using Fine-tuned Model

```bash
# Copy model to Ollama
ollama create my-productivity-model -f Modelfile

# Modelfile content:
# FROM ./qwen-productivity
# PARAMETER temperature 0.7
# PARAMETER top_p 0.9

# Use in reasoning server
MODEL_NAME=my-productivity-model npm run reasoning-server
```

## 🚧 Advanced Features

### 1. Proactive Insights

The widget can automatically notify you of important patterns:

```javascript
// Automatic insights based on activity
- "No activity in 2 hours - time for a break?"
- "High AI usage detected - you're problem-solving!"
- "Productivity spike - you're in the zone!"
```

### 2. Conversation History

Messages are stored locally for context:

```javascript
// Access conversation history
chatWidget.messages.forEach(msg => {
    console.log(`[${msg.role}]: ${msg.content}`);
});
```

### 3. Custom Reasoning Strategies

Add your own reasoning strategies:

```javascript
class CustomReasoning {
    async generateSteps(context) {
        // Your custom logic
        return [
            { step: 1, description: 'Custom analysis step 1' },
            { step: 2, description: 'Custom analysis step 2' }
        ];
    }
}

// Register strategy
reasoningEngine.registerStrategy('custom', CustomReasoning);
```

## 📈 Metrics & Analytics

The chat widget can track its own usage:

- Queries per day
- Most common query types
- Average response time
- User satisfaction ratings
- Reasoning confidence scores

## 🔒 Privacy & Security

- All data processing happens locally
- No telemetry sent to external servers (unless using OpenAI/Anthropic)
- Qwen via Ollama runs entirely on your machine
- Conversation history stored in browser localStorage

## 🤝 Contributing

Ideas for improvements:
1. Voice input support
2. Streaming responses
3. Multi-turn conversations with context
4. Integration with GitHub/GitLab
5. Team productivity comparisons
6. Exportable reports

## 📝 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Qwen by Alibaba Cloud
- Ollama for local LLM hosting
- Cursor IDE for inspiration

