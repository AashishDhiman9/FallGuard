import type { Request, Response } from 'express';
import { checkFirebaseAdminHealth } from './adminDb.js';

/** Read-only health response with no credentials, URLs, or patient data. */
export async function handleHealth(_req: Request, res: Response): Promise<void> {
  const check = await checkFirebaseAdminHealth();
  const healthy = check.firebaseAdminReady && check.realtimeDatabaseReachable;

  res.setHeader('Cache-Control', 'no-store');
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'error',
    service: 'FallGuard API',
    checks: {
      firebaseAdmin: check.firebaseAdminReady ? 'ready' : 'unavailable',
      realtimeDatabase: check.realtimeDatabaseReachable ? 'reachable' : 'unreachable',
    },
  });
}
