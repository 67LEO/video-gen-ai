import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Load .env before anything else (needed because ESM imports are hoisted)
dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function req(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`Missing required env var: ${key}`)
  return v
}

export const API_BASE = req('API_BASE')
export const AES_KEY = req('AES_KEY')
export const ELEVENLABS_BASE = req('ELEVENLABS_BASE')
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
