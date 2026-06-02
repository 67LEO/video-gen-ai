import path from 'path'
import { fileURLToPath } from 'url'

// Try env vars first (for Render/Railway), fall back to secrets.ts
function getSecret(envKey: string, b64Default: string): string {
  if (process.env[envKey]) return process.env[envKey]!
  if (b64Default) return Buffer.from(b64Default, 'base64').toString()
  return ''
}

// Import from secrets.ts (gitignored, only present on local dev)
let secrets: { API_BASE?: string; AES_KEY?: string; ELEVENLABS_BASE?: string } = {}
try {
  secrets = await import('./secrets.js')
} catch {}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

export const API_BASE = getSecret('API_BASE', secrets.API_BASE || '')
export const AES_KEY = getSecret('AES_KEY', secrets.AES_KEY || '')
export const ELEVENLABS_BASE = getSecret('ELEVENLABS_BASE', secrets.ELEVENLABS_BASE || '')
export const FFMPEG_PATH = process.env.FFMPEG_PATH || ''
export const TMP_DIR = path.join(root, 'tmp')

export const DURATIONS = [15, 30, 60]
export const ASPECT_OPTIONS = [
  { id: 'portrait', label: 'Portrait (9:16)', w: 648, h: 1152 },
  { id: 'landscape', label: 'Landscape (16:9)', w: 1152, h: 648 },
]

export interface LangOption { code: string; name: string; native: string }
export const LANGUAGES: LangOption[] = [
  { code: 'english', name: 'English USA', native: 'English' },
  { code: 'hindi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'tamil', name: 'Tamil', native: 'தமிழ்' },
  { code: 'telugu', name: 'Telugu', native: 'తెలుగు' },
  { code: 'bengali', name: 'Bengali', native: 'বাংলা' },
  { code: 'marathi', name: 'Marathi', native: 'मराठी' },
  { code: 'gujarati', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'punjabi', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'urdu', name: 'Urdu', native: 'اردو' },
  { code: 'kannada', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'malayalam', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'spanish', name: 'Spanish Spain', native: 'Español' },
  { code: 'french', name: 'French France', native: 'Français' },
  { code: 'german', name: 'German', native: 'Deutsch' },
]
