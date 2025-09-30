/**
 * Visualization Detection Service
 * Analyzes code to detect visualization outputs and file paths
 */

class VisualizationDetector {
    constructor() {
        this.visualizationPatterns = {
            // Matplotlib patterns
            matplotlib: [
                /plt\.savefig\(['"`]([^'"`]+)['"`]\)/g,
                /plt\.savefig\(([^)]+)\)/g,
                /fig\.savefig\(['"`]([^'"`]+)['"`]\)/g,
                /fig\.savefig\(([^)]+)\)/g,
                /savefig\(['"`]([^'"`]+)['"`]\)/g,
                /savefig\(([^)]+)\)/g
            ],
            
            // Plotly patterns
            plotly: [
                /plotly\.offline\.plot\([^,]+,\s*filename\s*=\s*['"`]([^'"`]+)['"`]\)/g,
                /plotly\.offline\.plot\([^,]+,\s*filename\s*=\s*([^)]+)\)/g,
                /fig\.write_html\(['"`]([^'"`]+)['"`]\)/g,
                /fig\.write_image\(['"`]([^'"`]+)['"`]\)/g,
                /fig\.write_json\(['"`]([^'"`]+)['"`]\)/g,
                /pio\.write_html\([^,]+,\s*['"`]([^'"`]+)['"`]\)/g,
                /pio\.write_image\([^,]+,\s*['"`]([^'"`]+)['"`]\)/g
            ],
            
            // Seaborn patterns
            seaborn: [
                /sns\.savefig\(['"`]([^'"`]+)['"`]\)/g,
                /sns\.savefig\(([^)]+)\)/g
            ],
            
            // General file output patterns
            fileOutput: [
                /open\(['"`]([^'"`]+\.(png|jpg|jpeg|gif|svg|pdf|html|json))['"`]/g,
                /with\s+open\(['"`]([^'"`]+\.(png|jpg|jpeg|gif|svg|pdf|html|json))['"`]/g,
                /\.to_file\(['"`]([^'"`]+)['"`]\)/g,
                /\.save\(['"`]([^'"`]+)['"`]\)/g
            ],
            
            // OS package file operations
            osOperations: [
                /os\.path\.join\([^)]+\)/g,
                /os\.makedirs\(['"`]([^'"`]+)['"`]\)/g,
                /os\.chdir\(['"`]([^'"`]+)['"`]\)/g
            ]
        };
        
        this.supportedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.pdf', '.html', '.json'];
        this.outputDirectories = ['output', 'plots', 'figures', 'images', 'results', 'visualizations'];
    }

    /**
     * Analyze code content for visualization outputs
     */
    analyzeCode(code, sessionId) {
        const results = {
            sessionId,
            visualizations: [],
            outputPaths: [],
            detectedLibraries: new Set(),
            analysis: {
                hasMatplotlib: false,
                hasPlotly: false,
                hasSeaborn: false,
                hasFileOutput: false
            }
        };

        if (!code || typeof code !== 'string') {
            return results;
        }

        // Detect visualization libraries
        this.detectLibraries(code, results);
        
        // Find visualization outputs
        this.findVisualizationOutputs(code, results);
        
        // Find file output paths
        this.findFileOutputs(code, results);
        
        // Find OS-based file operations
        this.findOSOperations(code, results);
        
        // Resolve relative paths
        this.resolvePaths(results);

        return results;
    }

    /**
     * Detect visualization libraries used in code
     */
    detectLibraries(code, results) {
        const libraryPatterns = {
            matplotlib: /import\s+matplotlib|from\s+matplotlib|import\s+plt|import\s+pyplot/gi,
            plotly: /import\s+plotly|from\s+plotly|import\s+px|import\s+go/gi,
            seaborn: /import\s+seaborn|from\s+seaborn|import\s+sns/gi,
            pandas: /import\s+pandas|from\s+pandas|import\s+pd/gi,
            numpy: /import\s+numpy|from\s+numpy|import\s+np/gi
        };

        Object.entries(libraryPatterns).forEach(([lib, pattern]) => {
            if (pattern.test(code)) {
                results.detectedLibraries.add(lib);
                results.analysis[`has${lib.charAt(0).toUpperCase() + lib.slice(1)}`] = true;
            }
        });
    }

    /**
     * Find visualization outputs using pattern matching
     */
    findVisualizationOutputs(code, results) {
        Object.entries(this.visualizationPatterns).forEach(([type, patterns]) => {
            patterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(code)) !== null) {
                    const path = this.cleanPath(match[1]);
                    if (path && this.isVisualizationFile(path)) {
                        results.visualizations.push({
                            type,
                            path,
                            line: this.getLineNumber(code, match.index),
                            method: match[0],
                            extension: this.getFileExtension(path)
                        });
                    }
                }
            });
        });
    }

    /**
     * Find file output operations
     */
    findFileOutputs(code, results) {
        const filePattern = /(?:open|with\s+open|\.to_file|\.save)\(['"`]([^'"`]+)['"`]\)/g;
        let match;
        
        while ((match = filePattern.exec(code)) !== null) {
            const path = this.cleanPath(match[1]);
            if (path && this.isVisualizationFile(path)) {
                results.outputPaths.push({
                    path,
                    line: this.getLineNumber(code, match.index),
                    method: match[0],
                    type: 'file_output'
                });
            }
        }
    }

    /**
     * Find OS-based file operations
     */
    findOSOperations(code, results) {
        // Look for os.path.join operations that might create output paths
        const osJoinPattern = /os\.path\.join\(([^)]+)\)/g;
        let match;
        
        while ((match = osJoinPattern.exec(code)) !== null) {
            const args = match[1];
            // Try to extract potential file paths from os.path.join arguments
            const pathArgs = args.split(',').map(arg => 
                arg.trim().replace(/['"`]/g, '')
            );
            
            // Check if any argument looks like a file path
            pathArgs.forEach(arg => {
                if (this.isVisualizationFile(arg)) {
                    results.outputPaths.push({
                        path: arg,
                        line: this.getLineNumber(code, match.index),
                        method: match[0],
                        type: 'os_operation'
                    });
                }
            });
        }

        // Look for directory creation that might indicate output directories
        const makedirsPattern = /os\.makedirs\(['"`]([^'"`]+)['"`]\)/g;
        while ((match = makedirsPattern.exec(code)) !== null) {
            const dir = this.cleanPath(match[1]);
            if (this.outputDirectories.some(outputDir => 
                dir.toLowerCase().includes(outputDir.toLowerCase())
            )) {
                results.outputPaths.push({
                    path: dir,
                    line: this.getLineNumber(code, match.index),
                    method: match[0],
                    type: 'output_directory'
                });
            }
        }
    }

    /**
     * Resolve relative paths to absolute paths
     */
    resolvePaths(results) {
        const resolvedVisualizations = [];
        const resolvedOutputPaths = [];

        // Resolve visualization paths
        results.visualizations.forEach(viz => {
            const resolved = this.resolvePath(viz.path);
            if (resolved) {
                resolvedVisualizations.push({
                    ...viz,
                    resolvedPath: resolved,
                    exists: this.checkFileExists(resolved)
                });
            }
        });

        // Resolve output paths
        results.outputPaths.forEach(path => {
            const resolved = this.resolvePath(path.path);
            if (resolved) {
                resolvedOutputPaths.push({
                    ...path,
                    resolvedPath: resolved,
                    exists: this.checkFileExists(resolved)
                });
            }
        });

        results.visualizations = resolvedVisualizations;
        results.outputPaths = resolvedOutputPaths;
    }

    /**
     * Resolve a path to absolute path
     */
    resolvePath(path) {
        if (!path) return null;
        
        // If already absolute, return as is
        if (path.startsWith('/') || path.match(/^[A-Za-z]:/)) {
            return path;
        }
        
        // Try to resolve relative paths
        // This would need to be enhanced based on the actual workspace structure
        const possiblePaths = [
            path,
            `./${path}`,
            `../${path}`,
            `../../${path}`,
            // Add more common relative path patterns
        ];

        // For now, return the original path
        // In a real implementation, you'd check which path actually exists
        return path;
    }

    /**
     * Check if a file exists (placeholder - would need actual file system access)
     */
    checkFileExists(path) {
        // This would need to be implemented with actual file system access
        // For now, return true for demonstration
        return true;
    }

    /**
     * Clean and normalize a file path
     */
    cleanPath(path) {
        if (!path) return null;
        
        // Remove quotes and whitespace
        path = path.replace(/['"`]/g, '').trim();
        
        // Remove common prefixes
        path = path.replace(/^['"`]/, '').replace(/['"`]$/, '');
        
        return path;
    }

    /**
     * Check if a file is a visualization file
     */
    isVisualizationFile(path) {
        if (!path) return false;
        
        const extension = this.getFileExtension(path);
        return this.supportedExtensions.includes(extension);
    }

    /**
     * Get file extension
     */
    getFileExtension(path) {
        const match = path.match(/\.([^.]+)$/);
        return match ? `.${match[1].toLowerCase()}` : '';
    }

    /**
     * Get line number for a match in code
     */
    getLineNumber(code, index) {
        return code.substring(0, index).split('\n').length;
    }

    /**
     * Generate visualization metadata
     */
    generateVisualizationMetadata(visualization) {
        return {
            id: `viz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: this.generateTitle(visualization.path),
            description: this.generateDescription(visualization),
            type: visualization.type,
            path: visualization.path,
            resolvedPath: visualization.resolvedPath,
            extension: visualization.extension,
            line: visualization.line,
            method: visualization.method,
            timestamp: new Date().toISOString(),
            exists: visualization.exists
        };
    }

    /**
     * Generate a title for the visualization
     */
    generateTitle(path) {
        const filename = path.split('/').pop().split('\\').pop();
        const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
        
        // Convert snake_case or kebab-case to Title Case
        return nameWithoutExt
            .replace(/[_-]/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Generate a description for the visualization
     */
    generateDescription(visualization) {
        const typeDescriptions = {
            matplotlib: 'Matplotlib plot',
            plotly: 'Plotly visualization',
            seaborn: 'Seaborn plot',
            fileOutput: 'Generated visualization file'
        };
        
        return typeDescriptions[visualization.type] || 'Generated visualization';
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VisualizationDetector };
} else if (typeof window !== 'undefined') {
    window.VisualizationDetector = VisualizationDetector;
}
