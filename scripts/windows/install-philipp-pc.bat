@echo off
setlocal enabledelayedexpansion
title Mithor Philipp Harness - Windows Installer

echo ======================================================================
echo   Mithor Philipp Harness - Automated Windows Setup
echo ======================================================================
echo.

:: Resolve harness root (two levels up from scripts\windows\)
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "HARNESS_ROOT=%%~fI"

:: Default Mithor-Platforms sibling folder
for %%I in ("%HARNESS_ROOT%\..\Mithor-Platforms") do set "DEFAULT_MITHOR_REPO=%%~fI"
set /p "MITHOR_REPO_PATH=Path to Mithor-Platforms [%DEFAULT_MITHOR_REPO%]: "
if "%MITHOR_REPO_PATH%"=="" set "MITHOR_REPO_PATH=%DEFAULT_MITHOR_REPO%"

echo.
echo [1/6] Checking required tools (Git, GitHub CLI, Node.js, Python)...
where git >nul 2>&1 || winget install -e --id Git.Git --accept-package-agreements --accept-source-agreements
where gh >nul 2>&1 || winget install -e --id GitHub.cli --accept-package-agreements --accept-source-agreements
where node >nul 2>&1 || winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
where python >nul 2>&1 || winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements

:: Refresh PATH for current session from Machine + User registry
for /f "usebackq tokens=2,*" %%A in (`reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul`) do set "SYS_PATH=%%B"
for /f "usebackq tokens=2,*" %%A in (`reg query "HKCU\Environment" /v Path 2^>nul`) do set "USR_PATH=%%B"
set "PATH=%SYS_PATH%;%USR_PATH%;%PATH%"

echo.
echo [2/6] Installing DeepSeek Harness (dsh) and Poetry...
where dsh >nul 2>&1
if errorlevel 1 (
    call npm install -g @deepseek-ai/dsh
) else (
    echo   dsh is already installed.
)

where poetry >nul 2>&1
if errorlevel 1 (
    python -m pip install --user poetry
) else (
    echo   poetry is already installed.
)

echo.
echo [3/6] Configuring DeepSeek API Key & Environment Variables...
if "%DEEPSEEK_API_KEY%"=="" (
    set /p "INPUT_API_KEY=Enter DEEPSEEK_API_KEY (or press Enter to skip): "
    if not "!INPUT_API_KEY!"=="" (
        setx DEEPSEEK_API_KEY "!INPUT_API_KEY!" >nul
        set "DEEPSEEK_API_KEY=!INPUT_API_KEY!"
        echo   Saved DEEPSEEK_API_KEY for current Windows user.
    )
) else (
    echo   DEEPSEEK_API_KEY is already set.
)
setx MITHOR_REPO_PATH "%MITHOR_REPO_PATH%" >nul
setx MITHOR_HARNESS_ROOT "%HARNESS_ROOT%" >nul

echo.
echo [4/6] Checking Mithor-Platforms repository...
if not exist "%MITHOR_REPO_PATH%\apps\FEP\package.json" (
    echo   Mithor-Platforms not found at "%MITHOR_REPO_PATH%".
    set /p "CLONE_CONFIRM=Clone Mithor-Tech/Mithor-Platforms there now? (y/n): "
    if /i "!CLONE_CONFIRM!"=="y" (
        git clone https://github.com/Mithor-Tech/Mithor-Platforms.git "%MITHOR_REPO_PATH%"
        pushd "%MITHOR_REPO_PATH%"
        git checkout develop
        popd
    )
)

if exist "%MITHOR_REPO_PATH%\apps\FEP\package.json" (
    if not exist "%MITHOR_REPO_PATH%\apps\FEP\node_modules" (
        echo   Installing apps\FEP npm dependencies...
        pushd "%MITHOR_REPO_PATH%\apps\FEP"
        call npm install
        if not exist ".env" if exist ".env.example" copy ".env.example" ".env" >nul
        popd
    )
)

echo.
echo [5/6] Bootstrapping DeepSeek Harness profile (~/.dsh/profiles/philipp) & running tests...
pushd "%HARNESS_ROOT%"
call node scripts/bootstrap-dsh.mjs
call npm test
if errorlevel 1 (
    echo.
    echo [WARNING] One or more validation checks failed. Review output above.
)
popd

echo.
echo [6/6] Creating Desktop shortcut "Start Mithor Assistant.bat"...
copy /y "%SCRIPT_DIR%start-mithor-assistant.bat" "%USERPROFILE%\Desktop\Start Mithor Assistant.bat" >nul

echo.
echo ======================================================================
echo   Setup Complete!
echo   - Desktop shortcut created: %USERPROFILE%\Desktop\Start Mithor Assistant.bat
echo   - Next: Run "gh auth login" once if Philipp hasn't signed in to GitHub.
echo   - Then double-click "Start Mithor Assistant.bat" on the Desktop!
echo ======================================================================
pause
