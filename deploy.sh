#!/bin/bash

# Quick Deployment Script for Cursor Telemetry Dashboard
# Supports: Netlify, Vercel, or custom server

set -e

DEPLOY_TARGET="${1:-netlify}"
API_URL="${2:-}"

echo "🚀 Cursor Telemetry Dashboard Deployment"
echo "========================================"
echo ""

# Check if we're in the right directory
if [ ! -d "components/activity-logger/public" ]; then
    echo "❌ Error: Must run from cursor-telemetry root directory"
    exit 1
fi

case "$DEPLOY_TARGET" in
    netlify)
        echo "📦 Deploying to Netlify..."
        
        if ! command -v netlify &> /dev/null; then
            echo "Installing Netlify CLI..."
            npm install -g netlify-cli
        fi
        
        # Update API URL if provided
        if [ ! -z "$API_URL" ]; then
            echo "Updating API URL to: $API_URL"
            # Create a build script that injects the API URL
            cat > components/activity-logger/public/config-env.js << EOF
// Auto-generated during deployment
window.__API_BASE_URL__ = '$API_URL';
EOF
        fi
        
        # Deploy
        netlify deploy --prod --dir=components/activity-logger/public
        
        echo ""
        echo "✅ Deployment complete!"
        echo "   Your dashboard is now live on Netlify"
        ;;
    
    vercel)
        echo "📦 Deploying to Vercel..."
        
        if ! command -v vercel &> /dev/null; then
            echo "Installing Vercel CLI..."
            npm install -g vercel
        fi
        
        # Update API URL if provided
        if [ ! -z "$API_URL" ]; then
            echo "Updating API URL to: $API_URL"
            cat > components/activity-logger/public/config-env.js << EOF
// Auto-generated during deployment
window.__API_BASE_URL__ = '$API_URL';
EOF
        fi
        
        # Deploy
        vercel --prod
        
        echo ""
        echo "✅ Deployment complete!"
        echo "   Your dashboard is now live on Vercel"
        ;;
    
    render)
        echo "📦 Deploying backend to Render..."
        echo ""
        echo "Render deployment steps:"
        echo "1. Go to https://render.com"
        echo "2. Sign up/login and create a new Web Service"
        echo "3. Connect your GitHub repository"
        echo "4. Configure:"
        echo "   - Name: cursor-telemetry-companion"
        echo "   - Environment: Node"
        echo "   - Build Command: cd components/activity-logger/companion && npm install"
        echo "   - Start Command: cd components/activity-logger/companion && node src/index.js"
        echo "   - Environment Variables:"
        echo "     HOST=0.0.0.0"
        echo "     NODE_ENV=production"
        echo "     PORT=43917 (or let Render set it automatically)"
        echo "5. Deploy (Render will auto-deploy from GitHub)"
        echo ""
        echo "After deployment, update frontend API URL to your Render URL"
        ;;
    
    *)
        echo "Usage: ./deploy.sh [netlify|vercel|render] [api-url]"
        echo ""
        echo "Examples:"
        echo "  ./deploy.sh netlify"
        echo "  ./deploy.sh netlify https://my-api.onrender.com"
        echo "  ./deploy.sh vercel https://my-api.onrender.com"
        echo ""
        echo "For Render backend deployment, see README.md"
        exit 1
        ;;
esac

