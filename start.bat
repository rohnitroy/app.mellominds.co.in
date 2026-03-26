@echo off
setlocal

echo.
echo ========================================
echo   MelloMinds Development Environment
echo ========================================
echo.

REM Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org/
    pause
    exit /b 1
)

echo [INFO] Node.js: 
node --version
echo [INFO] npm: 
npm --version
echo.

REM Install backend dependencies
echo ========================================
echo   Backend Setup
echo ========================================
if not exist "backend\node_modules\" (
    echo [INFO] Installing backend dependencies...
    cd backend
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Backend npm install failed
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo [SUCCESS] Backend ready
) else (
    echo [INFO] Backend dependencies OK
)
echo.

REM Install frontend dependencies
echo ========================================
echo   Frontend Setup
echo ========================================
if not exist "frontend\node_modules\" (
    echo [INFO] Installing frontend dependencies...
    cd frontend
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Frontend npm install failed
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo [SUCCESS] Frontend ready
) else (
    echo [INFO] Frontend dependencies OK
)
echo.

REM Check environment files
echo ========================================
echo   Environment Check
echo ========================================
if exist "backend\.env" (
    echo [INFO] Backend .env found
) else (
    echo [WARNING] backend\.env missing
    if exist "backend\.env.example" (
        copy "backend\.env.example" "backend\.env" >nul
        echo [INFO] Created from .env.example - please configure
    )
)
echo.

REM Start servers
echo ========================================
echo   Starting Servers
echo ========================================
echo.
echo Backend will start on port 3001
echo Frontend will start on port 5173
echo.

start "Backend - Port 3001" cmd /k "cd /d %~dp0backend && npm start"
timeout /t 2 /nobreak >nul
start "Frontend - Port 5173" cmd /k "cd /d %~dp0frontend && npm start"

echo.
echo [SUCCESS] Servers starting in new windows
echo.
echo Backend:  http://localhost:3001
echo Frontend: http://localhost:5173
echo.
echo Close the server windows to stop them
echo.
