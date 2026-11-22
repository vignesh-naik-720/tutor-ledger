@echo off
REM Automated PostgreSQL Setup Script for Tutor Ledger
powershell -ExecutionPolicy Bypass -File "%~dp0setup-postgres.ps1"
pause
