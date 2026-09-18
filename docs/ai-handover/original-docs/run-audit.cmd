@echo off
REM اجرای ممیزی فقط‌خواندنی — هیچ فایلی تغییر نمی‌کند
set "ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-audit.ps1" -Root "%ROOT:~0,-1%"
pause
