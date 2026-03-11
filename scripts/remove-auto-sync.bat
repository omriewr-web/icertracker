@echo off
echo Removing AtlasPM violation auto-sync...
echo.

schtasks /delete /tn "AtlasPM-ViolationSync" /f

if %errorlevel% equ 0 (
    echo Auto-sync removed successfully.
) else (
    echo Task not found or already removed.
)

echo.
pause
