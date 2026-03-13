#!/bin/bash

# ScreenCast - Linux / macOS
cd "$(dirname "$0")"

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé."
    echo "   Installer depuis: https://nodejs.org"
    exit 1
fi

# Vérifier cloudflared
if ! command -v cloudflared &> /dev/null; then
    echo "❌ cloudflared n'est pas installé."
    echo ""
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "   macOS:  brew install cloudflared"
    else
        echo "   Linux:  https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation"
    fi
    exit 1
fi

# Installer les dépendances si nécessaire
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
fi

echo ""
echo "🖥️  Lancement de ScreenCast..."
echo ""

npm run dev
