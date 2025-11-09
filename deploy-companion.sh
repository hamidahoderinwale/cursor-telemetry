#!/bin/bash

# Companion Service Deployment Script
# This script helps deploy the companion service using Docker

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPANION_DIR="$SCRIPT_DIR/components/activity-logger/companion"

echo "Cursor Companion Service Deployment"
echo "======================================"
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "ERROR: Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Function to check if docker-compose or docker compose
DOCKER_COMPOSE_CMD="docker-compose"
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
fi

# Parse command line arguments
ACTION="${1:-up}"
PORT="${PORT:-43917}"
HOST="${HOST:-0.0.0.0}"

case "$ACTION" in
    build)
        echo "Building Docker image..."
        docker build -f "$SCRIPT_DIR/infra/docker/Dockerfile.companion" \
            -t cursor-companion:latest \
            "$SCRIPT_DIR"
        echo "Build complete!"
        ;;
    
    up|start)
        echo "Starting companion service..."
        export PORT HOST
        $DOCKER_COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" up -d companion
        echo "Service started!"
        echo ""
        echo "Service status:"
        $DOCKER_COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" ps companion
        echo ""
        echo "View logs: docker-compose logs -f companion"
        echo "Health check: curl http://localhost:$PORT/health"
        ;;
    
    down|stop)
        echo "Stopping companion service..."
        $DOCKER_COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" down
        echo "Service stopped!"
        ;;
    
    restart)
        echo "Restarting companion service..."
        $DOCKER_COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" restart companion
        echo "Service restarted!"
        ;;
    
    logs)
        echo "Showing logs (Ctrl+C to exit)..."
        $DOCKER_COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" logs -f companion
        ;;
    
    status|ps)
        echo "Service status:"
        $DOCKER_COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" ps companion
        echo ""
        echo "Health check:"
        curl -s http://localhost:$PORT/health | jq . || curl -s http://localhost:$PORT/health
        ;;
    
    health)
        echo "Checking service health..."
        curl -f http://localhost:$PORT/health && echo "" || echo "ERROR: Service is not healthy"
        ;;
    
    shell)
        echo "Opening shell in container..."
        docker exec -it cursor-companion /bin/sh
        ;;
    
    backup)
        echo "Creating database backup..."
        BACKUP_FILE="companion.db.backup.$(date +%Y%m%d_%H%M%S)"
        docker exec cursor-companion cp /app/data/companion.db "/app/data/$BACKUP_FILE" 2>/dev/null || \
            cp "$COMPANION_DIR/data/companion.db" "$COMPANION_DIR/data/$BACKUP_FILE"
        echo "Backup created: $BACKUP_FILE"
        ;;
    
    help|--help|-h)
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  build      - Build Docker image"
        echo "  up|start   - Start the service (default)"
        echo "  down|stop  - Stop the service"
        echo "  restart    - Restart the service"
        echo "  logs       - Show service logs"
        echo "  status|ps  - Show service status"
        echo "  health     - Check service health"
        echo "  shell      - Open shell in container"
        echo "  backup     - Backup database"
        echo "  help       - Show this help message"
        echo ""
        echo "Environment variables:"
        echo "  PORT       - Server port (default: 43917)"
        echo "  HOST       - Bind address (default: 0.0.0.0)"
        echo ""
        echo "Examples:"
        echo "  $0 build          # Build image"
        echo "  $0 up             # Start service"
        echo "  $0 logs           # View logs"
        echo "  PORT=8080 $0 up  # Start on custom port"
        ;;
    
    *)
        echo "ERROR: Unknown command: $ACTION"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac

