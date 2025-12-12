@echo off
echo.
echo ========================================
echo   stock-flow Release Script
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: npm is not installed or not in PATH
    pause
    exit /b 1
)

REM Run the release script
echo Starting release process...
echo.
node release/scripts/release.js

if %errorlevel% neq 0 (
    echo.
    echo Release failed!
    pause
    exit /b 1
)

echo.
echo Release completed successfully!
echo.
pause