const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Clio Integration Service for Advanced Intent Classification
 * Integrates with OpenClio for sophisticated conversation and code analysis
 */
class ClioIntentService {
  constructor() {
    this.clioAvailable = false;
    this.clioPath = this.findClioPath();
    this.facets = this.initializeFacets();
    this.initializeClio();
    
    // Analysis proportion toggles
    this.analysisProportions = {
      clio: 0.6,      // 60% weight for OpenClio/Kura analysis
      ast: 0.4,       // 40% weight for AST analysis
      auto: true      // Auto-adjust based on availability
    };
    
    // Initialize AST classifier if available
    this.astClassifier = null;
    this.initializeASTClassifier();
  }

  /**
   * Find Clio installation path
   */
  findClioPath() {
    const possiblePaths = [
      path.join(__dirname, 'OpenClio'),
      path.join(__dirname, '..', 'OpenClio'),
      path.join(process.env.HOME || '', 'OpenClio'),
      path.join(process.env.HOME || '', 'clio'),
      '/usr/local/bin/clio',
      '/opt/clio'
    ];

    for (const clioPath of possiblePaths) {
      if (fs.existsSync(clioPath)) {
        console.log(`Found Clio at: ${clioPath}`);
        return clioPath;
      }
    }

    console.log('Clio not found in standard locations');
    return null;
  }

  /**
   * Initialize Clio availability
   */
  async initializeClio() {
    if (this.clioPath) {
      try {
        // Test if Clio is working
        await this.testClioConnection();
        this.clioAvailable = true;
        console.log('Clio integration initialized successfully');
      } catch (error) {
        console.log('Clio not available:', error.message);
        this.clioAvailable = false;
      }
    }
  }

  /**
   * Initialize AST classifier with enhanced facets
   */
  initializeASTClassifier() {
    try {
      const ASTIntentClassifier = require('./ast-intent-classifier');
      // Pass this service to the AST classifier for enhanced facets
      this.astClassifier = new ASTIntentClassifier(this);
      console.log('AST classifier initialized successfully with enhanced facets');
    } catch (error) {
      console.log('AST classifier not available:', error.message);
      this.astClassifier = null;
    }
  }

