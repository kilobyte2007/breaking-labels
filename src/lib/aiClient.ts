import { ref } from 'vue'
import type { AnalyzeInput, AnalyzeResult } from './ai-schema'
import { state } from '../store'

export const serverAi = ref<{ ai: boolean; accessCode: boolean } | null>(null)

export async function checkServer() {
  try {
    const r = await fetch('/api/health')
    serverAi.value = r.ok ? await r.json() : { ai: false, accessCode: false }
  } catch {
    serverAi.value = { ai: false, accessCode: false }
  }
}

export function aiAvailable(): boolean {
  const ai = state.settings.ai
  if (ai.mode === 'key') return !!ai.apiKey.trim()
  return !!serverAi.value?.ai
}

export async function runAnalysis(input: AnalyzeInput): Promise<AnalyzeResult> {
  const ai = state.settings.ai
  if (ai.mode === 'key') {
    if (!ai.apiKey.trim()) throw new Error('Add your Anthropic API key in Settings → AI.')
    // Loaded on demand so the SDK isn't part of the main bundle.
    const [{ default: Anthropic }, { analyze }] = await Promise.all([import('@anthropic-ai/sdk'), import('./analyze')])
    const client = new Anthropic({ apiKey: ai.apiKey.trim(), dangerouslyAllowBrowser: true })
    return analyze(client, input)
  }
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(ai.accessCode ? { 'x-access-code': ai.accessCode } : {}) },
    body: JSON.stringify(input),
  })
  const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }))
  if (!res.ok) throw new Error(data.error ?? `Server error (${res.status})`)
  return data as AnalyzeResult
}
