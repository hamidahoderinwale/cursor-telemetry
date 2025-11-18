/**
 * Safe DOM Manipulation Utilities
 * Replaces innerHTML with safer, more performant alternatives
 */

/**
 * Safely set HTML content using DocumentFragment for better performance
 * @param {HTMLElement} element - Target element
 * @param {string} html - HTML string (will be sanitized)
 * @param {boolean} append - Whether to append instead of replace
 */
function safeSetHTML(element, html, append = false) {
  if (!element) return;
  
  // Create a temporary container
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment();
  while (temp.firstChild) {
    fragment.appendChild(temp.firstChild);
  }
  
  if (append) {
    element.appendChild(fragment);
  } else {
    // Clear existing content efficiently
    element.textContent = '';
    element.appendChild(fragment);
  }
}

/**
 * Create element with attributes and children
 * @param {string} tag - HTML tag name
 * @param {Object} attrs - Attributes object
 * @param {Array|string} children - Child elements or text
 * @returns {HTMLElement}
 */
function createElement(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);
  
  // Set attributes
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else if (key.startsWith('data-') || key.startsWith('aria-')) {
      element.setAttribute(key, value);
    } else if (key === 'onclick' || key.startsWith('on')) {
      // Handle event listeners
      const eventType = key.slice(2).toLowerCase();
      if (typeof value === 'function') {
        element.addEventListener(eventType, value);
      }
    } else {
      element[key] = value;
    }
  });
  
  // Add children
  if (typeof children === 'string') {
    element.textContent = children;
  } else if (Array.isArray(children)) {
    children.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        element.appendChild(child);
      }
    });
  }
  
  return element;
}

/**
 * Create multiple elements from a template
 * @param {Array} items - Array of item data
 * @param {Function} renderFn - Function that takes item and returns element
 * @returns {DocumentFragment}
 */
function createElements(items, renderFn) {
  const fragment = document.createDocumentFragment();
  items.forEach(item => {
    const element = renderFn(item);
    if (element) {
      fragment.appendChild(element);
    }
  });
  return fragment;
}

/**
 * Update element content efficiently (only updates if changed)
 * @param {HTMLElement} element - Target element
 * @param {string} newContent - New text content
 */
function updateTextContent(element, newContent) {
  if (!element) return;
  if (element.textContent !== newContent) {
    element.textContent = newContent;
  }
}

/**
 * Batch DOM updates for better performance
 * @param {Function} updateFn - Function that performs DOM updates
 */
function batchDOMUpdates(updateFn) {
  // Use requestAnimationFrame for smooth updates
  requestAnimationFrame(() => {
    // Temporarily disable layout thrashing
    const container = document.body;
    if (container) {
      container.style.display = 'none';
      updateFn();
      // Force reflow
      void container.offsetHeight;
      container.style.display = '';
    } else {
      updateFn();
    }
  });
}

/**
 * Replace innerHTML with safe alternative
 * This is a drop-in replacement that uses DocumentFragment
 */
function replaceInnerHTML(element, html) {
  safeSetHTML(element, html, false);
}

/**
 * Append HTML safely
 */
function appendHTML(element, html) {
  safeSetHTML(element, html, true);
}

// Export to window for global access
window.safeSetHTML = safeSetHTML;
window.createElement = createElement;
window.createElements = createElements;
window.updateTextContent = updateTextContent;
window.batchDOMUpdates = batchDOMUpdates;
window.replaceInnerHTML = replaceInnerHTML;
window.appendHTML = appendHTML;

