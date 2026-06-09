import { API_BASE } from '../config.js'
import type { ScriptScene, ScriptResult } from '../types.js'

async function fetchWithRetry(url: string, opts: RequestInit, max = 3): Promise<Response> {
  for (let i = 0; i <= max; i++) {
    const res = await fetch(url, opts)
    if (res.ok) return res
    const body = await res.text().catch(() => '')
    const lower = body.toLowerCase()
    if (lower.includes('high traffic') && i < max) {
      await new Promise(r => setTimeout(r, 2000 * 2 ** i))
      continue
    }
    if (lower.includes('prohibited content')) {
      throw new Error('PROHIBITED_CONTENT')
    }
    throw new Error(`API error ${res.status}: ${body.slice(0, 200)}`)
  }
  throw new Error('Max retries exceeded')
}

function decodeHtml(s: string): string {
  return s.replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
}

export async function writeScript(
  prompt: string,
  language = 'English USA',
  targetCount = 6,
): Promise<ScriptResult> {
  const url = `${API_BASE}/completions/script-writer-extended?style_id=&is_subscriber=%20`
  const finalPrompt = language !== 'English USA'
    ? `Write "${prompt}" in "${language}" language only`
    : `Write "${prompt}"`

  const batches: { descs: string[]; vo: string }[] = []
  const history: string[] = []
  let total = 0

  for (let a = 0; a < 10 && total < targetCount; a++) {
    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'app-version': '2.1.5' },
      body: JSON.stringify({ prompt_id: 1, prompt: finalPrompt, history }),
    })
    const raw = await res.json() as { parsed?: unknown; answer?: string }
    const p = raw.parsed
    if (!p || Array.isArray(p) || typeof p !== 'object') break

    const descs = (Array.isArray((p as Record<string, unknown>).images_descriptions)
      ? (p as Record<string, unknown>).images_descriptions as string[]
      : []) as string[]
    const vo = typeof (p as Record<string, unknown>).voiceover_description === 'string'
      ? (p as Record<string, unknown>).voiceover_description as string
      : ''
    if (!descs.length) break

    batches.push({ descs, vo })
    total += descs.length
    history.push(JSON.stringify({ images_descriptions: descs, voiceover_description: vo }))
  }

  function splitVo(text: string, n: number): string[] {
    if (!text || n <= 1) return [text || '']
    const sents = text.split(/(?<![A-Z])[.!।](?:\s+|$)/).map(s => s.trim()).filter(Boolean)
    if (sents.length >= n) {
      const per = Math.ceil(sents.length / n)
      return Array.from({ length: n }, (_, i) =>
        sents.slice(i * per, (i + 1) * per).join('. ').trim(),
      )
    }
    const words = text.split(/\s+/).filter(Boolean)
    const cs = Math.max(Math.ceil(words.length / n), 1)
    return words.length ? Array.from({ length: Math.ceil(words.length / cs) }, (_, i) =>
      words.slice(i * cs, (i + 1) * cs).join(' '),
    ) : [text]
  }

  const scenes: ScriptScene[] = []
  let dc = 0
  for (const b of batches) {
    const parts = splitVo(b.vo, b.descs.length)
    for (let i = 0; i < b.descs.length && dc < targetCount; i++, dc++) {
      scenes.push({
        description: decodeHtml(b.descs[i]),
        visualPrompt: decodeHtml(b.descs[i]),
        duration: 5,
        audioText: i < parts.length ? decodeHtml(parts[i]) : undefined,
      })
    }
  }

  return {
    scenes,
    voiceoverDescription: batches.map(b => b.vo).filter(Boolean).join(' '),
  }
}
