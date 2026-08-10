@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0install_residential_push.ps1"
if errorlevel 1 (
  echo.
  echo TVPI residential push installation failed.
  pause
  exit /b 1
)