  /**
   * Test Clio connection
   */
  async testClioConnection() {
    return new Promise((resolve, reject) => {
      const testScript = `
import sys
import os
sys.path.insert(0, '${this.clioPath}')

try:
    from openclio import Facet, ConversationFacetData
    print("Clio modules imported successfully")
except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)
`;

      const python = spawn('python3', ['-c', testScript]);
      
      python.stdout.on('data', (data) => {
        console.log('Clio test output:', data.toString());
      });
      
      python.stderr.on('data', (data) => {
        console.error('Clio test error:', data.toString());
      });
      
      python.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Clio test failed with code ${code}`));
        }
      });
    });
  }

  /**
   * Initialize facets (OpenClio-integrated with toggle percentages and AST patterns)
   */
  initializeFacets() {
    return {
      // Primary intent facets with OpenClio-integrated toggle percentages and AST patterns
      intent: {
        name: 'DataScienceIntent',
        question: 'What is the primary intent of this data science session?',
        prefill: 'The primary intent is to',
        summaryCriteria: 'Categorize by data science intent: exploration, implementation, debugging, refactoring, or documentation',
        options: ['explore', 'implement', 'debug', 'refactor', 'document'],
        togglePercentages: {
          explore: 0.35,      // 35% - Most common for data science (OpenClio optimized)
          implement: 0.25,    // 25% - Model building and implementation
          debug: 0.20,        // 20% - Debugging and troubleshooting
          refactor: 0.15,     // 15% - Code optimization and refactoring
          document: 0.05      // 5% - Documentation and commenting
        },
        astPatterns: {
          explore: {
            imports: ['pandas', 'numpy', 'matplotlib', 'seaborn', 'plotly', 'sklearn'],
            functions: ['read_csv', 'read_excel', 'head', 'tail', 'info', 'describe', 'plot', 'hist', 'scatter', 'boxplot'],
            constructs: ['import', 'pd.read_', 'df.', 'plt.', 'sns.'],
            keywords: ['explore', 'analyze', 'visualize', 'eda', 'exploratory', 'investigate'],
            variables: ['df', 'data', 'dataset', 'df_', 'data_']
          },
          implement: {
            imports: ['sklearn', 'tensorflow', 'torch', 'keras', 'xgboost', 'lightgbm'],
            functions: ['fit', 'predict', 'train', 'model', 'algorithm', 'pipeline', 'transform'],
            constructs: ['def ', 'class ', 'function', 'async def', 'model.', 'classifier.', 'regressor.'],
            keywords: ['implement', 'build', 'create', 'develop', 'train', 'model', 'algorithm'],
            variables: ['model', 'classifier', 'regressor', 'pipeline', 'estimator']
          },
          debug: {
            imports: ['pdb', 'traceback', 'logging'],
            functions: ['print', 'debug', 'pdb', 'breakpoint', 'traceback', 'exception', 'log'],
            constructs: ['try:', 'except:', 'finally:', 'raise', 'assert', 'if __name__'],
            keywords: ['debug', 'fix', 'error', 'bug', 'issue', 'problem', 'troubleshoot', 'exception'],
            variables: ['error', 'exception', 'traceback', 'debug']
          },
          refactor: {
            imports: ['refactor', 'optimize'],
            functions: ['refactor', 'optimize', 'clean', 'restructure', 'refactor_code'],
            constructs: ['# TODO:', '# FIXME:', '# REFACTOR:', 'def ', 'class '],
            keywords: ['refactor', 'optimize', 'improve', 'clean', 'restructure', 'performance', 'efficiency'],
            variables: ['refactored', 'optimized', 'cleaned']
          },
          document: {
            imports: ['docstring', 'help'],
            functions: ['docstring', 'help', 'documentation', 'explain'],
            constructs: ['"""', "'''", '# ', 'markdown', 'docstring'],
            keywords: ['document', 'explain', 'comment', 'describe', 'note', 'docstring'],
            variables: ['doc', 'documentation', 'comment']
          }
        },
        openclioIntegration: {
          enabled: true,
          facetType: 'primary_intent',
          confidenceBoost: 0.3,
          lastUpdated: new Date().toISOString()
        }
      },
      
      // Task type facets with toggle percentages and AST patterns
      task: {
        name: 'DataScienceTask',
        question: 'What specific data science task is being performed?',
        prefill: 'The data science task is to',
        summaryCriteria: 'Categorize by task type: analysis, modeling, visualization, preprocessing, or validation',
        options: ['analysis', 'modeling', 'visualization', 'preprocessing', 'validation'],
        togglePercentages: {
          analysis: 0.30,     // 30% - Data exploration and analysis
          modeling: 0.25,     // 25% - Machine learning model development
          visualization: 0.20, // 20% - Data visualization and plotting
          preprocessing: 0.15, // 15% - Data cleaning and preprocessing
          validation: 0.10    // 10% - Model validation and testing
        },
        astPatterns: {
          analysis: {
            imports: ['pandas', 'numpy', 'scipy', 'statsmodels'],
            functions: ['describe', 'info', 'corr', 'cov', 'groupby', 'agg', 'value_counts', 'unique'],
            constructs: ['df.', 'data.', 'statistical', 'summary'],
            keywords: ['analyze', 'statistics', 'summary', 'correlation', 'distribution', 'statistical'],
            variables: ['stats', 'summary', 'analysis', 'correlation']
          },
          modeling: {
            imports: ['sklearn', 'tensorflow', 'torch', 'keras', 'xgboost', 'lightgbm'],
            functions: ['fit', 'predict', 'train', 'model', 'algorithm', 'pipeline', 'transform', 'score'],
            constructs: ['model.', 'classifier.', 'regressor.', 'estimator.', 'pipeline.'],
            keywords: ['model', 'predict', 'train', 'algorithm', 'machine learning', 'classification', 'regression'],
            variables: ['model', 'classifier', 'regressor', 'estimator', 'pipeline']
          },
          visualization: {
            imports: ['matplotlib', 'seaborn', 'plotly', 'bokeh', 'altair'],
            functions: ['plot', 'hist', 'scatter', 'boxplot', 'heatmap', 'show', 'figure', 'subplot'],
            constructs: ['plt.', 'sns.', 'fig.', 'ax.', 'plotly.', 'bokeh.'],
            keywords: ['plot', 'chart', 'graph', 'visualize', 'display', 'figure', 'subplot'],
            variables: ['fig', 'ax', 'plot', 'chart', 'graph']
          },
          preprocessing: {
            imports: ['pandas', 'numpy', 'sklearn.preprocessing', 'sklearn.impute'],
            functions: ['fillna', 'dropna', 'scale', 'normalize', 'encode', 'StandardScaler', 'LabelEncoder'],
            constructs: ['preprocessing.', 'StandardScaler', 'LabelEncoder', 'OneHotEncoder', 'df.'],
            keywords: ['preprocess', 'clean', 'transform', 'scale', 'encode', 'normalize', 'impute'],
            variables: ['scaler', 'encoder', 'preprocessed', 'cleaned']
          },
          validation: {
            imports: ['sklearn.metrics', 'sklearn.model_selection', 'sklearn.cross_validation'],
            functions: ['score', 'accuracy_score', 'cross_val_score', 'confusion_matrix', 'classification_report'],
            constructs: ['metrics.', 'validation.', 'test_', 'cross_val_', 'train_test_split'],
            keywords: ['validate', 'test', 'score', 'accuracy', 'performance', 'cross validation', 'metrics'],
            variables: ['score', 'accuracy', 'metrics', 'validation', 'test_score']
          }
        }
      },
      
      // Complexity facets with toggle percentages and AST patterns
      complexity: {
        name: 'CodeComplexity',
        question: 'What is the complexity level of the code being written?',
        prefill: 'The code complexity is',
        summaryCriteria: 'Categorize by complexity: simple, moderate, or complex',
        options: ['simple', 'moderate', 'complex'],
        togglePercentages: {
          simple: 0.40,       // 40% - Simple scripts and basic operations
          moderate: 0.45,     // 45% - Medium complexity with some logic
          complex: 0.15       // 15% - Complex algorithms and architectures
        },
        astPatterns: {
          simple: {
            imports: ['pandas', 'numpy', 'matplotlib'],
            functions: ['print', 'read_csv', 'head', 'tail', 'plot', 'show'],
            constructs: ['import', 'print(', 'df.', 'plt.'],
            keywords: ['simple', 'basic', 'straightforward', 'direct'],
            variables: ['df', 'data', 'result'],
            complexity_indicators: ['< 50 lines', 'no loops', 'no functions', 'no classes', 'linear flow']
          },
          moderate: {
            imports: ['pandas', 'numpy', 'sklearn', 'matplotlib'],
            functions: ['def ', 'for ', 'if ', 'try:', 'except:', 'groupby', 'apply'],
            constructs: ['def ', 'for ', 'if ', 'try:', 'except:', 'lambda'],
            keywords: ['moderate', 'intermediate', 'some logic', 'conditional'],
            variables: ['function', 'loop', 'condition', 'result'],
            complexity_indicators: ['50-200 lines', 'some functions', 'basic logic', 'loops', 'conditionals']
          },
          complex: {
            imports: ['sklearn', 'tensorflow', 'torch', 'keras', 'complex'],
            functions: ['class ', 'async def', 'decorator', 'generator', 'pipeline', 'ensemble'],
            constructs: ['class ', 'async def', '@', 'yield', 'with ', 'context manager'],
            keywords: ['complex', 'advanced', 'sophisticated', 'architecture', 'design pattern'],
            variables: ['class', 'object', 'pipeline', 'ensemble', 'architecture'],
            complexity_indicators: ['> 200 lines', 'multiple classes', 'advanced patterns', 'async', 'decorators']
          }
        }
      },
      
      // Domain facets with toggle percentages and AST patterns
      domain: {
        name: 'DataScienceDomain',
        question: 'What domain or field is this data science work focused on?',
        prefill: 'The domain is',
        summaryCriteria: 'Categorize by domain: general, finance, healthcare, marketing, research, or other',
        options: ['general', 'finance', 'healthcare', 'marketing', 'research', 'other'],
        togglePercentages: {
          general: 0.50,      // 50% - General data science work
          finance: 0.15,      // 15% - Financial analysis and modeling
          healthcare: 0.10,   // 10% - Medical and health data analysis
          marketing: 0.10,    // 10% - Marketing analytics and customer insights
          research: 0.10,     // 10% - Academic and research applications
          other: 0.05         // 5% - Other specialized domains
        },
        astPatterns: {
          general: {
            imports: ['pandas', 'numpy', 'matplotlib', 'sklearn'],
            functions: ['read_csv', 'plot', 'fit', 'predict', 'describe', 'info'],
            constructs: ['df.', 'plt.', 'model.', 'data.'],
            keywords: ['data', 'analysis', 'model', 'general', 'basic'],
            variables: ['df', 'data', 'model', 'result']
          },
          finance: {
            imports: ['yfinance', 'pandas_datareader', 'quantlib', 'numpy', 'pandas'],
            functions: ['get_data', 'returns', 'volatility', 'portfolio', 'risk', 'sharpe'],
            constructs: ['yf.', 'pdr.', 'portfolio.', 'risk.'],
            keywords: ['finance', 'trading', 'portfolio', 'risk', 'returns', 'stocks', 'market'],
            variables: ['portfolio', 'returns', 'volatility', 'risk', 'sharpe']
          },
          healthcare: {
            imports: ['biopython', 'scipy.stats', 'sklearn', 'pandas', 'numpy'],
            functions: ['clinical', 'medical', 'patient', 'diagnosis', 'treatment', 'biomarker'],
            constructs: ['clinical.', 'medical.', 'patient.', 'diagnosis.'],
            keywords: ['healthcare', 'medical', 'clinical', 'patient', 'diagnosis', 'treatment', 'biomarker'],
            variables: ['patient', 'clinical', 'medical', 'diagnosis', 'treatment']
          },
          marketing: {
            imports: ['pandas', 'sklearn', 'matplotlib', 'seaborn'],
            functions: ['customer', 'segmentation', 'campaign', 'conversion', 'clustering', 'rfm'],
            constructs: ['customer.', 'segmentation.', 'campaign.', 'conversion.'],
            keywords: ['marketing', 'customer', 'segmentation', 'campaign', 'conversion', 'rfm', 'clustering'],
            variables: ['customer', 'segmentation', 'campaign', 'conversion', 'rfm']
          },
          research: {
            imports: ['scipy', 'statsmodels', 'sympy', 'matplotlib', 'pandas'],
            functions: ['hypothesis', 'statistical', 'research', 'experiment', 'significance', 'p_value'],
            constructs: ['stats.', 'research.', 'experiment.', 'hypothesis.'],
            keywords: ['research', 'hypothesis', 'statistical', 'experiment', 'study', 'significance', 'p_value'],
            variables: ['hypothesis', 'experiment', 'research', 'statistical', 'significance']
          },
          other: {
            imports: ['pandas', 'numpy', 'matplotlib', 'sklearn'],
            functions: ['custom', 'specialized', 'domain_specific', 'industry'],
            constructs: ['custom.', 'specialized.', 'domain.'],
            keywords: ['specialized', 'domain_specific', 'custom', 'industry', 'other'],
            variables: ['custom', 'specialized', 'domain', 'industry']
          }
        }
      }
    };
  }

  /**
   * Update toggle percentages for a specific facet
   */
  updateTogglePercentages(facetName, newPercentages) {
    if (this.facets[facetName] && this.facets[facetName].togglePercentages) {
      // Validate that percentages sum to 1.0
      const total = Object.values(newPercentages).reduce((sum, val) => sum + val, 0);
      if (Math.abs(total - 1.0) > 0.01) {
        console.warn(`Toggle percentages for ${facetName} don't sum to 1.0 (${total}), normalizing...`);
        // Normalize percentages
        Object.keys(newPercentages).forEach(key => {
          newPercentages[key] = newPercentages[key] / total;
        });
      }
      
      this.facets[facetName].togglePercentages = newPercentages;
      console.log(`Updated toggle percentages for ${facetName}:`, newPercentages);
    }
  }

