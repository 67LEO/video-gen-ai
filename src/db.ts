import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
})

async function query(text: string, params?: unknown[]) {
  const client = await pool.connect()
  try {
    return await client.query(text, params)
  } finally {
    client.release()
  }
}

export async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      chat_id BIGINT PRIMARY KEY,
      first_name TEXT,
      username TEXT,
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      total_uses INTEGER DEFAULT 0,
      is_premium BOOLEAN DEFAULT FALSE,
      premium_until TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS daily_usage (
      chat_id BIGINT,
      date DATE,
      count INTEGER DEFAULT 0,
      PRIMARY KEY (chat_id, date)
    );
    CREATE TABLE IF NOT EXISTS images (
      id SERIAL PRIMARY KEY,
      chat_id BIGINT NOT NULL,
      original_size INTEGER,
      result_size INTEGER,
      type TEXT NOT NULL DEFAULT 'bg_remove',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)
}

export async function upsertUser(chatId: number, firstName?: string, username?: string) {
  await query(
    `INSERT INTO users (chat_id, first_name, username)
     VALUES ($1, $2, $3)
     ON CONFLICT (chat_id) DO UPDATE SET
       first_name = EXCLUDED.first_name,
       username = EXCLUDED.username`,
    [chatId, firstName || null, username || null],
  )
}

export async function incrementUsage(chatId: number) {
  const today = new Date().toISOString().split('T')[0]
  await query(
    `INSERT INTO daily_usage (chat_id, date, count) VALUES ($1, $2, 1)
     ON CONFLICT (chat_id, date) DO UPDATE SET count = daily_usage.count + 1`,
    [chatId, today],
  )
  await query('UPDATE users SET total_uses = total_uses + 1 WHERE chat_id = $1', [chatId])
}

export async function logVideoGen(chatId: number) {
  await query(
    'INSERT INTO images (chat_id, type) VALUES ($1, $2)',
    [chatId, 'video'],
  )
}

export async function getVideoGenCountToday(chatId: number): Promise<number> {
  const r = await query(
    "SELECT COUNT(*) as c FROM images WHERE chat_id = $1 AND type = 'video' AND created_at::date = CURRENT_DATE",
    [chatId],
  )
  return parseInt(r.rows[0]?.c || '0')
}

export async function getUserStats(chatId: number): Promise<{
  isPremium: boolean
  videoUsedToday: number
  videoRemaining: number
} | null> {
  const r = await query('SELECT * FROM users WHERE chat_id = $1', [chatId])
  const user = r.rows[0]
  if (!user) return null

  // Auto-expire premium
  if (user.is_premium && user.premium_until && new Date(user.premium_until) < new Date()) {
    await query(
      "UPDATE users SET is_premium = false, premium_until = NULL WHERE chat_id = $1",
      [chatId],
    )
    user.is_premium = false
  }

  const isPremium = !!user.is_premium
  const videoUsedToday = await getVideoGenCountToday(chatId)
  const FREE_VIDEO_LIMIT = 3

  return {
    isPremium,
    videoUsedToday,
    videoRemaining: isPremium ? Infinity : Math.max(0, FREE_VIDEO_LIMIT - videoUsedToday),
  }
}

export async function closePool() {
  await pool.end()
}
