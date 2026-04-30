// Embedding wrapper. Uses Voyage AI when VOYAGE_API_KEY is set; otherwise
// falls back to a deterministic hash-based pseudo-embedding so the pipeline
// runs end-to-end offline. The fallback is NOT semantically meaningful. It
// only exists to let you exercise the schema without a key.

export const EMBED_DIM = 512;
export const EMBED_MODEL = 'voyage-3-lite';

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';

export type EmbedInputType = 'document' | 'query';

interface VoyageResponse {
  data: { embedding: number[]; index: number }[];
  model: string;
  usage: { total_tokens: number };
}

async function voyageEmbed(
  texts: string[],
  inputType: EmbedInputType,
): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY!;
  const res = await fetch(VOYAGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: texts,
      input_type: inputType,
      output_dimension: EMBED_DIM,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Voyage API ${res.status}: ${body}`);
  }
  const json = (await res.json()) as VoyageResponse;
  return json.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

// FNV-1a 32-bit hash, used to seed the fallback vector deterministically.
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function fallbackEmbed(text: string): number[] {
  // Bag-of-tokens projected into EMBED_DIM via hash modulo. L2-normalized.
  const vec = new Float32Array(EMBED_DIM);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const t of tokens) {
    const h = fnv1a(t);
    const idx = h % EMBED_DIM;
    const sign = (h >> 31) & 1 ? -1 : 1;
    vec[idx] += sign;
  }
  let norm = 0;
  for (let i = 0; i < EMBED_DIM; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  const out = new Array<number>(EMBED_DIM);
  for (let i = 0; i < EMBED_DIM; i++) out[i] = vec[i] / norm;
  return out;
}

export function hasVoyageKey(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY);
}

export async function embed(
  texts: string[],
  inputType: EmbedInputType = 'document',
): Promise<number[][]> {
  if (!texts.length) return [];
  if (hasVoyageKey()) return voyageEmbed(texts, inputType);
  return texts.map(fallbackEmbed);
}

export async function embedOne(
  text: string,
  inputType: EmbedInputType = 'query',
): Promise<number[]> {
  const [v] = await embed([text], inputType);
  return v;
}
