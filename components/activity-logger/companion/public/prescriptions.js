/**
 * Prescriptions Dashboard UI
 * 
 * Frontend logic for managing AI behavioral prescriptions.
 */

const API_BASE = 'http://localhost:43917/api/prescriptions';

let prescriptions = [];
let currentEditId = null;
let filters = {
  search: '',
  category: '',
  scope: '',
  active: ''
};

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  loadPrescriptions();
  loadStats();
  setupEventListeners();
});

function setupEventListeners() {
  // Search input
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', debounce(() => {
    filters.search = searchInput.value;
    filterPrescriptions();
  }, 300));

  // Filter selects
  document.getElementById('category-filter').addEventListener('change', (e) => {
    filters.category = e.target.value;
    filterPrescriptions();
  });

  document.getElementById('scope-filter').addEventListener('change', (e) => {
    filters.scope = e.target.value;
    filterPrescriptions();
  });

  document.getElementById('active-filter').addEventListener('change', (e) => {
    filters.active = e.target.value;
    filterPrescriptions();
  });

  // Priority slider
  document.getElementById('priority').addEventListener('input', (e) => {
    document.getElementById('priority-value').textContent = e.target.value;
  });

  // Character counter
  document.getElementById('prescription').addEventListener('input', (e) => {
    document.getElementById('char-count').textContent = e.target.value.length;
  });
}

// ============================================
// Data Loading
// ============================================

async function loadPrescriptions() {
  try {
    const response = await fetch(`${API_BASE}`);
    const data = await response.json();
    
    if (data.success) {
      prescriptions = data.prescriptions;
      renderPrescriptions(prescriptions);
    }
  } catch (error) {
    showToast('Failed to load prescriptions', 'error');
    console.error(error);
  }
}

