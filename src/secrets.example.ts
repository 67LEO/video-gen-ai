// Rename this file to secrets.ts and fill in the actual base64-encoded values
// Use: echo -n "your-string" | base64 (Linux) or [Convert]::ToBase64String() (PowerShell)
import { Buffer } from 'buffer'

export const API_BASE = Buffer.from('', 'base64').toString()        // Base64 of API base URL
export const AES_KEY = Buffer.from('', 'base64').toString()         // Base64 of AES encryption key
export const ELEVENLABS_BASE = Buffer.from('', 'base64').toString() // Base64 of ElevenLabs API URL
