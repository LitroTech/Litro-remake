import * as fs from 'fs'
import * as path from 'path'
import type { Config } from 'drizzle-kit'

// drizzle-kit doesn't auto-load .env files, so we do it manually.
// Checks local packages/db/.env first, then falls back to apps/api/.env.
const candidates = [
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '../../apps/api/.env'),
]

for (const envPath of candidates) {
  if (!fs.existsSync(envPath)) continue
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    const val = trimmed.slice(eq + 1)
    if (!process.env[key]) process.env[key] = val
  }
  break
}

export default {
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config
