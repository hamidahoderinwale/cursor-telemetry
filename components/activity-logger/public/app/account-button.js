/**
 * Account Button Helper
 * Adds account button to dashboard header
 */

function addAccountButton() {
  // Wait for DOM and account modal to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addAccountButton);
    return;
  }

  // Wait for account modal to be available
  if (!window.accountModal) {
    setTimeout(addAccountButton, 100);
    return;
  }

  // Find header
  const header = document.querySelector('.dashboard-header');
  if (!header) {
    // Try again after a short delay
    setTimeout(addAccountButton, 500);
    return;
  }

  // Check if button already exists
  if (document.getElementById('accountButton')) {
    return;
  }

  // Get account status to determine button state
  window.accountClient?.getStatus().then(status => {
    const isAuthenticated = status?.authenticated || false;
    const account = status?.account;

    // Create account button
    const accountBtn = document.createElement('button');
    accountBtn.id = 'accountButton';
    accountBtn.className = 'btn btn-secondary';
    accountBtn.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-left: auto;';
    accountBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
      </svg>
      <span>${isAuthenticated ? (account?.email || 'Account') : 'Account'}</span>
    `;
    
    accountBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.accountModal) {
        window.accountModal.show('status');
      }
    };

    accountBtn.title = isAuthenticated 
      ? `Account: ${account?.email || 'Connected'}` 
      : 'Connect your account to port Cursor code across devices';

    // Add to header (try to find a good spot)
    const headerActions = header.querySelector('.header-actions') || header.querySelector('.header-right');
    if (headerActions) {
      headerActions.appendChild(accountBtn);
    } else {
      // Create actions container if it doesn't exist
      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'header-actions';
      actionsContainer.style.cssText = 'display: flex; align-items: center; gap: var(--space-sm); margin-left: auto;';
      actionsContainer.appendChild(accountBtn);
      header.appendChild(actionsContainer);
    }

    // Update button when account status changes
    if (window.accountClient) {
      window.accountClient.on('logged_in', () => {
        updateAccountButton();
      });
      window.accountClient.on('logged_out', () => {
        updateAccountButton();
      });
    }
  }).catch(error => {
    console.warn('[ACCOUNT] Could not get account status:', error.message);
    // Still add button, just without status
    addAccountButtonFallback();
  });
}

function updateAccountButton() {
  const btn = document.getElementById('accountButton');
  if (!btn) return;

  window.accountClient?.getStatus().then(status => {
    const isAuthenticated = status?.authenticated || false;
    const account = status?.account;
    
    const span = btn.querySelector('span');
    if (span) {
      span.textContent = isAuthenticated ? (account?.email || 'Account') : 'Account';
    }
    
    btn.title = isAuthenticated 
      ? `Account: ${account?.email || 'Connected'}` 
      : 'Connect your account to port Cursor code across devices';
  });
}

function addAccountButtonFallback() {
  const header = document.querySelector('.dashboard-header');
  if (!header || document.getElementById('accountButton')) return;

  const accountBtn = document.createElement('button');
  accountBtn.id = 'accountButton';
  accountBtn.className = 'btn btn-secondary';
  accountBtn.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-left: auto;';
  accountBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
    </svg>
    <span>Account</span>
  `;
  
  accountBtn.onclick = (e) => {
    e.preventDefault();
    if (window.accountModal) {
      window.accountModal.show('status');
    }
  };

  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'header-actions';
  actionsContainer.style.cssText = 'display: flex; align-items: center; gap: var(--space-sm); margin-left: auto;';
  actionsContainer.appendChild(accountBtn);
  header.appendChild(actionsContainer);
}

// Initialize when scripts are loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(addAccountButton, 500);
  });
} else {
  setTimeout(addAccountButton, 500);
}

// Export for manual initialization
window.addAccountButton = addAccountButton;



