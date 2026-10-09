import Anthropic from '@anthropic-ai/sdk'
import type { AnalyzeInput, AnalyzeResult } from './ai-schema'
import { resultSchema, systemPrompt } from './ai-schema'

export const MODEL = 'claude-opus-5-5'

/** Runs the panel / circuit-list analysis. Used by the Worker and by the browser in "own key" mode. */
export async function analyze(client: Anthropic, input: AnalyzeInput): Promise<AnalyzeResult> {
  if (!input.photo && !input.docs?.length && !input.instructions?.trim()) throw new Error('Nothing to analyze – add a photo, a circuit list, or some text.')

  const content: Anthropic.Beta.BetaContentBlockParam[] = []
  if (input.photo) {
    content.push({ type: 'text', text: 'Photo of the breaker panel:' })
    content.push({ type: 'image', source: { type: 'base64', media_type: input.photo.media_type, data: input.photo.data } })
  }
  for (const [i, doc] of (input.docs ?? []).entries()) {
    const title = `Circuit list from the electrician${doc.name ? ` (${doc.name})` : ''}${(input.docs?.length ?? 0) > 1 ? ` – part ${i + 1}` : ''}:`
    content.push({ type: 'text', text: title })
    if (doc.kind === 'image') content.push({ type: 'image', source: { type: 'base64', media_type: doc.media_type, data: doc.data } })
    else if (doc.kind === 'pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: doc.data } })
    else content.push({ type: 'text', text: doc.text })
  }
  content.push({
    type: 'text',
    text: input.instructions?.trim()
      ? `Instructions from the user:\n${input.instructions.trim()}`
      : 'Build the panel map from the material above.',
  })

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: systemPrompt(input),
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: resultSchema(input.sizes.map(s => s.id), input.icons) },
    },
    messages: [{ role: 'user', content }],
  })

  if (response.stop_reason === 'refusal') throw new Error('The model declined to analyze this input.')
  if (response.stop_reason === 'max_tokens') throw new Error('The panel is too large to analyze in one go – try a cropped photo or a shorter list.')
  const text = response.content.map(b => (b.type === 'text' ? b.text : '')).join('')
  try {
    return JSON.parse(text) as AnalyzeResult
  } catch {
    throw new Error('Could not read the analysis result.')
  }
}
