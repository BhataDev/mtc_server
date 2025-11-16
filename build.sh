#!/bin/bash

# Build script for Render deployment
echo "🚀 Starting build process..."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not found"
    exit 1
fi

echo "✅ Build completed successfully!"
echo "📁 Build artifacts:"
ls -la dist/

# Set memory limits for production
export NODE_OPTIONS="--max-old-space-size=512"

echo "🎯 Ready for deployment!"
