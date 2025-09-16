#!/usr/bin/env node

// Test script to verify end-to-end data flow
const fetch = require('node-fetch');

const COMPANION_URL = 'http://127.0.0.1:43917';
const SPA_URL = 'http://localhost:8000';

async function testEndToEnd() {
    console.log('🧪 Testing end-to-end data flow...\n');
    
    // Step 1: Check companion service health
    console.log('1. Checking companion service health...');
    try {
        const healthResponse = await fetch(`${COMPANION_URL}/health`);
        const health = await healthResponse.json();
        console.log(`   ✅ Companion service: ${health.status}`);
        console.log(`   📊 Current entries: ${health.entries}, events: ${health.events}`);
    } catch (error) {
        console.log(`   ❌ Companion service error: ${error.message}`);
        return;
    }
    
    // Step 2: Add a test entry via MCP
    console.log('\n2. Adding test entry via MCP...');
    try {
        const mcpResponse = await fetch(`${COMPANION_URL}/mcp/log-prompt-response`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: 'test-session-' + Date.now(),
                file_path: 'test-end-to-end.js',
                prompt: 'Test prompt for end-to-end verification',
                response: 'Test response for end-to-end verification'
            })
        });
        const mcpResult = await mcpResponse.json();
        console.log(`   ✅ MCP entry added: ${mcpResult.entry_id}`);
    } catch (error) {
        console.log(`   ❌ MCP error: ${error.message}`);
        return;
    }
    
    // Step 3: Check queue
    console.log('\n3. Checking queue...');
    try {
        const queueResponse = await fetch(`${COMPANION_URL}/queue`);
        const queue = await queueResponse.json();
        console.log(`   📥 Queue entries: ${queue.entries.length}, events: ${queue.events.length}`);
        if (queue.entries.length > 0) {
            console.log(`   📝 Sample entry:`, {
                id: queue.entries[0].id,
                source: queue.entries[0].source,
                file_path: queue.entries[0].file_path
            });
        }
    } catch (error) {
        console.log(`   ❌ Queue error: ${error.message}`);
        return;
    }
    
    // Step 4: Check SPA status
    console.log('\n4. Checking SPA status...');
    try {
        const spaResponse = await fetch(`${SPA_URL}`);
        if (spaResponse.ok) {
            console.log(`   ✅ SPA is accessible`);
        } else {
            console.log(`   ❌ SPA error: ${spaResponse.status}`);
        }
    } catch (error) {
        console.log(`   ❌ SPA error: ${error.message}`);
        return;
    }
    
    // Step 5: Wait and check if data was acknowledged
    console.log('\n5. Waiting for SPA to process data...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    try {
        const healthResponse2 = await fetch(`${COMPANION_URL}/health`);
        const health2 = await healthResponse2.json();
        console.log(`   📊 After processing - entries: ${health2.entries}, events: ${health2.events}`);
        
        if (health2.entries === 0 && health2.events === 0) {
            console.log(`   ✅ Data was acknowledged by SPA`);
        } else {
            console.log(`   ⚠️ Data still in companion service`);
        }
    } catch (error) {
        console.log(`   ❌ Health check error: ${error.message}`);
    }
    
    console.log('\n🎯 End-to-end test complete!');
    console.log('\n📋 Next steps:');
    console.log('   1. Open http://localhost:8000 in your browser');
    console.log('   2. Check the browser console for any errors');
    console.log('   3. Look for the test entry in the activity feed');
    console.log('   4. If no entry appears, check IndexedDB in browser dev tools');
}

testEndToEnd().catch(console.error);
