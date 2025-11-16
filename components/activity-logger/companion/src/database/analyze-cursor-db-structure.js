#!/usr/bin/env node

/**
 * Cursor Database Structure Analyzer
 * Analyzes the Cursor DB to find tables/keys that capture:
 * - File interactions (edits, operations, etc.)
 * - Tool calls (function calls, API calls, etc.)
 * - API call interactions (HTTP requests, external services)
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const os = require('os');

const execAsync = promisify(exec);

class CursorDBAnalyzer {
  constructor() {
    this.dbPaths = this.findCursorDatabases();
  }

  findCursorDatabases() {
    const basePath = path.join(os.homedir(), 'Library/Application Support/Cursor');
    return {
      global: path.join(basePath, 'User/globalStorage/state.vscdb'),
      workspaces: path.join(basePath, 'User/workspaceStorage'),
    };
  }

  async analyzeDatabase(dbPath) {
    if (!fs.existsSync(dbPath)) {
      console.log(`Database not found: ${dbPath}`);
      return null;
    }

    console.log(`\n📊 Analyzing: ${dbPath}\n`);

    try {
      // Get all tables
      const tablesQuery = `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`;
      const { stdout: tablesOutput } = await execAsync(`sqlite3 "${dbPath}" "${tablesQuery}"`);
      const tables = tablesOutput.trim().split('\n').filter(Boolean);

      console.log(`Found ${tables.length} tables:`);
      tables.forEach(t => console.log(`  - ${t}`));

      const analysis = {
        dbPath,
        tables: [],
        fileInteractions: [],
        toolCalls: [],
        apiCalls: [],
        otherInteresting: []
      };

      // Analyze each table
      for (const table of tables) {
        const tableInfo = await this.analyzeTable(dbPath, table);
        analysis.tables.push(tableInfo);

        // Categorize findings
        if (this.isFileInteractionTable(table, tableInfo)) {
          analysis.fileInteractions.push(tableInfo);
        }
        if (this.isToolCallTable(table, tableInfo)) {
          analysis.toolCalls.push(tableInfo);
        }
        if (this.isAPICallTable(table, tableInfo)) {
          analysis.apiCalls.push(tableInfo);
        }
        if (this.isInterestingTable(table, tableInfo)) {
          analysis.otherInteresting.push(tableInfo);
        }
      }

      return analysis;
    } catch (error) {
      console.error(`Error analyzing database: ${error.message}`);
      return null;
    }
  }

  async analyzeTable(dbPath, tableName) {
    try {
      // Get table schema
      const schemaQuery = `PRAGMA table_info(${tableName})`;
      const { stdout: schemaOutput } = await execAsync(`sqlite3 "${dbPath}" "${schemaQuery}"`);
      const schema = this.parseSchema(schemaOutput);

      // Get row count
      const countQuery = `SELECT COUNT(*) as count FROM ${tableName}`;
      const { stdout: countOutput } = await execAsync(`sqlite3 "${dbPath}" "${countQuery}"`);
      const rowCount = parseInt(countOutput.trim()) || 0;

      // Get sample data (first 3 rows)
      const sampleQuery = `SELECT * FROM ${tableName} LIMIT 3`;
      let sampleData = [];
      try {
        const { stdout: sampleOutput } = await execAsync(`sqlite3 "${dbPath}" "${sampleQuery}"`);
        sampleData = this.parseSampleData(sampleOutput, schema);
      } catch (e) {
        // Some tables might not be readable
      }

      // For key-value tables, get sample keys
      let sampleKeys = [];
      if (tableName === 'ItemTable' || tableName === 'cursorDiskKV' || tableName.toLowerCase().includes('kv')) {
        const keysQuery = `SELECT key FROM ${tableName} LIMIT 50`;
        try {
          const { stdout: keysOutput } = await execAsync(`sqlite3 "${dbPath}" "${keysQuery}"`);
          sampleKeys = keysOutput.trim().split('\n').filter(Boolean);
        } catch (e) {
          // Ignore errors
        }
      }

      return {
        name: tableName,
        schema,
        rowCount,
        sampleData,
        sampleKeys
      };
    } catch (error) {
      return {
        name: tableName,
        error: error.message
      };
    }
  }

  parseSchema(schemaOutput) {
    const lines = schemaOutput.trim().split('\n');
    return lines.map(line => {
      // SQLite PRAGMA table_info format: cid|name|type|notnull|dflt_value|pk
      const parts = line.split('|');
      return {
        cid: parts[0],
        name: parts[1],
        type: parts[2],
        notnull: parts[3] === '1',
        dflt_value: parts[4],
        pk: parts[5] === '1'
      };
    });
  }

  parseSampleData(sampleOutput, schema) {
    if (!sampleOutput.trim()) return [];
    
    const lines = sampleOutput.trim().split('\n');
    return lines.slice(0, 3).map(line => {
      const values = line.split('|');
      const row = {};
      schema.forEach((col, idx) => {
        row[col.name] = values[idx] || null;
      });
      return row;
    });
  }

  isFileInteractionTable(tableName, tableInfo) {
    const fileKeywords = ['file', 'edit', 'change', 'modify', 'write', 'read', 'document', 'text'];
    const nameLower = tableName.toLowerCase();
    
    // Check table name
    if (fileKeywords.some(kw => nameLower.includes(kw))) {
      return true;
    }

    // Check column names
    if (tableInfo.schema) {
      const columnNames = tableInfo.schema.map(c => c.name.toLowerCase()).join(' ');
      if (fileKeywords.some(kw => columnNames.includes(kw))) {
        return true;
      }
    }

    // Check sample keys (for key-value tables)
    if (tableInfo.sampleKeys) {
      const keysStr = tableInfo.sampleKeys.join(' ').toLowerCase();
      if (fileKeywords.some(kw => keysStr.includes(kw))) {
        return true;
      }
    }

    return false;
  }

  isToolCallTable(tableName, tableInfo) {
    const toolKeywords = ['tool', 'function', 'call', 'invoke', 'execute', 'command', 'action', 'operation'];
    const nameLower = tableName.toLowerCase();
    
    if (toolKeywords.some(kw => nameLower.includes(kw))) {
      return true;
    }

    if (tableInfo.schema) {
      const columnNames = tableInfo.schema.map(c => c.name.toLowerCase()).join(' ');
      if (toolKeywords.some(kw => columnNames.includes(kw))) {
        return true;
      }
    }

    if (tableInfo.sampleKeys) {
      const keysStr = tableInfo.sampleKeys.join(' ').toLowerCase();
      if (toolKeywords.some(kw => keysStr.includes(kw))) {
        return true;
      }
    }

    return false;
  }

  isAPICallTable(tableName, tableInfo) {
    const apiKeywords = ['api', 'http', 'request', 'response', 'fetch', 'network', 'url', 'endpoint', 'service', 'external'];
    const nameLower = tableName.toLowerCase();
    
    if (apiKeywords.some(kw => nameLower.includes(kw))) {
      return true;
    }

    if (tableInfo.schema) {
      const columnNames = tableInfo.schema.map(c => c.name.toLowerCase()).join(' ');
      if (apiKeywords.some(kw => columnNames.includes(kw))) {
        return true;
      }
    }

    if (tableInfo.sampleKeys) {
      const keysStr = tableInfo.sampleKeys.join(' ').toLowerCase();
      if (apiKeywords.some(kw => keysStr.includes(kw))) {
        return true;
      }
    }

    return false;
  }

  isInterestingTable(tableName, tableInfo) {
    const interestingKeywords = ['extension', 'host', 'profiler', 'process', 'log', 'event', 'activity', 'track', 'monitor'];
    const nameLower = tableName.toLowerCase();
    
    if (interestingKeywords.some(kw => nameLower.includes(kw))) {
      return true;
    }

    // ExtensionHostProfiler and ExtensionHostProcess are interesting
    if (nameLower.includes('extensionhost')) {
      return true;
    }

    return false;
  }

  async searchItemTableKeys(dbPath, patterns) {
    if (!fs.existsSync(dbPath)) return [];

    try {
      const patternsStr = patterns.map(p => `key LIKE '%${p}%'`).join(' OR ');
      const query = `SELECT DISTINCT key FROM ItemTable WHERE ${patternsStr} LIMIT 100`;
      const { stdout } = await execAsync(`sqlite3 "${dbPath}" "${query}"`);
      return stdout.trim().split('\n').filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  async searchCursorDiskKVKeys(dbPath, patterns) {
    if (!fs.existsSync(dbPath)) return [];

    try {
      const patternsStr = patterns.map(p => `key LIKE '%${p}%'`).join(' OR ');
      const query = `SELECT DISTINCT key FROM cursorDiskKV WHERE ${patternsStr} LIMIT 100`;
      const { stdout } = await execAsync(`sqlite3 "${dbPath}" "${query}"`);
      return stdout.trim().split('\n').filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  async generateReport() {
    console.log('🔍 Cursor Database Structure Analysis\n');
    console.log('=' .repeat(60));

    const { global, workspaces } = this.dbPaths;

    // Analyze global database
    const globalAnalysis = await this.analyzeDatabase(global);

    // Search for specific patterns in key-value tables
    console.log('\n🔑 Searching for file/tool/API related keys in ItemTable...');
    const fileKeys = await this.searchItemTableKeys(global, ['file', 'edit', 'change', 'document', 'text']);
    const toolKeys = await this.searchItemTableKeys(global, ['tool', 'function', 'call', 'command', 'action']);
    const apiKeys = await this.searchItemTableKeys(global, ['api', 'http', 'request', 'fetch', 'network', 'url']);

    console.log('\n🔑 Searching cursorDiskKV...');
    const cursorFileKeys = await this.searchCursorDiskKVKeys(global, ['file', 'edit', 'change']);
    const cursorToolKeys = await this.searchCursorDiskKVKeys(global, ['tool', 'function', 'call']);
    const cursorApiKeys = await this.searchCursorDiskKVKeys(global, ['api', 'http', 'request']);

    // Generate summary report
    console.log('\n' + '='.repeat(60));
    console.log('📋 SUMMARY REPORT');
    console.log('='.repeat(60));

    if (globalAnalysis) {
      console.log('\n📁 FILE INTERACTIONS:');
      if (globalAnalysis.fileInteractions.length > 0) {
        globalAnalysis.fileInteractions.forEach(t => {
          console.log(`  ✓ ${t.name} (${t.rowCount} rows)`);
          if (t.sampleKeys && t.sampleKeys.length > 0) {
            console.log(`    Sample keys: ${t.sampleKeys.slice(0, 5).join(', ')}`);
          }
        });
      } else {
        console.log('  No dedicated file interaction tables found');
      }
      if (fileKeys.length > 0 || cursorFileKeys.length > 0) {
        console.log(`  Found ${fileKeys.length + cursorFileKeys.length} file-related keys in key-value tables`);
        const allFileKeys = [...fileKeys, ...cursorFileKeys].slice(0, 10);
        allFileKeys.forEach(k => console.log(`    - ${k}`));
      }

      console.log('\n🔧 TOOL CALLS:');
      if (globalAnalysis.toolCalls.length > 0) {
        globalAnalysis.toolCalls.forEach(t => {
          console.log(`  ✓ ${t.name} (${t.rowCount} rows)`);
          if (t.schema) {
            const cols = t.schema.map(c => c.name).join(', ');
            console.log(`    Columns: ${cols}`);
          }
        });
      } else {
        console.log('  No dedicated tool call tables found');
      }
      if (toolKeys.length > 0 || cursorToolKeys.length > 0) {
        console.log(`  Found ${toolKeys.length + cursorToolKeys.length} tool-related keys in key-value tables`);
        const allToolKeys = [...toolKeys, ...cursorToolKeys].slice(0, 10);
        allToolKeys.forEach(k => console.log(`    - ${k}`));
      }

      console.log('\n🌐 API CALLS:');
      if (globalAnalysis.apiCalls.length > 0) {
        globalAnalysis.apiCalls.forEach(t => {
          console.log(`  ✓ ${t.name} (${t.rowCount} rows)`);
          if (t.schema) {
            const cols = t.schema.map(c => c.name).join(', ');
            console.log(`    Columns: ${cols}`);
          }
        });
      } else {
        console.log('  No dedicated API call tables found');
      }
      if (apiKeys.length > 0 || cursorApiKeys.length > 0) {
        console.log(`  Found ${apiKeys.length + cursorApiKeys.length} API-related keys in key-value tables`);
        const allApiKeys = [...apiKeys, ...cursorApiKeys].slice(0, 10);
        allApiKeys.forEach(k => console.log(`    - ${k}`));
      }

      console.log('\n🔍 OTHER INTERESTING TABLES:');
      if (globalAnalysis.otherInteresting.length > 0) {
        globalAnalysis.otherInteresting.forEach(t => {
          console.log(`  ✓ ${t.name} (${t.rowCount} rows)`);
          if (t.schema) {
            const cols = t.schema.map(c => c.name).join(', ');
            console.log(`    Columns: ${cols}`);
          }
        });
      }

      // Detailed table information
      console.log('\n' + '='.repeat(60));
      console.log('📊 DETAILED TABLE INFORMATION');
      console.log('='.repeat(60));

      globalAnalysis.tables.forEach(table => {
        console.log(`\n📋 ${table.name}`);
        console.log(`   Rows: ${table.rowCount}`);
        if (table.schema) {
          console.log(`   Schema:`);
          table.schema.forEach(col => {
            console.log(`     - ${col.name} (${col.type}${col.pk ? ', PK' : ''})`);
          });
        }
        if (table.sampleKeys && table.sampleKeys.length > 0) {
          console.log(`   Sample keys (first 10):`);
          table.sampleKeys.slice(0, 10).forEach(key => {
            console.log(`     - ${key}`);
          });
        }
        if (table.sampleData && table.sampleData.length > 0) {
          console.log(`   Sample data (first row):`);
          const firstRow = table.sampleData[0];
          Object.entries(firstRow).slice(0, 5).forEach(([key, value]) => {
            const valStr = String(value || '').substring(0, 50);
            console.log(`     ${key}: ${valStr}${valStr.length >= 50 ? '...' : ''}`);
          });
        }
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Analysis Complete');
    console.log('='.repeat(60));
  }
}

// Run if executed directly
if (require.main === module) {
  const analyzer = new CursorDBAnalyzer();
  analyzer.generateReport().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}

module.exports = CursorDBAnalyzer;

