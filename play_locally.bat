@echo off
cd /d "%~dp0"
echo Starting Reign's Quest on this computer...
echo A browser tab will open. Leave THIS window open while you play; close it when done.
echo After you save a content file, the game page reloads by itself.
npm run dev -- --open --host
pause
