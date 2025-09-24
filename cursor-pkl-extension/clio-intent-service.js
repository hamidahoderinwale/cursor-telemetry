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
   * Initialize data science specific facets
   */
  initializeFacets() {
    return {
      // Primary intent facets
      intent: {
        name: 'DataScienceIntent',
        question: 'What is the primary intent of this data science session?',
        prefill: 'The primary intent is to',
        summaryCriteria: 'Categorize by data science intent: exploration, implementation, debugging, refactoring, or documentation',
        options: ['explore', 'implement', 'debug', 'refactor', 'document']
      },
      
      // Task type facets
      task: {
        name: 'DataScienceTask',
        question: 'What specific data science task is being performed?',
        prefill: 'The data science task is to',
        summaryCriteria: 'Categorize by task type: analysis, modeling, visualization, preprocessing, or validation',
        options: ['analysis', 'modeling', 'visualization', 'preprocessing', 'validation']
      },
      
      // Complexity facets
      complexity: {
        name: 'CodeComplexity',
        question: 'What is the complexity level of the code being written?',
        prefill: 'The code complexity is',
        summaryCriteria: 'Categorize by complexity: simple, moderate, or complex',
        options: ['simple', 'moderate', 'complex']
      },
      
      // Domain facets
      domain: {
        name: 'DataScienceDomain',
        question: 'What domain or field is this data science work focused on?',
        prefill: 'The domain is',
        summaryCriteria: 'Categorize by domain: general, finance, healthcare, marketing, research, or other',
        options: ['general', 'finance', 'healthcare', 'marketing', 'research', 'other']
      }
    };
  }

  /**
   * Classify intent using Clio
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
      return this.processClioResults(clioResults, session);
      
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
   * Hybrid classification combining AST and Clio
   */
  async hybridClassifyIntent(session, conversations = [], astClassifier) {
    const results = {
      ast: null,
      clio: null,
      hybrid: null
    };

    // Get AST classification
    if (astClassifier && session.codeDeltas) {
      const codeContent = session.codeDeltas.map(d => d.afterContent).join('\n');
      results.ast = astClassifier.classifyIntent(codeContent, session.currentFile);
    }

    // Get Clio classification
    results.clio = await this.classifyIntentWithClio(session, conversations);

    // Combine results
    results.hybrid = this.combineClassifications(results.ast, results.clio);

    return results;
  }

  /**
   * Combine AST and Clio classifications
   */
  combineClassifications(astResult, clioResult) {
    if (!astResult && !clioResult) {
      return this.getDefaultIntent();
    }

    if (!astResult) return clioResult;
    if (!clioResult) return astResult;

    // Weight the results (Clio gets higher weight for conversation analysis)
    const clioWeight = 0.6;
    const astWeight = 0.4;

    // Determine primary intent
    let primaryIntent = astResult.primary_intent;
    let confidence = astResult.confidence * astWeight;

    if (clioResult.primary_intent && clioResult.confidence > 0.5) {
      if (clioResult.primary_intent === astResult.primary_intent) {
        // Agreement - boost confidence
        confidence = Math.min(0.95, (astResult.confidence + clioResult.confidence) / 2);
      } else {
        // Disagreement - use Clio for conversation context
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
        hybrid: true
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
   * Check if Clio is available
   */
  isClioAvailable() {
    return this.clioAvailable;
  }
}

module.exports = ClioIntentService;
