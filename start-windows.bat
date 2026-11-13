@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 or newer first.
  pause
  exit /b 1
)
echo LUMAVUN Market Gateway: http://localhost:8000
node server/index.mjs
pause
