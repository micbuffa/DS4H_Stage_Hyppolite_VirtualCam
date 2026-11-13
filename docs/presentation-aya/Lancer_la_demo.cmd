@echo off
setlocal
cd /d "%~dp0"
set "AYA_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%AYA_NODE%" (
 "%AYA_NODE%" serveur-demo.mjs
) else (
 node serveur-demo.mjs
)
pause
