/**
 * Diagnostic utility for AI Model Usage component
 * Run this in the browser console to check data availability
 */

function diagnoseModelUsageData() {
  const prompts = window.state?.data?.prompts || [];

  console.group('AI Model Usage Diagnostics');
  console.log(`Total prompts: ${prompts.length}`);
  
  if (prompts.length === 0) {
    console.warn(' No prompts data available');
    console.groupEnd();
    return;
  }
  
  // Sample first 5 prompts to see structure
  console.log('\n Sample prompts (first 5):');
  prompts.slice(0, 5).forEach((p, i) => {
    console.log(`\nPrompt ${i + 1}:`, {
      id: p.id,
      timestamp: p.timestamp,
      modelName: p.modelName,
      model_name: p.model_name,
      model: p.model,
      modelType: p.modelType,
      model_type: p.model_type,
      modelInfo: p.modelInfo,
      mode: p.mode,
      type: p.type,
      metadata: p.metadata
    });
  });
  
  // Analyze model data availability
  const modelFields = {
    hasModelName: 0,
    hasModel_name: 0,
    hasModel: 0,
    hasModelType: 0,
    hasModel_type: 0,
    hasModelInfo: 0,
    hasMode: 0,
    hasType: 0,
    hasMetadata: 0,
    unknown: 0
  };
  
  const modelNames = new Set();
  const modes = new Set();
  
  prompts.forEach(p => {
    if (p.modelName) modelFields.hasModelName++;
    if (p.model_name) modelFields.hasModel_name++;
    if (p.model) modelFields.hasModel++;
    if (p.modelType) modelFields.hasModelType++;
    if (p.model_type) modelFields.hasModel_type++;
    if (p.modelInfo) modelFields.hasModelInfo++;
    if (p.mode) modelFields.hasMode++;
    if (p.type) modelFields.hasType++;
    if (p.metadata) modelFields.hasMetadata++;
    
    // Extract model name using same logic as component
    const modelName = p.modelName || p.model_name || p.model || 
                     p.modelInfo?.model || p.modelInfo?.modelName || 
                     p.modelInfo?.model_name || p.metadata?.model ||
                     (p.modelType && p.modelName ? `${p.modelType}/${p.modelName}` : null) ||
                     (p.model_type && p.model_name ? `${p.model_type}/${p.model_name}` : null) ||
                     p.modelType || p.model_type || 'Unknown';
    
    modelNames.add(modelName);
    
    const mode = p.type || p.mode || p.metadata?.mode || 'Not Specified';
    modes.add(mode);
    
    if (modelName === 'Unknown') modelFields.unknown++;
  });
  
  console.log('\nModel Data Availability:');
  console.table(modelFields);
  
  console.log(`\n Unique Models Found: ${modelNames.size}`);
  console.log('Models:', Array.from(modelNames).slice(0, 20));
  
  console.log(`\nUnique Modes Found: ${modes.size}`);
  console.log('Modes:', Array.from(modes));
  
  // Check component rendering
  const container = document.getElementById('modelUsageAnalytics');
  if (container) {
    console.log('\nComponent container found');
    console.log('Container content length:', container.innerHTML.length);
  } else {
    console.warn('\nComponent container NOT found (view might not be active)');
  }
  
  // Check if function is available
  if (window.renderModelUsageAnalytics) {
    console.log('renderModelUsageAnalytics function is available');
  } else {
    console.error('renderModelUsageAnalytics function NOT available');
  }
  
  console.groupEnd();
  
  return {
    totalPrompts: prompts.length,
    modelFields,
    uniqueModels: modelNames.size,
    uniqueModes: modes.size,
    models: Array.from(modelNames),
    modes: Array.from(modes),
    containerExists: !!container,
    functionExists: !!window.renderModelUsageAnalytics
  };
}

// Export to window
window.diagnoseModelUsageData = diagnoseModelUsageData;

// Auto-run if in analytics view
if (document.getElementById('modelUsageAnalytics')) {
  console.log('Running automatic diagnostics...');
  setTimeout(() => diagnoseModelUsageData(), 1000);
}

