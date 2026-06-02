# Next Session — VideoGPT Telegram Bot

## Render Deploy Status
- Repo: `https://github.com/67LEO/video-gen-ai`
- Render URL: `https://video-gen-ai.onrender.com`
- Env vars set in Render Dashboard: BOT_TOKEN, DATABASE_URL, API_BASE, AES_KEY, ELEVENLABS_BASE, PORT=10000
- Build success ✅, Health server on port 10000 ✅

## Known Issues
1. **409 Conflict**: Bot crashes, Render restarts, stale polling session blocks reconnection. Fixed with `deleteWebhook` + exponential retry (3-15s delays, 5 attempts).
2. **FFmpeg Concat**: Windows backslash paths broke concat. Fixed with forward slashes.
3. **Async FFmpeg**: Was `execSync` (blocked event loop → crash). Fixed with async `execFile`.
4. **Unhandled errors**: Global `unhandledRejection`/`uncaughtException` handlers added (log only, no crash).
5. **Temp cleanup**: Full job directory deleted after video sent.

## Pending for Next Session
1. **Test video generation** on Render — user clicks `/create` → generates → sends video
2. **409 still happening?** If retries exhaust, switch from polling to webhook mode (Express + `bot.webhookCallback`)
3. **UptimeRobot** — keep free tier alive with 5-min pings to `https://video-gen-ai.onrender.com`

## Commands
- Local dev: `npx tsx src/index.ts`
- Build: `npm run build` (tsc)
- Deploy: Push to master → Render auto-deploys (or Manual Deploy)
