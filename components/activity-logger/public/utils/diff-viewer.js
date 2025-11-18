/**
 * Git-style Diff Viewer
 * Computes and renders unified diffs with green/red highlights
 */

/**
 * Compute a unified diff from before and after content
 * Returns an array of diff lines with type: 'added', 'removed', 'context', or 'unchanged'
 */
function computeUnifiedDiff(beforeContent, afterContent) {
  if (!beforeContent && !afterContent) return [];
  if (!beforeContent) {
    // All additions
    return afterContent.split('\n').map((line, i) => ({
      type: 'added',
      lineNumber: i + 1,
      content: line,
      beforeLineNumber: null,
      afterLineNumber: i + 1
    }));
  }
  if (!afterContent) {
    // All removals
    return beforeContent.split('\n').map((line, i) => ({
      type: 'removed',
      lineNumber: i + 1,
      content: line,
      beforeLineNumber: i + 1,
      afterLineNumber: null
    }));
  }

  const beforeLines = beforeContent.split('\n');
  const afterLines = afterContent.split('\n');
  const diff = [];
  
  // Simple line-by-line comparison
  // For a more sophisticated diff, we could use a library like diff-match-patch
  const maxLen = Math.max(beforeLines.length, afterLines.length);
  let beforeIdx = 0;
  let afterIdx = 0;
  let beforeLineNum = 1;
  let afterLineNum = 1;
  
  // Use a simple longest common subsequence approach
  while (beforeIdx < beforeLines.length || afterIdx < afterLines.length) {
    const beforeLine = beforeIdx < beforeLines.length ? beforeLines[beforeIdx] : null;
    const afterLine = afterIdx < afterLines.length ? afterLines[afterIdx] : null;
    
    if (beforeLine === null) {
      // Only after content remains - all additions
      diff.push({
        type: 'added',
        content: afterLine,
        beforeLineNumber: null,
        afterLineNumber: afterLineNum
      });
      afterIdx++;
      afterLineNum++;
    } else if (afterLine === null) {
      // Only before content remains - all removals
      diff.push({
        type: 'removed',
        content: beforeLine,
        beforeLineNumber: beforeLineNum,
        afterLineNumber: null
      });
      beforeIdx++;
      beforeLineNum++;
    } else if (beforeLine === afterLine) {
      // Lines match - context
      diff.push({
        type: 'context',
        content: beforeLine,
        beforeLineNumber: beforeLineNum,
        afterLineNumber: afterLineNum
      });
      beforeIdx++;
      afterIdx++;
      beforeLineNum++;
      afterLineNum++;
    } else {
      // Lines differ - check if it's a modification or separate add/remove
      // Look ahead to see if we can find a match
      let foundMatch = false;
      let lookAhead = 1;
      const maxLookAhead = 5; // Limit lookahead for performance
      
      // Check if next after line matches current before line (removal)
      if (afterIdx + 1 < afterLines.length && afterLines[afterIdx + 1] === beforeLine) {
        diff.push({
          type: 'added',
          content: afterLine,
          beforeLineNumber: null,
          afterLineNumber: afterLineNum
        });
        afterIdx++;
        afterLineNum++;
        foundMatch = true;
      }
      // Check if next before line matches current after line (addition)
      else if (beforeIdx + 1 < beforeLines.length && beforeLines[beforeIdx + 1] === afterLine) {
        diff.push({
          type: 'removed',
          content: beforeLine,
          beforeLineNumber: beforeLineNum,
          afterLineNumber: null
        });
        beforeIdx++;
        beforeLineNum++;
        foundMatch = true;
      }
      
      if (!foundMatch) {
        // Treat as modification: remove old, add new
        diff.push({
          type: 'removed',
          content: beforeLine,
          beforeLineNumber: beforeLineNum,
          afterLineNumber: null
        });
        diff.push({
          type: 'added',
          content: afterLine,
          beforeLineNumber: null,
          afterLineNumber: afterLineNum
        });
        beforeIdx++;
        afterIdx++;
        beforeLineNum++;
        afterLineNum++;
      }
    }
  }
  
  return diff;
}

/**
 * Render a Git-style diff viewer
 * @param {string} beforeContent - The before content
 * @param {string} afterContent - The after content
 * @param {Object} options - Options for rendering
 * @returns {string} HTML string for the diff viewer
 */
