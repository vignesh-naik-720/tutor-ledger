# PowerShell Startup Script for Tutor Ledger
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  Starting Tutor Ledger (Backend + Frontend)" -ForegroundColor Cyan
Write-Host "  WhatsApp-First Back Office for Home Tutors" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""

# Start local PostgreSQL 18 cluster if installed
$PG_BIN = "C:\Program Files\PostgreSQL\18\bin"
$PG_DATA = "$PSScriptRoot\backend\data\pgdata"
if (Test-Path "$PG_BIN\pg_ctl.exe") {
    Write-Host "Starting PostgreSQL 18 on port 5433..." -ForegroundColor Cyan
    & "$PG_BIN\pg_ctl.exe" -D "$PG_DATA" -l "$PG_DATA\logfile" start 2>$null
}

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm run dev"
Start-Sleep -Seconds 3
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "Servers started:" -ForegroundColor Yellow
Write-Host "  - Backend API:  http://localhost:3001" -ForegroundColor Gray
Write-Host "  - Frontend App: http://localhost:5173" -ForegroundColor Gray
Write-Host ""
Write-Host "Opening http://localhost:5173 in browser..." -ForegroundColor Green
Start-Process "http://localhost:5173"
