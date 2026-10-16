import { Router } from 'express';
import { VoiceParserService } from '../services/voiceParser.service.js';
import { validateBody } from '../middleware/validate.js';
import { VoiceParseSchema } from '../shared/schemas.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';

export const voiceRouter = Router();

voiceRouter.use(authenticateToken);

// AI / NLP Voice Parsing endpoint
voiceRouter.post('/parse', validateBody(VoiceParseSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const transcript = (req.body.transcript || req.body.text || '').trim();
    const result = await VoiceParserService.parseVoiceTranscript(req.user!.id, transcript);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
