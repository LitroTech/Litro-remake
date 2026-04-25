@echo off
setlocal EnableDelayedExpansion

REM Build @ to prevent mailto-link corruption when copying from chat
set AT=@
set DB_URL=postgresql://litro:litro%AT%localhost:5432/litro

REM ── Create apps\api\.env ──────────────────────────────────────────────────
echo DATABASE_URL=%DB_URL%>apps\api\.env
echo REDIS_URL=redis://localhost:6379>>apps\api\.env
echo JWT_SECRET=litro-dev-secret-change-in-prod>>apps\api\.env
echo FB_PAGE_ACCESS_TOKEN=>>apps\api\.env
echo FB_VERIFY_TOKEN=>>apps\api\.env
echo PORT=3000>>apps\api\.env
echo NODE_ENV=development>>apps\api\.env
echo Created apps\api\.env

REM ── Create apps\mobile\.env ───────────────────────────────────────────────
echo EXPO_PUBLIC_API_URL=http://localhost:3000>apps\mobile\.env
echo Created apps\mobile\.env

REM ── Run migrations from root using hoisted drizzle-kit ────────────────────
echo.
echo Running database migrations...
set DATABASE_URL=%DB_URL%
node_modules\.bin\drizzle-kit migrate --config packages\db\drizzle.config.ts

if errorlevel 1 (
  echo.
  echo Migration failed. Is Docker running? Try: docker compose up -d
  exit /b 1
)

echo.
echo Setup complete! Now run:
echo   pnpm --filter @litro/api dev
