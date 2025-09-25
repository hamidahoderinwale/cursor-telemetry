@echo off
echo 🚀 BRINGING UP CURSOR TELEMETRY SYSTEM
echo =====================================
echo.

echo 🧹 Cleaning up any existing processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :43917') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do taskkill /f /pid %%a >nul 2>&1

echo 🔌 Starting companion service...
start "Companion Service" cmd /k "cd cursor-activity-logger\companion && node src/index.js"

echo ⏳ Waiting for companion service...
timeout /t 5 /nobreak >nul

echo 🌐 Starting dashboard server...
start "Dashboard Server" cmd /k "cd cursor-activity-logger\public && python -m http.server 8000"

echo ⏳ Waiting for dashboard...
timeout /t 3 /nobreak >nul

echo.
echo 🎉 SYSTEM IS UP AND RUNNING!
echo ============================
echo.
echo 📊 Dashboard: http://localhost:8000/dashboard.html
echo 🧪 Test Page: http://localhost:8000/quick_test.html
echo 🔌 Companion API: http://127.0.0.1:43917
echo.
echo ✨ Edit files in your project to see real-time changes!
echo.
echo Press any key to open the dashboard...
pause >nul

start http://localhost:8000/dashboard.html

echo.
echo Press any key to exit...
pause >nul
