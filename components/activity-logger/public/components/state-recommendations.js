/**
 * State Recommendations Component
 * Shows intelligent recommendations about states
 */

class StateRecommendations {
  constructor(containerId) {
    this.containerId = containerId;
    this.apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    this.recommendations = [];
  }

  /**
   * Load and display recommendations
   */
  async loadRecommendations(workspacePath = null) {
    try {
      const url = new URL(`${this.apiBase}/api/states/recommendations`);
      if (workspacePath) {
        url.searchParams.set('workspace_path', workspacePath);
      }

      const response = await fetch(url);
      if (response.ok) {
        try {
          const data = await response.json();
          this.recommendations = data.recommendations || [];
          this.render();
        } catch (parseError) {
          console.warn('[STATE-RECOMMENDATIONS] Error parsing JSON response:', parseError);
          this.recommendations = [];
          this.render();
        }
      }
    } catch (error) {
      console.warn('[STATE-RECOMMENDATIONS] Error loading recommendations:', error.message);
    }
  }

  /**
   * Render recommendations
   */
  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    if (this.recommendations.length === 0) {
      container.innerHTML = '';
      return;
    }

    const escapeHtml = window.escapeHtml || ((str) => {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    });

    let html = `<div class="state-recommendations" style="padding: var(--space-md); background: var(--color-bg-alt); border-radius: var(--radius-md); margin-bottom: var(--space-md);">`;
    html += `<div class="recommendations-header" style="font-weight: 600; margin-bottom: var(--space-md); display: flex; align-items: center; gap: var(--space-xs);">`;
    html += `<span>[Idea] Recommendations</span>`;
    html += `</div>`;

    this.recommendations.forEach((rec, index) => {
      html += `<div class="recommendation-item" style="background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: var(--space-md); margin-bottom: var(--space-sm);">`;
      html += `<div class="recommendation-message" style="margin-bottom: var(--space-sm); color: var(--color-text);">${escapeHtml(rec.message)}</div>`;
      
      if (rec.states && rec.states.length > 0) {
        html += `<div class="recommendation-states" style="display: flex; gap: var(--space-xs); flex-wrap: wrap;">`;
        rec.states.forEach(state => {
          html += `<button class="state-chip" style="background: var(--color-primary); color: white; border: none; padding: 4px 12px; border-radius: 4px; font-size: 0.85em; cursor: pointer; transition: opacity 0.2s;" onclick="handleRecommendationAction('${rec.action}', '${state.id}')" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">`;
          html += `${escapeHtml(state.name)}`;
          html += `</button>`;
        });
        html += `</div>`;
      }
      
      html += `</div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
  }
}

/**
 * Handle recommendation action
 */
async function handleRecommendationAction(action, stateId) {
  if (!window.stateService) {
    console.warn('[STATE-RECOMMENDATIONS] State service not available');
    return;
  }

  try {
    if (action === 'merge') {
      // Show merge dialog or execute merge
      const result = await window.stateService.executeCommand(`merge ${stateId} into main`, {});
      if (result.success) {
        alert('Merge prepared! Check the merge plan.');
      }
    } else if (action === 'fork') {
      // Fork the state
      const state = await window.stateService.listStates();
      const targetState = state.find(s => s.id === stateId);
      if (targetState) {
        const forked = await window.stateService.forkState(stateId, `Fork: ${targetState.name}`, '');
        if (forked) {
          alert(`Forked state "${forked.name}"`);
        }
      }
    }
  } catch (error) {
    console.error('[STATE-RECOMMENDATIONS] Error handling action:', error);
    alert(`Error: ${error.message}`);
  }
}

// Export
if (typeof window !== 'undefined') {
  window.StateRecommendations = StateRecommendations;
  window.handleRecommendationAction = handleRecommendationAction;
}

