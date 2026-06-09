import crypto from 'crypto'
import { API_BASE } from '../config.js'
import type { ScriptScene } from '../types.js'

async function fetchWithTimeout(url: string, opts: RequestInit & { timeout?: number }, ms = 30000) {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal })
    return res
  } finally {
    clearTimeout(id)
  }
}

interface Style {
  id: number
  name: string
  sd_data?: string
  seed?: number
}

export async function getDefaultStyle(): Promise<Style> {
  const res = await fetch(`${API_BASE}/styles?page=1&perPage=50`)
  if (!res.ok) throw new Error(`Styles fetch failed: ${res.status}`)
  const data = await res.json() as { items: Style[] }
  return data.items.find(s => s.id === 72) || data.items[0]
}

export async function generateImages(
  scenes: ScriptScene[],
  style: Style,
  width: number,
  height: number,
): Promise<string[]> {
  const sdData = JSON.parse(style.sd_data || '{}') as Record<string, unknown>
  sdData.positive_prompt = ''
  sdData.base64 = true
  sdData.seed = style.seed ?? -1
  sdData.width = width
  sdData.height = height
  delete sdData.styleID
  delete sdData.jsonData

  const payload = scenes.map(s => ({
    ...sdData,
    positive_prompt: s.visualPrompt,
    id: crypto.randomUUID(),
  }))

  const res = await fetchWithTimeout(
    `${API_BASE}/runpod-wrapper/call?endpoint=generate-batch&style_id=${style.id}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'app-version': '2.1.5' },
      body: JSON.stringify(payload),
    },
    60000,
  )

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    if (body.includes('high traffic')) throw new Error('HIGH_TRAFFIC')
    throw new Error(`Image gen failed: ${res.status} - ${body.slice(0, 200)}`)
  }

  const result = await res.json() as { image_base64?: string }[]
  return (Array.isArray(result) ? result : [result]).map(item => {
    const raw = item.image_base64 || ''
    const comma = raw.indexOf(',')
    return comma >= 0 ? raw.slice(comma + 1) : raw
  })
}
