/**
 * TODO View - Task tracking
 */

async function renderTodoView(container) {
  container.innerHTML = `
    <div style="max-width: 1200px; margin: 0 auto;">
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Task Tracking</h2>
          <p style="font-size: var(--text-sm); color: var(--color-text-muted); margin-top: var(--space-xs);">
            TODOs created by AI assistant, linked to prompts and file changes
          </p>
        </div>
        <div class="card-body" id="todoListContainer">
          <div style="display: flex; justify-content: center; padding: var(--space-2xl);">
            <div class="spinner"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    const response = await fetch(`${window.CONFIG.API_BASE}/api/todos`);
    const data = await response.json();
    
    const todos = data.todos || data || [];
    
    const todoListContainer = document.getElementById('todoListContainer');
    
    if (!todos || todos.length === 0) {
      todoListContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-2xl); text-align: center;">
          <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No TODOs Yet</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted); max-width: 400px;">
            TODOs will appear here automatically when the AI assistant creates them during your workflow
          </div>
        </div>
      `;
      return;
    }

    // Group todos by status
    const grouped = {
      in_progress: todos.filter(t => t.status === 'in_progress'),
      pending: todos.filter(t => t.status === 'pending'),
      completed: todos.filter(t => t.status === 'completed')
    };

    const totalCompleted = grouped.completed.length;
    const totalTodos = todos.length;
    const completionRate = totalTodos > 0 ? Math.round((totalCompleted / totalTodos) * 100) : 0;

    todoListContainer.innerHTML = `
      <!-- Progress Summary -->
      <div style="display: flex; gap: var(--space-lg); margin-bottom: var(--space-xl); padding: var(--space-lg); background: var(--color-bg); border-radius: var(--radius-md);">
        <div style="flex: 1;">
          <div style="font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-xs);">Total Tasks</div>
          <div style="font-size: var(--text-2xl); font-weight: 600; color: var(--color-text);">${totalTodos}</div>
        </div>
        <div style="flex: 1;">
          <div style="font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-xs);">Completed</div>
          <div style="font-size: var(--text-2xl); font-weight: 600; color: var(--color-success);">${totalCompleted}</div>
        </div>
        <div style="flex: 1;">
          <div style="font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-xs);">In Progress</div>
          <div style="font-size: var(--text-2xl); font-weight: 600; color: var(--color-primary);">${grouped.in_progress.length}</div>
        </div>
        <div style="flex: 1;">
          <div style="font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-xs);">Completion Rate</div>
          <div style="font-size: var(--text-2xl); font-weight: 600; color: var(--color-text);">${completionRate}%</div>
        </div>
      </div>

      <!-- TODO Sections -->
      ${grouped.in_progress.length > 0 ? `
        <div style="margin-bottom: var(--space-xl);">
          <h3 style="font-size: var(--text-md); font-weight: 600; color: var(--color-text); margin-bottom: var(--space-md); display: flex; align-items: center; gap: var(--space-sm);">
            <span style="color: var(--color-primary);"></span> In Progress
          </h3>
          <div style="display: flex; flex-direction: column; gap: var(--space-md);">
            ${grouped.in_progress.map(todo => renderTodoItem(todo)).join('')}
          </div>
        </div>
      ` : ''}

      ${grouped.pending.length > 0 ? `
        <div style="margin-bottom: var(--space-xl);">
          <h3 style="font-size: var(--text-md); font-weight: 600; color: var(--color-text); margin-bottom: var(--space-md); display: flex; align-items: center; gap: var(--space-sm);">
            <span style="color: var(--color-text-muted);"></span> Pending
          </h3>
          <div style="display: flex; flex-direction: column; gap: var(--space-md);">
            ${grouped.pending.map(todo => renderTodoItem(todo)).join('')}
          </div>
        </div>
      ` : ''}

      ${grouped.completed.length > 0 ? `
        <div>
          <h3 style="font-size: var(--text-md); font-weight: 600; color: var(--color-text); margin-bottom: var(--space-md); display: flex; align-items: center; gap: var(--space-sm);">
            <span style="color: var(--color-success);"></span> Completed
          </h3>
          <div style="display: flex; flex-direction: column; gap: var(--space-md);">
            ${grouped.completed.slice(0, 10).map(todo => renderTodoItem(todo)).join('')}
            ${grouped.completed.length > 10 ? `<div style="text-align: center; padding: var(--space-md); color: var(--color-text-muted);">... and ${grouped.completed.length - 10} more completed tasks</div>` : ''}
          </div>
        </div>
      ` : ''}
    `;
  } catch (error) {
    console.error('Error fetching TODOs:', error);
    document.getElementById('todoListContainer').innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-2xl); text-align: center;">
        <div style="font-size: var(--text-lg); color: var(--color-error); margin-bottom: var(--space-xs); font-weight: 500;">Error Loading TODOs</div>
        <div style="font-size: var(--text-sm); color: var(--color-text-muted);">${window.escapeHtml(error.message || 'Unknown error')}</div>
      </div>
    `;
  }
}

function renderTodoItem(todo) {
  const statusColor = {
    'pending': 'var(--color-text-muted)',
    'in_progress': 'var(--color-primary)',
    'completed': 'var(--color-success)'
  }[todo.status] || 'var(--color-text-muted)';

  return `
    <div class="card" style="border-left: 3px solid ${statusColor};">
      <div class="card-body">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-sm);">
          <h4 style="font-size: var(--text-base); font-weight: 600; color: var(--color-text); margin: 0;">${window.escapeHtml(todo.title || 'Untitled Task')}</h4>
          <span style="padding: var(--space-xs) var(--space-sm); background: ${statusColor}; color: white; border-radius: var(--radius-sm); font-size: var(--text-xs); text-transform: uppercase;">
            ${window.escapeHtml(todo.status || 'pending')}
          </span>
        </div>
        ${todo.description ? `<p style="color: var(--color-text-muted); margin: var(--space-sm) 0;">${window.escapeHtml(todo.description)}</p>` : ''}
        <div style="display: flex; gap: var(--space-md); font-size: var(--text-xs); color: var(--color-text-muted);">
          ${todo.created_at ? `<span>Created: ${new Date(todo.created_at).toLocaleDateString()}</span>` : ''}
          ${todo.workspace ? `<span>Workspace: ${window.escapeHtml(todo.workspace.split('/').pop())}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

// Export to window for global access
window.renderTodoView = renderTodoView;
window.renderTodoItem = renderTodoItem;

