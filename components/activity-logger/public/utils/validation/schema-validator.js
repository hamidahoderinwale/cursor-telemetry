/**
 * Schema Validator Module
 * Validates import data against database schema
 */

class SchemaValidator {
  constructor() {
    this.currentSchema = null;
    this.schemaVersion = '1.0.0';
  }

  /**
   * Load current database schema
   */
  async loadCurrentSchema() {
    try {
      if (!window.CONFIG?.API_BASE) {
        console.warn('[SCHEMA] API base not configured');
        return null;
      }

      const response = await fetch(`${window.CONFIG.API_BASE}/api/schema`);
      if (!response.ok) {
        throw new Error('Failed to fetch schema');
      }

      const result = await response.json();
      if (result.success && result.data) {
        this.currentSchema = result.data;
        this.schemaVersion = result.data.version || '1.0.0';
        return this.currentSchema;
      }
      return null;
    } catch (error) {
      console.error('[SCHEMA] Error loading schema:', error);
      return null;
    }
  }

  /**
   * Detect schema version from import data
   */
  detectSchemaVersion(importData) {
    // Check for explicit schema version
    if (importData.schema_version) {
      return importData.schema_version;
    }

    // Check for schema metadata
    if (importData.metadata?.schema_version) {
      return importData.metadata.schema_version;
    }

    // Infer from data structure
    if (importData.data?.schema_version) {
      return importData.data.schema_version;
    }

    // Default to 1.0.0 for legacy exports
    return '1.0.0';
  }

  /**
   * Analyze import data structure
   */
  analyzeImportData(importData) {
    const data = importData.data || importData;
    const schemaVersion = this.detectSchemaVersion(importData);
    
    const analysis = {
      schemaVersion,
      tables: {},
      hasEntries: false,
      hasPrompts: false,
      hasEvents: false,
      hasTerminalCommands: false,
      hasWorkspaces: false,
      totalRecords: 0
    };

    // Analyze each table
    if (data.entries && Array.isArray(data.entries)) {
      analysis.hasEntries = true;
      analysis.tables.entries = {
        count: data.entries.length,
        sample: data.entries[0] || null,
        fields: data.entries[0] ? Object.keys(data.entries[0]) : []
      };
      analysis.totalRecords += data.entries.length;
    }

    if (data.prompts && Array.isArray(data.prompts)) {
      analysis.hasPrompts = true;
      analysis.tables.prompts = {
        count: data.prompts.length,
        sample: data.prompts[0] || null,
        fields: data.prompts[0] ? Object.keys(data.prompts[0]) : []
      };
      analysis.totalRecords += data.prompts.length;
    }

    if (data.events && Array.isArray(data.events)) {
      analysis.hasEvents = true;
      analysis.tables.events = {
        count: data.events.length,
        sample: data.events[0] || null,
        fields: data.events[0] ? Object.keys(data.events[0]) : []
      };
      analysis.totalRecords += data.events.length;
    }

    if (data.terminal_commands && Array.isArray(data.terminal_commands)) {
      analysis.hasTerminalCommands = true;
      analysis.tables.terminal_commands = {
        count: data.terminal_commands.length,
        sample: data.terminal_commands[0] || null,
        fields: data.terminal_commands[0] ? Object.keys(data.terminal_commands[0]) : []
      };
      analysis.totalRecords += data.terminal_commands.length;
    }

    if (data.workspaces && Array.isArray(data.workspaces)) {
      analysis.hasWorkspaces = true;
      analysis.tables.workspaces = {
        count: data.workspaces.length,
        sample: data.workspaces[0] || null
      };
      analysis.totalRecords += data.workspaces.length;
    }

    return analysis;
  }

