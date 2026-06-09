import { Telegraf, session, Scenes } from 'telegraf'
import { createVideoWizard } from './scenes/createVideo.js'

type BotContext = Scenes.WizardContext

const bot = new Telegraf<BotContext>(process.env.BOT_TOKEN || '', { handlerTimeout: 300_000 })

const stage = new Scenes.Stage<BotContext>([createVideoWizard])

bot.use(session())
bot.use(stage.middleware())

bot.start(async (ctx) => {
  const name = ctx.from?.first_name || 'there'
  await ctx.reply(
    `🎬 *Welcome ${name}!*\n\nI can create AI videos for you.\n\n` +
    `Use /create to start making a video.`,
    { parse_mode: 'Markdown' },
  )
})

bot.help(async (ctx) => {
  await ctx.reply(
    '*/create* – Start AI video creation\n' +
    '*/cancel* – Cancel current operation\n' +
    '*/help* – Show this message',
    { parse_mode: 'Markdown' },
  )
})

bot.command('cancel', async (ctx) => {
  await ctx.reply('Cancelled. Use /create to start again.')
})

bot.command('create', async (ctx) => {
  await ctx.scene.enter('create-video')
})

export default bot
