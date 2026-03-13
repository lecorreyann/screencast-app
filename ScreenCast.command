#!/bin/bash

# ScreenCast - Double-cliquer pour lancer (macOS)
cd "$(dirname "$0")"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "🖥️  ScreenCast"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Fonction pour installer Homebrew si nécessaire
install_homebrew() {
    if ! command -v brew &> /dev/null; then
        echo -e "${YELLOW}📦 Installation de Homebrew...${NC}"
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

        # Ajouter Homebrew au PATH pour cette session
        if [[ -f "/opt/homebrew/bin/brew" ]]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
        elif [[ -f "/usr/local/bin/brew" ]]; then
            eval "$(/usr/local/bin/brew shellenv)"
        fi
    fi
}

# Vérifier/installer Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}📦 Installation de Node.js...${NC}"
    install_homebrew
    brew install node
    echo -e "${GREEN}✓ Node.js installé${NC}"
else
    echo -e "${GREEN}✓ Node.js OK${NC}"
fi

# Vérifier/installer cloudflared
if ! command -v cloudflared &> /dev/null; then
    echo -e "${YELLOW}📦 Installation de cloudflared...${NC}"
    install_homebrew
    brew install cloudflared
    echo -e "${GREEN}✓ cloudflared installé${NC}"
else
    echo -e "${GREEN}✓ cloudflared OK${NC}"
fi

# Installer les dépendances npm si nécessaire
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installation des dépendances...${NC}"
    npm install --silent
    echo -e "${GREEN}✓ Dépendances installées${NC}"
else
    echo -e "${GREEN}✓ Dépendances OK${NC}"
fi

echo ""
echo -e "${GREEN}🚀 Lancement de ScreenCast...${NC}"
echo ""

npm run dev
