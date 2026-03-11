@echo off
echo Setting up AtlasPM violation auto-sync (every 6 hours)...
echo.

REM Delete existing task if it exists
schtasks /delete /tn "AtlasPM-ViolationSync" /f >nul 2>&1

REM Create scheduled task: runs every 6 hours starting at 6am
schtasks /create /tn "AtlasPM-ViolationSync" /tr "node C:\Users\omrid\Documents\icertracker\scripts\sync-violations.js" /sc DAILY /st 06:00 /ri 360 /du 24:00 /f

if %errorlevel% equ 0 (
    echo.
    echo Auto-sync scheduled successfully!
    echo.
    echo   Task name:  AtlasPM-ViolationSync
    echo   Schedule:   Every 6 hours (6am, 12pm, 6pm, 12am)
    echo   Command:    node scripts/sync-violations.js
    echo.
    echo   Note: The Next.js dev server must be running for sync to work.
    echo   To remove: double-click scripts\remove-auto-sync.bat
    echo   To view:   schtasks /query /tn "AtlasPM-ViolationSync"
) else (
    echo.
    echo Failed to create scheduled task. Try running as administrator.
)

echo.
pause
