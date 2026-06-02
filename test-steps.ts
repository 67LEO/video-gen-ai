import { readFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import ffmpeg from 'ffmpeg-static'

const exec = promisify(execFile)
const ff = ffmpeg || 'ffmpeg'
console.log('ffmpeg:', ff)

const tmpDir = join(import.meta.dirname, 'tmp_test_gen')
mkdirSync(tmpDir, { recursive: true })

async function main() {
  // Step 1: test getAudioDuration equivalent
  console.log('\n--- Step 1: ffprobe test ---')
  try {
    const { stderr } = await exec(ff, ['-i', join(tmpDir, 'test.mp3')], { timeout: 15000 })
    console.log('probe succeeded')
  } catch (e: any) {
    const durMatch = e.stderr?.match(/Duration: (\d+):(\d+):(\d+\.\d+)/)
    if (durMatch) {
      console.log('probe (stderr): duration found:', durMatch[0])
    } else {
      console.error('probe failed:', e.message?.slice(0, 200))
    }
  }

  // Step 2: test scene generation
  console.log('\n--- Step 2: scene gen test ---')
  const img1 = join(tmpDir, 'test1.png')
  const img2 = join(tmpDir, 'test2.png')
  const sceneOut1 = join(tmpDir, 'scene_0.mp4')
  const sceneOut2 = join(tmpDir, 'scene_1.mp4')

  const filter = 'scale=648:1152:force_original_aspect_ratio=decrease,pad=648:1152:(ow-iw)/2:(oh-ih)/2'

  try {
    console.log('generating scene 0...')
    await exec(ff, ['-loop', '1', '-i', img1, '-t', '5', '-vf', filter, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'ultrafast', '-y', sceneOut1], { timeout: 60000 })
    console.log('scene 0 done')
  } catch (e: any) {
    console.error('scene 0 error:', e.message)
    if (e.stderr) console.error('stderr:', e.stderr.slice(0, 500))
  }

  try {
    console.log('generating scene 1...')
    await exec(ff, ['-loop', '1', '-i', img2, '-t', '5', '-vf', filter, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'ultrafast', '-y', sceneOut2], { timeout: 60000 })
    console.log('scene 1 done')
  } catch (e: any) {
    console.error('scene 1 error:', e.message)
    if (e.stderr) console.error('stderr:', e.stderr.slice(0, 500))
  }

  // Step 3: concat
  console.log('\n--- Step 3: concat test ---')
  const listPath = join(tmpDir, 'files.txt')
  const listContent = [sceneOut1, sceneOut2].map(v => `file '${v}'`).join('\n')
  console.log('file list:', listContent)
  const noAudioVid = join(tmpDir, 'no_audio.mp4')
  try {
    await exec(ff, ['-f', 'concat', '-safe', '0', '-i', listPath, '-c:v', 'copy', '-an', '-y', noAudioVid], { timeout: 60000 })
    console.log('concat done')
  } catch (e: any) {
    console.error('concat error:', e.message)
  }

  // Step 4: mix audio
  console.log('\n--- Step 4: audio mix ---')
  const audio = join(tmpDir, 'test.mp3')
  const final = join(tmpDir, 'final.mp4')
  try {
    await exec(ff, ['-i', noAudioVid, '-i', audio, '-c:v', 'copy', '-map', '0:v:0', '-map', '1:a:0', '-af', 'apad', '-y', final], { timeout: 60000 })
    console.log('mix done')
  } catch (e: any) {
    console.error('mix error:', e.message)
  }
}

main().catch(e => console.error('main error:', e.message))
