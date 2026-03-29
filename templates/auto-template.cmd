@echo off
setlocal
node "%~dp0scripts/auto-template.mjs" %*
exit /b %errorlevel%
