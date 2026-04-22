require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || process.env.APP_PORT || '8085', 10),
  env: process.env.APP_ENV || process.env.NODE_ENV || 'production',
  databaseUrl: process.env.DATABASE_URL || '',
  internalApiSecret: process.env.INTERNAL_API_SECRET || process.env.MS5_INTERNAL_SECRET || '',

  // Analytics tuning
  timestampBucketSeconds: parseInt(process.env.TIMESTAMP_BUCKET_SECONDS || '5', 10),
  minRevisitCount: parseInt(process.env.MIN_REVISIT_COUNT || '2', 10),
  topHighlightsCount: parseInt(process.env.TOP_HIGHLIGHTS_COUNT || '5', 10),
  importantSectionsCount: parseInt(process.env.IMPORTANT_SECTIONS_COUNT || '10', 10),
};

module.exports = config;
