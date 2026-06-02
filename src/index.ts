import dotenv from 'dotenv'
dotenv.config()

import bot from './bot.js'
import fs from 'fs'
import { TMP_DIR } from './config.js'

// Ensure tmp dir exists
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true })
}

const token = process.env.BOT_TOKEN
if (!token) {
  console.error('❌ BOT_TOKEN not set in .env file')
  process.exit(1)
}

bot.launch(() => {
  console.log('🤖 VideoGPT Bot is running...')
})

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