  /**
   * Set analysis proportions for AST vs Clio/Kura
   */
  setAnalysisProportions(clioWeight, astWeight, autoAdjust = true) {
    // Validate that weights sum to 1.0
    const total = clioWeight + astWeight;
    if (Math.abs(total - 1.0) > 0.01) {
      console.warn(`Analysis proportions don't sum to 1.0 (${total}), normalizing...`);
      clioWeight = clioWeight / total;
      astWeight = astWeight / total;
    }
    
    this.analysisProportions = {
      clio: clioWeight,
      ast: astWeight,
      auto: autoAdjust
    };
    
    console.log(`Updated analysis proportions - Clio: ${(clioWeight * 100).toFixed(1)}%, AST: ${(astWeight * 100).toFixed(1)}%`);
  }

  /**
   * Get current analysis proportions
   */
  getAnalysisProportions() {
    return { ...this.analysisProportions };
  }

  /**
   * Auto-adjust proportions based on availability
   */
  autoAdjustProportions() {
    const clioAvailable = this.clioAvailable;
    const astAvailable = this.astClassifier !== null;
    
    if (clioAvailable && astAvailable) {
      // Both available - use configured proportions
      return this.analysisProportions;
    } else if (clioAvailable && !astAvailable) {
      // Only Clio available
      return { clio: 1.0, ast: 0.0, auto: true };
    } else if (!clioAvailable && astAvailable) {
      // Only AST available
      return { clio: 0.0, ast: 1.0, auto: true };
    } else {
      // Neither available - fallback to default
      return { clio: 0.5, ast: 0.5, auto: true };
    }
  }

