/**
 * Module Graph Edge Detector
 * Detects typed edges (imports, calls, model context, navigation, tool) from extracted data
 */

const path = require('path');
const fs = require('fs');

class ModuleGraphEdgeDetector {
  constructor() {
    this.importPatterns = {
      js: [
        /import\s+.*?\s+from\s+['"](.+?)['"]/g,
        /require\(['"](.+?)['"]\)/g,
        /import\(['"](.+?)['"]\)/g
      ],
      ts: [
        /import\s+.*?\s+from\s+['"](.+?)['"]/g,
        /import\s+['"](.+?)['"]/g
      ],
      py: [
        /^import\s+(\S+)/gm,
        /^from\s+(\S+)\s+import/gm
      ]
    };
  }

  /**
   * Detect import edges from file content
   */
  detectImportEdges(fileMetadata, fileIdMap) {
    const edges = [];

    for (const [filePath, metadata] of Object.entries(fileMetadata)) {
      const fileId = fileIdMap.get(filePath);
      if (!fileId) continue;

      const lang = this.getLanguage(filePath);
      const patterns = this.importPatterns[lang] || [];

      // Check original lines for imports
      const content = metadata.originalLines.join('\n');

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const importPath = match[1];
          if (!importPath) continue;

          // Resolve import path to actual file
          const resolvedPath = this.resolveImportPath(importPath, filePath);
          if (resolvedPath && fileIdMap.has(resolvedPath)) {
            const targetId = fileIdMap.get(resolvedPath);
            
            // Check if edge already exists
            const existingEdge = edges.find(e => 
              e.source === fileId && e.target === targetId && e.type === 'IMPORT'
            );

            if (existingEdge) {
              existingEdge.weight++;
              existingEdge.timestamps.push(Date.now());
            } else {
              edges.push({
                id: `EDGE_IMPORT_${fileId}_${targetId}`,
                source: fileId,
                target: targetId,
                type: 'IMPORT',
                subtype: 'import_out',
                weight: 1,
                timestamps: [Date.now()],
                metadata: {
                  importPath: importPath,
                  resolvedPath: resolvedPath
                }
              });
            }
          }
        }
      }
    }

    return edges;
  }

  /**
   * Detect model context edges
   */
  detectModelContextEdges(modelContext, fileIdMap) {
    const edges = [];

    for (const [targetFile, contextFiles] of Object.entries(modelContext)) {
      const targetId = fileIdMap.get(targetFile);
      if (!targetId) continue;

      for (const contextFile of contextFiles) {
        const sourceId = fileIdMap.get(contextFile);
        if (!sourceId) continue;

        // Check if edge already exists
        const existingEdge = edges.find(e => 
          e.source === sourceId && e.target === targetId && e.type === 'MODEL_CONTEXT'
        );

        if (existingEdge) {
          existingEdge.weight++;
          existingEdge.timestamps.push(Date.now());
        } else {
          edges.push({
            id: `EDGE_CTX_${sourceId}_${targetId}`,
            source: sourceId,
            target: targetId,
            type: 'MODEL_CONTEXT',
            subtype: 'ctx_out',
            weight: 1,
            timestamps: [Date.now()],
            metadata: {
              context_type: 'included'
            }
          });
        }
      }
    }

    return edges;
  }

  /**
   * Detect navigation edges from file diffs (temporal ordering)
   */
  detectNavigationEdges(fileMetadata, fileIdMap) {
    const edges = [];
    const fileTimestamps = [];

    // Collect all file edit timestamps
    for (const [filePath, metadata] of Object.entries(fileMetadata)) {
      const fileId = fileIdMap.get(filePath);
      if (!fileId) continue;

      for (const diff of metadata.diffs) {
        fileTimestamps.push({
          fileId,
          filePath,
          timestamp: diff.timestamp || Date.now()
        });
      }
    }

    // Sort by timestamp
    fileTimestamps.sort((a, b) => a.timestamp - b.timestamp);

    // Create navigation edges (previous file -> current file)
    for (let i = 1; i < fileTimestamps.length; i++) {
      const prev = fileTimestamps[i - 1];
      const curr = fileTimestamps[i];

      // Only create edge if files are different and within reasonable time window (5 minutes)
      if (prev.fileId !== curr.fileId && (curr.timestamp - prev.timestamp) < 5 * 60 * 1000) {
        const existingEdge = edges.find(e => 
          e.source === prev.fileId && e.target === curr.fileId && e.type === 'NAVIGATE'
        );

        if (existingEdge) {
          existingEdge.weight++;
          existingEdge.timestamps.push(curr.timestamp);
        } else {
          edges.push({
            id: `EDGE_NAV_${prev.fileId}_${curr.fileId}`,
            source: prev.fileId,
            target: curr.fileId,
            type: 'NAVIGATE',
            subtype: 'nav_out',
            weight: 1,
            timestamps: [curr.timestamp],
            metadata: {
              navigation_type: 'switch'
            }
          });
        }
      }
    }

    return edges;
  }

  /**
   * Detect tool edges from tool interactions
   */
  detectToolEdges(toolInteractions, fileIdMap) {
    const edges = [];

    for (const interaction of toolInteractions) {
      if (interaction.type === 'terminal' && interaction.command) {
        // Try to extract file paths from command
        const filePaths = this.extractFilePathsFromCommand(interaction.command);
        
        for (const filePath of filePaths) {
          const fileId = fileIdMap.get(filePath);
          if (!fileId) continue;

          // Create tool edge (file -> tool)
          edges.push({
            id: `EDGE_TOOL_${fileId}_${interaction.tool}_${interaction.timestamp}`,
            source: fileId,
            target: `TOOL_${interaction.tool}`,
            type: 'TOOL',
            subtype: 'tool_out',
            weight: 1,
            timestamps: [interaction.timestamp],
            metadata: {
              tool_name: interaction.tool,
              command: interaction.command
            }
          });
        }
      }
    }

    return edges;
  }

  /**
   * Get language from file path
   */
  getLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const langMap = {
      '.js': 'js',
      '.jsx': 'js',
      '.ts': 'ts',
      '.tsx': 'ts',
      '.py': 'py',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.c': 'c'
    };
    return langMap[ext] || 'unknown';
  }

  /**
   * Resolve import path to actual file path
   */
  resolveImportPath(importPath, fromFile) {
    // Remove file extension if present
    let resolved = importPath.replace(/\.(js|ts|jsx|tsx|py)$/, '');
    
    // Handle relative imports
    if (resolved.startsWith('.')) {
      const fromDir = path.dirname(fromFile);
      resolved = path.resolve(fromDir, resolved);
    } else {
      // Handle absolute/package imports (simplified)
      // In a real implementation, you'd need to resolve node_modules, etc.
      const fromDir = path.dirname(fromFile);
      resolved = path.resolve(fromDir, '..', resolved);
    }

    // Try common extensions
    const extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.json'];
    for (const ext of extensions) {
      const withExt = resolved + ext;
      if (fs.existsSync(withExt)) {
        return withExt;
      }
    }

    // Return as-is if no extension found
    return resolved;
  }

  /**
   * Extract file paths from terminal command
   */
  extractFilePathsFromCommand(command) {
    const paths = [];
    // Simple pattern matching for file paths in commands
    const pathPattern = /[\w\/\-\.]+\.(js|ts|jsx|tsx|py|java|go|rs|cpp|c|json|md|txt)/g;
    let match;
    while ((match = pathPattern.exec(command)) !== null) {
      paths.push(match[0]);
    }
    return paths;
  }

  /**
   * Detect all edge types
   */
  detectAllEdges(fileMetadata, modelContext, toolInteractions, fileIdMap) {
    const edges = [];

    // Detect import edges
    const importEdges = this.detectImportEdges(fileMetadata, fileIdMap);
    edges.push(...importEdges);

    // Detect model context edges
    const contextEdges = this.detectModelContextEdges(modelContext, fileIdMap);
    edges.push(...contextEdges);

    // Detect navigation edges
    const navEdges = this.detectNavigationEdges(fileMetadata, fileIdMap);
    edges.push(...navEdges);

    // Detect tool edges
    const toolEdges = this.detectToolEdges(toolInteractions, fileIdMap);
    edges.push(...toolEdges);

    return edges;
  }
}

module.exports = ModuleGraphEdgeDetector;

