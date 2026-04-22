const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getAnalytics, recomputeAnalytics } = require('../services/analyticsService');

const router = Router();

// GET /api/v1/analytics/:userId/:videoId
router.get('/api/v1/analytics/:userId/:videoId', authMiddleware, async (req, res) => {
  try {
    const analytics = await getAnalytics(req.params.userId, req.params.videoId);
    res.json(analytics);
  } catch (err) {
    console.error('[analytics] Error:', err.message);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/v1/analytics/:userId/:videoId/highlights
router.get('/api/v1/analytics/:userId/:videoId/highlights', authMiddleware, async (req, res) => {
  try {
    const analytics = await getAnalytics(req.params.userId, req.params.videoId);
    res.json({
      video_id: req.params.videoId,
      highlights: analytics.smart_highlights,
    });
  } catch (err) {
    console.error('[analytics] Error:', err.message);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/v1/analytics/:userId/:videoId/queries
router.get('/api/v1/analytics/:userId/:videoId/queries', authMiddleware, async (req, res) => {
  try {
    const analytics = await getAnalytics(req.params.userId, req.params.videoId);
    res.json({
      video_id: req.params.videoId,
      query_history: analytics.query_history,
    });
  } catch (err) {
    console.error('[analytics] Error:', err.message);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/v1/analytics/:userId/:videoId/recompute
router.post('/api/v1/analytics/:userId/:videoId/recompute', authMiddleware, async (req, res) => {
  try {
    await recomputeAnalytics(req.params.userId, req.params.videoId);
    res.status(202).json({
      status: 'recompute_triggered',
      video_id: req.params.videoId,
    });
  } catch (err) {
    console.error('[analytics] Error:', err.message);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
