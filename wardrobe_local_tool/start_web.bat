@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo 没有找到项目 Python 环境，请先双击 setup.ps1 或在 PowerShell 运行 setup.ps1
  pause
  exit /b 1
)
echo Wardrobe API listening on http://127.0.0.1:8000
".venv\Scripts\python.exe" -m uvicorn app:app --host 0.0.0.0 --port 8000
pause
