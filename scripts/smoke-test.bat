@echo off
REM smoke-test.bat — Windows 兼容启动自检脚本
REM 顺序执行：install → prisma → build → start → health check → cleanup

setlocal enabledelayedexpansion

set PORT=5000
set HEALTH_URL=http://localhost:!PORT!/api/health
set BUILD_LOG=%TEMP%\build.log
set SERVER_PID=

echo.
echo ================================
echo  Smoke Test (Windows)
echo ================================

REM Step 1: Install
echo.
echo [Step 1] bun install --frozen-lockfile
call bun install --frozen-lockfile
if errorlevel 1 (
    echo FAILED: bun install
    exit /b 1
)
echo OK: Dependencies installed

REM Step 2: Prisma Generate
echo.
echo [Step 2] prisma generate
call npx prisma generate
if errorlevel 1 (
    echo FAILED: prisma generate
    exit /b 1
)
echo OK: Prisma Client generated

REM Step 3: Prisma DB Push
echo.
echo [Step 3] prisma db push
set DATABASE_URL=file:./prisma/db/custom.db
call npx prisma db push
if errorlevel 1 (
    echo FAILED: prisma db push
    exit /b 1
)
echo OK: Database schema synced

REM Step 4: Build
echo.
echo [Step 4] next build
call npx next build > "!BUILD_LOG!" 2>&1
if errorlevel 1 (
    echo FAILED: next build
    type "!BUILD_LOG!"
    exit /b 1
)
echo OK: Build completed

REM Step 5: Start Server
echo.
echo [Step 5] Starting server on port !PORT!
start /b npx next start -p !PORT!
timeout /t 15 /nobreak > nul

REM Step 6: Health Check
echo.
echo [Step 6] Health check
curl -sf "!HEALTH_URL!" > nul 2>&1
if errorlevel 1 (
    echo FAILED: Health check - server not responding
    taskkill /f /im node.exe > nul 2>&1
    exit /b 1
)
echo OK: Health check passed

REM Step 7: Cleanup
echo.
echo [Step 7] Cleanup
taskkill /f /im node.exe > nul 2>&1
echo OK: Server stopped

echo.
echo ================================
echo  All smoke tests passed!
echo ================================
exit /b 0
