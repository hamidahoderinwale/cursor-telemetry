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
    
    railway)
        echo "📦 Deploying backend to Railway..."
        echo ""
        echo "Railway deployment steps:"
        echo "1. Go to https://railway.app"
        echo "2. Create new project from GitHub"
        echo "3. Configure:"
        echo "   - Root Directory: cursor-telemetry/components/activity-logger/companion"
        echo "   - Start Command: node src/index.js"
        echo "   - Environment Variables:"
        echo "     PORT=43917"
        echo "     HOST=0.0.0.0"
        echo "     NODE_ENV=production"
        echo ""
        echo "After deployment, update frontend API URL to your Railway URL"
        ;;
    
    *)
        echo "Usage: ./deploy.sh [netlify|vercel|railway] [api-url]"
        echo ""
        echo "Examples:"
        echo "  ./deploy.sh netlify"
        echo "  ./deploy.sh netlify https://my-api.railway.app"
        echo "  ./deploy.sh vercel https://my-api.railway.app"
        echo ""
        echo "For Railway backend deployment, see HOSTING_GUIDE.md"
        exit 1
        ;;
esac

