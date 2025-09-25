/**
 * Enhanced Context Restoration UI Component
 * Provides improved user interface for context restoration with feedback and options
 */

class EnhancedContextRestoration {
    constructor() {
        this.restorationInProgress = false;
        this.restorationHistory = [];
        this.currentSession = null;
        this.validationResults = null;
        
        this.initializeUI();
        this.setupEventListeners();
    }

    /**
     * Initialize the enhanced context restoration UI
     */
    initializeUI() {
        // Create the enhanced context restoration modal
        this.createRestorationModal();
        
        // Add enhanced buttons to existing session cards
        this.enhanceSessionCards();
        
        // Create restoration status indicator
        this.createStatusIndicator();
    }

    /**
     * Create the enhanced context restoration modal
     */
    createRestorationModal() {
        const modalHTML = `
            <div class="modal" id="contextRestorationModal">
                <div class="modal-content context-restoration-modal">
                    <div class="modal-header">
                        <h2 class="modal-title">Enhanced Context Restoration</h2>
                        <button class="modal-close" onclick="closeContextRestorationModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <!-- Session Information -->
                        <div class="restoration-section">
                            <h3>Session Information</h3>
                            <div class="session-info-grid" id="sessionInfoGrid">
                                <!-- Session info will be populated here -->
                            </div>
                        </div>

                        <!-- Restoration Options -->
                        <div class="restoration-section">
                            <h3>Restoration Options</h3>
                            <div class="restoration-options">
                                <div class="option-group">
                                    <label class="option-label">
                                        <input type="radio" name="restorationStrategy" value="auto" checked>
                                        <span class="option-text">Auto (Recommended)</span>
                                        <span class="option-description">Automatically choose the best restoration method</span>
                                    </label>
                                </div>
                                <div class="option-group">
                                    <label class="option-label">
                                        <input type="radio" name="restorationStrategy" value="applescript">
                                        <span class="option-text">AppleScript</span>
                                        <span class="option-description">Use AppleScript to control Cursor directly</span>
                                    </label>
                                </div>
                                <div class="option-group">
                                    <label class="option-label">
                                        <input type="radio" name="restorationStrategy" value="workspace_state">
                                        <span class="option-text">Workspace State</span>
                                        <span class="option-description">Restore entire workspace state</span>
                                    </label>
                                </div>
                                <div class="option-group">
                                    <label class="option-label">
                                        <input type="radio" name="restorationStrategy" value="file_system">
                                        <span class="option-text">File System</span>
                                        <span class="option-description">Open file using system file associations</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <!-- Advanced Options -->
                        <div class="restoration-section">
                            <h3>Advanced Options</h3>
                            <div class="advanced-options">
                                <div class="option-group">
                                    <label class="checkbox-label">
                                        <input type="checkbox" id="includeWorkspaceState" checked>
                                        <span class="option-text">Include Workspace State</span>
                                    </label>
                                </div>
                                <div class="option-group">
                                    <label class="checkbox-label">
                                        <input type="checkbox" id="includeGitState" checked>
                                        <span class="option-text">Include Git State</span>
                                    </label>
                                </div>
                                <div class="option-group">
                                    <label class="checkbox-label">
                                        <input type="checkbox" id="validateRestoration" checked>
                                        <span class="option-text">Validate Restoration</span>
                                    </label>
                                </div>
                                <div class="option-group">
                                    <label class="checkbox-label">
                                        <input type="checkbox" id="createCheckpoint">
                                        <span class="option-text">Create Checkpoint</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <!-- Validation Results -->
                        <div class="restoration-section" id="validationSection" style="display: none;">
                            <h3>Validation Results</h3>
                            <div class="validation-results" id="validationResults">
                                <!-- Validation results will be populated here -->
                            </div>
                        </div>

                        <!-- Restoration Progress -->
                        <div class="restoration-section" id="progressSection" style="display: none;">
                            <h3>Restoration Progress</h3>
                            <div class="restoration-progress">
                                <div class="progress-bar">
                                    <div class="progress-fill" id="progressFill"></div>
                                </div>
                                <div class="progress-text" id="progressText">Initializing...</div>
                                <div class="progress-details" id="progressDetails"></div>
                            </div>
                        </div>

                        <!-- Restoration Results -->
                        <div class="restoration-section" id="resultsSection" style="display: none;">
                            <h3>Restoration Results</h3>
                            <div class="restoration-results" id="restorationResults">
                                <!-- Results will be populated here -->
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="closeContextRestorationModal()">Cancel</button>
                        <button class="btn btn-primary" id="startRestorationBtn" onclick="startContextRestoration()">
                            <span class="btn-text">Start Restoration</span>
                            <span class="btn-spinner" style="display: none;">⟳</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to body if it doesn't exist
        if (!document.getElementById('contextRestorationModal')) {
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }
    }

    /**
     * Enhance existing session cards with better restoration options
     */
    enhanceSessionCards() {
        // Add enhanced restoration buttons to session cards
        const style = document.createElement('style');
        style.textContent = `
            .session-card .restoration-actions {
                display: flex;
                gap: 8px;
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid var(--border-color);
            }

            .restoration-btn {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 6px 12px;
                border: 1px solid var(--border-color);
                background: var(--background-primary);
                color: var(--text-primary);
                font-size: 12px;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .restoration-btn:hover {
                background: var(--background-secondary);
                border-color: var(--accent-primary);
            }

            .restoration-btn.enhanced {
                background: var(--accent-primary);
                color: white;
                border-color: var(--accent-primary);
            }

            .restoration-btn.enhanced:hover {
                background: var(--accent-primary-hover);
            }

            .restoration-status {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 11px;
                color: var(--text-secondary);
                margin-top: 8px;
            }

            .restoration-status.success {
                color: var(--status-success);
            }

            .restoration-status.error {
                color: var(--status-error);
            }

            .restoration-status.warning {
                color: var(--status-warning);
            }

            .context-restoration-modal {
                max-width: 800px;
                max-height: 90vh;
                overflow-y: auto;
            }

            .restoration-section {
                margin-bottom: 24px;
                padding-bottom: 16px;
                border-bottom: 1px solid var(--border-color);
            }

            .restoration-section:last-child {
                border-bottom: none;
                margin-bottom: 0;
            }

            .session-info-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 12px;
            }

            .info-item {
                background: var(--background-secondary);
                padding: 12px;
                border-radius: 4px;
                border: 1px solid var(--border-color);
            }

            .info-label {
                font-size: 12px;
                color: var(--text-secondary);
                margin-bottom: 4px;
                font-weight: 500;
            }

            .info-value {
                font-size: 14px;
                color: var(--text-primary);
                word-break: break-all;
            }

            .restoration-options {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .option-group {
                border: 1px solid var(--border-color);
                border-radius: 4px;
                padding: 12px;
                transition: border-color 0.2s ease;
            }

            .option-group:hover {
                border-color: var(--accent-primary);
            }

            .option-label {
                display: flex;
                flex-direction: column;
                gap: 4px;
                cursor: pointer;
            }

            .option-text {
                font-weight: 500;
                color: var(--text-primary);
            }

            .option-description {
                font-size: 12px;
                color: var(--text-secondary);
            }

            .advanced-options {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 12px;
            }

            .checkbox-label {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
            }

            .validation-results {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .validation-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                border-radius: 4px;
                border: 1px solid var(--border-color);
            }

            .validation-item.success {
                background: var(--status-success-bg);
                border-color: var(--status-success);
            }

            .validation-item.warning {
                background: var(--status-warning-bg);
                border-color: var(--status-warning);
            }

            .validation-item.error {
                background: var(--status-error-bg);
                border-color: var(--status-error);
            }

            .validation-icon {
                width: 16px;
                height: 16px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                font-weight: bold;
                color: white;
            }

            .validation-icon.success {
                background: var(--status-success);
            }

            .validation-icon.warning {
                background: var(--status-warning);
            }

            .validation-icon.error {
                background: var(--status-error);
            }

            .restoration-progress {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .progress-bar {
                width: 100%;
                height: 8px;
                background: var(--border-color);
                border-radius: 4px;
                overflow: hidden;
            }

            .progress-fill {
                height: 100%;
                background: var(--accent-primary);
                width: 0%;
                transition: width 0.3s ease;
            }

            .progress-text {
                font-weight: 500;
                color: var(--text-primary);
            }

            .progress-details {
                font-size: 12px;
                color: var(--text-secondary);
            }

            .restoration-results {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .result-item {
                padding: 12px;
                border-radius: 4px;
                border: 1px solid var(--border-color);
            }

            .result-item.success {
                background: var(--status-success-bg);
                border-color: var(--status-success);
            }

            .result-item.error {
                background: var(--status-error-bg);
                border-color: var(--status-error);
            }

            .result-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
            }

            .result-title {
                font-weight: 500;
                color: var(--text-primary);
            }

            .result-message {
                font-size: 14px;
                color: var(--text-secondary);
            }
        `;

        document.head.appendChild(style);
    }

    /**
     * Create restoration status indicator
     */
    createStatusIndicator() {
        const indicatorHTML = `
            <div class="restoration-status-indicator" id="restorationStatusIndicator" style="display: none;">
                <div class="status-icon">
                    <div class="status-spinner">⟳</div>
                </div>
                <div class="status-text">Restoring context...</div>
                <button class="status-cancel" onclick="cancelContextRestoration()">Cancel</button>
            </div>
        `;

        // Add status indicator styles
        const statusStyle = document.createElement('style');
        statusStyle.textContent = `
            .restoration-status-indicator {
                position: fixed;
                top: 20px;
                right: 20px;
                background: var(--background-primary);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                padding: 12px 16px;
                display: flex;
                align-items: center;
                gap: 12px;
                box-shadow: var(--shadow-lg);
                z-index: 1000;
                min-width: 200px;
            }

            .status-icon {
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .status-spinner {
                animation: spin 1s linear infinite;
                font-size: 16px;
                color: var(--accent-primary);
            }

            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }

            .status-text {
                flex: 1;
                font-size: 14px;
                color: var(--text-primary);
            }

            .status-cancel {
                background: none;
                border: none;
                color: var(--text-secondary);
                cursor: pointer;
                font-size: 12px;
                padding: 4px 8px;
                border-radius: 4px;
                transition: background-color 0.2s ease;
            }

            .status-cancel:hover {
                background: var(--background-secondary);
            }
        `;

        document.head.appendChild(statusStyle);
        document.body.insertAdjacentHTML('beforeend', indicatorHTML);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for session card clicks
        document.addEventListener('click', (event) => {
            if (event.target.classList.contains('enhanced-restoration-btn')) {
                const sessionId = event.target.dataset.sessionId;
                this.openRestorationModal(sessionId);
            }
        });

        // Listen for restoration strategy changes
        document.addEventListener('change', (event) => {
            if (event.target.name === 'restorationStrategy') {
                this.updateRestorationOptions(event.target.value);
            }
        });
    }

    /**
     * Open the context restoration modal
     */
    async openRestorationModal(sessionId) {
        try {
            this.currentSession = await this.getSessionData(sessionId);
            if (!this.currentSession) {
                this.showError('Session not found');
                return;
            }

            // Populate session information
            this.populateSessionInfo();
            
            // Show validation results if available
            await this.runValidation();
            
            // Show modal
            const modal = document.getElementById('contextRestorationModal');
            modal.classList.add('active');
            
        } catch (error) {
            console.error('Failed to open restoration modal:', error);
            this.showError('Failed to open restoration modal: ' + error.message);
        }
    }

    /**
     * Populate session information in the modal
     */
    populateSessionInfo() {
        const sessionInfoGrid = document.getElementById('sessionInfoGrid');
        
        const sessionInfo = [
            { label: 'Session ID', value: this.currentSession.id },
            { label: 'Intent', value: this.currentSession.intent || 'Unknown' },
            { label: 'File', value: this.currentSession.currentFile || 'No file' },
            { label: 'Timestamp', value: new Date(this.currentSession.timestamp).toLocaleString() },
            { label: 'Workspace', value: this.currentSession.workspacePath || 'No workspace' },
            { label: 'Outcome', value: this.currentSession.outcome || 'In Progress' }
        ];

        sessionInfoGrid.innerHTML = sessionInfo.map(info => `
            <div class="info-item">
                <div class="info-label">${info.label}</div>
                <div class="info-value">${info.value}</div>
            </div>
        `).join('');
    }

    /**
     * Run validation on the current session
     */
    async runValidation() {
        try {
            const response = await fetch('/api/context/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.currentSession.id,
                    context: this.currentSession
                })
            });

            if (response.ok) {
                this.validationResults = await response.json();
                this.displayValidationResults();
            }
        } catch (error) {
            console.warn('Validation failed:', error);
        }
    }

    /**
     * Display validation results
     */
    displayValidationResults() {
        if (!this.validationResults) return;

        const validationSection = document.getElementById('validationSection');
        const validationResults = document.getElementById('validationResults');

        validationSection.style.display = 'block';

        const resultsHTML = this.validationResults.results.map(result => `
            <div class="validation-item ${result.valid ? 'success' : (result.severity === 'warning' ? 'warning' : 'error')}">
                <div class="validation-icon ${result.valid ? 'success' : (result.severity === 'warning' ? 'warning' : 'error')}">
                    ${result.valid ? '✓' : (result.severity === 'warning' ? '⚠' : '✗')}
                </div>
                <div class="validation-content">
                    <div class="validation-name">${result.name}</div>
                    ${!result.valid ? `<div class="validation-error">${result.error}</div>` : ''}
                </div>
            </div>
        `).join('');

        validationResults.innerHTML = resultsHTML;
    }

    /**
     * Update restoration options based on selected strategy
     */
    updateRestorationOptions(strategy) {
        const advancedOptions = document.querySelector('.advanced-options');
        
        // Show/hide options based on strategy
        switch (strategy) {
            case 'workspace_state':
                document.getElementById('includeWorkspaceState').checked = true;
                document.getElementById('includeWorkspaceState').disabled = true;
                break;
            case 'file_system':
                document.getElementById('includeWorkspaceState').disabled = false;
                document.getElementById('includeGitState').disabled = false;
                break;
            default:
                document.getElementById('includeWorkspaceState').disabled = false;
                document.getElementById('includeGitState').disabled = false;
        }
    }

    /**
     * Start context restoration
     */
    async startContextRestoration() {
        if (this.restorationInProgress) return;

        try {
            this.restorationInProgress = true;
            this.showProgressSection();
            this.showStatusIndicator();

            const options = this.getRestorationOptions();
            const strategy = document.querySelector('input[name="restorationStrategy"]:checked').value;

            // Start restoration
            const response = await fetch('/api/context/restore', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.currentSession.id,
                    strategy: strategy,
                    options: options
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            this.displayRestorationResults(result);

        } catch (error) {
            console.error('Context restoration failed:', error);
            this.showError('Context restoration failed: ' + error.message);
        } finally {
            this.restorationInProgress = false;
            this.hideStatusIndicator();
        }
    }

    /**
     * Show progress section
     */
    showProgressSection() {
        const progressSection = document.getElementById('progressSection');
        const startBtn = document.getElementById('startRestorationBtn');
        
        progressSection.style.display = 'block';
        startBtn.disabled = true;
        startBtn.querySelector('.btn-text').style.display = 'none';
        startBtn.querySelector('.btn-spinner').style.display = 'inline';
    }

    /**
     * Show status indicator
     */
    showStatusIndicator() {
        const indicator = document.getElementById('restorationStatusIndicator');
        indicator.style.display = 'flex';
    }

    /**
     * Hide status indicator
     */
    hideStatusIndicator() {
        const indicator = document.getElementById('restorationStatusIndicator');
        indicator.style.display = 'none';
    }

    /**
     * Display restoration results
     */
    displayRestorationResults(result) {
        const resultsSection = document.getElementById('resultsSection');
        const restorationResults = document.getElementById('restorationResults');
        const startBtn = document.getElementById('startRestorationBtn');

        resultsSection.style.display = 'block';
        startBtn.disabled = false;
        startBtn.querySelector('.btn-text').style.display = 'inline';
        startBtn.querySelector('.btn-spinner').style.display = 'none';

        const resultHTML = `
            <div class="result-item ${result.success ? 'success' : 'error'}">
                <div class="result-header">
                    <div class="result-title">${result.success ? 'Restoration Successful' : 'Restoration Failed'}</div>
                </div>
                <div class="result-message">
                    ${result.success ? 
                        `Context restored using ${result.strategy} strategy` : 
                        result.error || 'Unknown error occurred'
                    }
                </div>
                ${result.validation ? `
                    <div class="result-validation">
                        <strong>Validation:</strong> ${result.validation.success ? 'Passed' : 'Failed'}
                        ${result.validation.error ? ` - ${result.validation.error}` : ''}
                    </div>
                ` : ''}
            </div>
        `;

        restorationResults.innerHTML = resultHTML;

        // Record in history
        this.recordRestoration(result);
    }

    /**
     * Get restoration options from form
     */
    getRestorationOptions() {
        return {
            includeWorkspaceState: document.getElementById('includeWorkspaceState').checked,
            includeGitState: document.getElementById('includeGitState').checked,
            validateRestoration: document.getElementById('validateRestoration').checked,
            createCheckpoint: document.getElementById('createCheckpoint').checked
        };
    }

    /**
     * Get session data
     */
    async getSessionData(sessionId) {
        try {
            const response = await fetch(`/api/session/${sessionId}`);
            if (response.ok) {
                const data = await response.json();
                return data.session;
            }
        } catch (error) {
            console.error('Failed to get session data:', error);
        }
        return null;
    }

    /**
     * Record restoration in history
     */
    recordRestoration(result) {
        this.restorationHistory.push({
            sessionId: this.currentSession.id,
            result: result,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Show error message
     */
    showError(message) {
        // You could implement a proper error display here
        alert('Error: ' + message);
    }

    /**
     * Cancel context restoration
     */
    cancelContextRestoration() {
        if (this.restorationInProgress) {
            // You could implement cancellation logic here
            this.restorationInProgress = false;
            this.hideStatusIndicator();
        }
    }
}

// Global functions for modal interactions
function closeContextRestorationModal() {
    const modal = document.getElementById('contextRestorationModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function startContextRestoration() {
    if (window.enhancedContextRestoration) {
        window.enhancedContextRestoration.startContextRestoration();
    }
}

function cancelContextRestoration() {
    if (window.enhancedContextRestoration) {
        window.enhancedContextRestoration.cancelContextRestoration();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.enhancedContextRestoration = new EnhancedContextRestoration();
});

module.exports = EnhancedContextRestoration;
