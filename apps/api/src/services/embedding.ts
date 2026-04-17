import type { EmbedderFn } from '@litro/bot-engine'

let embedder: EmbedderFn | null = null

/**
 * Lazily loads the all-MiniLM-L6-v2 model on first call.
 * Model is 22MB, cached in memory for the process lifetime.
 * Download happens once per container (~5-10s on cold start).
 */
export async function getEmbedder(): Promise<EmbedderFn> {
  if (embedder) return embedder

  // Dynamic import so the model only loads in environments where it's needed.
  // If @xenova/transformers is unavailable, bot engine falls back gracefully.
  try {
    const { pipeline, env } = await import('@xenova/transformers')

    // Use local cache if available, otherwise download from HuggingFace CDN
    env.allowLocalModels = true
    env.useBrowserCache = false

    const extractor = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      { quantized: true } // 8-bit quantized — half the size, same accuracy
    )

    embedder = async (text: string): Promise<Float32Array> => {
      const output = await extractor(text, { pooling: 'mean', normalize: true })
      return output.data as Float32Array
    }
  } catch (err) {
    console.warn('[embedding] MiniLM unavailable, FAQ matching disabled:', (err as Error).message)
    // Return a dummy embedder — FaqMatcher.findMatch will return null for all queries
    embedder = async () => new Float32Array(384)
  }

  return embedder!
}
