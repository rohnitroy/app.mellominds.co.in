@echo off
echo ========================================
echo MelloMinds - Starting Backend Server
echo ========================================
echo.

cd ../backend

if not exist node_modules (
    echo Installing dependencies...
    call npm install
)

if not exist .env (
    echo ERROR: .env file not found!
    echo Please copy .env.example to .env and configure it
    pause
    exit /b 1
)

echo Starting server...
call npm run dev
