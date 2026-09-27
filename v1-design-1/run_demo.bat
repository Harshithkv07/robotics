@echo off
REM Serves the pre-built viewer offline and opens it in the default browser.
cd /d "%~dp0"
if not exist viewer\dist\index.html (
  echo viewer\dist not found. Build it first:  cd viewer ^&^& npm install ^&^& npm run build
  pause
  exit /b 1
)
start "" http://localhost:4173
python -m http.server 4173 --directory viewer\dist
