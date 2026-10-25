@echo off
rem OpenMail CLI / MCP server (installed app): runs the bundled CLI with Electron's built-in Node.
set ELECTRON_RUN_AS_NODE=1
"%~dp0OpenMail.exe" "%~dp0resources\app.asar\out\cli\octo.js" %*
