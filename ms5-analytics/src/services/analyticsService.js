/**
 * Analytics computation — port of Python analytics_service.py
 */
const { v4: uuidv4 } = require('uuid');
const { getPool } = require('../database');
const config = require('../config');
const { bucketTimestamp, mergeAdjacentBuckets } = require('../utils/timeUtils');
const { generateSmartHighlights } = require('./highlightService');

// Signal weights for importance scoring
const SIGNAL_WEIGHTS = {
  SEARCH: 5.0,
  REPLAY: 3.0,
  SEEK: 1.5,
  PAUSE: 1.0,
  PLAY: 0.0,
};

/**
 * Retrieves or computes analytics for a user-video pair.
 */
async function getAnalytics(userId, videoId) {
  const pool = getPool();

  // Check for existing computed analytics
  const existing = await pool.query(
    `SELECT * FROM user_video_analytics WHERE user_id = $1 AND video_id = $2`,
    [userId, videoId]
  );

  if (existing.rows.length && existing.rows[0].last_computed_at) {
    const record = existing.rows[0];
    return {
      user_id: userId,
      video_id: videoId,
      important_sections: record.important_timestamps || [],
      smart_highlights: record.smart_highlights || [],
      query_history: record.query_history || [],
      revisited_segments: record.revisited_segments || [],
      last_computed_at: record.last_computed_at,
    };
  }

  // Compute fresh from raw events
  const analytics = await computeAnalytics(userId, videoId);
  await upsertAnalytics(userId, videoId, analytics);
  return analytics;
}

/**
 * Computes analytics from raw events for a user-video pair.
 */
async function computeAnalytics(userId, videoId) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM user_video_events
     WHERE user_id = $1 AND video_id = $2
     ORDER BY created_at`,
    [userId, videoId]
  );
  const events = result.rows;
  const now = new Date().toISOString();

  if (!events.length) {
    return {
      user_id: userId,
      video_id: videoId,
      important_sections: [],
      smart_highlights: [],
      query_history: [],
      revisited_segments: [],
      last_computed_at: now,
    };
  }

  const bucketSize = config.timestampBucketSeconds;

  // 1. Bucket timestamps and compute scores
  const bucketEvents = {}; // bucket_ts -> [events]
  for (const event of events) {
    if (event.timestamp_sec != null) {
      const bucket = bucketTimestamp(event.timestamp_sec, bucketSize);
      if (!bucketEvents[bucket]) bucketEvents[bucket] = [];
      bucketEvents[bucket].push(event);
    }
  }

  const scoredBuckets = [];
  for (const [bucket, eventsInBucket] of Object.entries(bucketEvents)) {
    let score = 0;
    const signals = new Set();
    for (const event of eventsInBucket) {
      const weight = SIGNAL_WEIGHTS[event.event_type] || 0;
      score += weight;
      if (weight > 0) signals.add(event.event_type);
    }
    scoredBuckets.push({
      bucket: Number(bucket),
      score,
      signals: [...signals],
    });
  }

  // 2. Sort by score, take top N*3 buckets
  scoredBuckets.sort((a, b) => b.score - a.score);
  const topBuckets = scoredBuckets.slice(0, config.importantSectionsCount * 3);

  // 3. Merge adjacent buckets into sections
  const sections = mergeAdjacentBuckets(topBuckets, bucketSize, 2);

  // 4. Sort sections by score and create ImportantSection objects
  sections.sort((a, b) => b.total_score - a.total_score);
  const importantSections = sections
    .slice(0, config.importantSectionsCount)
    .map((section, idx) => ({
      rank: idx + 1,
      start_sec: section.start_sec,
      end_sec: section.end_sec,
      label: generateSectionLabel(section, bucketEvents),
      score: Math.round(section.total_score * 10) / 10,
      signals: section.signals,
    }));

  // 5. Find revisited segments
  const revisitedSegments = findRevisitedSegments(events, bucketSize, config.minRevisitCount);

  // 6. Extract query history
  const queryHistory = extractQueryHistory(events);

  // 7. Generate smart highlights
  const smartHighlights = generateSmartHighlights(
    importantSections, bucketEvents, bucketSize, config.topHighlightsCount
  );

  return {
    user_id: userId,
    video_id: videoId,
    important_sections: importantSections,
    smart_highlights: smartHighlights,
    query_history: queryHistory,
    revisited_segments: revisitedSegments,
    last_computed_at: now,
  };
}

/**
 * Force recompute analytics from raw events and store.
 */
async function recomputeAnalytics(userId, videoId) {
  const analytics = await computeAnalytics(userId, videoId);
  await upsertAnalytics(userId, videoId, analytics);
}

/**
 * Upserts computed analytics into the user_video_analytics table.
 */
async function upsertAnalytics(userId, videoId, analytics) {
  const pool = getPool();
  const now = new Date().toISOString();
  const data = {
    important_timestamps: JSON.stringify(analytics.important_sections),
    smart_highlights: JSON.stringify(analytics.smart_highlights),
    query_history: JSON.stringify(analytics.query_history),
    revisited_segments: JSON.stringify(analytics.revisited_segments),
  };

  const existing = await pool.query(
    `SELECT id FROM user_video_analytics WHERE user_id = $1 AND video_id = $2`,
    [userId, videoId]
  );

  if (existing.rows.length) {
    await pool.query(
      `UPDATE user_video_analytics
       SET important_timestamps = $1, smart_highlights = $2, query_history = $3,
           revisited_segments = $4, last_computed_at = $5, updated_at = $5
       WHERE user_id = $6 AND video_id = $7`,
      [data.important_timestamps, data.smart_highlights, data.query_history,
       data.revisited_segments, now, userId, videoId]
    );
  } else {
    await pool.query(
      `INSERT INTO user_video_analytics
       (id, user_id, video_id, important_timestamps, smart_highlights,
        query_history, revisited_segments, last_computed_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
      [uuidv4(), userId, videoId, data.important_timestamps, data.smart_highlights,
       data.query_history, data.revisited_segments, now]
    );
  }

  console.log(`[analytics] Upserted analytics for user=${userId} video=${videoId}`);
}