  /**
   * Check schema compatibility
   */
  async checkCompatibility(importAnalysis) {
    if (!this.currentSchema) {
      await this.loadCurrentSchema();
    }

    if (!this.currentSchema) {
      return {
        compatible: true,
        warnings: ['Could not load current schema for validation'],
        errors: []
      };
    }

    const compatibility = {
      compatible: true,
      warnings: [],
      errors: [],
      schemaVersionMatch: importAnalysis.schemaVersion === this.schemaVersion,
      missingFields: {},
      extraFields: {},
      typeMismatches: {}
    };

    // Check each table
    for (const [tableName, tableData] of Object.entries(importAnalysis.tables)) {
      if (!tableData.sample) continue;

      const currentTable = this.currentSchema.tables.find(t => t.name === tableName);
      if (!currentTable) {
        compatibility.warnings.push(`Table "${tableName}" not found in current schema`);
        continue;
      }

      // Check fields
      const currentFields = new Set(currentTable.columns.map(c => c.name));
      const importFields = new Set(tableData.fields);

      // Find missing fields (in current schema but not in import)
      const missing = [...currentFields].filter(f => !importFields.has(f));
      if (missing.length > 0) {
        compatibility.missingFields[tableName] = missing;
        compatibility.warnings.push(
          `Table "${tableName}" missing fields: ${missing.join(', ')}`
        );
      }

      // Find extra fields (in import but not in current schema)
      const extra = [...importFields].filter(f => !currentFields.has(f));
      if (extra.length > 0) {
        compatibility.extraFields[tableName] = extra;
        compatibility.warnings.push(
          `Table "${tableName}" has extra fields: ${extra.join(', ')} (will be ignored)`
        );
      }

      // Check required fields
      const requiredFields = currentTable.columns
        .filter(c => c.notnull && !c.defaultValue)
        .map(c => c.name);

      for (const requiredField of requiredFields) {
        if (!importFields.has(requiredField)) {
          compatibility.errors.push(
            `Table "${tableName}" missing required field: ${requiredField}`
          );
          compatibility.compatible = false;
        }
      }
    }

    // Check schema version
    if (!compatibility.schemaVersionMatch) {
      compatibility.warnings.push(
        `Schema version mismatch: import is ${importAnalysis.schemaVersion}, current is ${this.schemaVersion}`
      );
    }

    return compatibility;
  }

  /**
   * Validate import data structure
   */
  validateImportData(importData) {
    const errors = [];
    const warnings = [];

    // Check basic structure
    if (!importData) {
      errors.push('Import data is empty');
      return { valid: false, errors, warnings };
    }

    const data = importData.data || importData;

    // Check if data has any content
    const hasData = 
      (data.entries && data.entries.length > 0) ||
      (data.prompts && data.prompts.length > 0) ||
      (data.events && data.events.length > 0) ||
      (data.terminal_commands && data.terminal_commands.length > 0) ||
      (data.workspaces && data.workspaces.length > 0);

    if (!hasData) {
      warnings.push('Import file contains no data');
    }

    // Validate array types
    if (data.entries && !Array.isArray(data.entries)) {
      errors.push('"entries" must be an array');
    }
    if (data.prompts && !Array.isArray(data.prompts)) {
      errors.push('"prompts" must be an array');
    }
    if (data.events && !Array.isArray(data.events)) {
      errors.push('"events" must be an array');
    }
    if (data.terminal_commands && !Array.isArray(data.terminal_commands)) {
      errors.push('"terminal_commands" must be an array');
    }
    if (data.workspaces && !Array.isArray(data.workspaces)) {
      errors.push('"workspaces" must be an array');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get field mapping suggestions
   */
  getFieldMappings(tableName, importFields) {
    if (!this.currentSchema) {
      return {};
    }

    const currentTable = this.currentSchema.tables.find(t => t.name === tableName);
    if (!currentTable) {
      return {};
    }

    const mappings = {};
    const currentFields = currentTable.columns.map(c => c.name.toLowerCase());

    for (const importField of importFields) {
      const importFieldLower = importField.toLowerCase();
      
      // Exact match
      if (currentFields.includes(importFieldLower)) {
        mappings[importField] = importField;
        continue;
      }

      // Try common variations
      const variations = [
        importFieldLower.replace(/_/g, ''),
        importFieldLower.replace(/([A-Z])/g, '_$1').toLowerCase(),
        importFieldLower.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
      ];

      for (const variation of variations) {
        const match = currentFields.find(cf => 
          cf === variation || 
          cf.replace(/_/g, '') === variation ||
          cf.toLowerCase() === variation
        );
        if (match) {
          const originalField = currentTable.columns.find(c => 
            c.name.toLowerCase() === match
          )?.name;
          if (originalField) {
            mappings[importField] = originalField;
            break;
          }
        }
      }
    }

    return mappings;
  }
}

// Create singleton instance
window.SchemaValidator = SchemaValidator;
window.schemaValidator = new SchemaValidator();

