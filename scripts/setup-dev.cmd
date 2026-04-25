@echo off
setlocal EnableDelayedExpansion

REM Build the @ character to prevent mailto-link mangling
set AT=@
set DB_URL=postgresql://litro:litro%AT%localhost:5432/litro

REM ── Create apps\api\.env ──────────────────────────────────────────────────
(
echo DATABASE_URL=%DB_URL%
echo REDIS_URL=redis://localhost:6379
echo JWT_SECRET=litro-dev-secret-change-in-prod
echo FB_PAGE_ACCESS_TOKEN=
echo FB_VERIFY_TOKEN=
echo PORT=3000
echo NODE_ENV=development
) > "%~dp0..\apps\api\.env"
echo Created apps\api\.env

REM ── Create apps\mobile\.env ───────────────────────────────────────────────
echo EXPO_PUBLIC_API_URL=http://localhost:3000> "%~dp0..\apps\mobile\.env"
echo Created apps\mobile\.env

REM ── Run migrations with DATABASE_URL set in environment ───────────────────
echo.
echo Running database migrations...
set DATABASE_URL=%DB_URL%
cd /d "%~dp0..\packages\db"
call node_modules\.bin\drizzle-kit migrate
if errorlevel 1 (
  echo.
  echo Migration failed. Make sure Docker is running: docker compose up -d
  cd /d "%~dp0.."
  exit /b 1
)

cd /d "%~dp0.."
echo.
echo Setup complete! Now run in a new terminal:
echo   pnpm --filter @litro/api dev
