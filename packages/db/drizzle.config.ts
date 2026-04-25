import { config } from 'dotenv'
import { resolve } from 'path'
import type { Config } from 'drizzle-kit'

// Try packages/db/.env first, fall back to apps/api/.env
config({ path: resolve(__dirname, '.env') })
config({ path: resolve(__dirname, '../../apps/api/.env') })

export default {
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config
