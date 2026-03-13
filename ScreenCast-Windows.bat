@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ScreenCast

echo.
echo 🖥️  ScreenCast
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

:: Vérifier Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo 📦 Installation de Node.js...
    echo.
    echo    Téléchargement en cours...

    :: Télécharger et installer Node.js
    curl -o node-installer.msi https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi
    if exist node-installer.msi (
        echo    Installation en cours...
        msiexec /i node-installer.msi /qn
        del node-installer.msi
        echo ✓ Node.js installé
        echo.
        echo ⚠️  Veuillez relancer ScreenCast-Windows.bat
        pause
        exit /b 0
    ) else (
        echo ❌ Impossible de télécharger Node.js
        echo    Installer manuellement depuis: https://nodejs.org
        pause
        exit /b 1
    )
) else (
    echo ✓ Node.js OK
)

:: Vérifier cloudflared
where cloudflared >nul 2>nul
if %errorlevel% neq 0 (
    echo 📦 Installation de cloudflared...

    :: Télécharger cloudflared
    curl -Lo cloudflared.exe https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
    if exist cloudflared.exe (
        :: Déplacer dans le dossier courant (sera utilisé localement)
        echo ✓ cloudflared installé
    ) else (
        echo ❌ Impossible de télécharger cloudflared
        pause
        exit /b 1
    )
) else (
    echo ✓ cloudflared OK
)

:: Installer les dépendances npm
if not exist "node_modules" (
    echo 📦 Installation des dépendances...
    call npm install --silent
    echo ✓ Dépendances installées
) else (
    echo ✓ Dépendances OK
)

echo.
echo 🚀 Lancement de ScreenCast...
echo.

call npm run dev
pause
