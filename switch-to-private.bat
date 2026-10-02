@echo off
cd /d "%~dp0"
echo ======================================================================
echo 🔒 SWITCHING AI-BUILDER-BRAIN TO PRIVATE SAFEGUARD MODE
echo ======================================================================
node 04_WORKFLOWS/factory-engine/repo-mode-switcher.mjs to-private
pause
