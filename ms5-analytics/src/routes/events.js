const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getPool } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = Router();

const VALID_EVENT_TYPES = ['SEEK', 'REPLAY', 'SEARCH', 'PAUSE', 'PLAY'];

router.post('/api/v1/events', authMiddleware, async (req, res) => {
  try {
    const { user_id, video_id, event_type, timestamp_sec, query_text, session_id } = req.body;

    // Validation
    if (!user_id || !video_id) {
      return res.status(422).json({ detail: 'user_id and video_id are required' });
    }
    if (!VALID_EVENT_TYPES.includes(event_type)) {
      return res.status(422).json({ detail: `Invalid event_type. Must be one of: ${VALID_EVENT_TYPES.join(', ')}` });
    }
    if (timestamp_sec == null) {
      return res.status(422).json({ detail: `timestamp_sec is required for ${event_type} events` });
    }
    if (event_type === 'SEARCH' && !query_text) {
      return res.status(422).json({ detail: 'query_text is required for SEARCH events' });
    }

    const id = uuidv4();
    const pool = getPool();

    await pool.query(
      `INSERT INTO user_video_events (id, user_id, video_id, event_type, timestamp_sec, query_text, session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, user_id, video_id, event_type, timestamp_sec, query_text || null, session_id || null]
    );

    console.log(`[events] Recorded ${event_type} user=${user_id} video=${video_id} ts=${timestamp_sec}`);
    res.status(201).json({ event_id: id, status: 'recorded' });
  } catch (err) {
    console.error('[events] Error:', err.message);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
