@echo off
setlocal
node "%~dp0scripts/updater.mjs" %*
exit /b %errorlevel%
