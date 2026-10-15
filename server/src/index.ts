import { app } from './app.js';
import { config } from './config.js';

app.listen(config.port, () => {
  console.log(`[TalkLedger API] Server running at http://localhost:${config.port}`);
  console.log(`[TalkLedger API] Health check at http://localhost:${config.port}/api/health`);
  console.log(`[TalkLedger API] Environment: ${config.nodeEnv}`);
});
