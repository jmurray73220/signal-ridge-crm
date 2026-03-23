@echo off
cd /d "C:\Users\jmurr\Documents\signal-ridge-crm\crm"
start "Signal Ridge CRM" cmd /k "npm run dev"
timeout /t 4 /nobreak >nul
start chrome "http://localhost:5173"
