/**
 * Hugging Face Export API Routes
 * Provides endpoints for exporting data to Hugging Face Dataset format
 */

const path = require('path');
const HuggingFaceExporter = require('../services/huggingface-exporter.js');

function createHuggingFaceRoutes(deps) {
  const { app, persistentDB } = deps;

  /**
   * Export to Hugging Face Dataset format
   * GET /api/huggingface/export
   * 
   * Query parameters:
   * - privacy_level: 'raw', 'rung1', 'rung2', 'rung3', 'module_graph', 'clio' (default: 'clio')
   * - include_code: 'true' or 'false' (default: true for raw/rung1/rung2/rung3, false for clio/module_graph)
   * - include_prompts: 'true' or 'false' (default: true)
   * - anonymize: 'true' or 'false' (default: true)
   * - max_samples: number (default: 10000)
   * - output_dir: path to output directory (default: ./data/hf-export-<timestamp>)
   */
  app.get('/api/huggingface/export', async (req, res) => {
    try {
      console.log('[HF-API] Hugging Face export request received');

      const privacyLevel = req.query.privacy_level || 'clio';
      const includeCode = req.query.include_code !== 'false';
      const includePrompts = req.query.include_prompts !== 'false';
      const anonymize = req.query.anonymize !== 'false';
      const maxSamples = parseInt(req.query.max_samples) || 10000;
      const outputDir = req.query.output_dir || 
        path.join(__dirname, '../../data', `hf-export-${Date.now()}`);

      // Validate privacy level
      const validPrivacyLevels = ['raw', 'rung1', 'rung2', 'rung3', 'module_graph', 'clio'];
      if (!validPrivacyLevels.includes(privacyLevel)) {
        return res.status(400).json({
          success: false,
          error: `Invalid privacy_level. Must be one of: ${validPrivacyLevels.join(', ')}`
        });
      }

      // Create exporter with options
      const exporter = new HuggingFaceExporter(persistentDB, {
        privacyLevel,
        includeCode,
        includePrompts,
        anonymize,
        maxSamples
      });

      // Export to Hugging Face format
      console.log('[HF-API] Starting export with options:', {
        privacyLevel,
        includeCode,
        includePrompts,
        anonymize,
        maxSamples,
        outputDir
      });

      const result = await exporter.exportToHuggingFaceFormat(outputDir);

      res.json({
        success: true,
        message: 'Export completed successfully',
        result: {
          outputDir: result.outputDir,
          totalSamples: result.totalSamples,
          files: result.files,
          privacyLevel,
          anonymized: anonymize
        },
        instructions: {
          upload: [
            '1. Install Hugging Face CLI: pip install huggingface_hub',
            '2. Login: huggingface-cli login',
            `3. Create dataset: huggingface-cli repo create <your-username>/cursor-telemetry --type dataset`,
            `4. Upload files: cd ${result.outputDir} && huggingface-cli upload <your-username>/cursor-telemetry . .`,
            '5. Your dataset will be available at: https://huggingface.co/datasets/<your-username>/cursor-telemetry'
          ],
          usage: [
            'from datasets import load_dataset',
            'dataset = load_dataset("<your-username>/cursor-telemetry")',
            'train_data = dataset["train"]'
          ]
        }
      });

    } catch (error) {
      console.error('[HF-API] Export failed:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  /**
   * Get export options and documentation
   * GET /api/huggingface/info
   */
  app.get('/api/huggingface/info', (req, res) => {
    res.json({
      success: true,
      description: 'Hugging Face Dataset Export Service',
      privacyLevels: {
        raw: 'Full data including all code and prompts (lowest privacy)',
        rung1: 'Token-level with PII redaction',
        rung2: 'Semantic edit operations',
        rung3: 'Function-level changes',
        module_graph: 'File dependencies only',
        clio: 'Workflow patterns only (highest privacy)'
      },
      options: {
        privacy_level: 'Privacy level for export (raw, rung1, rung2, rung3, module_graph, clio)',
        include_code: 'Include code diffs in export (true/false)',
        include_prompts: 'Include AI prompts in export (true/false)',
        anonymize: 'Anonymize file paths and remove PII (true/false)',
        max_samples: 'Maximum number of samples to export (default: 10000)',
        output_dir: 'Custom output directory path (optional)'
      },
      endpoints: {
        export: 'GET /api/huggingface/export - Export data to HF format',
        info: 'GET /api/huggingface/info - Get API documentation'
      },
      examples: [
        '/api/huggingface/export?privacy_level=clio&anonymize=true',
        '/api/huggingface/export?privacy_level=rung3&max_samples=5000',
        '/api/huggingface/export?privacy_level=raw&include_code=true&anonymize=false'
      ],
      resources: {
        documentation: 'https://huggingface.co/docs/datasets',
        hub: 'https://huggingface.co/datasets',
        cli: 'https://huggingface.co/docs/huggingface_hub/guides/cli'
      }
    });
  });

  return app;
}

module.exports = createHuggingFaceRoutes;



