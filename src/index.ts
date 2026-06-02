import dotenv from 'dotenv'
dotenv.config()

import bot from './bot.js'
import fs from 'fs'
import { TMP_DIR } from './config.js'
import { initDb, closePool } from './db.js'

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true })
}

const token = process.env.BOT_TOKEN
if (!token) {
  console.error('❌ BOT_TOKEN not set in .env file')
  process.exit(1)
}

// Init DB tables (safe: IF NOT EXISTS)
initDb().then(() => {
  console.log('✅ Database connected')
}).catch((e) => {
  console.error('❌ Database init error:', e.message)
})

bot.launch(() => {
  console.log('🤖 VideoGPT Bot is running...')
})

process.once('SIGINT', () => { bot.stop('SIGINT'); closePool() })
process.once('SIGTERM', () => { bot.stop('SIGTERM'); closePool() })
