@echo off
chcp 65001 >nul
cd /d "%~dp0"

:: ScreenCast - Windows

:: Vérifier Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js n'est pas installé.
    echo    Installer depuis: https://nodejs.org
    pause
    exit /b 1
)

:: Vérifier cloudflared
where cloudflared >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ cloudflared n'est pas installé.
    echo    Télécharger depuis: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation
    pause
    exit /b 1
)

:: Installer les dépendances si nécessaire
if not exist "node_modules" (
    echo 📦 Installation des dépendances...
    call npm install
)

echo.
echo 🖥️  Lancement de ScreenCast...
echo.

call npm run dev
pause
