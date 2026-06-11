import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Tiny custom middleware that forwards /api/anthropic/* to the Anthropic API.
// We avoid Vite's built-in server.proxy because it forwards the browser's
// Origin/Referer headers, which Anthropic treats as a CORS request and may
// reject. Using fetch() gives us full control over the outbound headers and a
// transparent streaming pass-through. The API key is injected here, server-
// side, so it never reaches the browser bundle.
function anthropicProxyPlugin(apiKey) {
  return {
    name: 'right-size-anthropic-proxy',
    configureServer(server) {
      server.middlewares.use('/api/anthropic', async (req, res) => {
        const targetPath = req.url ?? '/'
        const target = 'https://api.anthropic.com' + targetPath

        if (!apiKey) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(
            JSON.stringify({
              error: {
                message:
                  'ANTHROPIC_API_KEY is missing on the dev server. Add it to .env.local and restart `npm run dev`.',
              },
            }),
          )
          return
        }

        try {
          const chunks = []
          for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          }
          const body = chunks.length ? Buffer.concat(chunks) : undefined

          const upstream = await fetch(target, {
            method: req.method,
            headers: {
              'content-type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body,
          })

          res.statusCode = upstream.status
          upstream.headers.forEach((value, key) => {
            // Drop hop-by-hop / encoding headers — fetch already decoded.
            if (
              key === 'content-encoding' ||
              key === 'content-length' ||
              key === 'transfer-encoding' ||
              key === 'connection'
            ) {
              return
            }
            res.setHeader(key, value)
          })

          if (!upstream.body) {
            res.end()
            return
          }

          const reader = upstream.body.getReader()
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            res.write(Buffer.from(value))
          }
          res.end()
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          res.statusCode = 502
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: { message: `Proxy failure: ${message}` } }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const anthropicKey = env.ANTHROPIC_API_KEY

  if (anthropicKey) {
    process.stdout.write(
      `[right-size] Anthropic proxy ready (key length=${anthropicKey.length}, starts="${anthropicKey.slice(0, 7)}…")\n`,
    )
  } else {
    process.stdout.write(
      '[right-size] WARNING: ANTHROPIC_API_KEY missing from .env.local — AI recommendation will fall back to static copy.\n',
    )
  }

  return {
    plugins: [anthropicProxyPlugin(anthropicKey), react()],
  }
})
