import { API_BASE, ELEVENLABS_BASE } from '../config.js'
import { encryptToken } from './encrypt.js'

let elevenLabsKey: string | null = null

export async function getElevenLabsKey(): Promise<string> {
  if (elevenLabsKey) return elevenLabsKey
  const token = encryptToken()
  const res = await fetch(`${API_BASE}/reference/elevenlabs`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Failed to fetch ElevenLabs key: ${res.status}`)
  const data = await res.json() as { xi_api_token: string }
  elevenLabsKey = data.xi_api_token
  return elevenLabsKey
}

export async function generateVoiceover(
  text: string,
  voiceId = '21m00Tcm4TlvDq8ikWAM',
  language?: string,
): Promise<string> {
  const key = await getElevenLabsKey()

  const langMap: Record<string, string> = {
    english: 'en', hindi: 'hi', tamil: 'ta', telugu: 'te',
    bengali: 'bn', marathi: 'mr', gujarati: 'gu', punjabi: 'pa',
    urdu: 'ur', kannada: 'kn', malayalam: 'ml',
    spanish: 'es', french: 'fr', german: 'de',
  }

  const model = language && language !== 'english' ? 'eleven_multilingual_v2' : 'eleven_turbo_v2_5'
  const body: Record<string, unknown> = {
    text,
    model_id: model,
    voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
  }

  if (language && langMap[language]) {
    body.language_code = langMap[language]
  }

  const res = await fetch(`${ELEVENLABS_BASE}/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': key },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`TTS failed: ${res.status} - ${errText.slice(0, 200)}`)
  }

  const buf = Buffer.from(await res.arrayBuffer())
  return buf.toString('base64')
}
