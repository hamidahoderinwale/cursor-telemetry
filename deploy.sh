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
    
    heroku)
        echo "📦 Deploying backend to Heroku..."
        echo ""
        echo "Heroku deployment steps:"
        echo "1. Install Heroku CLI: brew install heroku"
        echo "2. Login: heroku login"
        echo "3. Create app: heroku create your-app-name"
        echo "4. Set environment variables:"
        echo "   heroku config:set HOST=0.0.0.0"
        echo "   heroku config:set NODE_ENV=production"
        echo "5. Deploy: git push heroku master"
        echo ""
        echo "After deployment, update frontend API URL to your Heroku URL"
        ;;
    
    *)
        echo "Usage: ./deploy.sh [netlify|vercel|heroku] [api-url]"
        echo ""
        echo "Examples:"
        echo "  ./deploy.sh netlify"
        echo "  ./deploy.sh netlify https://my-api.herokuapp.com"
        echo "  ./deploy.sh vercel https://my-api.herokuapp.com"
        echo ""
        echo "For Heroku backend deployment, see README.md"
        exit 1
        ;;
esac

