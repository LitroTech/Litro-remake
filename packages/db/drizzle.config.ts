import type { Config } from 'drizzle-kit'

// DATABASE_URL is injected by dotenv-cli in the db:migrate / db:generate scripts
export default {
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config
