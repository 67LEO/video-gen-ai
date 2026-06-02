import { readFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { compileVideo } from './src/services/videoCompiler.js'
import ffmpeg from 'ffmpeg-static'

const ff = ffmpeg || 'ffmpeg'
const tmpDir = join(import.meta.dirname, 'tmp_test_gen')
mkdirSync(tmpDir, { recursive: true })

const img1 = join(tmpDir, 'test1.png')
const img2 = join(tmpDir, 'test2.png')
const audio = join(tmpDir, 'test.mp3')

execSync(`"${ff}" -f lavfi -i color=c=red:s=648x1152:d=1 -frames:v 1 -y "${img1}"`, { timeout: 15000, encoding: 'utf-8' })
console.log('✅ img1 created')
execSync(`"${ff}" -f lavfi -i color=c=blue:s=648x1152:d=1 -frames:v 1 -y "${img2}"`, { timeout: 15000, encoding: 'utf-8' })
console.log('✅ img2 created')
execSync(`"${ff}" -f lavfi -i anullsrc=r=44100:cl=mono -t 4 -c:a libmp3lame -y "${audio}"`, { timeout: 15000, encoding: 'utf-8' })
console.log('✅ audio created')

const imgB64s = [
  readFileSync(img1).toString('base64'),
  readFileSync(img2).toString('base64'),
]
const audioB64 = readFileSync(audio).toString('base64')

console.log('🧪 Testing compileVideo (2 scenes, 5s each, 648x1152)...')
console.time('compile')

try {
  const result = await compileVideo(imgB64s, audioB64, 648, 1152, 5)
  console.timeEnd('compile')
  console.log('✅ Output:', result)
} catch (e: any) {
  console.timeEnd('compile')
  console.error('❌ Error:', e.message)
  if (e.stderr) console.error('STDERR:', e.stderr.slice(0, 1000))
  if (e.stdout) console.error('STDOUT:', e.stdout.slice(0, 500))
}
