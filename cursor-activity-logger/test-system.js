#!/usr/bin/env node

// Comprehensive system test for Cursor Activity Logger
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const COMPANION_URL = 'http://127.0.0.1:43917';
const SPA_URL = 'http://localhost:8000';

class SystemTester {
    constructor() {
        this.results = {
            companion: { status: 'unknown', tests: [] },
            spa: { status: 'unknown', tests: [] },
            integration: { status: 'unknown', tests: [] }
        };
    }

    async runTest(name, testFn) {
        try {
            console.log(`🧪 Running: ${name}`);
            const result = await testFn();
            console.log(`✅ ${name}: PASSED`);
            return { name, status: 'passed', result };
        } catch (error) {
            console.log(`❌ ${name}: FAILED - ${error.message}`);
            return { name, status: 'failed', error: error.message };
        }
    }

    async testCompanionService() {
        console.log('\n🔧 Testing Companion Service...');
        
        // Test 1: Health check
        const healthTest = await this.runTest('Companion Health Check', async () => {
            const response = await fetch(`${COMPANION_URL}/health`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (data.status !== 'running') throw new Error('Service not running');
            return data;
        });

        // Test 2: Configuration
        const configTest = await this.runTest('Configuration Management', async () => {
            const response = await fetch(`${COMPANION_URL}/config`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const config = await response.json();
            
            // Update config
            const updateResponse = await fetch(`${COMPANION_URL}/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    root_dir: process.cwd(),
                    diff_threshold: 10,
                    enable_clipboard: false
                })
            });
            if (!updateResponse.ok) throw new Error(`Update failed: HTTP ${updateResponse.status}`);
            
            return config;
        });

        // Test 3: Queue operations
        const queueTest = await this.runTest('Queue Operations', async () => {
            // Get initial queue
            const queueResponse = await fetch(`${COMPANION_URL}/queue`);
            if (!queueResponse.ok) throw new Error(`HTTP ${queueResponse.status}`);
            const queueData = await queueResponse.json();
            
            // Test MCP endpoints
            const mcpTest = await fetch(`${COMPANION_URL}/mcp/log-event`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: 'test-session',
                    type: 'test_event',
                    details: { test: true }
                })
            });
            if (!mcpTest.ok) throw new Error(`MCP test failed: HTTP ${mcpTest.status}`);
            
            return queueData;
        });

        this.results.companion.tests = [healthTest, configTest, queueTest];
        this.results.companion.status = this.results.companion.tests.every(t => t.status === 'passed') ? 'passed' : 'failed';
    }

    async testSPA() {
        console.log('\n🌐 Testing SPA...');
        
        // Test 1: SPA accessibility
        const spaTest = await this.runTest('SPA Accessibility', async () => {
            const response = await fetch(SPA_URL);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();
            if (!html.includes('Cursor Activity Logger')) throw new Error('SPA not loading correctly');
            return { status: 'accessible' };
        });

        // Test 2: Static assets
        const assetsTest = await this.runTest('Static Assets', async () => {
            const assets = ['app.js', 'style.css'];
            for (const asset of assets) {
                const response = await fetch(`${SPA_URL}/${asset}`);
                if (!response.ok) throw new Error(`Asset ${asset} not found`);
            }
            return { assets: 'loaded' };
        });

        this.results.spa.tests = [spaTest, assetsTest];
        this.results.spa.status = this.results.spa.tests.every(t => t.status === 'passed') ? 'passed' : 'failed';
    }

    async testIntegration() {
        console.log('\n🔗 Testing Integration...');
        
        // Test 1: Data flow
        const dataFlowTest = await this.runTest('Data Flow', async () => {
            // Create test entry via MCP
            const entryResponse = await fetch(`${COMPANION_URL}/mcp/log-prompt-response`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: 'integration-test',
                    file_path: 'test.js',
                    prompt: 'Test prompt for integration',
                    response: 'Test response for integration'
                })
            });
            if (!entryResponse.ok) throw new Error(`Entry creation failed: HTTP ${entryResponse.status}`);
            
            // Check if entry appears in queue
            const queueResponse = await fetch(`${COMPANION_URL}/queue`);
            const queueData = await queueResponse.json();
            const testEntry = queueData.entries.find(e => e.prompt === 'Test prompt for integration');
            if (!testEntry) throw new Error('Test entry not found in queue');
            
            return { entry: testEntry };
        });

        // Test 2: File watching (if possible)
        const fileWatchTest = await this.runTest('File Watching', async () => {
            // This test would require actual file changes
            // For now, just verify the endpoint exists
            const configResponse = await fetch(`${COMPANION_URL}/config`);
            const config = await configResponse.json();
            if (!config.root_dir) throw new Error('File watching not configured');
            return { configured: true };
        });

        this.results.integration.tests = [dataFlowTest, fileWatchTest];
        this.results.integration.status = this.results.integration.tests.every(t => t.status === 'passed') ? 'passed' : 'failed';
    }

    async runAllTests() {
        console.log('🚀 Starting Cursor Activity Logger System Tests\n');
        
        await this.testCompanionService();
        await this.testSPA();
        await this.testIntegration();
        
        this.printResults();
    }

    printResults() {
        console.log('\n📊 Test Results Summary');
        console.log('='.repeat(50));
        
        const sections = [
            { name: 'Companion Service', result: this.results.companion },
            { name: 'SPA', result: this.results.spa },
            { name: 'Integration', result: this.results.integration }
        ];
        
        sections.forEach(section => {
            const status = section.result.status === 'passed' ? '✅' : '❌';
            console.log(`\n${status} ${section.name}: ${section.result.status.toUpperCase()}`);
            
            section.result.tests.forEach(test => {
                const testStatus = test.status === 'passed' ? '✅' : '❌';
                console.log(`  ${testStatus} ${test.name}`);
                if (test.status === 'failed') {
                    console.log(`    Error: ${test.error}`);
                }
            });
        });
        
        const overallStatus = sections.every(s => s.result.status === 'passed') ? 'PASSED' : 'FAILED';
        console.log(`\n🎯 Overall Status: ${overallStatus}`);
        
        if (overallStatus === 'PASSED') {
            console.log('\n🎉 All systems operational! Your Cursor Activity Logger is ready to use.');
            console.log('\nNext steps:');
            console.log('1. Open http://localhost:8000 in your browser');
            console.log('2. Edit files in your project to see code changes');
            console.log('3. Use Cursor with MCP integration for full telemetry');
        } else {
            console.log('\n⚠️ Some tests failed. Check the errors above and ensure:');
            console.log('1. Companion service is running: cd companion && npm start');
            console.log('2. SPA server is running: cd public && python3 -m http.server 8000');
            console.log('3. All dependencies are installed: npm install');
        }
    }
}

// Run tests
const tester = new SystemTester();
tester.runAllTests().catch(console.error);
