import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import ffmpeg from 'ffmpeg-static'
import { TMP_DIR } from '../config.js'

const exec = promisify(execFile)

function resolveFfmpeg(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH
  if (ffmpeg) return ffmpeg
  return 'ffmpeg'
}

async function getAudioDuration(audioPath: string, ff: string): Promise<number> {
  try {
    const { stderr } = await exec(ff, ['-i', audioPath], { timeout: 10000 })
    const m = stderr.match(/Duration: (\d+):(\d+):(\d+\.\d+)/)
    if (m) return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3])
  } catch (e: any) {
    const m = e.stderr?.match(/Duration: (\d+):(\d+):(\d+\.\d+)/)
    if (m) return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3])
  }
  return 30
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

  const ff = resolveFfmpeg()

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
    await exec(ff, [
      '-loop', '1', '-i', imgPaths[i],
      '-t', String(secsPerScene),
      '-vf', filter,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-preset', 'ultrafast',
      '-y', out,
    ], { timeout: 120000 })
    sceneVideos.push(out)
  }

  const noAudioVid = path.join(jobDir, 'no_audio.mp4')
  const listPath = path.join(jobDir, 'files.txt')
  // Use forward slashes for cross-platform FFmpeg concat compat
  fs.writeFileSync(listPath, sceneVideos.map(v => `file '${v.replace(/\\/g, '/')}'`).join('\n'))
  await exec(ff, [
    '-f', 'concat', '-safe', '0', '-i', listPath,
    '-c:v', 'copy', '-an', '-y', noAudioVid,
  ], { timeout: 60000 })

  const output = path.join(jobDir, 'final.mp4')
  await exec(ff, [
    '-i', noAudioVid,
    '-i', audioPath,
    '-c:v', 'copy',
    '-map', '0:v:0', '-map', '1:a:0',
    '-af', 'apad', '-shortest', '-y', output,
  ], { timeout: 120000 })

  return output
}