  /**
   * Get toggle percentages for a specific facet
   */
  getTogglePercentages(facetName) {
    return this.facets[facetName]?.togglePercentages || {};
  }

  /**
   * Apply toggle percentages to classification results
   */
  applyTogglePercentages(classificationResult, facetName) {
    const percentages = this.getTogglePercentages(facetName);
    if (!percentages || Object.keys(percentages).length === 0) {
      return classificationResult;
    }

    // Adjust confidence based on toggle percentages
    const baseConfidence = classificationResult.confidence || 0.5;
    const intent = classificationResult.primary_intent || classificationResult.intent;
    
    if (percentages[intent]) {
      // Boost confidence if intent matches high percentage
      const percentageBoost = percentages[intent] * 0.3; // Max 30% boost
      const adjustedConfidence = Math.min(0.95, baseConfidence + percentageBoost);
      
      return {
        ...classificationResult,
        confidence: adjustedConfidence,
        toggle_adjustment: {
          original_confidence: baseConfidence,
          percentage_boost: percentageBoost,
          final_confidence: adjustedConfidence,
          intent_percentage: percentages[intent]
        }
      };
    }

    return classificationResult;
  }

  /**
   * Classify intent using Clio with toggle percentage adjustments
   */
  async classifyIntentWithClio(session, conversations = []) {
    if (!this.clioAvailable) {
      console.log('Clio not available, falling back to AST classification');
      return null;
    }

    try {
      // Prepare conversation data for Clio
      const clioData = this.prepareClioData(session, conversations);
      
      // Run Clio analysis
      const clioResults = await this.runClioAnalysis(clioData);
      
      // Process results
      const processedResults = this.processClioResults(clioResults, session);
      
      // Apply toggle percentage adjustments
      if (processedResults) {
        return this.applyTogglePercentages(processedResults, 'intent');
      }
      
      return processedResults;
      
    } catch (error) {
      console.error('Error in Clio classification:', error);
      return null;
    }
  }

