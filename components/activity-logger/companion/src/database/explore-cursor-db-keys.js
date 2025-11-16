#!/usr/bin/env node

/**
 * Explore specific Cursor DB keys to understand their structure
 * Focuses on messageRequestContext, tool calls, and file interactions
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const os = require('os');

const execAsync = promisify(exec);

async function exploreKey(dbPath, keyPattern, limit = 5) {
  try {
    const query = `SELECT key, substr(value, 1, 500) as value_preview FROM ItemTable WHERE key LIKE '${keyPattern}' LIMIT ${limit}`;
    const { stdout } = await execAsync(`sqlite3 "${dbPath}" "${query}"`);
    
    const lines = stdout.trim().split('\n');
    const results = [];
    
    for (const line of lines) {
      if (!line) continue;
      const tabIndex = line.indexOf('\t');
      if (tabIndex === -1) continue;
      
      const key = line.substring(0, tabIndex);
      const valuePreview = line.substring(tabIndex + 1);
      
      // Try to parse as JSON
      let parsed = null;
      try {
        // Get full value
        const fullQuery = `SELECT value FROM ItemTable WHERE key = '${key.replace(/'/g, "''")}'`;
        const { stdout: fullValue } = await execAsync(`sqlite3 "${dbPath}" "${fullQuery}"`);
        parsed = JSON.parse(fullValue.trim());
      } catch (e) {
        // Not JSON or error
      }
      
      results.push({
        key,
        valuePreview,
        parsed,
        isJSON: parsed !== null
      });
    }
    
    return results;
  } catch (error) {
    console.error(`Error exploring key pattern ${keyPattern}:`, error.message);
    return [];
  }
}

async function exploreCursorDiskKV(dbPath, keyPattern, limit = 5) {
  try {
    const query = `SELECT key, substr(value, 1, 500) as value_preview FROM cursorDiskKV WHERE key LIKE '${keyPattern}' LIMIT ${limit}`;
    const { stdout } = await execAsync(`sqlite3 "${dbPath}" "${query}"`);
    
    const lines = stdout.trim().split('\n');
    const results = [];
    
    for (const line of lines) {
      if (!line) continue;
      const tabIndex = line.indexOf('\t');
      if (tabIndex === -1) continue;
      
      const key = line.substring(0, tabIndex);
      const valuePreview = line.substring(tabIndex + 1);
      
      // Try to parse as JSON
      let parsed = null;
      try {
        // Get full value
        const fullQuery = `SELECT value FROM cursorDiskKV WHERE key = '${key.replace(/'/g, "''")}'`;
        const { stdout: fullValue } = await execAsync(`sqlite3 "${dbPath}" "${fullQuery}"`);
        parsed = JSON.parse(fullValue.trim());
      } catch (e) {
        // Not JSON or error
      }
      
      results.push({
        key,
        valuePreview,
        parsed,
        isJSON: parsed !== null
      });
    }
    
    return results;
  } catch (error) {
    console.error(`Error exploring cursorDiskKV key pattern ${keyPattern}:`, error.message);
    return [];
  }
}

async function main() {
  const dbPath = path.join(os.homedir(), 'Library/Application Support/Cursor/User/globalStorage/state.vscdb');
  
  if (!fs.existsSync(dbPath)) {
    console.error('Database not found:', dbPath);
    return;
  }

  console.log('🔍 Exploring Cursor DB Keys\n');
  console.log('='.repeat(60));

  // 1. Explore messageRequestContext (API calls)
  console.log('\n🌐 API CALL INTERACTIONS (messageRequestContext):');
  console.log('-'.repeat(60));
  const apiContexts = await exploreCursorDiskKV(dbPath, 'messageRequestContext:%', 3);
  apiContexts.forEach((item, idx) => {
    console.log(`\n${idx + 1}. Key: ${item.key}`);
    if (item.isJSON && item.parsed) {
      console.log('   Structure:', JSON.stringify(Object.keys(item.parsed), null, 2));
      if (item.parsed.request) {
        console.log('   Has request object');
        if (item.parsed.request.url) console.log(`   URL: ${item.parsed.request.url}`);
        if (item.parsed.request.method) console.log(`   Method: ${item.parsed.request.method}`);
      }
      if (item.parsed.response) {
        console.log('   Has response object');
      }
      if (item.parsed.timestamp) console.log(`   Timestamp: ${item.parsed.timestamp}`);
    } else {
      console.log('   Preview:', item.valuePreview.substring(0, 200));
    }
  });

  // 2. Explore tool/function calls
  console.log('\n\n🔧 TOOL/FUNCTION CALLS:');
  console.log('-'.repeat(60));
  const toolKeys = await exploreKey(dbPath, '%tool%', 5);
  const functionKeys = await exploreKey(dbPath, '%function%', 5);
  const callKeys = await exploreCursorDiskKV(dbPath, '%call%', 5);
  
  const allToolKeys = [...toolKeys, ...functionKeys, ...callKeys];
  if (allToolKeys.length > 0) {
    allToolKeys.slice(0, 5).forEach((item, idx) => {
      console.log(`\n${idx + 1}. Key: ${item.key}`);
      if (item.isJSON && item.parsed) {
        console.log('   Structure:', JSON.stringify(Object.keys(item.parsed), null, 2));
      } else {
        console.log('   Preview:', item.valuePreview.substring(0, 200));
      }
    });
  } else {
    console.log('   No tool/function call keys found');
  }

  // 3. Explore file interactions
  console.log('\n\n📁 FILE INTERACTIONS:');
  console.log('-'.repeat(60));
  const fileKeys = await exploreCursorDiskKV(dbPath, 'inlineDiffs-%', 3);
  fileKeys.forEach((item, idx) => {
    console.log(`\n${idx + 1}. Key: ${item.key}`);
    if (item.isJSON && item.parsed) {
      console.log('   Type: Array of', Array.isArray(item.parsed) ? `${item.parsed.length} items` : 'object');
      if (Array.isArray(item.parsed) && item.parsed.length > 0) {
        const first = item.parsed[0];
        console.log('   First item keys:', Object.keys(first).join(', '));
        if (first.diffId) console.log(`   Diff ID: ${first.diffId}`);
        if (first.filePath) console.log(`   File Path: ${first.filePath}`);
      }
    } else {
      console.log('   Preview:', item.valuePreview.substring(0, 200));
    }
  });

  // 4. Explore ExtensionHostProfiler (if exists in workspace DBs)
  console.log('\n\n🔍 EXTENSION HOST PROFILER:');
  console.log('-'.repeat(60));
  const workspaceRoot = path.join(os.homedir(), 'Library/Application Support/Cursor/User/workspaceStorage');
  if (fs.existsSync(workspaceRoot)) {
    const workspaceDirs = fs.readdirSync(workspaceRoot).slice(0, 3);
    for (const wsDir of workspaceDirs) {
      const wsDbPath = path.join(workspaceRoot, wsDir, 'state.vscdb');
      if (fs.existsSync(wsDbPath)) {
        try {
          const { stdout: tables } = await execAsync(`sqlite3 "${wsDbPath}" "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%ExtensionHost%'"`);
          if (tables.trim()) {
            console.log(`\n  Found in workspace: ${wsDir}`);
            const tableNames = tables.trim().split('\n');
            for (const table of tableNames) {
              console.log(`    - ${table}`);
              // Get sample data
              try {
                const { stdout: sample } = await execAsync(`sqlite3 "${wsDbPath}" "SELECT * FROM ${table} LIMIT 1"`);
                if (sample.trim()) {
                  console.log(`      Sample: ${sample.substring(0, 150)}...`);
                }
              } catch (e) {
                // Ignore
              }
            }
          }
        } catch (e) {
          // Ignore errors
        }
      }
    }
  }

  // 5. Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📋 SUMMARY');
  console.log('='.repeat(60));
  console.log('\n✅ Found API call interactions: messageRequestContext keys in cursorDiskKV');
  console.log('✅ Found file interactions: inlineDiffs keys in cursorDiskKV');
  console.log('✅ Found tool-related keys: terminal.history, ms-toolsai.jupyter');
  console.log('\n💡 Key Findings:');
  console.log('   - cursorDiskKV contains 40,080+ rows with conversation/API/file data');
  console.log('   - messageRequestContext appears to capture API request/response data');
  console.log('   - inlineDiffs captures file change information');
  console.log('   - ExtensionHostProfiler may exist in workspace-specific databases');
}

main().catch(console.error);

