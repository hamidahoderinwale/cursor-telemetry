/**
 * Prescription System Integration Example
 * 
 * How to integrate prescriptions into your existing companion service.
 * Copy the relevant parts to your main index.js or create a separate integration file.
 */

/* 
 * ============================================
 * STEP 1: Import and Initialize
 * ============================================
 * 
 * Add to the top of companion/src/index.js
 */

// const { initializePrescriptionSystem } = require('./prescriptions');

/*
 * ============================================
 * STEP 2: Initialize After Database Setup
 * ============================================
 * 
 * Add after your SQLite database is initialized
 */

// Initialize prescription system
// const prescriptionSystem = initializePrescriptionSystem(db, app);

// if (prescriptionSystem) {
//   console.log('✓ Prescription system ready');
//   
//   // Make components available globally if needed
//   global.prescriptionManager = prescriptionSystem.manager;
//   global.prescriptionInjector = prescriptionSystem.injector;
//   global.prescriptionDetector = prescriptionSystem.detector;
// } else {
//   console.error('✗ Failed to initialize prescription system');
// }

/*
 * ============================================
 * STEP 3: Auto-Suggest on Startup (Optional)
 * ============================================
 * 
 * Automatically detect and suggest prescriptions on startup
 */

// // Wait a bit for data to be available
// setTimeout(async () => {
//   if (prescriptionSystem) {
//     const suggestions = await prescriptionSystem.detector.getAllSuggestions();
//     
//     if (suggestions.combined.length > 0) {
//       console.log(`\n[IDEA] Found ${suggestions.combined.length} prescription suggestions:`);
//       suggestions.combined.slice(0, 5).forEach(s => {
//         console.log(`  - ${s.title} (${Math.round(s.confidence * 100)}% confidence)`);
//       });
//       console.log(`\nView all at: http://localhost:43917/prescriptions.html\n`);
//     }
//   }
// }, 5000);

/*
 * ============================================
 * STEP 4: Inject into MCP Prompts (Optional)
 * ============================================
 * 
 * If you have MCP integration, inject prescriptions into prompts
 */

// app.post('/api/mcp/prompt', async (req, res) => {
//   const { prompt, context } = req.body;
//   
//   if (prescriptionSystem) {
//     // Get active prescriptions for this context
//     const injection = prescriptionSystem.injector.inject({
//       workspace: context?.workspace,
//       fileType: context?.fileType,
//       filePath: context?.filePath
//     });
//     
//     if (injection.count > 0) {
//       console.log(`[CLIPBOARD] Injecting ${injection.count} prescriptions into prompt`);
//       
//       // Prepend prescriptions to user prompt
//       const enhancedPrompt = injection.formatted + prompt;
//       
//       // Track application
//       injection.prescriptions.forEach(p => {
//         prescriptionSystem.manager.recordApplication(p.id);
//       });
//       
//       // Forward enhanced prompt to AI...
//       return res.json({
//         success: true,
//         enhancedPrompt,
//         prescriptionsApplied: injection.count
//       });
//     }
//   }
//   
//   // No prescriptions, use original prompt
//   res.json({ success: true, enhancedPrompt: prompt });
// });

/*
 * ============================================
 * STEP 5: Helper Endpoint (Optional)
 * ============================================
 * 
 * Add convenience endpoint to get current prescriptions
 */

// app.get('/api/current-prescriptions', async (req, res) => {
//   if (!prescriptionSystem) {
//     return res.status(503).json({ error: 'Prescription system not available' });
//   }
//   
//   const context = {
//     workspace: req.query.workspace,
//     fileType: req.query.fileType,
//     filePath: req.query.filePath
//   };
//   
//   const injection = prescriptionSystem.injector.inject(context);
//   
//   res.json({
//     success: true,
//     count: injection.count,
//     prescriptions: injection.prescriptions,
//     formatted: injection.formatted
//   });
// });

/*
 * ============================================
 * STEP 6: Daily Suggestion Check (Optional)
 * ============================================
 * 
 * Run daily to check for new suggestions
 */

// if (prescriptionSystem) {
//   // Check for suggestions daily
//   setInterval(async () => {
//     try {
//       const suggestions = await prescriptionSystem.detector.getAllSuggestions();
//       
//       if (suggestions.combined.length > 0) {
//         console.log(`\n[IDEA] Daily suggestion check: ${suggestions.combined.length} new suggestions`);
//         console.log('View at: http://localhost:43917/prescriptions.html\n');
//       }
//     } catch (error) {
//       console.error('Error checking suggestions:', error.message);
//     }
//   }, 24 * 60 * 60 * 1000); // 24 hours
// }

/*
 * ============================================
 * STEP 7: Serve Dashboard UI
 * ============================================
 * 
 * The dashboard is automatically served at /prescriptions.html
 * when you initialize with the app parameter.
 * 
 * Access at: http://localhost:43917/prescriptions.html
 */

/*
 * ============================================
 * COMPLETE INTEGRATION EXAMPLE
 * ============================================
 * 
 * Here's a complete example of what to add to index.js:
 */

// ===== ADD TO IMPORTS SECTION =====
// const { initializePrescriptionSystem } = require('./prescriptions');

// ===== ADD AFTER DATABASE INITIALIZATION =====
// // Initialize prescription system
// let prescriptionSystem = null;
// try {
//   prescriptionSystem = initializePrescriptionSystem(db, app);
//   
//   if (prescriptionSystem) {
//     console.log('✓ Prescription system initialized');
//     
//     // Auto-suggest after startup
//     setTimeout(async () => {
//       const suggestions = await prescriptionSystem.detector.getAllSuggestions();
//       if (suggestions.combined.length > 0) {
//         console.log(`[IDEA] ${suggestions.combined.length} prescription suggestions available`);
//       }
//     }, 5000);
//     
//     // Daily suggestion check
//     setInterval(async () => {
//       const suggestions = await prescriptionSystem.detector.getAllSuggestions();
//       if (suggestions.combined.length > 0) {
//         console.log(`[IDEA] Daily check: ${suggestions.combined.length} new suggestions`);
//       }
//     }, 24 * 60 * 60 * 1000);
//   }
// } catch (error) {
//   console.error('Failed to initialize prescription system:', error.message);
// }

// ===== EXPORT FOR USE IN OTHER MODULES =====
// module.exports = {
//   // ... existing exports
//   prescriptionSystem
// };

/*
 * ============================================
 * USAGE IN YOUR CODE
 * ============================================
 */

// Example: Get prescriptions for current file
// const getPrescriptionsForFile = (filePath) => {
//   if (!prescriptionSystem) return null;
//   
//   const fileType = filePath.match(/\.[^.]+$/)?.[0];
//   const workspace = filePath.split('/').slice(0, -2).join('/');
//   
//   return prescriptionSystem.injector.inject({
//     workspace,
//     fileType,
//     filePath
//   });
// };

// Example: Create prescription programmatically
// const createPrescription = (title, text, category = 'behavior') => {
//   if (!prescriptionSystem) return null;
//   
//   return prescriptionSystem.manager.create({
//     title,
//     prescription: text,
//     category,
//     scope: 'global',
//     priority: 50,
//     source: 'auto-detected'
//   });
// };

// Example: Check if specific prescription exists
// const hasPrescription = (titlePattern) => {
//   if (!prescriptionSystem) return false;
//   
//   const all = prescriptionSystem.manager.getAll({ active: true });
//   return all.some(p => p.title.match(new RegExp(titlePattern, 'i')));
// };

module.exports = {
  // This file is for documentation only
  // Copy the relevant sections to your index.js
};

