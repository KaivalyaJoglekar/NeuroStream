/**
 * Time-bucketing utilities — port of Python app/utils/time_utils.py
 */

/**
 * Returns the start of the bucket this timestamp falls into.
 * With bucketSize=5, timestamps 140.1, 141.8, 143.5 all → bucket 140.
 */
function bucketTimestamp(ts, bucketSize = 5) {
  return Math.floor(ts / bucketSize) * bucketSize;
}

/**
 * Merges adjacent scored buckets into contiguous sections.
 * Adjacent = within maxGapBuckets bucket-lengths of each other.
 */
function mergeAdjacentBuckets(scoredBuckets, bucketSize = 5, maxGapBuckets = 2) {
  if (!scoredBuckets.length) return [];

  const sorted = [...scoredBuckets].sort((a, b) => a.bucket - b.bucket);

  const sections = [];
  let current = {
    start_sec: sorted[0].bucket,
    end_sec: sorted[0].bucket + bucketSize,
    total_score: sorted[0].score,
    signals: new Set(sorted[0].signals || []),
  };

  for (let i = 1; i < sorted.length; i++) {
    const b = sorted[i];
    const gap = b.bucket - current.end_sec;

    if (gap <= maxGapBuckets * bucketSize) {
      current.end_sec = b.bucket + bucketSize;
      current.total_score += b.score;
      (b.signals || []).forEach((s) => current.signals.add(s));
    } else {
      current.signals = [...current.signals];
      sections.push(current);
      current = {
        start_sec: b.bucket,
        end_sec: b.bucket + bucketSize,
        total_score: b.score,
        signals: new Set(b.signals || []),
      };
    }
  }

  current.signals = [...current.signals];
  sections.push(current);
  return sections;
}

module.exports = { bucketTimestamp, mergeAdjacentBuckets };
