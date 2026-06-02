import crypto from 'crypto'
import { AES_KEY } from '../config.js'

export function encryptToken(): string {
  const ts = Math.floor(Date.now() / 1000)
  const key = Buffer.from(AES_KEY, 'utf-8')
  const cipher = crypto.createCipheriv('aes-256-gcm', key, key, { authTagLength: 4 })
  const enc = Buffer.concat([cipher.update(`app_${ts}`, 'utf-8'), cipher.final(), cipher.getAuthTag()])
  return enc.toString('hex')
}
