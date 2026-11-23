# Automated PostgreSQL 18 Setup & Migration Script for Tutor Ledger
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  Setting up PostgreSQL 18 for Tutor Ledger" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""

$PG_BIN = "C:\Program Files\PostgreSQL\18\bin"
$PG_DATA = "$PSScriptRoot\backend\data\pgdata"
$PORT = 5433

if (-not (Test-Path "$PG_BIN\pg_ctl.exe")) {
    Write-Host "PostgreSQL 18 binaries not found at $PG_BIN" -ForegroundColor Red
    exit 1
}

# 1. Initialize cluster if needed
if (-not (Test-Path "$PG_DATA\PG_VERSION")) {
    Write-Host "Initializing PostgreSQL cluster at $PG_DATA..." -ForegroundColor Yellow
    & "$PG_BIN\initdb.exe" -D "$PG_DATA" -U postgres -A trust
    (Get-Content "$PG_DATA\postgresql.conf") -replace "#?port = \d+", "port = $PORT" -replace "#?listen_addresses = '.*'", "listen_addresses = '127.0.0.1'" | Set-Content "$PG_DATA\postgresql.conf"
}

# 2. Start PostgreSQL server on port 5433
Write-Host "Starting PostgreSQL on 127.0.0.1:$PORT..." -ForegroundColor Yellow
& "$PG_BIN\pg_ctl.exe" -D "$PG_DATA" -l "$PG_DATA\logfile" start

Start-Sleep -Seconds 3

# 3. Create database if it does not exist
Write-Host "Creating tutor_ledger database..." -ForegroundColor Yellow
& "$PG_BIN\createdb.exe" -p $PORT -h 127.0.0.1 -U postgres tutor_ledger 2>$null

# 4. Run database schema migrations
Write-Host "Applying database migrations..." -ForegroundColor Yellow
$env:TL_MIGRATION_DATABASE_URL = "postgresql://postgres@127.0.0.1:$PORT/tutor_ledger"
$env:TL_DATABASE_URL = "postgresql://postgres@127.0.0.1:$PORT/tutor_ledger"

cd backend
npm run migrate
cd ..

Write-Host ""
Write-Host "✅ PostgreSQL 18 setup complete and migrations applied!" -ForegroundColor Green
Write-Host "   Database URL: postgresql://postgres@127.0.0.1:5433/tutor_ledger" -ForegroundColor Cyan
