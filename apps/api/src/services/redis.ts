import Redis from 'ioredis'

let client: Redis | null = null

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    })
    client.on('error', (err) => {
      // Log but don't crash — Redis is a cache, not source of truth
      console.error('[redis] connection error:', err.message)
    })
  }
  return client
}

// ─── Typed helpers ────────────────────────────────────────────────────────────

export async function rGet(key: string): Promise<string | null> {
  try {
    return await getRedis().get(key)
  } catch {
    return null // graceful degradation
  }
}

export async function rSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    await getRedis().set(key, value, 'EX', ttlSeconds)
  } catch {
    // ignore — cache miss is acceptable
  }
}

export async function rDel(key: string): Promise<void> {
  try {
    await getRedis().del(key)
  } catch {
    // ignore
  }
}

export async function rGetJson<T>(key: string): Promise<T | null> {
  const raw = await rGet(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function rSetJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await rSet(key, JSON.stringify(value), ttlSeconds)
}
