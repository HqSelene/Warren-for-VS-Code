@echo off
setlocal
set "ELECTRON_RUN_AS_NODE=1"
"%~dp0..\..\..\Agent Garden.exe" "%~dp0uninstall-adapters.cjs"
exit /b 0
