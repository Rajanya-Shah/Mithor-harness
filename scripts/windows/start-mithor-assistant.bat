@echo off
setlocal
title Mithor Assistant - Starter (Philipp)

:: Resolve paths from environment variables set by install-philipp-pc.bat (with safe fallbacks)
if "%MITHOR_HARNESS_ROOT%"=="" set "MITHOR_HARNESS_ROOT=C:\Mithor\mithor-harness"
if "%MITHOR_REPO_PATH%"=="" set "MITHOR_REPO_PATH=C:\Mithor\Mithor-Platforms"

echo ======================================================================
echo   Mithor KI-Assistent wird gestartet...
echo ======================================================================
echo   Mithor Repo    : %MITHOR_REPO_PATH%
echo   Harness Ordner : %MITHOR_HARNESS_ROOT%
echo.

if exist "%MITHOR_REPO_PATH%\apps\FEP\package.json" (
    echo [1/3] Starte Mithor Frontend (http://127.0.0.1:5173)...
    start "Mithor Frontend (FEP)" /min cmd /k "cd /d "%MITHOR_REPO_PATH%\apps\FEP" && npm run dev"
) else (
    echo [1/3] Hinweis: apps\FEP nicht gefunden unter "%MITHOR_REPO_PATH%" - ueberspringe Frontend.
)

echo [2/3] Starte Klick-Inspektor-Proxy (http://127.0.0.1:5174)...
start "Mithor Klick-Inspektor" /min cmd /k "cd /d "%MITHOR_HARNESS_ROOT%" && npm run harness:launch"

timeout /t 4 /nobreak >nul
start "" "http://127.0.0.1:5174"

echo [3/3] Starte DeepSeek Harness Web UI (Profil: philipp)...
echo       (Dieses Fenster bitte offen lassen, solange du arbeitest.)
echo.
dsh --profile philipp
pause