async function loadStats() {
  try {
    const response = await fetch(`${API_BASE}/stats`);
    const data = await response.json();
    
    if (data.success) {
      document.getElementById('stat-total').textContent = data.stats.total;
      document.getElementById('stat-active').textContent = data.stats.active;
      document.getElementById('stat-inactive').textContent = data.stats.inactive;
      document.getElementById('stat-conflicts').textContent = data.stats.conflicts.length;
    }
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

// ============================================
// Rendering
// ============================================

function renderPrescriptions(items) {
  const container = document.getElementById('prescriptions-container');
  const emptyState = document.getElementById('empty-state');

  if (items.length === 0) {
    container.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  container.style.display = 'block';
  emptyState.style.display = 'none';

  // Group by category
  const grouped = groupByCategory(items);

  container.innerHTML = Object.entries(grouped)
    .map(([category, prescriptions]) => renderCategory(category, prescriptions))
    .join('');
}

function groupByCategory(items) {
  return items.reduce((acc, item) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});
}

function renderCategory(category, items) {
  const icons = {
    formatting: '✨',
    behavior: '🎯',
    domain: '🏗️',
    workflow: '⚙️',
    security: '🔒',
    communication: '💬',
    allowlist: '✅',
    blocklist: '🚫',
    constraints: '⚠️'
  };

  const icon = icons[category] || '•';
  
  return `
    <div class="category-section">
      <h2 class="category-title">${icon} ${capitalize(category)}</h2>
      <div class="prescriptions-grid">
        ${items.map(renderPrescriptionCard).join('')}
      </div>
    </div>
  `;
}

function renderPrescriptionCard(prescription) {
  const scopeBadge = getScopeBadge(prescription.scope, prescription.scope_value);
  const priorityClass = getPriorityClass(prescription.priority);
  const activeClass = prescription.active ? '' : 'inactive';

  return `
    <div class="prescription-card ${activeClass}" data-id="${prescription.id}">
      <div class="card-header">
        <h3 class="card-title">${escapeHtml(prescription.title)}</h3>
        <div class="card-actions">
          <label class="toggle-switch">
            <input type="checkbox" ${prescription.active ? 'checked' : ''} 
                   onchange="togglePrescription('${prescription.id}')">
            <span class="toggle-slider"></span>
          </label>
          <button onclick="editPrescription('${prescription.id}')" class="btn-icon" title="Edit">
            ✏️
          </button>
          <button onclick="deletePrescription('${prescription.id}')" class="btn-icon" title="Delete">
            🗑️
          </button>
        </div>
      </div>
      
      <p class="card-prescription">${escapeHtml(prescription.prescription)}</p>
      
      <div class="card-footer">
        ${scopeBadge}
        <span class="badge priority ${priorityClass}">
          Priority: ${prescription.priority}
        </span>
        <span class="badge applied">
          Applied ${prescription.applied_count || 0}x
        </span>
      </div>
    </div>
  `;
}

function getScopeBadge(scope, scopeValue) {
  const label = scopeValue ? `${scope}: ${scopeValue}` : scope;
  return `<span class="badge scope">${label}</span>`;
}

function getPriorityClass(priority) {
  if (priority >= 80) return 'high';
  if (priority <= 30) return 'low';
  return 'medium';
}

// ============================================
// Filtering
// ============================================

function filterPrescriptions() {
  let filtered = [...prescriptions];

  if (filters.search) {
    const search = filters.search.toLowerCase();
    filtered = filtered.filter(p =>
      p.title.toLowerCase().includes(search) ||
      p.prescription.toLowerCase().includes(search)
    );
  }

  if (filters.category) {
    filtered = filtered.filter(p => p.category === filters.category);
  }

  if (filters.scope) {
    filtered = filtered.filter(p => p.scope === filters.scope);
  }

  if (filters.active) {
    const isActive = filters.active === 'true';
    filtered = filtered.filter(p => p.active === isActive);
  }

  renderPrescriptions(filtered);
}

function clearFilters() {
  filters = { search: '', category: '', scope: '', active: '' };
  document.getElementById('search-input').value = '';
  document.getElementById('category-filter').value = '';
  document.getElementById('scope-filter').value = '';
  document.getElementById('active-filter').value = '';
  renderPrescriptions(prescriptions);
}

// ============================================
// CRUD Operations
// ============================================

async function savePrescription(event) {
  event.preventDefault();

  const formData = new FormData(event.target);
  const data = {
    title: formData.get('title'),
    prescription: formData.get('prescription'),
    category: formData.get('category'),
    scope: formData.get('scope'),
    scope_value: formData.get('scope_value') || null,
    priority: parseInt(formData.get('priority')),
    active: document.getElementById('active').checked
  };

  try {
    const url = currentEditId 
      ? `${API_BASE}/${currentEditId}`
      : `${API_BASE}`;
    
    const method = currentEditId ? 'PATCH' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (result.success) {
      showToast(currentEditId ? 'Prescription updated' : 'Prescription created', 'success');
      closeModal();
      loadPrescriptions();
      loadStats();
    } else {
      showToast(result.errors?.join(', ') || 'Failed to save', 'error');
    }
  } catch (error) {
    showToast('Failed to save prescription', 'error');
    console.error(error);
  }
}

async function togglePrescription(id) {
  try {
    const response = await fetch(`${API_BASE}/${id}/toggle`, {
      method: 'POST'
    });

    const result = await response.json();

    if (result.success) {
      loadPrescriptions();
      loadStats();
    }
  } catch (error) {
    showToast('Failed to toggle prescription', 'error');
    console.error(error);
  }
}

async function deletePrescription(id) {
  if (!confirm('Are you sure you want to delete this prescription?')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      showToast('Prescription deleted', 'success');
      loadPrescriptions();
      loadStats();
    }
  } catch (error) {
    showToast('Failed to delete prescription', 'error');
    console.error(error);
  }
}

// ============================================
// Modal Management
// ============================================

function showCreateModal() {
  currentEditId = null;
  document.getElementById('modal-title').textContent = 'Create Prescription';
  document.getElementById('prescription-form').reset();
  document.getElementById('priority-value').textContent = '50';
  document.getElementById('char-count').textContent = '0';
  document.getElementById('active').checked = true;
  toggleScopeValue();
  document.getElementById('prescription-modal').style.display = 'flex';
}

function editPrescription(id) {
  const prescription = prescriptions.find(p => p.id === id);
  if (!prescription) return;

  currentEditId = id;
  document.getElementById('modal-title').textContent = 'Edit Prescription';
  
  document.getElementById('title').value = prescription.title;
  document.getElementById('prescription').value = prescription.prescription;
  document.getElementById('category').value = prescription.category;
  document.getElementById('scope').value = prescription.scope;
  document.getElementById('scope_value').value = prescription.scope_value || '';
  document.getElementById('priority').value = prescription.priority;
  document.getElementById('priority-value').textContent = prescription.priority;
  document.getElementById('active').checked = prescription.active;
  document.getElementById('char-count').textContent = prescription.prescription.length;
  
  toggleScopeValue();
  document.getElementById('prescription-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('prescription-modal').style.display = 'none';
  currentEditId = null;
}

function toggleScopeValue() {
  const scope = document.getElementById('scope').value;
  const scopeValueGroup = document.getElementById('scope-value-group');
  
  if (scope !== 'global') {
    scopeValueGroup.style.display = 'block';
    document.getElementById('scope_value').required = true;
  } else {
    scopeValueGroup.style.display = 'none';
    document.getElementById('scope_value').required = false;
  }
}

// ============================================
// Suggestions
// ============================================

async function showSuggestions() {
  try {
    const response = await fetch(`${API_BASE}/suggest`);
    const data = await response.json();

    if (data.success) {
      renderSuggestions(data.suggestions);
      document.getElementById('suggestions-modal').style.display = 'flex';
    }
  } catch (error) {
    showToast('Failed to load suggestions', 'error');
    console.error(error);
  }
}

function renderSuggestions(suggestions) {
  const container = document.getElementById('suggestions-content');

  if (suggestions.length === 0) {
    container.innerHTML = '<p class="empty-message">No suggestions available. Keep coding to build pattern history!</p>';
    return;
  }

  container.innerHTML = suggestions.map(suggestion => `
    <div class="suggestion-card">
      <div class="suggestion-header">
        <h3>${escapeHtml(suggestion.title)}</h3>
        <span class="confidence-badge">
          ${Math.round(suggestion.confidence * 100)}% confidence
        </span>
      </div>
      <p>${escapeHtml(suggestion.prescription)}</p>
      <div class="suggestion-meta">
        <span class="badge">${suggestion.category}</span>
        <span class="suggestion-reason">${suggestion.reason}</span>
      </div>
      <button onclick='acceptSuggestion(${JSON.stringify(suggestion).replace(/'/g, "&apos;")})' 
              class="btn btn-primary btn-sm">
        Accept & Create
      </button>
    </div>
  `).join('');
}

async function acceptSuggestion(suggestion) {
  try {
    const response = await fetch(`${API_BASE}/suggest/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(suggestion)
    });

    const result = await response.json();

    if (result.success) {
      showToast('Prescription created from suggestion', 'success');
      closeSuggestionsModal();
      loadPrescriptions();
      loadStats();
    }
  } catch (error) {
    showToast('Failed to accept suggestion', 'error');
    console.error(error);
  }
}

function closeSuggestionsModal() {
  document.getElementById('suggestions-modal').style.display = 'none';
}

// ============================================
// Templates
// ============================================

async function showTemplates() {
  try {
    const response = await fetch(`${API_BASE}/templates`);
    const data = await response.json();

    if (data.success) {
      renderTemplates(data.templates);
      document.getElementById('templates-modal').style.display = 'flex';
    }
  } catch (error) {
    showToast('Failed to load templates', 'error');
    console.error(error);
  }
}

function renderTemplates(templates) {
  const container = document.getElementById('templates-content');

  container.innerHTML = templates.map(template => `
    <div class="template-card">
      <h3>${escapeHtml(template.name)}</h3>
      <p>${escapeHtml(template.description)}</p>
      <div class="template-prescriptions">
        <strong>${template.prescriptions.length} prescriptions:</strong>
        <ul>
          ${template.prescriptions.map(p => `<li>${escapeHtml(p.title)}</li>`).join('')}
        </ul>
      </div>
      <button onclick="applyTemplate('${template.id}')" class="btn btn-primary">
        Apply Template
      </button>
    </div>
  `).join('');
}

async function applyTemplate(templateId) {
  try {
    const response = await fetch(`${API_BASE}/templates/${templateId}/apply`, {
      method: 'POST'
    });

    const result = await response.json();

    if (result.success) {
      showToast(`Template applied: ${result.result.success} prescriptions created`, 'success');
      closeTemplatesModal();
      loadPrescriptions();
      loadStats();
    }
  } catch (error) {
    showToast('Failed to apply template', 'error');
    console.error(error);
  }
}

function closeTemplatesModal() {
  document.getElementById('templates-modal').style.display = 'none';
}

// ============================================
// Import/Export
// ============================================

function showImportExport() {
  document.getElementById('import-export-modal').style.display = 'flex';
}

function closeImportExportModal() {
  document.getElementById('import-export-modal').style.display = 'none';
}

async function exportPrescriptions() {
  try {
    const response = await fetch(`${API_BASE}/export`);
    const data = await response.json();

    if (data.success) {
      const blob = new Blob([JSON.stringify(data.prescriptions, null, 2)], 
                            { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prescriptions-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      showToast('Prescriptions exported', 'success');
    }
  } catch (error) {
    showToast('Failed to export', 'error');
    console.error(error);
  }
}

async function importPrescriptions() {
  const fileInput = document.getElementById('import-file');
  const overwrite = document.getElementById('import-overwrite').checked;

  if (!fileInput.files.length) {
    showToast('Please select a file', 'error');
    return;
  }

  try {
    const file = fileInput.files[0];
    const text = await file.text();
    const prescriptions = JSON.parse(text);

    const response = await fetch(`${API_BASE}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prescriptions, overwrite })
    });

    const result = await response.json();

    if (result.success) {
      showToast(`Imported: ${result.result.success} success, ${result.result.skipped} skipped`, 'success');
      closeImportExportModal();
      loadPrescriptions();
      loadStats();
    }
  } catch (error) {
    showToast('Failed to import', 'error');
    console.error(error);
  }
}

// ============================================
// Utilities
// ============================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

