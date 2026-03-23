#!/bin/bash
# docker-start.sh - Start Docker containers

set -e

echo "🐳 Easyli Docker - Start Script"
echo "========================================"

# Check Docker installation
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed"
    exit 1
fi

echo "✓ Docker is installed"
echo "✓ Docker Compose is installed"

# Check ports
echo ""
echo "Checking ports..."

check_port() {
    local port=$1
    local service=$2
    
    if lsof -i :$port &> /dev/null; then
        echo "⚠️  Port $port is already in use by $service"
        echo "   Either stop the service or change the port in docker-compose.yml"
        return 1
    fi
    echo "✓ Port $port is available"
}

check_port 3001 "API" || true
check_port 3000 "Web" || true
check_port 6379 "Redis" || true

echo ""
echo "Starting containers..."
echo "========================================"

# Build and start
docker-compose up --build

echo ""
echo "✅ All containers started!"
echo ""
echo "API:   http://localhost:3001"
echo "Swagger: http://localhost:3001/api/docs"
echo "Web:   http://localhost:3000"
echo ""
