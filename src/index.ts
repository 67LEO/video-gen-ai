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

// Global handlers — log but don't crash on unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('⚠️ unhandledRejection:', (err as any)?.message || err)
})
process.on('uncaughtException', (err) => {
  console.error('⚠️ uncaughtException:', err.message)
})

// Init DB
initDb().then(() => {
  console.log('✅ Database connected')
}).catch((e) => {
  console.error('❌ Database init error:', e.message)
})

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000
const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('ok')
})
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Health server on port ${PORT}`)
})

async function startBot() {
  // Clear stale session first
  await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {})
  await new Promise(r => setTimeout(r, 2000))

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await bot.launch()
      console.log('🤖 VideoGPT Bot is running...')
      return
    } catch (e: any) {
      if (e?.response?.error_code === 409) {
        console.log(`⚠️ 409 conflict (attempt ${attempt}/5), retrying in ${attempt * 3}s...`)
        await new Promise(r => setTimeout(r, attempt * 3000))
        await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {})
      } else {
        throw e
      }
    }
  }
  throw new Error('Max retries for 409 conflict')
}

startBot().catch((e) => {
  console.error('❌ Bot failed to start:', e.message)
  process.exit(1)
})

const shutdown = () => {
  bot.stop('SIGINT')
  server.close()
  closePool()
}
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
