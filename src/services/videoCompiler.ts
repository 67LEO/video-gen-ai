import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import ffmpeg from 'ffmpeg-static'
import { TMP_DIR } from '../config.js'

function resolveFfmpeg(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH
  if (ffmpeg) return ffmpeg
  return 'ffmpeg'
}

function getAudioDuration(audioPath: string, ff: string): number {
  try {
    const out = execSync(`"${ff}" -i "${audioPath}" 2>&1`, { timeout: 10000, encoding: 'utf-8' })
    const m = out.match(/Duration: (\d+):(\d+):(\d+\.\d+)/)
    if (m) return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3])
  } catch {}
  return 30
}

export function compileVideo(
  imageBase64s: string[],
  audioBase64: string,
  width: number,
  height: number,
  _durationPerScene: number,
): string {
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

  const audioDur = getAudioDuration(audioPath, ff)

  const filter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`
  const sceneVideos: string[] = []
  const secsPerScene = Math.ceil(audioDur / imageBase64s.length) + 1

  for (let i = 0; i < imgPaths.length; i++) {
    const out = path.join(jobDir, `scene_${i}.mp4`)
    const cmd = `"${ff}" -loop 1 -i "${imgPaths[i]}" -t ${secsPerScene} -vf "${filter}" -c:v libx264 -pix_fmt yuv420p -preset ultrafast -y "${out}"`
    execSync(cmd, { timeout: 60000, encoding: 'utf-8' })
    sceneVideos.push(out)
  }

  const noAudioVid = path.join(jobDir, 'no_audio.mp4')
  const listPath = path.join(jobDir, 'files.txt')
  fs.writeFileSync(listPath, sceneVideos.map(v => `file '${v.replace(/\\/g, '\\\\')}'`).join('\n'))
  execSync(`"${ff}" -f concat -safe 0 -i "${listPath}" -c:v copy -an -y "${noAudioVid}"`, { timeout: 60000, encoding: 'utf-8' })

  const output = path.join(jobDir, 'final.mp4')
  execSync(
    `"${ff}" -i "${noAudioVid}" -i "${audioPath}" -c:v copy -map 0:v:0 -map 1:a:0 -af "apad" -shortest -y "${output}"`,
    { timeout: 60000, encoding: 'utf-8' },
  )

  return output
}