  /**
   * Prepare data for Clio analysis
   */
  prepareClioData(session, conversations) {
    const clioData = {
      session: {
        id: session.id,
        timestamp: session.timestamp,
        filePath: session.currentFile,
        codeDeltas: session.codeDeltas || [],
        fileChanges: session.fileChanges || []
      },
      conversations: conversations.map(conv => ({
        role: conv.role || 'user',
        content: conv.content || '',
        timestamp: conv.timestamp,
        codeBlocks: conv.codeBlocks || []
      })),
      facets: Object.values(this.facets)
    };

    return clioData;
  }

  /**
   * Run Clio analysis
   */
  async runClioAnalysis(clioData) {
    return new Promise((resolve, reject) => {
      const analysisScript = this.generateClioAnalysisScript(clioData);
      
      const python = spawn('python3', ['-c', analysisScript], {
        cwd: this.clioPath
      });
      
      let output = '';
      let errorOutput = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      python.on('close', (code) => {
        if (code === 0) {
          try {
            const results = JSON.parse(output);
            resolve(results);
          } catch (parseError) {
            console.error('Error parsing Clio results:', parseError);
            reject(new Error('Failed to parse Clio results'));
          }
        } else {
          console.error('Clio analysis failed:', errorOutput);
          reject(new Error(`Clio analysis failed with code ${code}`));
        }
      });
    });
  }

  /**
   * Generate Clio analysis script
   */
  generateClioAnalysisScript(clioData) {
    return `
import sys
import os
import json
sys.path.insert(0, '${this.clioPath}')

try:
    from openclio import Facet, ConversationFacetData, runClio
    from openclio.utils import flatten, unflatten
    
    # Data from Node.js
    clio_data = ${JSON.stringify(clioData)}
    
    # Create facets
    facets = []
    for facet_config in clio_data['facets']:
        facet = Facet(
            name=facet_config['name'],
            question=facet_config['question'],
            prefill=facet_config['prefill'],
            summaryCriteria=facet_config['summaryCriteria']
        )
        facets.append(facet)
    
    # Prepare conversation data
    conversations = []
    for conv in clio_data['conversations']:
        conv_data = ConversationFacetData(
            conversation_id=clio_data['session']['id'],
            messages=[{
                'role': conv['role'],
                'content': conv['content']
            }]
        )
        conversations.append(conv_data)
    
    # Run Clio analysis
    if conversations:
        results = runClio(conversations, facets)
        
        # Process results
        processed_results = {
            'intent': None,
            'task': None,
            'complexity': None,
            'domain': None,
            'confidence': 0.0,
            'evidence': {}
        }
        
        for result in results:
            if result.facet_name == 'DataScienceIntent':
                processed_results['intent'] = result.summary
                processed_results['confidence'] = 0.8
            elif result.facet_name == 'DataScienceTask':
                processed_results['task'] = result.summary
            elif result.facet_name == 'CodeComplexity':
                processed_results['complexity'] = result.summary
            elif result.facet_name == 'DataScienceDomain':
                processed_results['domain'] = result.summary
            
            processed_results['evidence'][result.facet_name] = {
                'summary': result.summary,
                'details': result.details
            }
        
        print(json.dumps(processed_results))
    else:
        # No conversations, return default
        default_result = {
            'intent': 'explore',
            'task': 'analysis',
            'complexity': 'simple',
            'domain': 'general',
            'confidence': 0.3,
            'evidence': {}
        }
        print(json.dumps(default_result))
        
except ImportError as e:
    print(json.dumps({'error': f'Import error: {e}'}))
except Exception as e:
    print(json.dumps({'error': f'Analysis error: {e}'}))
`;
  }

  /**
   * Process Clio results
   */
  processClioResults(clioResults, session) {
    if (clioResults.error) {
      console.error('Clio analysis error:', clioResults.error);
      return null;
    }

    // Map Clio results to our intent format
    const intent = clioResults.intent || 'explore';
    const confidence = clioResults.confidence || 0.5;
    
    return {
      primary_intent: intent,
      confidence: confidence,
      evidence: {
        clio_analysis: true,
        facets: clioResults.evidence || {}
      },
      signal_weights: {
        clio_analysis: 0.7,
        ast_analysis: 0.3
      },
      confidence_breakdown: {
        signal_agreement: 1.0,
        evidence_strength: confidence
      },
      all_evidences: [{
        intent: intent,
        confidence: confidence,
        weight: 1.0,
        source: 'clio'
      }],
      intent_scores: {
        [intent]: {
          total_score: confidence,
          evidence_count: 1,
          source: 'clio'
        }
      },
      clio_analysis: {
        task: clioResults.task,
        complexity: clioResults.complexity,
        domain: clioResults.domain,
        facets: clioResults.evidence
      }
    };
  }

