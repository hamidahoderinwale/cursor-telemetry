import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface PKLMemory {
  id: string;
  title: string;
  description: string;
  category: string;
  type: string;
  content: string;
  tags: string[];
  priority: string;
  status: string;
  autoExecute: boolean;
  created: number;
  updated: number;
  executed: number | null;
  executionCount: number;
  successRate: number;
  metadata: any;
}

interface PKLMemoryStorage {
  memories: PKLMemory[];
  lastUpdated: number;
}

export function activate(context: vscode.ExtensionContext) {
  console.log('PKL Memory Extension is now active!');

  // Register the command to show memories
  const showMemoriesCommand = vscode.commands.registerCommand('pkl-memory.showMemories', () => {
    showMemoriesPanel();
  });

  // Register the tree data provider for the memories view
  const memoryProvider = new MemoryTreeDataProvider();
  vscode.window.registerTreeDataProvider('pkl-memories', memoryProvider);

  // Register refresh command
  const refreshCommand = vscode.commands.registerCommand('pkl-memory.refresh', () => {
    memoryProvider.refresh();
  });

  context.subscriptions.push(showMemoriesCommand, refreshCommand);

  // Auto-refresh every 30 seconds
  setInterval(() => {
    memoryProvider.refresh();
  }, 30000);
}

class MemoryTreeDataProvider implements vscode.TreeDataProvider<MemoryItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<MemoryItem | undefined | null | void> = new vscode.EventEmitter<MemoryItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<MemoryItem | undefined | null | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: MemoryItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: MemoryItem): Thenable<MemoryItem[]> {
    if (!element) {
      return this.getMemories();
    } else {
      return Promise.resolve([]);
    }
  }

  private async getMemories(): Promise<MemoryItem[]> {
    try {
      const memoryFile = path.join(os.homedir(), 'Library/Application Support/Cursor/User/globalStorage/pkl-memories.json');
      
      if (!fs.existsSync(memoryFile)) {
        return [new MemoryItem('No memories found', 'No PKL memories have been created yet', vscode.TreeItemCollapsibleState.None)];
      }

      const data = fs.readFileSync(memoryFile, 'utf8');
      const storage: PKLMemoryStorage = JSON.parse(data);
      
      if (!storage.memories || storage.memories.length === 0) {
        return [new MemoryItem('No memories found', 'No PKL memories have been created yet', vscode.TreeItemCollapsibleState.None)];
      }

      return storage.memories.map(memory => {
        const item = new MemoryItem(
          memory.title,
          memory.description || memory.content.substring(0, 100) + '...',
          vscode.TreeItemCollapsibleState.None
        );
        
        item.tooltip = `Category: ${memory.category}\nType: ${memory.type}\nPriority: ${memory.priority}\nStatus: ${memory.status}\nCreated: ${new Date(memory.created).toLocaleString()}`;
        item.contextValue = 'memory';
        item.command = {
          command: 'pkl-memory.showMemoryDetails',
          title: 'Show Memory Details',
          arguments: [memory]
        };

        // Set icon based on category
        switch (memory.category) {
          case 'code':
            item.iconPath = new vscode.ThemeIcon('code');
            break;
          case 'data':
            item.iconPath = new vscode.ThemeIcon('database');
            break;
          case 'workflow':
            item.iconPath = new vscode.ThemeIcon('workflow');
            break;
          case 'insight':
            item.iconPath = new vscode.ThemeIcon('lightbulb');
            break;
          default:
            item.iconPath = new vscode.ThemeIcon('bookmark');
        }

        return item;
      });
    } catch (error) {
      console.error('Error loading memories:', error);
      return [new MemoryItem('Error loading memories', error.message, vscode.TreeItemCollapsibleState.None)];
    }
  }
}

class MemoryItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.description = description;
  }
}

