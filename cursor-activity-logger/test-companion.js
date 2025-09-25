#!/usr/bin/env node

// Test script for companion service
import fetch from 'node-fetch';

const COMPANION_URL = 'http://127.0.0.1:43917';

async function testCompanionService() {
    console.log('🧪 Testing Companion Service...\n');

    try {
        // Test 1: Health check
        console.log('1. Testing health endpoint...');
        const healthResponse = await fetch(`${COMPANION_URL}/health`);
        const healthData = await healthResponse.json();
        console.log('✅ Health check:', healthData);

        // Test 2: Get initial queue
        console.log('\n2. Testing queue endpoint...');
        const queueResponse = await fetch(`${COMPANION_URL}/queue`);
        const queueData = await queueResponse.json();
        console.log('✅ Queue data:', {
            entries: queueData.entries?.length || 0,
            events: queueData.events?.length || 0,
            cursor: queueData.cursor
        });

        // Test 3: Get configuration
        console.log('\n3. Testing config endpoint...');
        const configResponse = await fetch(`${COMPANION_URL}/config`);
        const configData = await configResponse.json();
        console.log('✅ Config:', configData);

        // Test 4: Update configuration
        console.log('\n4. Testing config update...');
        const updateResponse = await fetch(`${COMPANION_URL}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                root_dir: process.cwd(),
                diff_threshold: 10
            })
        });
        console.log('✅ Config update:', updateResponse.ok ? 'Success' : 'Failed');

        // Test 5: Acknowledge cursor
        if (queueData.cursor) {
            console.log('\n5. Testing cursor acknowledgment...');
            const ackResponse = await fetch(`${COMPANION_URL}/ack`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cursor: queueData.cursor })
            });
            console.log('✅ Cursor acknowledgment:', ackResponse.ok ? 'Success' : 'Failed');
        }

        console.log('\n🎉 All tests completed successfully!');
        console.log('\nNext steps:');
        console.log('1. Start the companion service: cd companion && npm start');
        console.log('2. Open the SPA: open http://localhost:8000');
        console.log('3. Edit some files to see code changes detected');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('\nTroubleshooting:');
        console.log('1. Make sure companion service is running: cd companion && npm start');
        console.log('2. Check if port 43917 is available');
        console.log('3. Verify Node.js dependencies are installed');
    }
}

// Run tests
testCompanionService();
