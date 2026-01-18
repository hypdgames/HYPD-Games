#!/bin/bash

# Hypd Games - Quick Deploy Script
# Usage: ./deploy.sh [dev|prod]

set -e

MODE=${1:-dev}

echo "🎮 Hypd Games Deployment"
echo "========================"
echo "Mode: $MODE"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from example..."
    cp .env.example .env
    echo "📝 Please edit .env with your settings, then run this script again."
    exit 1
fi

# Load environment variables
source .env

# Validate required variables
if [ "$JWT_SECRET" = "change-this-to-a-random-64-character-string" ]; then
    echo "❌ ERROR: Please change JWT_SECRET in .env"
    echo "   Generate one with: openssl rand -hex 32"
    exit 1
fi

if [ "$MODE" = "prod" ]; then
    if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "hypdgames.com" ]; then
        echo "❌ ERROR: Please set your actual DOMAIN in .env"
        exit 1
    fi
    
    if [ -z "$SSL_EMAIL" ] || [ "$SSL_EMAIL" = "your-email@example.com" ]; then
        echo "❌ ERROR: Please set SSL_EMAIL in .env for SSL certificates"
        exit 1
    fi
fi

echo "✅ Configuration validated"
echo ""

# Build and start containers
if [ "$MODE" = "prod" ]; then
    echo "🚀 Starting production deployment with SSL..."
    docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
else
    echo "🚀 Starting development deployment..."
    docker compose up -d --build
fi

echo ""
echo "⏳ Waiting for services to start..."
sleep 10

# Check if services are running
if docker compose ps | grep -q "running"; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    if [ "$MODE" = "prod" ]; then
        echo "🌐 Your app is live at: https://$DOMAIN"
        echo "   (SSL certificate may take a few minutes to provision)"
    else
        echo "🌐 Your app is live at: http://localhost"
    fi
    echo ""
    echo "📊 Admin Dashboard: /admin"
    echo "   Email: admin@hypd.games"
    echo "   Password: admin123 (CHANGE THIS!)"
    echo ""
    echo "📝 View logs: docker compose logs -f"
else
    echo "❌ Deployment may have issues. Check logs:"
    echo "   docker compose logs"
fi
