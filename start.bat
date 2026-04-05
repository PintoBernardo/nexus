@echo off
title Nexus Unified Communications

echo =========================================
echo   Nexus Unified Communications - Backend
echo   Version: 1.0.0
echo =========================================
echo.

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo   Download from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Check if dependencies are installed
if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Failed to install dependencies.
        echo.
        pause
        exit /b 1
    )
    echo.
)

:: Initialize database with default settings
if not exist "nexus.db" (
    echo [INFO] Initializing database with default settings...
    call npm run seed
    echo.
)

:: Start the server
echo [INFO] Starting Nexus server...
echo   API: http://localhost:8000/api
echo   Docs: http://localhost:8000/docs
echo   Bruno: ./bruno/
echo.
echo Press Ctrl+C to stop.
echo =========================================
echo.
call npm start