function findRevisitedSegments(events, bucketSize, minCount) {
  const replaySeeks = events.filter(
    (e) => (e.event_type === 'REPLAY' || e.event_type === 'SEEK') && e.timestamp_sec != null
  );
  const bucketCounts = {};
  for (const e of replaySeeks) {
    const bucket = bucketTimestamp(e.timestamp_sec, bucketSize);
    bucketCounts[bucket] = (bucketCounts[bucket] || 0) + 1;
  }

  return Object.entries(bucketCounts)
    .filter(([, count]) => count >= minCount)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([bucket, count]) => ({
      start_sec: Number(bucket),
      end_sec: Number(bucket) + bucketSize,
      replay_count: count,
    }));
}

function extractQueryHistory(events) {
  return events
    .filter((e) => e.event_type === 'SEARCH' && e.query_text)
    .map((e) => ({
      query_text: e.query_text,
      searched_at: e.created_at,
      result_timestamp_sec: e.timestamp_sec,
    }));
}

function generateSectionLabel(section, bucketEvents) {
  const searchQueries = [];
  for (const [bucketTs, events] of Object.entries(bucketEvents)) {
    const ts = Number(bucketTs);
    if (ts >= section.start_sec && ts < section.end_sec) {
      for (const event of events) {
        if (event.event_type === 'SEARCH' && event.query_text) {
          searchQueries.push(event.query_text);
        }
      }
    }
  }

  if (searchQueries.length) {
    const counts = {};
    searchQueries.forEach((q) => { counts[q] = (counts[q] || 0) + 1; });
    const mostCommon = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    return mostCommon.charAt(0).toUpperCase() + mostCommon.slice(1);
  }

  const signals = section.signals || [];
  if (signals.includes('REPLAY')) return 'Frequently revisited section';
  if (signals.includes('SEEK')) return 'Frequently accessed section';
  if (signals.includes('PAUSE')) return 'Key moment';
  return 'Important section';
}

module.exports = { getAnalytics, recomputeAnalytics };
