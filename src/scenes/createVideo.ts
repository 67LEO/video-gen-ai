import { Scenes, Markup } from 'telegraf'
import type { ScriptScene } from '../types.js'
import { DURATIONS, ASPECT_OPTIONS, LANGUAGES } from '../config.js'
import { writeScript } from '../services/scriptWriter.js'
import { getDefaultStyle, generateImages } from '../services/imageGen.js'
import { generateVoiceover } from '../services/voiceover.js'
import { compileVideo } from '../services/videoCompiler.js'
import { upsertUser, getUserStats, incrementUsage, logVideoGen } from '../db.js'
import fs from 'fs'

interface VideoState {
  duration: number
  aspectRatio: string
  language: string
  topic: string
}

function chunk<T>(arr: T[], n: number): T[][] {
  const r: T[][] = []
  for (let i = 0; i < arr.length; i += n) r.push(arr.slice(i, i + n))
  return r
}

function st(ctx: Scenes.WizardContext): VideoState {
  return ctx.wizard.state as unknown as VideoState
}

export const createVideoWizard = new Scenes.WizardScene<Scenes.WizardContext>(
  'create-video',

  // Step 0: Duration
  async (ctx) => {
    // Track user
    const from = ctx.from
    if (from) {
      await upsertUser(from.id, from.first_name, from.username).catch(() => {})
    }
    await ctx.reply(
      '🎬 *Step 1/5: Video Duration*\n\nHow long should the video be?',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(
          DURATIONS.map(d => Markup.button.callback(`${d}s`, `dur_${d}`)),
        ),
      },
    )
    return ctx.wizard.next()
  },

  // Step 1: Aspect Ratio
  async (ctx) => {
    const cb = (ctx as any).callbackQuery
    if (!cb?.data?.startsWith('dur_')) {
      await ctx.reply('Please select a duration using the buttons.')
      return
    }
    st(ctx).duration = parseInt(cb.data.replace('dur_', ''), 10)
    await ctx.answerCbQuery()
    await ctx.deleteMessage().catch(() => {})
    await ctx.reply(
      '📐 *Step 2/5: Aspect Ratio*\n\nChoose the video format:',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(
          ASPECT_OPTIONS.map(a => Markup.button.callback(a.label, `aspect_${a.id}`)),
        ),
      },
    )
    return ctx.wizard.next()
  },

  // Step 2: Language
  async (ctx) => {
    const cb = (ctx as any).callbackQuery
    if (!cb?.data?.startsWith('aspect_')) {
      await ctx.reply('Please select an aspect ratio.')
      return
    }
    st(ctx).aspectRatio = cb.data.replace('aspect_', '')
    await ctx.answerCbQuery()
    await ctx.deleteMessage().catch(() => {})

    const langRows = chunk(LANGUAGES, 2).map(row =>
      row.map(l => Markup.button.callback(`${l.native}`, `lang_${l.code}`)),
    )
    await ctx.reply(
      '🌐 *Step 3/5: Language*\n\nChoose the video language:',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(langRows),
      },
    )
    return ctx.wizard.next()
  },

  // Step 3: Topic
  async (ctx) => {
    const cb = (ctx as any).callbackQuery
    if (!cb?.data?.startsWith('lang_')) {
      await ctx.reply('Please select a language.')
      return
    }
    const langCode = cb.data.replace('lang_', '')
    const lang = LANGUAGES.find(l => l.code === langCode)
    st(ctx).language = lang?.name || 'English USA'
    await ctx.answerCbQuery()
    await ctx.deleteMessage().catch(() => {})
    await ctx.reply(
      '✍️ *Step 4/5: Topic*\n\nWhat should the video be about?\n\n' +
      'Examples:\n' +
      '• "AI technology explained"\n' +
      '• "ताजमहल का इतिहास"\n' +
      '• "motivational speech for students"',
      { parse_mode: 'Markdown' },
    )
    return ctx.wizard.next()
  },

  // Step 4: Preview & Confirm
  async (ctx) => {
    const msg = (ctx as any).message
    if (!msg?.text || msg.text.startsWith('/')) {
      await ctx.reply('Please send a text message with your topic.')
      return
    }
    st(ctx).topic = msg.text
    const s = st(ctx)
    const aspect = ASPECT_OPTIONS.find(a => a.id === s.aspectRatio)

    await ctx.reply(
      `📋 *Preview*\n\n` +
      `• Duration: ${s.duration}s\n` +
      `• Aspect: ${aspect?.label || s.aspectRatio}\n` +
      `• Language: ${s.language}\n` +
      `• Topic: *${s.topic}*\n\n` +
      `Generation takes ~1-2 minutes. Ready?`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          Markup.button.callback('✅ Generate Video', 'generate'),
          Markup.button.callback('❌ Cancel', 'cancel'),
          Markup.button.callback('👑 Premium', 'premium'),
        ]),
      },
    )
    return ctx.wizard.next()
  },

  // Step 5: Generate & Send
  async (ctx) => {
    try {
      const cb = (ctx as any).callbackQuery
      if (!cb) {
        await ctx.reply('Please use the buttons to confirm.').catch(() => {})
        return ctx.scene.leave()
      }

      if (cb.data === 'cancel') {
        await ctx.answerCbQuery().catch(() => {})
        await ctx.deleteMessage().catch(() => {})
        await ctx.reply('Cancelled. Use /create to start again.').catch(() => {})
        return ctx.scene.leave()
      }

      if (cb.data === 'premium') {
        await ctx.answerCbQuery().catch(() => {})
        await ctx.deleteMessage().catch(() => {})
        await ctx.reply(
          '👑 *Premium Plan*\n\n' +
          '• Unlimited videos (no daily limit)\n' +
          '• All 14 languages\n' +
          '• Higher priority generation\n\n' +
          'Contact admin to purchase: @YourAdmin',
          { parse_mode: 'Markdown' },
        ).catch(() => {})
        return ctx.scene.leave()
      }

      const s = st(ctx)
      const from = ctx.from
      const chatId = from?.id

      // Check usage limit
      if (chatId) {
        try {
          const stats = await getUserStats(chatId)
          if (stats && !stats.isPremium && stats.videoRemaining <= 0) {
            await ctx.answerCbQuery().catch(() => {})
            await ctx.deleteMessage().catch(() => {})
            await ctx.reply(
              '⚠️ *Daily limit reached!*\n\n' +
              'You\'ve used all 3 free video generations today.\n\n' +
              '👑 Get premium for unlimited videos.\n' +
              '⏰ Or wait until tomorrow for a fresh 3.',
              {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                  Markup.button.callback('👑 Go Premium', 'premium'),
                ]),
              },
            ).catch(() => {})
            return ctx.scene.leave()
          }
        } catch {
          // DB error — allow the generation anyway
        }
      }

      await ctx.answerCbQuery().catch(() => {})
      const aspect = ASPECT_OPTIONS.find(a => a.id === s.aspectRatio)!

      await ctx.editMessageText('⏳ *Generating your video...*\n\n1️⃣ Writing script...', { parse_mode: 'Markdown' }).catch(() => {})

      const sceneCount = Math.max(Math.round((s.duration * 2) / 60), 2)
      const script = await writeScript(s.topic, s.language, sceneCount)

      await ctx.editMessageText(
        `⏳ *Generating...*\n\n1️⃣ ✅ Script (${script.scenes.length} scenes)\n2️⃣ Generating images...`,
        { parse_mode: 'Markdown' },
      ).catch(() => {})

      const style = await getDefaultStyle()
      const imageB64s = await generateImages(script.scenes, style, aspect.w, aspect.h)

      await ctx.editMessageText(
        `⏳ *Generating...*\n\n1️⃣ ✅ Script\n2️⃣ ✅ Images (${imageB64s.length})\n3️⃣ Generating voiceover...`,
        { parse_mode: 'Markdown' },
      ).catch(() => {})

      const voiceText = script.scenes.map(s => s.audioText || s.description).join('. ')
      const audioB64 = await generateVoiceover(voiceText, '21m00Tcm4TlvDq8ikWAM', s.language)

      await ctx.editMessageText(
        `⏳ *Generating...*\n\n1️⃣ ✅ Script\n2️⃣ ✅ Images\n3️⃣ ✅ Voiceover\n4️⃣ Compiling video...`,
        { parse_mode: 'Markdown' },
      ).catch(() => {})

      const videoPath = await compileVideo(imageB64s, audioB64, aspect.w, aspect.h, s.duration / imageB64s.length)

      await ctx.editMessageText('📤 Uploading video...', { parse_mode: 'Markdown' }).catch(() => {})

      await ctx.replyWithVideo(
        { source: fs.createReadStream(videoPath) },
        {
          caption:
            `🎬 *${s.topic}*\n` +
            `⏱ ${s.duration}s | 🌐 ${s.language}\n` +
            `_Generated by AI Video Bot_`,
          parse_mode: 'Markdown',
        },
      )

      // Track usage
      if (chatId) {
        incrementUsage(chatId).catch(() => {})
        logVideoGen(chatId).catch(() => {})
      }

      fs.rmSync(videoPath, { force: true })
      await ctx.reply('Use /create to make another video!').catch(() => {})

    } catch (e: any) {
      try {
        const msg = e.message || 'Unknown error'
        if (msg === 'HIGH_TRAFFIC') {
          await ctx.editMessageText(
            '⚠️ *Image servers are busy.*\n\nPlease try again in a few minutes.',
            { parse_mode: 'Markdown' },
          ).catch(() => {})
        } else {
          const errText = msg.split('\n').slice(0, 5).join('\n')
          await ctx.editMessageText(
            `❌ *Error:*\n\`\`\`\n${errText}\n\`\`\`\n\nUse /create to try again.`,
            { parse_mode: 'Markdown' },
          ).catch(() => {})
        }
      } catch {}
    }

    return ctx.scene.leave()
  },
)