  /**
   * Hybrid classification combining AST and Clio with toggle percentage adjustments
   */
  async hybridClassifyIntent(session, conversations = [], astClassifier = null) {
    const results = {
      ast: null,
      clio: null,
      hybrid: null,
      proportions: null,
      facets: null
    };

    // Get effective proportions (auto-adjust if enabled)
    const proportions = this.analysisProportions.auto ? 
      this.autoAdjustProportions() : 
      this.analysisProportions;
    
    results.proportions = proportions;

    // Get AST classification
    const effectiveASTClassifier = astClassifier || this.astClassifier;
    if (effectiveASTClassifier && session.codeDeltas && proportions.ast > 0) {
      const codeContent = session.codeDeltas.map(d => d.afterContent).join('\n');
      
      // Use enhanced classification if available
      let astResult;
      if (effectiveASTClassifier.hasEnhancedFacets && effectiveASTClassifier.hasEnhancedFacets()) {
        astResult = effectiveASTClassifier.classifyIntentWithEnhancedFacets(codeContent, session.currentFile);
      } else {
        astResult = effectiveASTClassifier.classifyIntent(codeContent, session.currentFile);
      }
      
      // Apply toggle percentages to AST result
      results.ast = this.applyTogglePercentages(astResult, 'intent');
    }

    // Get Clio classification (already includes toggle percentage adjustments)
    if (proportions.clio > 0) {
      results.clio = await this.classifyIntentWithClio(session, conversations);
    }

    // Analyze facets using AST patterns
    if (session.codeDeltas) {
      results.facets = this.analyzeFacetsWithAST(session);
    }

    // Combine results using the configured proportions
    results.hybrid = this.combineClassificationsWithProportions(results.ast, results.clio, proportions);

    return results;
  }

  /**
   * Analyze facets using AST patterns
   */
  analyzeFacetsWithAST(session) {
    const facetResults = {};
    const codeContent = session.codeDeltas ? session.codeDeltas.map(d => d.afterContent).join('\n') : '';

    for (const [facetName, facetConfig] of Object.entries(this.facets)) {
      if (facetConfig.astPatterns) {
        const facetAnalysis = this.analyzeFacetWithAST(facetName, facetConfig, codeContent, session);
        facetResults[facetName] = facetAnalysis;
      }
    }

    return facetResults;
  }

  /**
   * Analyze individual facet using AST patterns
   */
  analyzeFacetWithAST(facetName, facetConfig, codeContent, session) {
    const scores = {};
    const evidence = {};

    for (const [option, patterns] of Object.entries(facetConfig.astPatterns)) {
      let score = 0;
      let evidenceCount = 0;
      const optionEvidence = {
        imports: [],
        functions: [],
        constructs: [],
        keywords: [],
        variables: [],
        complexity_indicators: []
      };

      // Check imports
      if (patterns.imports) {
        const importMatches = this.findPatternMatches(codeContent, patterns.imports, 'import');
        score += importMatches.length * 0.3;
        evidenceCount += importMatches.length;
        optionEvidence.imports = importMatches;
      }

      // Check functions
      if (patterns.functions) {
        const functionMatches = this.findPatternMatches(codeContent, patterns.functions, 'function');
        score += functionMatches.length * 0.25;
        evidenceCount += functionMatches.length;
        optionEvidence.functions = functionMatches;
      }

      // Check constructs
      if (patterns.constructs) {
        const constructMatches = this.findPatternMatches(codeContent, patterns.constructs, 'construct');
        score += constructMatches.length * 0.2;
        evidenceCount += constructMatches.length;
        optionEvidence.constructs = constructMatches;
      }

      // Check keywords
      if (patterns.keywords) {
        const keywordMatches = this.findPatternMatches(codeContent, patterns.keywords, 'keyword');
        score += keywordMatches.length * 0.15;
        evidenceCount += keywordMatches.length;
        optionEvidence.keywords = keywordMatches;
      }

      // Check variables
      if (patterns.variables) {
        const variableMatches = this.findPatternMatches(codeContent, patterns.variables, 'variable');
        score += variableMatches.length * 0.05;
        evidenceCount += variableMatches.length;
        optionEvidence.variables = variableMatches;
      }

      // Check complexity indicators
      if (patterns.complexity_indicators) {
        const indicatorMatches = this.findPatternMatches(codeContent, patterns.complexity_indicators, 'indicator');
        score += indicatorMatches.length * 0.05;
        evidenceCount += indicatorMatches.length;
        optionEvidence.complexity_indicators = indicatorMatches;
      }

      scores[option] = {
        score: Math.min(score, 1.0),
        evidenceCount,
        evidence: optionEvidence
      };
    }

    // Select primary option
    const primaryOption = this.selectPrimaryOption(scores);
    
    return {
      primary_option: primaryOption.option,
      confidence: primaryOption.confidence,
      scores,
      evidence,
      facet_name: facetName,
      toggle_percentage: facetConfig.togglePercentages[primaryOption.option] || 0
    };
  }

