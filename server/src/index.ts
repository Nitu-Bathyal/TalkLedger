import { app } from './app.js';
import { config } from './config.js';
import { ensureDatabaseReady } from './db-init.js';

// Auto-verify and self-heal database tables on startup
ensureDatabaseReady().then((ready) => {
  if (ready) {
    console.log('[TalkLedger API] Database initialized and verified ready.');
  } else {
    console.warn('[TalkLedger API] Database initialization pending or degraded.');
  }
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`[TalkLedger API] Server running at http://0.0.0.0:${config.port}`);
  console.log(`[TalkLedger API] Health check at http://localhost:${config.port}/api/health`);
  console.log(`[TalkLedger API] Environment: ${config.nodeEnv}`);
});
