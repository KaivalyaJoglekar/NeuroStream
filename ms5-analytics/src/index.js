const express = require('express');
const cors = require('cors');
const config = require('./config');
const { initDb, closeDb } = require('./database');

const healthRoutes = require('./routes/health');
const eventRoutes = require('./routes/events');
const analyticsRoutes = require('./routes/analytics');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use(healthRoutes);
app.use(eventRoutes);
app.use(analyticsRoutes);

// Startup
async function start() {
  try {
    console.log(`[ms5] Starting MS5 Analytics Service (env=${config.env})...`);
    console.log(`[ms5] DATABASE_URL is ${config.databaseUrl ? 'SET' : 'NOT SET'}`);

    await initDb();

    const server = app.listen(config.port, '0.0.0.0', () => {
      console.log(`[ms5] Listening on port ${config.port}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('[ms5] Shutting down...');
      server.close();
      await closeDb();
      process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('[ms5] FATAL: Failed to start:', err);
    process.exit(1);
  }
}

start();
