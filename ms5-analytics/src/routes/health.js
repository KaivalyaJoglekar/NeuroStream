const { Router } = require('express');
const { getPool } = require('../database');

const router = Router();

router.get('/health', async (_req, res) => {
  let dbStatus = 'disconnected';
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch (err) {
    console.error('[health] DB check failed:', err.message);
  }

  const status = dbStatus === 'connected' ? 'ok' : 'degraded';
  res.json({ status, db: dbStatus });
});

module.exports = router;
