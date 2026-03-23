#!/bin/bash
# docker-logs.sh - View Docker logs

if [ $# -eq 0 ]; then
    echo "🐳 Easyli Docker - Logs"
    echo "========================================"
    echo "Usage: ./docker-logs.sh [service]"
    echo ""
    echo "Services:"
    echo "  api      - API Server logs"
    echo "  web      - Web Server logs"
    echo "  redis    - Redis Server logs"
    echo "  all      - All services (default)"
    echo ""
    echo "Examples:"
    echo "  ./docker-logs.sh api        # Show API logs"
    echo "  ./docker-logs.sh api -f     # Follow API logs"
    echo ""
    exit 0
fi

SERVICE=$1
FOLLOW=${2:-}

if [ "$SERVICE" == "api" ]; then
    docker-compose logs $FOLLOW atera_api
elif [ "$SERVICE" == "web" ]; then
    docker-compose logs $FOLLOW atera_web
elif [ "$SERVICE" == "redis" ]; then
    docker-compose logs $FOLLOW atera_redis
else
    docker-compose logs $FOLLOW
fi
