#!/usr/bin/env node
/**
 * Simple Build Script
 * Concatenates and minifies critical files without full bundling
 * Fast compilation, no complex dependency resolution needed
 */

const fs = require('fs');
const path = require('path');

console.log('[BUILD] Building optimized dashboard files...\n');

// Create dist directory
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

/**
 * Concatenate files in order
 */
function concatenateFiles(files, outputPath) {
  console.log(`[CONCAT] Concatenating ${files.length} files -> ${path.basename(outputPath)}`);
  
  let combined = '';
  let totalSize = 0;
  
  for (const file of files) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      totalSize += content.length;
      
      // Add file marker comment
      combined += `\n// ========== ${file} ==========\n`;
      combined += content;
      combined += '\n';
    } else {
      console.warn(`  [WARN] File not found: ${file}`);
    }
  }
  
  fs.writeFileSync(outputPath, combined);
  const outputSize = fs.statSync(outputPath).size;
  
  console.log(`  [OK] ${(totalSize / 1024).toFixed(2)} KB -> ${(outputSize / 1024).toFixed(2)} KB`);
  return outputSize;
}

/**
 * Simple minification (remove comments and extra whitespace)
 */
function simpleMinify(inputPath, outputPath) {
  const input = fs.readFileSync(inputPath, 'utf8');
  
  // Remove multi-line comments
  let minified = input.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Remove single-line comments (but preserve URLs)
  minified = minified.replace(/(?<!:)\/\/.*$/gm, '');
  
  // Remove excess whitespace
  minified = minified.replace(/\n\s*\n/g, '\n');
  
  // Trim lines
  minified = minified.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
  
  fs.writeFileSync(outputPath, minified);
  
  const inputSize = fs.statSync(inputPath).size;
  const outputSize = fs.statSync(outputPath).size;
  const savings = ((1 - outputSize / inputSize) * 100).toFixed(1);
  
  console.log(`  [OK] ${(inputSize / 1024).toFixed(2)} KB -> ${(outputSize / 1024).toFixed(2)} KB (${savings}% smaller)`);
}

// ============================================================================
// Build Step 1: Critical Path Bundle
// ============================================================================
console.log('\n[STEP 1] Building critical path bundle...');

const criticalFiles = [
  'core/config.js',
  'core/state.js',
  'core/api-client.js',
  'utils/core/helpers.js',
  'utils/formatting/time-formatting.js',
  'utils/dom/templates.js'
];

const criticalPath = path.join(distDir, 'critical.bundle.js');
concatenateFiles(criticalFiles, criticalPath);

// ============================================================================
// Build Step 2: Performance Utilities Bundle
// ============================================================================
console.log('\n[STEP 2] Building performance utilities bundle...');

const perfFiles = [
  'utils/performance/debounce-throttle.js',
  'utils/performance/request-coalescer.js',
  'utils/performance/lazy-loader.js',
  'utils/performance/performance-monitor.js'
];

const perfPath = path.join(distDir, 'performance.bundle.js');
concatenateFiles(perfFiles, perfPath);

// ============================================================================
// Build Step 3: Data Services Bundle
// ============================================================================
console.log('\n[STEP 3] Building data services bundle...');

const dataFiles = [
  'services/data/persistent-storage.js',
  'services/data/data-access-service.js',
  'services/data/progressive-data-loader.js'
];

// Check which files exist
const existingDataFiles = dataFiles.filter(f => 
  fs.existsSync(path.join(__dirname, f))
);

if (existingDataFiles.length > 0) {
  const dataPath = path.join(distDir, 'data-services.bundle.js');
  concatenateFiles(existingDataFiles, dataPath);
} else {
  console.log('  [WARN] No data service files found, skipping');
}

// ============================================================================
// Build Step 4: Minify Large Files
// ============================================================================
console.log('\n[STEP 4] Minifying large files...');

const filesToMinify = [
  'dashboard.js',
  'views/analytics/index.js',
  'views/activity/index.js'
];

for (const file of filesToMinify) {
  const inputPath = path.join(__dirname, file);
  if (fs.existsSync(inputPath)) {
    const outputPath = path.join(distDir, file.replace('.js', '.min.js'));
    const outputDir = path.dirname(outputPath);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    console.log(`\n  Minifying ${file}...`);
    simpleMinify(inputPath, outputPath);
  }
}

// ============================================================================
// Build Step 5: Create loader script
// ============================================================================
console.log('\n[STEP 5] Creating optimized loader...');

const loaderScript = `
/**
 * Optimized Dashboard Loader
 * Loads critical bundles before main app
 */
(function() {
  'use strict';
  
  const startTime = performance.now();
  console.log('[LOADER] Starting optimized load...');
  
  // Load critical bundle first
  const criticalScript = document.createElement('script');
  criticalScript.src = 'dist/critical.bundle.js';
  criticalScript.async = false;
  
  criticalScript.onload = function() {
    console.log('[LOADER] Critical bundle loaded');
    
    // Load performance utilities
    const perfScript = document.createElement('script');
    perfScript.src = 'dist/performance.bundle.js';
    perfScript.async = false;
    
    perfScript.onload = function() {
      console.log('[LOADER] Performance bundle loaded');
      
      // Load data services
      const dataScript = document.createElement('script');
      dataScript.src = 'dist/data-services.bundle.js';
      dataScript.async = false;
      
      dataScript.onload = function() {
        const loadTime = performance.now() - startTime;
        console.log(\`[LOADER] All bundles loaded in \${loadTime.toFixed(2)}ms\`);
        
        // Signal that bundles are ready
        window.bundlesLoaded = true;
        window.dispatchEvent(new Event('bundlesReady'));
      };
      
      dataScript.onerror = function() {
        console.warn('[LOADER] Data services bundle failed, continuing...');
        window.bundlesLoaded = true;
        window.dispatchEvent(new Event('bundlesReady'));
      };
      
      document.head.appendChild(dataScript);
    };
    
    perfScript.onerror = function() {
      console.warn('[LOADER] Performance bundle failed, continuing...');
    };
    
    document.head.appendChild(perfScript);
  };
  
  criticalScript.onerror = function() {
    console.error('[LOADER] Critical bundle failed to load!');
  };
  
  document.head.appendChild(criticalScript);
})();
`;

fs.writeFileSync(path.join(distDir, 'loader.js'), loaderScript.trim());
console.log('  [OK] Loader script created');

// ============================================================================
// Summary
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('[BUILD] Complete!\n');

const distFiles = fs.readdirSync(distDir, { recursive: true })
  .filter(f => f.endsWith('.js'));

let totalSize = 0;
distFiles.forEach(f => {
  const size = fs.statSync(path.join(distDir, f)).size;
  totalSize += size;
  console.log(`  ${f.padEnd(30)} ${(size / 1024).toFixed(2)} KB`);
});

console.log('\n' + '='.repeat(60));
console.log(`[SUMMARY] Total bundled size: ${(totalSize / 1024).toFixed(2)} KB`);
console.log('\n[NEXT STEPS]:');
console.log('  1. Update dashboard.html to use dist/loader.js');
console.log('  2. Test the dashboard loads correctly');
console.log('  3. Measure performance improvement\n');