  /**
   * Find pattern matches in code content
   */
  findPatternMatches(codeContent, patterns, type) {
    const matches = [];
    const lowerContent = codeContent.toLowerCase();

    for (const pattern of patterns) {
      const lowerPattern = pattern.toLowerCase();
      
      if (type === 'import') {
        // Look for import statements
        const importRegex = new RegExp(`import\\s+${lowerPattern}|from\\s+${lowerPattern}`, 'g');
        if (importRegex.test(lowerContent)) {
          matches.push(pattern);
        }
      } else if (type === 'function') {
        // Look for function calls
        const functionRegex = new RegExp(`\\b${lowerPattern}\\s*\\(`, 'g');
        if (functionRegex.test(lowerContent)) {
          matches.push(pattern);
        }
      } else if (type === 'construct') {
        // Look for code constructs
        if (lowerContent.includes(lowerPattern)) {
          matches.push(pattern);
        }
      } else if (type === 'keyword') {
        // Look for keywords
        const keywordRegex = new RegExp(`\\b${lowerPattern}\\b`, 'g');
        if (keywordRegex.test(lowerContent)) {
          matches.push(pattern);
        }
      } else if (type === 'variable') {
        // Look for variable names
        const variableRegex = new RegExp(`\\b${lowerPattern}\\b`, 'g');
        if (variableRegex.test(lowerContent)) {
          matches.push(pattern);
        }
      } else if (type === 'indicator') {
        // Look for complexity indicators
        if (lowerContent.includes(lowerPattern)) {
          matches.push(pattern);
        }
      }
    }

    return matches;
  }

  /**
   * Select primary option from scores
   */
  selectPrimaryOption(scores) {
    let maxScore = 0;
    let primaryOption = Object.keys(scores)[0];
    let maxConfidence = 0.3;

    for (const [option, data] of Object.entries(scores)) {
      if (data.score > maxScore) {
        maxScore = data.score;
        primaryOption = option;
        maxConfidence = Math.min(data.score + 0.2, 0.95);
      }
    }

    return {
      option: primaryOption,
      confidence: maxConfidence,
      score: maxScore
    };
  }

  /**
   * Combine AST and Clio classifications with configurable proportions
   */
  combineClassificationsWithProportions(astResult, clioResult, proportions) {
    if (!astResult && !clioResult) {
      return this.getDefaultIntent();
    }

    if (!astResult) return clioResult;
    if (!clioResult) return astResult;

    // Use configured proportions
    const clioWeight = proportions.clio;
    const astWeight = proportions.ast;

    // Determine primary intent
    let primaryIntent = astResult.primary_intent;
    let confidence = astResult.confidence * astWeight;

    if (clioResult.primary_intent && clioResult.confidence > 0.5) {
      if (clioResult.primary_intent === astResult.primary_intent) {
        // Agreement - boost confidence
        confidence = Math.min(0.95, (astResult.confidence + clioResult.confidence) / 2);
      } else {
        // Disagreement - use weighted combination
        primaryIntent = clioResult.primary_intent;
        confidence = clioResult.confidence * clioWeight + astResult.confidence * astWeight;
      }
    }

    return {
      primary_intent: primaryIntent,
      confidence: confidence,
      evidence: {
        ast_analysis: true,
        clio_analysis: true,
        hybrid: true,
        proportions: proportions
      },
      signal_weights: {
        ast_analysis: astWeight,
        clio_analysis: clioWeight
      },
      confidence_breakdown: {
        signal_agreement: astResult.primary_intent === clioResult.primary_intent ? 1.0 : 0.5,
        evidence_strength: confidence
      },
      all_evidences: [
        ...astResult.all_evidences.map(e => ({ ...e, source: 'ast' })),
        ...clioResult.all_evidences.map(e => ({ ...e, source: 'clio' }))
      ],
      intent_scores: {
        ...astResult.intent_scores,
        ...clioResult.intent_scores
      },
      ast_analysis: astResult.ast_analysis,
      clio_analysis: clioResult.clio_analysis
    };
  }

  /**
   * Combine AST and Clio classifications (legacy method for backward compatibility)
   */
  combineClassifications(astResult, clioResult) {
    // Use default proportions for backward compatibility
    const defaultProportions = { clio: 0.6, ast: 0.4, auto: false };
    return this.combineClassificationsWithProportions(astResult, clioResult, defaultProportions);
  }

