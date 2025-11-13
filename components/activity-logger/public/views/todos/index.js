/**
 * Todos View
 * Displays todos and task management interface
 */

function renderTodoView(container) {
  // Check if todos API endpoint exists
  const hasTodosAPI = window.APIClient && typeof window.APIClient.get === 'function';
  
  container.innerHTML = `
    <div class="todos-view">
      <div class="view-header">
        <h1 class="view-title">Todos & Tasks</h1>
        <p class="view-description">
          Manage your todos and track task completion
        </p>
      </div>
      
      <div class="todos-content">
        ${hasTodosAPI ? `
          <div id="todos-container" class="todos-container">
            <div class="loading-state">Loading todos...</div>
          </div>
        ` : `
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg width="48" height="48" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
              </svg>
            </div>
            <div class="empty-state-text">
              <h3>Todos API Not Available</h3>
              <p>The todos feature requires the companion service API endpoint <code>/api/todos</code> to be available.</p>
            </div>
          </div>
        `}
      </div>
    </div>
  `;
  
  if (hasTodosAPI) {
    loadTodos();
  }
}

async function loadTodos() {
  const container = document.getElementById('todos-container');
  if (!container) return;
  
  try {
    const response = await window.APIClient.get('/api/todos');
    const todos = response.data || response || [];
    
    if (todos.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="48" height="48" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div class="empty-state-text">
            <h3>No Todos Found</h3>
            <p>You don't have any todos yet. Create one to get started.</p>
          </div>
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      <div class="todos-list">
        ${todos.map(todo => `
          <div class="todo-item ${todo.completed ? 'completed' : ''}">
            <input type="checkbox" ${todo.completed ? 'checked' : ''} 
                   onchange="toggleTodo(${todo.id}, this.checked)">
            <div class="todo-content">
              <div class="todo-title">${escapeHtml(todo.title || 'Untitled')}</div>
              ${todo.description ? `<div class="todo-description">${escapeHtml(todo.description)}</div>` : ''}
              ${todo.dueDate ? `<div class="todo-due-date">Due: ${new Date(todo.dueDate).toLocaleDateString()}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    console.error('[TODOS] Error loading todos:', error);
    container.innerHTML = `
      <div class="error-state">
        <div class="error-message">
          <strong>Failed to load todos</strong>
          <p>${error.message || 'Unknown error occurred'}</p>
        </div>
      </div>
    `;
  }
}

async function toggleTodo(id, completed) {
  try {
    await window.APIClient.post(`/api/todos/${id}/status`, { completed });
    await loadTodos(); // Reload to reflect changes
  } catch (error) {
    console.error('[TODOS] Error updating todo:', error);
    alert(`Failed to update todo: ${error.message}`);
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Export to window for global access
window.renderTodoView = renderTodoView;
window.toggleTodo = toggleTodo;






