#!/bin/bash
# docker-stop.sh - Stop Docker containers

echo "🐳 Easyli Docker - Stop Script"
echo "========================================"

docker-compose stop

echo "✓ Containers stopped"
echo ""
echo "To remove containers and volumes:"
echo "  docker-compose down -v"
echo ""