  /**
   * Get default intent
   */
  getDefaultIntent() {
    return {
      primary_intent: 'data_exploration',
      confidence: 0.3,
      evidence: { default: true },
      signal_weights: { ast_analysis: 0.5, clio_analysis: 0.5 },
      confidence_breakdown: { signal_agreement: 0, evidence_strength: 0.3 },
      all_evidences: [{ intent: 'data_exploration', confidence: 0.3, weight: 1.0 }],
      intent_scores: { data_exploration: { total_score: 0.3, evidence_count: 0 } }
    };
  }

  /**
   * Get toggle percentage statistics
   */
  getTogglePercentageStats() {
    const stats = {};
    
    Object.keys(this.facets).forEach(facetName => {
      const facet = this.facets[facetName];
      if (facet.togglePercentages) {
        stats[facetName] = {
          percentages: facet.togglePercentages,
          total: Object.values(facet.togglePercentages).reduce((sum, val) => sum + val, 0),
          highest: Object.entries(facet.togglePercentages).reduce((max, [key, val]) => 
            val > max.value ? { key, value: val } : max, { key: '', value: 0 }),
          lowest: Object.entries(facet.togglePercentages).reduce((min, [key, val]) => 
            val < min.value ? { key, value: val } : min, { key: '', value: 1 })
        };
      }
    });
    
    return stats;
  }

  /**
   * Reset toggle percentages to default values
   */
  resetTogglePercentages(facetName = null) {
    if (facetName) {
      // Reset specific facet
      if (this.facets[facetName]) {
        this.facets[facetName].togglePercentages = this.getDefaultTogglePercentages(facetName);
        console.log(`Reset toggle percentages for ${facetName}`);
      }
    } else {
      // Reset all facets
      Object.keys(this.facets).forEach(name => {
        this.facets[name].togglePercentages = this.getDefaultTogglePercentages(name);
      });
      console.log('Reset all toggle percentages to defaults');
    }
  }

  /**
   * Get default toggle percentages for a facet
   */
  getDefaultTogglePercentages(facetName) {
    const defaults = {
      intent: {
        explore: 0.35,
        implement: 0.25,
        debug: 0.20,
        refactor: 0.15,
        document: 0.05
      },
      task: {
        analysis: 0.30,
        modeling: 0.25,
        visualization: 0.20,
        preprocessing: 0.15,
        validation: 0.10
      },
      complexity: {
        simple: 0.40,
        moderate: 0.45,
        complex: 0.15
      },
      domain: {
        general: 0.50,
        finance: 0.15,
        healthcare: 0.10,
        marketing: 0.10,
        research: 0.10,
        other: 0.05
      }
    };
    
    return defaults[facetName] || {};
  }

  /**
   * Export toggle percentages configuration
   */
  exportTogglePercentages() {
    const config = {};
    Object.keys(this.facets).forEach(facetName => {
      if (this.facets[facetName].togglePercentages) {
        config[facetName] = this.facets[facetName].togglePercentages;
      }
    });
    return config;
  }

  /**
   * Import toggle percentages configuration
   */
  importTogglePercentages(config) {
    Object.keys(config).forEach(facetName => {
      if (this.facets[facetName]) {
        this.updateTogglePercentages(facetName, config[facetName]);
      }
    });
    console.log('Imported toggle percentages configuration');
  }

  /**
   * Check if Clio is available
   */
  isClioAvailable() {
    return this.clioAvailable;
  }

  /**
   * Check if AST classifier is available
   */
  isASTClassifierAvailable() {
    return this.astClassifier !== null;
  }

  /**
   * Get analysis configuration summary
   */
  getAnalysisConfiguration() {
    return {
      clioAvailable: this.clioAvailable,
      astClassifierAvailable: this.isASTClassifierAvailable(),
      currentProportions: this.getAnalysisProportions(),
      autoAdjustEnabled: this.analysisProportions.auto,
      effectiveProportions: this.autoAdjustProportions(),
      facets: Object.keys(this.facets),
      togglePercentages: this.getTogglePercentageStats()
    };
  }

  /**
   * Export complete configuration
   */
  exportConfiguration() {
    return {
      analysisProportions: this.analysisProportions,
      facets: Object.keys(this.facets).reduce((config, facetName) => {
        if (this.facets[facetName].togglePercentages) {
          config[facetName] = this.facets[facetName].togglePercentages;
        }
        return config;
      }, {}),
      clioPath: this.clioPath,
      clioAvailable: this.clioAvailable,
      astClassifierAvailable: this.isASTClassifierAvailable(),
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Import configuration
   */
  importConfiguration(config) {
    if (config.analysisProportions) {
      this.analysisProportions = { ...config.analysisProportions };
      console.log('Imported analysis proportions:', this.analysisProportions);
    }
    
    if (config.facets) {
      Object.keys(config.facets).forEach(facetName => {
        if (this.facets[facetName]) {
          this.updateTogglePercentages(facetName, config.facets[facetName]);
        }
      });
      console.log('Imported facet toggle percentages');
    }
    
    console.log('Configuration imported successfully');
  }
}

module.exports = ClioIntentService;
