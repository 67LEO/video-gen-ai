import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import ffmpeg from 'ffmpeg-static'
import { TMP_DIR } from '../config.js'

function resolveFfmpeg(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH
  if (ffmpeg) return ffmpeg
  return 'ffmpeg'
}

function runFf(args: string[], timeout = 120_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(resolveFfmpeg(), args, { stdio: 'ignore' })
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`ffmpeg timed out after ${timeout}ms: ${args.join(' ').slice(0, 120)}`))
    }, timeout)
    child.on('error', (e) => { clearTimeout(timer); reject(e) })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited with code ${code}: ${args.join(' ').slice(0, 120)}`))
    })
  })
}

async function getAudioDuration(audioPath: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(resolveFfmpeg(), ['-i', audioPath], { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr?.on('data', (d) => { stderr += d.toString() })
    child.on('close', () => {
      const m = stderr.match(/Duration: (\d+):(\d+):(\d+\.\d+)/)
      if (m) {
        resolve(parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]))
      } else {
        resolve(30)
      }
    })
    child.on('error', () => resolve(30))
  })
}

export async function compileVideo(
  imageBase64s: string[],
  audioBase64: string,
  width: number,
  height: number,
  durationPerScene: number,
): Promise<string> {
  const jobDir = path.join(TMP_DIR, `job_${Date.now()}`)
  fs.mkdirSync(jobDir, { recursive: true })

  const imgPaths: string[] = []
  for (let i = 0; i < imageBase64s.length; i++) {
    const p = path.join(jobDir, `img_${i}.png`)
    fs.writeFileSync(p, Buffer.from(imageBase64s[i], 'base64'))
    imgPaths.push(p)
  }

  const audioPath = path.join(jobDir, 'audio.mp3')
  fs.writeFileSync(audioPath, Buffer.from(audioBase64, 'base64'))

  const secsPerScene = Math.ceil(durationPerScene)
  const filter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`

  const sceneVideos: string[] = []
  for (let i = 0; i < imgPaths.length; i++) {
    const out = path.join(jobDir, `scene_${i}.mp4`)
    await runFf([
      '-loop', '1', '-i', imgPaths[i],
      '-t', String(secsPerScene),
      '-vf', filter,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-preset', 'ultrafast',
      '-y', out,
    ], 120_000)
    sceneVideos.push(out)
  }

  const noAudioVid = path.join(jobDir, 'no_audio.mp4')
  const listPath = path.join(jobDir, 'files.txt')
  fs.writeFileSync(listPath, sceneVideos.map(v => `file '${v.replace(/\\/g, '/')}'`).join('\n'))
  await runFf([
    '-f', 'concat', '-safe', '0', '-i', listPath,
    '-c:v', 'copy', '-an', '-y', noAudioVid,
  ], 60_000)

  const output = path.join(jobDir, 'final.mp4')
  await runFf([
    '-i', noAudioVid,
    '-i', audioPath,
    '-c:v', 'copy',
    '-map', '0:v:0', '-map', '1:a:0',
    '-af', 'apad', '-shortest', '-y', output,
  ], 120_000)

  return output
}
