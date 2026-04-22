const { Pool } = require('pg');
const config = require('./config');

let pool = null;

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS user_video_events (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    video_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(32) NOT NULL,
    timestamp_sec DOUBLE PRECISION,
    query_text TEXT,
    session_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uve_user_video ON user_video_events(user_id, video_id);
CREATE INDEX IF NOT EXISTS idx_uve_event_type ON user_video_events(event_type);

CREATE TABLE IF NOT EXISTS user_video_analytics (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    video_id VARCHAR(64) NOT NULL,
    important_timestamps JSONB,
    smart_highlights JSONB,
    query_history JSONB,
    revisited_segments JSONB,
    last_computed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_uva_user_video
    ON user_video_analytics(user_id, video_id);
`;

async function initDb() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  pool = new Pool({
    connectionString: config.databaseUrl,
    max: 10,
    ssl: config.databaseUrl.includes('render.com') || config.databaseUrl.includes('onrender.com')
      ? { rejectUnauthorized: false }
      : undefined,
  });

  // Test connection
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('[db] Connection successful');
    await client.query(INIT_SQL);
    console.log('[db] Tables initialized');
  } finally {
    client.release();
  }
}

async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[db] Connection pool closed');
  }
}

function getPool() {
  if (!pool) throw new Error('Database not initialized');
  return pool;
}

module.exports = { initDb, closeDb, getPool };
