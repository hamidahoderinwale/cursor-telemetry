/**
 * Enhanced Project Directory Analyzer
 * Provides comprehensive project analysis and organization based on directory structure
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class EnhancedProjectAnalyzer {
    constructor(options = {}) {
        this.options = {
            homeDirectory: options.homeDirectory || process.env.HOME,
            maxDepth: options.maxDepth || 5,
            ignorePatterns: options.ignorePatterns || [
                'node_modules',
                '.git',
                '.vscode',
                '.cursor',
                '__pycache__',
                '.pytest_cache',
                'venv',
                'env',
                '.env',
                'dist',
                'build',
                '.next',
                '.nuxt',
                'coverage',
                '.nyc_output'
            ],
            projectIndicators: options.projectIndicators || [
                'package.json',
                'pyproject.toml',
                'requirements.txt',
                'setup.py',
                'Cargo.toml',
                'go.mod',
                'composer.json',
                'Gemfile',
                'pom.xml',
                'build.gradle',
                'Makefile',
                'CMakeLists.txt',
                '.git',
                'README.md',
                'LICENSE'
            ],
            ...options
        };
        
        this.projectCache = new Map();
        this.analysisCache = new Map();
        this.lastAnalysis = null;
    }

    /**
     * Analyze all projects in the home directory
     */
    async analyzeAllProjects() {
        try {
            console.log('Starting comprehensive project analysis...');
            
            const projects = await this.discoverProjects();
            const analyzedProjects = await Promise.all(
                projects.map(project => this.analyzeProject(project))
            );
            
            // Sort by activity and importance
            const sortedProjects = this.sortProjectsByImportance(analyzedProjects);
            
            this.lastAnalysis = {
                timestamp: new Date().toISOString(),
                projects: sortedProjects,
                totalProjects: sortedProjects.length,
                totalSessions: sortedProjects.reduce((sum, p) => sum + p.sessionCount, 0)
            };
            
            console.log(`Analysis complete: ${sortedProjects.length} projects found`);
            return this.lastAnalysis;
            
        } catch (error) {
            console.error('Project analysis failed:', error);
            throw error;
        }
    }

    /**
     * Discover all projects in the home directory
     */
    async discoverProjects() {
        const projects = [];
        const visitedPaths = new Set();
        
        try {
            // Start from home directory
            await this.scanDirectory(this.options.homeDirectory, projects, visitedPaths, 0);
        } catch (error) {
            console.error('Error discovering projects:', error);
        }
        
        return projects;
    }

    /**
     * Recursively scan directory for projects
     */
    async scanDirectory(dirPath, projects, visitedPaths, depth) {
        if (depth > this.options.maxDepth || visitedPaths.has(dirPath)) {
            return;
        }
        
        visitedPaths.add(dirPath);
        
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            // Check if current directory is a project
            const isProject = await this.isProjectDirectory(dirPath, entries);
            if (isProject) {
                const projectInfo = await this.extractProjectInfo(dirPath, entries);
                projects.push(projectInfo);
                return; // Don't scan subdirectories of projects
            }
            
            // Scan subdirectories
            for (const entry of entries) {
                if (entry.isDirectory() && !this.shouldIgnoreDirectory(entry.name)) {
                    const subPath = path.join(dirPath, entry.name);
                    await this.scanDirectory(subPath, projects, visitedPaths, depth + 1);
                }
            }
            
        } catch (error) {
            // Skip directories we can't read
            console.warn(`Cannot read directory ${dirPath}:`, error.message);
        }
    }

    /**
     * Check if directory is a project
     */
    async isProjectDirectory(dirPath, entries) {
        // Check for project indicators
        const hasProjectIndicator = entries.some(entry => 
            this.options.projectIndicators.includes(entry.name)
        );
        
        if (hasProjectIndicator) {
            return true;
        }
        
        // Check for common project patterns
        const dirName = path.basename(dirPath);
        const projectPatterns = [
            /^[a-zA-Z0-9_-]+$/, // Simple project names
            /^[a-zA-Z0-9_-]+_[a-zA-Z0-9_-]+$/, // Snake case
            /^[a-zA-Z0-9_-]+-[a-zA-Z0-9_-]+$/, // Kebab case
        ];
        
        return projectPatterns.some(pattern => pattern.test(dirName));
    }

    /**
     * Extract project information from directory
     */
    async extractProjectInfo(dirPath, entries) {
        const projectName = path.basename(dirPath);
        const relativePath = path.relative(this.options.homeDirectory, dirPath);
        
        const projectInfo = {
            id: this.generateProjectId(dirPath),
            name: projectName,
            path: dirPath,
            relativePath: relativePath,
            category: this.categorizeProject(dirPath, entries),
            type: this.detectProjectType(entries),
            indicators: entries.filter(entry => 
                this.options.projectIndicators.includes(entry.name)
            ).map(entry => entry.name),
            discoveredAt: new Date().toISOString(),
            sessionCount: 0,
            lastActivity: null,
            stats: {
                totalSessions: 0,
                totalDuration: 0,
                intentDistribution: {},
                outcomeDistribution: {},
                fileTypes: {},
                activityPattern: {}
            }
        };
        
        return projectInfo;
    }

    /**
     * Categorize project based on path and contents
     */
    categorizeProject(dirPath, entries) {
        const pathParts = dirPath.split('/');
        const projectName = path.basename(dirPath);
        
        // Check for specific categories based on path
        if (pathParts.some(part => part.includes('HF Project') || part.includes('huggingface'))) {
            return 'machine_learning';
        }
        if (pathParts.some(part => part.includes('cursor_dashboard') || part.includes('pkl'))) {
            return 'development_tools';
        }
        if (pathParts.some(part => part.includes('Desktop'))) {
            return 'experiments';
        }
        if (pathParts.some(part => part.includes('notebooks'))) {
            return 'notebooks';
        }
        
        // Check for categories based on project indicators
        if (entries.some(entry => entry.name === 'package.json')) {
            return 'javascript';
        }
        if (entries.some(entry => entry.name === 'pyproject.toml' || entry.name === 'requirements.txt')) {
            return 'python';
        }
        if (entries.some(entry => entry.name === 'Cargo.toml')) {
            return 'rust';
        }
        if (entries.some(entry => entry.name === 'go.mod')) {
            return 'go';
        }
        if (entries.some(entry => entry.name === 'composer.json')) {
            return 'php';
        }
        if (entries.some(entry => entry.name === 'Gemfile')) {
            return 'ruby';
        }
        if (entries.some(entry => entry.name === 'pom.xml' || entry.name === 'build.gradle')) {
            return 'java';
        }
        
        return 'other';
    }

    /**
     * Detect project type based on indicators
     */
    detectProjectType(entries) {
        const indicators = entries.map(entry => entry.name);
        
        if (indicators.includes('package.json')) {
            return 'nodejs';
        }
        if (indicators.includes('pyproject.toml') || indicators.includes('requirements.txt')) {
            return 'python';
        }
        if (indicators.includes('Cargo.toml')) {
            return 'rust';
        }
        if (indicators.includes('go.mod')) {
            return 'go';
        }
        if (indicators.includes('composer.json')) {
            return 'php';
        }
        if (indicators.includes('Gemfile')) {
            return 'ruby';
        }
        if (indicators.includes('pom.xml') || indicators.includes('build.gradle')) {
            return 'java';
        }
        if (indicators.includes('Makefile') || indicators.includes('CMakeLists.txt')) {
            return 'cpp';
        }
        if (indicators.includes('.git')) {
            return 'git_repository';
        }
        
        return 'unknown';
    }

    /**
     * Analyze a specific project
     */
    async analyzeProject(project) {
        try {
            const analysis = {
                ...project,
                analysis: {
                    fileStructure: await this.analyzeFileStructure(project.path),
                    gitInfo: await this.getGitInfo(project.path),
                    dependencies: await this.getDependencies(project.path),
                    size: await this.getProjectSize(project.path),
                    activity: await this.getProjectActivity(project.path)
                }
            };
            
            this.analysisCache.set(project.id, analysis);
            return analysis;
            
        } catch (error) {
            console.error(`Error analyzing project ${project.name}:`, error);
            return project;
        }
    }

    /**
     * Analyze file structure
     */
    async analyzeFileStructure(projectPath) {
        try {
            const structure = {
                totalFiles: 0,
                totalDirectories: 0,
                fileTypes: {},
                directoryStructure: {},
                maxDepth: 0
            };
            
            await this.analyzeDirectoryStructure(projectPath, structure, 0);
            return structure;
            
        } catch (error) {
            console.error('Error analyzing file structure:', error);
            return { totalFiles: 0, totalDirectories: 0, fileTypes: {}, directoryStructure: {} };
        }
    }

    /**
     * Recursively analyze directory structure
     */
    async analyzeDirectoryStructure(dirPath, structure, depth) {
        if (depth > 3) return; // Limit depth for performance
        
        structure.maxDepth = Math.max(structure.maxDepth, depth);
        
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (this.shouldIgnoreDirectory(entry.name)) continue;
                
                if (entry.isDirectory()) {
                    structure.totalDirectories++;
                    await this.analyzeDirectoryStructure(
                        path.join(dirPath, entry.name), 
                        structure, 
                        depth + 1
                    );
                } else {
                    structure.totalFiles++;
                    const ext = path.extname(entry.name).toLowerCase();
                    structure.fileTypes[ext] = (structure.fileTypes[ext] || 0) + 1;
                }
            }
        } catch (error) {
            // Skip directories we can't read
        }
    }

    /**
     * Get git information
     */
    async getGitInfo(projectPath) {
        try {
            const gitDir = path.join(projectPath, '.git');
            await fs.access(gitDir);
            
            const [branchResult, statusResult, logResult] = await Promise.allSettled([
                execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath }),
                execAsync('git status --porcelain', { cwd: projectPath }),
                execAsync('git log -1 --pretty=format:"%H|%s|%an|%ad"', { cwd: projectPath })
            ]);
            
            const gitInfo = {
                isGitRepository: true,
                branch: branchResult.status === 'fulfilled' ? branchResult.value.stdout.trim() : 'unknown',
                hasUncommittedChanges: statusResult.status === 'fulfilled' && statusResult.value.stdout.trim().length > 0,
                lastCommit: null
            };
            
            if (logResult.status === 'fulfilled' && logResult.value.stdout.trim()) {
                const [hash, message, author, date] = logResult.value.stdout.split('|');
                gitInfo.lastCommit = { hash, message, author, date };
            }
            
            return gitInfo;
            
        } catch (error) {
            return { isGitRepository: false };
        }
    }

    /**
     * Get project dependencies
     */
    async getDependencies(projectPath) {
        const dependencies = {};
        
        try {
            // Check for package.json
            const packageJsonPath = path.join(projectPath, 'package.json');
            try {
                const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
                dependencies.npm = {
                    dependencies: Object.keys(packageJson.dependencies || {}),
                    devDependencies: Object.keys(packageJson.devDependencies || {}),
                    scripts: Object.keys(packageJson.scripts || {})
                };
            } catch (error) {
                // No package.json or invalid JSON
            }
            
            // Check for requirements.txt
            const requirementsPath = path.join(projectPath, 'requirements.txt');
            try {
                const requirements = await fs.readFile(requirementsPath, 'utf8');
                dependencies.python = requirements.split('\n')
                    .filter(line => line.trim() && !line.startsWith('#'))
                    .map(line => line.split('==')[0].split('>=')[0].split('<=')[0].trim());
            } catch (error) {
                // No requirements.txt
            }
            
            // Check for pyproject.toml
            const pyprojectPath = path.join(projectPath, 'pyproject.toml');
            try {
                const pyproject = await fs.readFile(pyprojectPath, 'utf8');
                // Simple parsing for dependencies
                const dependencyLines = pyproject.split('\n')
                    .filter(line => line.includes('=') && (line.includes('dependencies') || line.includes('dev-dependencies')));
                dependencies.python = dependencyLines;
            } catch (error) {
                // No pyproject.toml
            }
            
        } catch (error) {
            console.error('Error getting dependencies:', error);
        }
        
        return dependencies;
    }

    /**
     * Get project size
     */
    async getProjectSize(projectPath) {
        try {
            const { stdout } = await execAsync(`du -sh "${projectPath}"`);
            const size = stdout.split('\t')[0];
            return { size, path: projectPath };
        } catch (error) {
            return { size: 'unknown', path: projectPath };
        }
    }

    /**
     * Get project activity (file modification times)
     */
    async getProjectActivity(projectPath) {
        try {
            const { stdout } = await execAsync(`find "${projectPath}" -type f -name "*.py" -o -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" | head -20 | xargs ls -lt | head -10`);
            const files = stdout.split('\n')
                .filter(line => line.trim())
                .map(line => {
                    const parts = line.trim().split(/\s+/);
                    return {
                        date: parts.slice(5, 8).join(' '),
                        name: parts[parts.length - 1]
                    };
                });
            
            return { recentFiles: files };
        } catch (error) {
            return { recentFiles: [] };
        }
    }

    /**
     * Sort projects by importance and activity
     */
    sortProjectsByImportance(projects) {
        return projects.sort((a, b) => {
            // Primary sort: by session count
            if (a.sessionCount !== b.sessionCount) {
                return b.sessionCount - a.sessionCount;
            }
            
            // Secondary sort: by last activity
            if (a.lastActivity && b.lastActivity) {
                return new Date(b.lastActivity) - new Date(a.lastActivity);
            }
            
            // Tertiary sort: by category importance
            const categoryImportance = {
                'machine_learning': 5,
                'development_tools': 4,
                'python': 3,
                'javascript': 3,
                'experiments': 2,
                'other': 1
            };
            
            const aImportance = categoryImportance[a.category] || 1;
            const bImportance = categoryImportance[b.category] || 1;
            
            return bImportance - aImportance;
        });
    }

    /**
     * Update project with session data
     */
    updateProjectWithSessions(project, sessions) {
        const projectSessions = sessions.filter(session => 
            session.currentFile && session.currentFile.startsWith(project.path)
        );
        
        project.sessionCount = projectSessions.length;
        project.sessions = projectSessions;
        
        if (projectSessions.length > 0) {
            // Update stats
            project.stats.totalSessions = projectSessions.length;
            project.stats.totalDuration = projectSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
            
            // Update intent distribution
            projectSessions.forEach(session => {
                const intent = session.intent || 'unknown';
                project.stats.intentDistribution[intent] = (project.stats.intentDistribution[intent] || 0) + 1;
            });
            
            // Update outcome distribution
            projectSessions.forEach(session => {
                const outcome = session.outcome || 'in_progress';
                project.stats.outcomeDistribution[outcome] = (project.stats.outcomeDistribution[outcome] || 0) + 1;
            });
            
            // Update file types
            projectSessions.forEach(session => {
                if (session.currentFile) {
                    const ext = path.extname(session.currentFile).toLowerCase();
                    project.stats.fileTypes[ext] = (project.stats.fileTypes[ext] || 0) + 1;
                }
            });
            
            // Update last activity
            const lastSession = projectSessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
            project.lastActivity = lastSession.timestamp;
        }
        
        return project;
    }

    /**
     * Helper methods
     */
    shouldIgnoreDirectory(dirName) {
        return this.options.ignorePatterns.some(pattern => 
            dirName.includes(pattern) || dirName.startsWith('.')
        );
    }

    generateProjectId(projectPath) {
        return Buffer.from(projectPath).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    }

    /**
     * Get cached analysis
     */
    getCachedAnalysis() {
        return this.lastAnalysis;
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.projectCache.clear();
        this.analysisCache.clear();
        this.lastAnalysis = null;
    }
}

module.exports = EnhancedProjectAnalyzer;
