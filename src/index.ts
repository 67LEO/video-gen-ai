import dotenv from 'dotenv'
dotenv.config()

import bot from './bot.js'
import fs from 'fs'
import http from 'http'
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

// Init DB
initDb().then(() => {
  console.log('✅ Database connected')
}).catch((e) => {
  console.error('❌ Database init error:', e.message)
})

// Minimal HTTP server for Render health checks
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000
const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('ok')
})
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Health server on port ${PORT}`)
})

// Start bot (polling mode)
bot.launch(() => {
  console.log('🤖 VideoGPT Bot is running...')
})

// Graceful shutdown
const shutdown = () => {
  bot.stop('SIGINT')
  server.close()
  closePool()
}
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
