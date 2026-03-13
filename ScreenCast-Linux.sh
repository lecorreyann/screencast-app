#!/bin/bash

# ScreenCast - Linux
cd "$(dirname "$0")"

echo ""
echo "🖥️  ScreenCast"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Détecter le gestionnaire de paquets
install_package() {
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y "$1"
    elif command -v dnf &> /dev/null; then
        sudo dnf install -y "$1"
    elif command -v pacman &> /dev/null; then
        sudo pacman -S --noconfirm "$1"
    else
        echo "❌ Gestionnaire de paquets non reconnu"
        echo "   Installer manuellement: $1"
        exit 1
    fi
}

# Vérifier/installer Node.js
if ! command -v node &> /dev/null; then
    echo "📦 Installation de Node.js..."
    if command -v apt-get &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif command -v dnf &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo dnf install -y nodejs
    elif command -v pacman &> /dev/null; then
        sudo pacman -S --noconfirm nodejs npm
    fi
    echo "✓ Node.js installé"
else
    echo "✓ Node.js OK"
fi

# Vérifier/installer cloudflared
if ! command -v cloudflared &> /dev/null; then
    echo "📦 Installation de cloudflared..."

    # Télécharger le binaire
    ARCH=$(uname -m)
    if [ "$ARCH" = "x86_64" ]; then
        curl -Lo cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
    elif [ "$ARCH" = "aarch64" ]; then
        curl -Lo cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64
    fi

    chmod +x cloudflared
    sudo mv cloudflared /usr/local/bin/
    echo "✓ cloudflared installé"
else
    echo "✓ cloudflared OK"
fi

# Installer les dépendances npm
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install --silent
    echo "✓ Dépendances installées"
else
    echo "✓ Dépendances OK"
fi

echo ""
echo "🚀 Lancement de ScreenCast..."
echo ""

npm run dev
