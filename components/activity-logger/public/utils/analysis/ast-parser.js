/**
 * AST Parser for Code Diffs
 * Parses code into a simplified AST structure for visualization
 */

class ASTParser {
  constructor() {
    this.nodeIdCounter = 0;
  }

  /**
   * Parse code into AST (simplified structure)
   * Uses regex-based parsing for common patterns (works for JS/TS/Python-like syntax)
   */
  parseCode(code, language = 'javascript') {
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return null;
    }

    this.nodeIdCounter = 0;
    const lines = code.split('\n');
    const ast = {
      type: 'Program',
      id: this._nextId(),
      children: [],
      startLine: 1,
      endLine: lines.length
    };

    // Parse based on language
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
      case 'js':
      case 'ts':
        return this._parseJavaScript(code, ast);
      case 'python':
      case 'py':
        return this._parsePython(code, ast);
      default:
        return this._parseGeneric(code, ast);
    }
  }

  _nextId() {
    return `node_${this.nodeIdCounter++}`;
  }

  /**
   * Parse JavaScript/TypeScript code
   */
  _parseJavaScript(code, root) {
    const lines = code.split('\n');
    let depth = 0;
    const stack = [root];
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) return;

      // Detect function declarations
      const funcMatch = trimmed.match(/^(export\s+)?(async\s+)?function\s+(\w+)|^const\s+(\w+)\s*=\s*(async\s*)?\(|^(\w+)\s*:\s*(async\s*)?\(/);
      if (funcMatch) {
        const funcName = funcMatch[3] || funcMatch[4] || funcMatch[6] || 'anonymous';
        const node = {
          type: 'FunctionDeclaration',
          id: this._nextId(),
          name: funcName,
          children: [],
          startLine: index + 1,
          endLine: index + 1,
          depth: depth
        };
        stack[stack.length - 1].children.push(node);
        stack.push(node);
        depth++;
        return;
      }

      // Detect class declarations
      const classMatch = trimmed.match(/^class\s+(\w+)/);
      if (classMatch) {
        const node = {
          type: 'ClassDeclaration',
          id: this._nextId(),
          name: classMatch[1],
          children: [],
          startLine: index + 1,
          endLine: index + 1,
          depth: depth
        };
        stack[stack.length - 1].children.push(node);
        stack.push(node);
        depth++;
        return;
      }

      // Detect variable declarations
      const varMatch = trimmed.match(/^(const|let|var)\s+(\w+)/);
      if (varMatch && depth === 0) {
        const node = {
          type: 'VariableDeclaration',
          id: this._nextId(),
          name: varMatch[2],
          children: [],
          startLine: index + 1,
          endLine: index + 1,
          depth: depth
        };
        stack[stack.length - 1].children.push(node);
        return;
      }

      // Detect if/else/for/while statements
      const controlMatch = trimmed.match(/^(if|else|for|while|switch)\s*\(/);
      if (controlMatch) {
        const node = {
          type: 'ControlStatement',
          id: this._nextId(),
          name: controlMatch[1],
          children: [],
          startLine: index + 1,
          endLine: index + 1,
          depth: depth
        };
        stack[stack.length - 1].children.push(node);
        stack.push(node);
        depth++;
        return;
      }

      // Track braces to manage depth
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      depth += openBraces - closeBraces;

      // Pop stack when closing braces
      if (closeBraces > 0 && stack.length > 1) {
        for (let i = 0; i < closeBraces && stack.length > 1; i++) {
          const popped = stack.pop();
          if (popped) {
            popped.endLine = index + 1;
          }
        }
      }
    });

    // Update end lines for remaining nodes
    stack.forEach(node => {
      if (node.endLine === node.startLine) {
        node.endLine = lines.length;
      }
    });

    return root;
  }

  /**
   * Parse Python code
   */
  _parsePython(code, root) {
    const lines = code.split('\n');
    let depth = 0;
    const stack = [root];
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      // Detect function definitions
      const funcMatch = trimmed.match(/^def\s+(\w+)/);
      if (funcMatch) {
        const node = {
          type: 'FunctionDeclaration',
          id: this._nextId(),
          name: funcMatch[1],
          children: [],
          startLine: index + 1,
          endLine: index + 1,
          depth: depth
        };
        stack[stack.length - 1].children.push(node);
        stack.push(node);
        depth++;
        return;
      }

      // Detect class definitions
      const classMatch = trimmed.match(/^class\s+(\w+)/);
      if (classMatch) {
        const node = {
          type: 'ClassDeclaration',
          id: this._nextId(),
          name: classMatch[1],
          children: [],
          startLine: index + 1,
          endLine: index + 1,
          depth: depth
        };
        stack[stack.length - 1].children.push(node);
        stack.push(node);
        depth++;
        return;
      }

      // Track indentation (Python uses indentation for blocks)
      const indent = line.match(/^(\s*)/)[1].length;
      const prevIndent = index > 0 ? lines[index - 1].match(/^(\s*)/)[1].length : 0;
      
      if (indent < prevIndent && stack.length > 1) {
        // Decreased indentation - pop stack
        while (stack.length > 1 && depth > indent / 4) {
          const popped = stack.pop();
          if (popped) {
            popped.endLine = index;
          }
          depth--;
        }
      }
    });

    return root;
  }

  /**
   * Generic parser for other languages
   */
  _parseGeneric(code, root) {
    const lines = code.split('\n');
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('#')) {
        root.children.push({
          type: 'Statement',
          id: this._nextId(),
          name: trimmed.substring(0, 50),
          children: [],
          startLine: index + 1,
          endLine: index + 1,
          depth: 0
        });
      }
    });
    return root;
  }

  /**
   * Compare two ASTs and mark differences
   */
  compareASTs(beforeAST, afterAST) {
    if (!beforeAST && !afterAST) return null;
    if (!beforeAST) return { type: 'added', ast: afterAST };
    if (!afterAST) return { type: 'removed', ast: beforeAST };

    // Mark nodes as added, removed, or modified
    this._markDifferences(beforeAST, afterAST);
    
    return {
      type: 'modified',
      before: beforeAST,
      after: afterAST
    };
  }

  _markDifferences(before, after) {
    // Simple comparison - mark nodes that changed
    if (before.type !== after.type || before.name !== after.name) {
      before._diff = 'removed';
      after._diff = 'added';
    } else {
      before._diff = 'unchanged';
      after._diff = 'unchanged';
    }

    // Recursively compare children
    const beforeChildren = before.children || [];
    const afterChildren = after.children || [];
    const maxLen = Math.max(beforeChildren.length, afterChildren.length);

    for (let i = 0; i < maxLen; i++) {
      if (i >= beforeChildren.length) {
        afterChildren[i]._diff = 'added';
      } else if (i >= afterChildren.length) {
        beforeChildren[i]._diff = 'removed';
      } else {
        this._markDifferences(beforeChildren[i], afterChildren[i]);
      }
    }
  }

  /**
   * Detect language from file path or content
   */
  detectLanguage(filePath, content) {
    if (filePath) {
      const ext = filePath.split('.').pop()?.toLowerCase();
      const langMap = {
        'js': 'javascript',
        'ts': 'typescript',
        'jsx': 'javascript',
        'tsx': 'typescript',
        'py': 'python',
        'java': 'java',
        'cpp': 'cpp',
        'c': 'c',
        'go': 'go',
        'rs': 'rust'
      };
      if (langMap[ext]) return langMap[ext];
    }
    return 'javascript'; // Default
  }
}

// Export for use in other modules
window.ASTParser = ASTParser;


