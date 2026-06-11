// Minimal Claude (Anthropic) client.
//
// Requests are routed through the Vite dev-server proxy (see vite.config.js).
// The actual API key lives in .env.local as ANTHROPIC_API_KEY (no VITE_ prefix)
// and is injected server-side by the proxy, so it never reaches the browser
// bundle.

const API_URL = '/api/anthropic/v1/messages'
const DEFAULT_MODEL = 'claude-sonnet-4-6'

export async function complete(messages, opts = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.model ?? DEFAULT_MODEL,
      max_tokens: opts.maxTokens ?? 400,
      temperature: opts.temperature ?? 0.5,
      system: opts.system,
      messages,
    }),
    signal: opts.signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (res.status === 500 || res.status === 401) {
      throw new Error(
        'Anthropic key not configured. Add ANTHROPIC_API_KEY to .env.local and restart `npm run dev`.',
      )
    }
    throw new Error(`Claude API ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const block = data?.content?.[0]
  if (!block || block.type !== 'text') {
    throw new Error('Unexpected Claude response shape.')
  }
  return block.text
}

// Pulls the first {...} JSON object out of a model response, tolerating stray
// prose or ```json fences the model may add despite instructions.
export function parseJsonObject(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in response.')
  }
  return JSON.parse(text.slice(start, end + 1))
}
