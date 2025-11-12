import { diffLines, diffWords, diffChars } from 'diff';

class DiffEngine {
  createDiff(before, after) {
    if (before === after) {
      return null;
    }

    // Use line-based diff for better readability
    const changes = diffLines(before, after);

    // Convert to unified diff format
    let diffText = '';
    let addedLines = 0;
    let removedLines = 0;

    for (const change of changes) {
      if (change.added) {
        addedLines += change.count || 0;
        diffText += change.value
          .split('\n')
          .map((line) => `+${line}`)
          .join('\n');
      } else if (change.removed) {
        removedLines += change.count || 0;
        diffText += change.value
          .split('\n')
          .map((line) => `-${line}`)
          .join('\n');
      } else {
        // Context lines (unchanged)
        diffText += change.value;
      }
    }

    return {
      text: diffText,
      addedLines,
      removedLines,
      totalChanges: addedLines + removedLines,
      size: diffText.length,
    };
  }

  createWordDiff(before, after) {
    const changes = diffWords(before, after);
    return changes;
  }

  createCharDiff(before, after) {
    const changes = diffChars(before, after);
    return changes;
  }

  // Calculate similarity percentage
  calculateSimilarity(before, after) {
    if (before === after) return 100;
    if (!before || !after) return 0;

    const longer = before.length > after.length ? before : after;
    const shorter = before.length > after.length ? after : before;

    if (longer.length === 0) return 100;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return Math.round(((longer.length - editDistance) / longer.length) * 100);
  }

  // Levenshtein distance calculation
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  // Check if change is significant
  isSignificantChange(before, after, threshold = 12) {
    if (!before || !after) return true;

    const diff = this.createDiff(before, after);
    if (!diff) return false;

    return diff.size >= threshold;
  }
}

export const diffEngine = new DiffEngine();
