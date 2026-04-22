/**
 * Smart highlight generation — port of Python highlight_service.py
 */

/**
 * Generates smart highlights from important sections.
 * 1. Filter sections by score threshold (mean score).
 * 2. Sort by score descending.
 * 3. Take top N.
 * 4. Enrich with labels from search queries or generic fallback.
 */
function generateSmartHighlights(importantSections, bucketEvents, bucketSize, topN = 5) {
  if (!importantSections.length) return [];

  const scores = importantSections.map((s) => s.score);
  const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  const qualified = importantSections
    .filter((s) => s.score >= meanScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  return qualified.map((section) => ({
    start_sec: section.start_sec,
    end_sec: section.end_sec,
    label: getHighlightLabel(section.start_sec, section.end_sec, bucketEvents),
    score: section.score,
  }));
}

function getHighlightLabel(startSec, endSec, bucketEvents) {
  const searchQueries = [];
  const eventTypes = new Set();

  for (const [bucketTs, events] of Object.entries(bucketEvents)) {
    const ts = Number(bucketTs);
    if (ts >= startSec && ts < endSec) {
      for (const event of events) {
        eventTypes.add(event.event_type);
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

  if (eventTypes.has('REPLAY')) return 'Frequently revisited';
  if (eventTypes.has('SEEK')) return 'Key section';
  if (eventTypes.has('PAUSE')) return 'Paused moment';
  return 'Important moment';
}

module.exports = { generateSmartHighlights };
