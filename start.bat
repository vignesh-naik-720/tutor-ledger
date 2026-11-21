@echo off
echo ========================================================
echo   Starting Tutor Ledger (Backend + Frontend)
echo   WhatsApp-First Back Office for Home Tutors
echo ========================================================
echo.

start "Tutor Ledger - Backend API (Port 3001)" cmd /k "cd backend && npm run dev"
timeout /t 3 /nobreak >nul
start "Tutor Ledger - Frontend Web App (Port 5173)" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers are starting up!
echo   - Backend API: http://localhost:3001
echo   - Frontend App: http://localhost:5173
echo.
echo Opening browser...
start http://localhost:5173
