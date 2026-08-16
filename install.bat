@echo off
setlocal enabledelayedexpansion

echo ====================================================
echo Installing Antigravity Multi-Account Switcher (Windows)
echo ====================================================

powershell -ExecutionPolicy Bypass -File "%~dp0install.ps1"

pause
