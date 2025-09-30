@echo off
if "%1"=="local" (
    copy .env.local .env
    echo Switched to LOCAL environment
) else if "%1"=="server" (
    copy .env.server .env
    echo Switched to SERVER environment
) else (
    echo Usage: switch-env.bat [local^|server]
    echo Example: switch-env.bat local
)