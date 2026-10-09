import Anthropic from '@anthropic-ai/sdk'
import { analyze } from '../src/lib/analyze'
import type { AnalyzeInput } from '../src/lib/ai-schema'

interface Env {
  ASSETS: Fetcher
  ANTHROPIC_API_KEY?: string
  ACCESS_CODE?: string
}

const MAX_BODY = 30 * 1024 * 1024

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/health') {
      return json({ ai: !!env.ANTHROPIC_API_KEY, accessCode: !!env.ACCESS_CODE })
    }

    if (url.pathname === '/api/analyze') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
      if (!env.ANTHROPIC_API_KEY) return json({ error: 'AI import is not configured on this server. Add your own API key in Settings instead.' }, 501)
      if (env.ACCESS_CODE && request.headers.get('x-access-code') !== env.ACCESS_CODE) {
        return json({ error: 'Wrong or missing access code (Settings → AI).' }, 401)
      }
      if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) return json({ error: 'Upload too large.' }, 413)

      let input: AnalyzeInput
      try {
        input = await request.json()
      } catch {
        return json({ error: 'Invalid JSON body.' }, 400)
      }
      if (!Array.isArray(input.sizes) || !input.sizes.length || !Array.isArray(input.icons)) return json({ error: 'Missing sizes or icons.' }, 400)

      const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
      try {
        return json(await analyze(client, input))
      } catch (err) {
        if (err instanceof Anthropic.RateLimitError) return json({ error: 'The AI service is busy – try again in a minute.' }, 429)
        if (err instanceof Anthropic.AuthenticationError) return json({ error: 'The server API key was rejected.' }, 502)
        if (err instanceof Anthropic.BadRequestError) return json({ error: `The AI service rejected the request: ${err.message}` }, 400)
        if (err instanceof Anthropic.APIError) return json({ error: `AI service error (${err.status ?? 'network'}).` }, 502)
        return json({ error: err instanceof Error ? err.message : String(err) }, 500)
      }
    }

    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, 404)
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