function renderGitDiff(beforeContent, afterContent, options = {}) {
  const {
    maxLines = 50,
    showLineNumbers = true,
    collapseUnchanged = true,
    filePath = '',
    escapeHtml = window.escapeHtml || ((text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    })
  } = options;
  
  const diff = computeUnifiedDiff(beforeContent || '', afterContent || '');
  
  if (diff.length === 0) {
    return '<div class="diff-empty">No changes detected</div>';
  }
  
  // Collapse unchanged lines if requested
  let displayDiff = diff;
  if (collapseUnchanged && diff.length > maxLines) {
    const hasChanges = diff.some(line => line.type === 'added' || line.type === 'removed');
    if (hasChanges) {
      // Show first few lines, then collapse, then show last few lines
      const contextLines = 3;
      let firstChangeIdx = diff.findIndex(line => line.type === 'added' || line.type === 'removed');
      let lastChangeIdx = diff.length - 1 - diff.slice().reverse().findIndex(line => line.type === 'added' || line.type === 'removed');
      
      const startIdx = Math.max(0, firstChangeIdx - contextLines);
      const endIdx = Math.min(diff.length, lastChangeIdx + contextLines + 1);
      
      displayDiff = [
        ...diff.slice(0, startIdx),
        { type: 'collapse', beforeCount: firstChangeIdx - startIdx, afterCount: 0 },
        ...diff.slice(startIdx, endIdx),
        { type: 'collapse', beforeCount: diff.length - endIdx, afterCount: 0 },
        ...diff.slice(endIdx)
      ].filter(item => item !== undefined);
    }
  }
  
  const diffId = `diff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  let beforeLineNum = 0;
  let afterLineNum = 0;
  
  const diffLines = displayDiff.map((line, idx) => {
    if (line.type === 'collapse') {
      return `
        <tr class="diff-line diff-collapse" data-diff-id="${diffId}">
          <td class="diff-line-number"></td>
          <td class="diff-line-number"></td>
          <td class="diff-line-content" colspan="2">
            <button class="diff-expand-btn" onclick="expandDiffContext('${diffId}', ${idx})" style="
              width: 100%;
              padding: var(--space-xs);
              background: var(--color-bg-alt);
              border: 1px dashed var(--color-border);
              border-radius: var(--radius-sm);
              color: var(--color-text-muted);
              font-size: var(--text-xs);
              cursor: pointer;
              font-family: inherit;
            ">
              ... ${line.beforeCount} unchanged lines ...
            </button>
          </td>
        </tr>
      `;
    }
    
    let beforeNum = '';
    let afterNum = '';
    let lineClass = '';
    let lineStyle = '';
    
    if (line.type === 'added') {
      lineClass = 'diff-added';
      lineStyle = 'background: rgba(34, 197, 94, 0.1);';
      afterNum = showLineNumbers ? line.afterLineNumber : '';
      afterLineNum = line.afterLineNumber;
    } else if (line.type === 'removed') {
      lineClass = 'diff-removed';
      lineStyle = 'background: rgba(239, 68, 68, 0.1);';
      beforeNum = showLineNumbers ? line.beforeLineNumber : '';
      beforeLineNum = line.beforeLineNumber;
    } else {
      lineClass = 'diff-context';
      beforeNum = showLineNumbers ? line.beforeLineNumber : '';
      afterNum = showLineNumbers ? line.afterLineNumber : '';
      beforeLineNum = line.beforeLineNumber;
      afterLineNum = line.afterLineNumber;
    }
    
    const content = escapeHtml(line.content || '');
    
    return `
      <tr class="diff-line ${lineClass}" style="${lineStyle}">
        <td class="diff-line-number diff-line-number-removed">${beforeNum}</td>
        <td class="diff-line-number diff-line-number-added">${afterNum}</td>
        <td class="diff-line-marker">
          ${line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
        </td>
        <td class="diff-line-content">${content}</td>
      </tr>
    `;
  }).join('');
  
  return `
    <div class="git-diff-viewer" id="${diffId}">
      <table class="diff-table">
        <tbody>
          ${diffLines}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Expand collapsed context in diff viewer
 */
window.expandDiffContext = function(diffId, collapseIdx) {
  // This would need to be implemented to expand the full diff
  // For now, just remove the collapse row
  const collapseRow = document.querySelector(`[data-diff-id="${diffId}"].diff-collapse`);
  if (collapseRow) {
    collapseRow.style.display = 'none';
  }
};

// Export functions
window.computeUnifiedDiff = computeUnifiedDiff;
window.renderGitDiff = renderGitDiff;