async function showMemoriesPanel() {
  try {
    const memoryFile = path.join(os.homedir(), 'Library/Application Support/Cursor/User/globalStorage/pkl-memories.json');
    
    if (!fs.existsSync(memoryFile)) {
      vscode.window.showInformationMessage('No PKL memories found. Create memories in the PKL dashboard first.');
      return;
    }

    const data = fs.readFileSync(memoryFile, 'utf8');
    const storage: PKLMemoryStorage = JSON.parse(data);
    
    if (!storage.memories || storage.memories.length === 0) {
      vscode.window.showInformationMessage('No PKL memories found. Create memories in the PKL dashboard first.');
      return;
    }

    // Create and show a webview panel
    const panel = vscode.window.createWebviewPanel(
      'pklMemories',
      'PKL Memories',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = getWebviewContent(storage.memories);
  } catch (error) {
    vscode.window.showErrorMessage(`Error loading memories: ${error.message}`);
  }
}

function getWebviewContent(memories: PKLMemory[]): string {
  const memoryCards = memories.map(memory => `
    <div class="memory-card">
      <div class="memory-header">
        <h3>${escapeHtml(memory.title)}</h3>
        <span class="memory-category">${escapeHtml(memory.category)}</span>
      </div>
      <div class="memory-content">
        <p><strong>Description:</strong> ${escapeHtml(memory.description || 'No description')}</p>
        <p><strong>Type:</strong> ${escapeHtml(memory.type)}</p>
        <p><strong>Priority:</strong> ${escapeHtml(memory.priority)}</p>
        <p><strong>Status:</strong> ${escapeHtml(memory.status)}</p>
        <p><strong>Tags:</strong> ${memory.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join(' ')}</p>
        <p><strong>Created:</strong> ${new Date(memory.created).toLocaleString()}</p>
        <p><strong>Updated:</strong> ${new Date(memory.updated).toLocaleString()}</p>
        ${memory.executionCount > 0 ? `<p><strong>Executions:</strong> ${memory.executionCount} (${(memory.successRate * 100).toFixed(1)}% success)</p>` : ''}
      </div>
      <div class="memory-actions">
        <button onclick="showMemoryContent('${memory.id}')">View Content</button>
        <button onclick="copyMemoryContent('${memory.id}')">Copy Content</button>
      </div>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>PKL Memories</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          font-size: var(--vscode-font-size);
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
          padding: 20px;
        }
        .memory-card {
          border: 1px solid var(--vscode-panel-border);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
          background-color: var(--vscode-editor-background);
        }
        .memory-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .memory-header h3 {
          margin: 0;
          color: var(--vscode-textLink-foreground);
        }
        .memory-category {
          background-color: var(--vscode-badge-background);
          color: var(--vscode-badge-foreground);
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
        }
        .memory-content p {
          margin: 8px 0;
        }
        .tag {
          background-color: var(--vscode-textBlockQuote-background);
          color: var(--vscode-textBlockQuote-foreground);
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 11px;
          margin-right: 4px;
        }
        .memory-actions {
          margin-top: 12px;
        }
        .memory-actions button {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          margin-right: 8px;
        }
        .memory-actions button:hover {
          background-color: var(--vscode-button-hoverBackground);
        }
        .memory-content-modal {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          z-index: 1000;
        }
        .memory-content-modal-content {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background-color: var(--vscode-editor-background);
          padding: 20px;
          border-radius: 8px;
          max-width: 80%;
          max-height: 80%;
          overflow-y: auto;
        }
        .close {
          float: right;
          font-size: 24px;
          font-weight: bold;
          cursor: pointer;
        }
        pre {
          background-color: var(--vscode-textCodeBlock-background);
          padding: 12px;
          border-radius: 4px;
          overflow-x: auto;
          white-space: pre-wrap;
        }
      </style>
    </head>
    <body>
      <h1>PKL Memories (${memories.length})</h1>
      ${memoryCards}
      
      <div id="memoryContentModal" class="memory-content-modal">
        <div class="memory-content-modal-content">
          <span class="close" onclick="closeMemoryContent()">&times;</span>
          <h2 id="modalTitle"></h2>
          <pre id="modalContent"></pre>
        </div>
      </div>

      <script>
        const memories = ${JSON.stringify(memories)};
        
        function showMemoryContent(memoryId) {
          const memory = memories.find(m => m.id === memoryId);
          if (memory) {
            document.getElementById('modalTitle').textContent = memory.title;
            document.getElementById('modalContent').textContent = memory.content;
            document.getElementById('memoryContentModal').style.display = 'block';
          }
        }
        
        function closeMemoryContent() {
          document.getElementById('memoryContentModal').style.display = 'none';
        }
        
        function copyMemoryContent(memoryId) {
          const memory = memories.find(m => m.id === memoryId);
          if (memory) {
            navigator.clipboard.writeText(memory.content).then(() => {
              alert('Memory content copied to clipboard!');
            });
          }
        }
        
        // Close modal when clicking outside
        window.onclick = function(event) {
          const modal = document.getElementById('memoryContentModal');
          if (event.target === modal) {
            closeMemoryContent();
          }
        }
      </script>
    </body>
    </html>
  `;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function deactivate() {}
