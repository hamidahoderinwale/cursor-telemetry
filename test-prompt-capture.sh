#!/bin/bash
# Test script for manual prompt capture API

API_URL="http://localhost:43917/api/prompts/manual"

echo "🧪 Testing Manual Prompt Capture API"
echo ""

# Test 1: Simple prompt
echo "Test 1: Simple user prompt"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Fix the export bug in the database",
    "conversationTitle": "Bug fixing session",
    "messageRole": "user"
  }' | python3 -m json.tool
echo ""
echo "---"
echo ""

# Test 2: Prompt with conversation thread
echo "Test 2: Threaded conversation message"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Can you add pagination to the export endpoint?",
    "conversationTitle": "Database optimization",
    "conversationId": "conv-12345",
    "messageRole": "user",
    "hasAttachments": false
  }' | python3 -m json.tool
echo ""
echo "---"
echo ""

# Test 3: Prompt with attachments
echo "Test 3: Prompt with attachments"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Review these files and suggest improvements",
    "conversationTitle": "Code review",
    "messageRole": "user",
    "attachments": ["index.js", "config.json"],
    "hasAttachments": true
  }' | python3 -m json.tool
echo ""
echo "---"
echo ""

# Test 4: AI response (simulated)
echo "Test 4: AI response message"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I'\''ve added pagination to the export endpoint. The changes are in index.js lines 2325-2373.",
    "conversationTitle": "Database optimization",
    "conversationId": "conv-12345",
    "messageRole": "assistant"
  }' | python3 -m json.tool
echo ""
echo "---"
echo ""

echo "✅ Test complete! Check dashboard: http://localhost:43917/new-dashboard.html"
echo "   Navigate to Activity view to see captured prompts"

