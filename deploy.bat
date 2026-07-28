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

echo [1/3] Staging changes...
git add -A

git diff --cached --quiet
if %errorlevel%==0 (
    echo No changes to commit - skipping commit step.
) else (
    set "msg=Update %date% %time%"
    if not "%~1"=="" set "msg=%~1"
    echo [2/3] Committing: !msg!
    git commit -m "!msg!"
    if errorlevel 1 (
        echo ERROR: git commit failed.
        pause
        exit /b 1
    )
)

echo.
echo [3/3] Pushing to GitHub...
REM Vercel's GitHub integration auto-deploys to production on every push to
REM main - a separate `vercel --prod` CLI call used to run right after this
REM and was removed: while `git push` was silently failing (a since-fixed
REM broken push refspec), that CLI call was the only thing actually
REM deploying, so it went unnoticed. Once push started working again, both
REM triggers fired for the same commit, producing two redundant production
REM deployments per run. Push is now the only trigger.
git push
if errorlevel 1 (
    echo ERROR: git push failed - nothing was deployed.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  Done. Committed + pushed to GitHub - Vercel will deploy automatically.
echo ============================================
pause
