@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo ============================================
echo  Revolio Ai Studio - Commit + Deploy to Prod
echo ============================================
echo.

where git >nul 2>nul
if errorlevel 1 (
    echo ERROR: git not found in PATH.
    pause
    exit /b 1
)

where vercel >nul 2>nul
if errorlevel 1 (
    echo ERROR: vercel CLI not found in PATH.
    echo Install it with: npm install -g vercel
    pause
    exit /b 1
)

echo [1/4] Staging changes...
git add -A

git diff --cached --quiet
if %errorlevel%==0 (
    echo No changes to commit - skipping commit step.
) else (
    set "msg=Update %date% %time%"
    if not "%~1"=="" set "msg=%~1"
    echo [2/4] Committing: !msg!
    git commit -m "!msg!"
    if errorlevel 1 (
        echo ERROR: git commit failed.
        pause
        exit /b 1
    )
)

echo.
echo [3/4] Pushing to GitHub...
git push
if errorlevel 1 (
    echo ERROR: git push failed. Continuing to deploy anyway...
)

echo.
echo [4/4] Deploying to Vercel production...
call vercel --prod
if errorlevel 1 (
    echo ERROR: Vercel deploy failed.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  Done. Committed + pushed to GitHub + deployed to prod.
echo ============================================
pause
