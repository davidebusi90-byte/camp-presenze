@echo off
cd /d "c:\Users\david\Downloads\Antigravity\Programma Presenze Camp"
echo ===================================================
echo [Stream Deck] Sincronizzazione Git ^& Vercel
echo ===================================================
echo.

echo 1. Aggiunta dei file modificati...
git add .

echo 2. Creazione del commit...
git commit -m "Aggiornamento automatico da Stream Deck"

echo 3. Invio delle modifiche su GitHub (trigger automatico Vercel)...
git push origin main

echo.
echo ===================================================
echo Sincronizzazione completata con successo!
echo Vercel sta avviando la build in background.
echo ===================================================
echo.
timeout /t 3
