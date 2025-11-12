/**
 * Landing Page Modal
 * Shows welcome/onboarding information on first visit
 */

const LANDING_PAGE_SEEN_KEY = 'cursor-telemetry-landing-seen';

/**
 * Check if user has seen the landing page
 */
function hasSeenLandingPage() {
  return localStorage.getItem(LANDING_PAGE_SEEN_KEY) === 'true';
}

/**
 * Mark landing page as seen
 */
function markLandingPageSeen() {
  localStorage.setItem(LANDING_PAGE_SEEN_KEY, 'true');
}

/**
 * Show landing page modal
 */
function showLandingPageModal() {
  // Check if already seen
  if (hasSeenLandingPage()) {
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'landingPageModal';
  modal.className = 'modal-overlay';
  modal.style.zIndex = '10000';
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
      <div class="modal-header" style="border-bottom: 2px solid var(--color-primary); padding-bottom: var(--space-md);">
        <h2 style="display: flex; align-items: center; gap: var(--space-sm); margin: 0;">
          <svg width="32" height="32" viewBox="0 0 20 20" fill="currentColor" style="color: var(--color-primary);">
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
          </svg>
          Welcome to Cursor Telemetry Dashboard
        </h2>
        <button class="modal-close" onclick="closeLandingPageModal()" style="font-size: 24px; line-height: 1;">&times;</button>
      </div>
      
      <div class="modal-body" style="padding: var(--space-lg);">
        <!-- Introduction -->
        <div style="margin-bottom: var(--space-xl);">
          <p style="font-size: var(--text-base); line-height: 1.7; color: var(--color-text); margin-bottom: var(--space-md);">
            The Cursor Telemetry Dashboard helps you track and analyze your development workflow. 
            To get started, you'll need to run the <strong>companion service</strong> that collects data from your Cursor IDE.
          </p>
        </div>

        <!-- Step 1: Start Companion Service -->
        <div style="margin-bottom: var(--space-xl); padding: var(--space-lg); background: var(--color-bg-alt); border-radius: var(--radius-md); border-left: 4px solid var(--color-primary);">
          <h3 style="display: flex; align-items: center; gap: var(--space-sm); margin-top: 0; margin-bottom: var(--space-md); color: var(--color-primary);">
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: var(--color-primary); color: white; border-radius: 50%; font-weight: 600;">1</span>
            Start the Companion Service
          </h3>
          <div style="margin-bottom: var(--space-md);">
            <p style="margin-bottom: var(--space-sm); color: var(--color-text);">
              The companion service runs locally and collects data from your Cursor IDE. Open a terminal and run:
            </p>
            <div style="background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: var(--space-md); font-family: var(--font-mono); font-size: var(--text-sm); color: var(--color-text); margin-bottom: var(--space-sm);">
              <div style="color: var(--color-text-muted); margin-bottom: var(--space-xs);"># Navigate to the companion directory</div>
              <div>cd cursor-telemetry/components/activity-logger/companion</div>
              <div style="color: var(--color-text-muted); margin-top: var(--space-sm); margin-bottom: var(--space-xs);"># Install dependencies (if not already done)</div>
              <div>npm install</div>
              <div style="color: var(--color-text-muted); margin-top: var(--space-sm); margin-bottom: var(--space-xs);"># Start the service</div>
              <div>node src/index.js</div>
            </div>
            <p style="font-size: var(--text-sm); color: var(--color-text-muted); margin-top: var(--space-sm);">
              The service will start on <code style="background: var(--color-bg); padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono);">http://localhost:43917</code>
            </p>
          </div>
        </div>

        <!-- Step 2: Privacy Settings -->
        <div style="margin-bottom: var(--space-xl); padding: var(--space-lg); background: var(--color-bg-alt); border-radius: var(--radius-md); border-left: 4px solid var(--color-warning);">
          <h3 style="display: flex; align-items: center; gap: var(--space-sm); margin-top: 0; margin-bottom: var(--space-md); color: var(--color-warning);">
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: var(--color-warning); color: white; border-radius: 50%; font-weight: 600;">2</span>
            Configure Privacy Settings
          </h3>
          <div style="margin-bottom: var(--space-md);">
            <p style="margin-bottom: var(--space-md); color: var(--color-text);">
              To access the dashboard, you need to grant the companion service permission to read Cursor's database. 
              This is required to extract AI prompts and activity data.
            </p>
            
            <div style="background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: var(--space-md); margin-bottom: var(--space-sm);">
              <h4 style="margin-top: 0; margin-bottom: var(--space-sm); color: var(--color-text); font-size: var(--text-base);">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style="display: inline-block; vertical-align: middle; margin-right: var(--space-xs); color: var(--color-info);">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                </svg>
                Required Permissions
              </h4>
              <ul style="margin: 0; padding-left: var(--space-lg); color: var(--color-text); line-height: 1.8;">
                <li><strong>File System Access:</strong> Monitor workspace directories for file changes</li>
                <li><strong>Cursor Database Access:</strong> Read Cursor's internal database to extract AI prompts and conversations</li>
                <li><strong>System Metrics:</strong> Collect CPU, memory, and process information</li>
              </ul>
            </div>

            <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid var(--color-info); border-radius: var(--radius-sm); padding: var(--space-md); margin-top: var(--space-md);">
              <p style="margin: 0; font-size: var(--text-sm); color: var(--color-text); line-height: 1.6;">
                <strong style="color: var(--color-info);">Privacy Note:</strong> All data is stored locally on your machine. 
                The companion service only reads data from Cursor - it never sends data to external servers unless you explicitly share it.
              </p>
            </div>
          </div>
        </div>

        <!-- Step 3: Access Dashboard -->
        <div style="margin-bottom: var(--space-xl); padding: var(--space-lg); background: var(--color-bg-alt); border-radius: var(--radius-md); border-left: 4px solid var(--color-success);">
          <h3 style="display: flex; align-items: center; gap: var(--space-sm); margin-top: 0; margin-bottom: var(--space-md); color: var(--color-success);">
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: var(--color-success); color: white; border-radius: 50%; font-weight: 600;">3</span>
            Access the Dashboard
          </h3>
          <div>
            <p style="margin-bottom: var(--space-sm); color: var(--color-text);">
              Once the companion service is running, refresh this page. The dashboard will automatically connect and start displaying your data.
            </p>
            <div style="display: flex; gap: var(--space-sm); align-items: center; margin-top: var(--space-md);">
              <button class="btn btn-primary" onclick="location.reload()" style="flex: 1;">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style="margin-right: var(--space-xs);">
                  <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 5.674 1 1 0 11-2 0A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-5.674 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
                </svg>
                Refresh Page
              </button>
              <button class="btn btn-secondary" onclick="closeLandingPageModal()" style="flex: 1;">
                Continue Anyway
              </button>
            </div>
          </div>
        </div>

        <!-- Next Steps -->
        <div style="margin-bottom: var(--space-lg); padding: var(--space-lg); background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%); border-radius: var(--radius-md); color: white;">
          <h3 style="margin-top: 0; margin-bottom: var(--space-md); display: flex; align-items: center; gap: var(--space-sm);">
            <svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
              <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
            </svg>
            What's Next?
          </h3>
          <ul style="margin: 0; padding-left: var(--space-lg); line-height: 1.8;">
            <li>Explore the <strong>Overview</strong> to see real-time activity stats</li>
            <li>Check the <strong>Activity</strong> timeline to view your code changes and AI interactions</li>
            <li>Use <strong>Analytics</strong> to understand your productivity patterns</li>
            <li>Visualize file relationships in the <strong>File Graph</strong></li>
            <li>Share your workspace data with teammates using <strong>Share Workspace</strong></li>
          </ul>
        </div>

        <!-- Help Section -->
        <div style="padding: var(--space-md); background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md);">
          <h4 style="margin-top: 0; margin-bottom: var(--space-sm); color: var(--color-text); font-size: var(--text-base);">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style="display: inline-block; vertical-align: middle; margin-right: var(--space-xs); color: var(--color-info);">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
            </svg>
            Need Help?
          </h4>
          <p style="margin: 0; font-size: var(--text-sm); color: var(--color-text-muted); line-height: 1.6;">
            If the companion service isn't connecting, check that it's running on port 43917. 
            You can also visit the <strong>API Docs</strong> view for complete API documentation, 
            or check the connection status indicator in the top-right corner.
          </p>
        </div>
      </div>
      
      <div class="modal-actions" style="border-top: 1px solid var(--color-border); padding: var(--space-md); display: flex; justify-content: space-between; align-items: center;">
        <label style="display: flex; align-items: center; gap: var(--space-xs); cursor: pointer; font-size: var(--text-sm); color: var(--color-text-muted);">
          <input type="checkbox" id="dontShowAgain" style="cursor: pointer;">
          <span>Don't show this again</span>
        </label>
        <button class="btn btn-primary" onclick="closeLandingPageModal()">
          Get Started
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeLandingPageModal();
    }
  });
  
  // Close on Escape key
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeLandingPageModal();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
}

/**
 * Close landing page modal
 */
function closeLandingPageModal() {
  const modal = document.getElementById('landingPageModal');
  if (modal) {
    // Check if "Don't show again" is checked
    const dontShowAgain = document.getElementById('dontShowAgain');
    if (dontShowAgain && dontShowAgain.checked) {
      markLandingPageSeen();
    }
    modal.remove();
  }
}

/**
 * Check and show landing page if needed
 */
function checkAndShowLandingPage() {
  // Only show on first visit
  if (!hasSeenLandingPage()) {
    // Wait a bit for the page to load, then show modal
    setTimeout(() => {
      showLandingPageModal();
    }, 500);
  }
}

// Export to window for global access
window.showLandingPageModal = showLandingPageModal;
window.closeLandingPageModal = closeLandingPageModal;
window.checkAndShowLandingPage = checkAndShowLandingPage;
window.hasSeenLandingPage = hasSeenLandingPage;
window.markLandingPageSeen = markLandingPageSeen;


