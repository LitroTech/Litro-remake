# Creates local .env files needed to run Litro in development.
# Run once from the repo root: .\scripts\setup-env.ps1

param(
    [string]$DbPassword = "litro"
)

$root = Split-Path -Parent $PSScriptRoot
$at = [char]64

# apps/api/.env
$apiEnv = @"
DATABASE_URL=postgresql://litro:${DbPassword}${at}localhost:5432/litro
REDIS_URL=redis://localhost:6379
JWT_SECRET=litro-dev-secret-change-in-prod
FB_PAGE_ACCESS_TOKEN=
FB_VERIFY_TOKEN=
PORT=3000
NODE_ENV=development
"@
$apiPath = Join-Path $root "apps\api\.env"
Set-Content -Path $apiPath -Value $apiEnv -Encoding UTF8NoBOM
Write-Host "Created $apiPath"

# apps/mobile/.env
$mobileEnv = "EXPO_PUBLIC_API_URL=http://localhost:3000"
$mobilePath = Join-Path $root "apps\mobile\.env"
Set-Content -Path $mobilePath -Value $mobileEnv -Encoding UTF8NoBOM
Write-Host "Created $mobilePath"

Write-Host ""
Write-Host "Done. Next steps:"
Write-Host "  pnpm db:migrate"
Write-Host "  pnpm --filter @litro/api dev"
