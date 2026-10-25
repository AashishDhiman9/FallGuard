import { getAuth } from 'firebase-admin/auth';
import type { Request, Response } from 'express';
import { initFirebaseAdmin, logFirebaseError, CaretakerLinkError, linkPatientWithCaretaker } from './adminDb.js';

/** POST /api/caretaker/link-patient */
export async function handleCaretakerPatientLink(req: Request, res: Response): Promise<void> {
  const authorization = req.headers.authorization || '';
  const bearer = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!bearer) {
    res.status(401).json({
      status: 'error',
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Sign in before linking a patient.',
    });
    return;
  }

  if (!initFirebaseAdmin()) {
    res.status(503).json({
      status: 'error',
      code: 'DATABASE_UNAVAILABLE',
      message: 'Patient linking is temporarily unavailable.',
    });
    return;
  }

  let identity: { uid: string; email: string };
  try {
    const decoded = await getAuth().verifyIdToken(bearer[1]);
    if (!decoded.uid || !decoded.email) throw new Error('Missing account identity.');
    identity = { uid: decoded.uid, email: decoded.email };
  } catch {
    res.status(401).json({
      status: 'error',
      code: 'INVALID_AUTHENTICATION',
      message: 'Your sign-in session could not be verified. Sign in again and retry.',
    });
    return;
  }

  const body = req.body || {};
  if (typeof body.patientEmail !== 'string' || typeof body.deviceId !== 'string') {
    res.status(400).json({
      status: 'error',
      code: 'INVALID_LINK_DETAILS',
      message: 'Enter the patient account email and device code.',
    });
    return;
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.patientEmail.trim()) ||
    !/^FG-[A-Z0-9]{4}(-[A-Z0-9]{1,4})?$/i.test(body.deviceId.trim())
  ) {
    res.status(400).json({
      status: 'error',
      code: 'INVALID_LINK_DETAILS',
      message: 'Enter a valid patient email and device code.',
    });
    return;
  }

  try {
    let patientAccount;
    try {
      patientAccount = await getAuth().getUserByEmail(body.patientEmail.trim());
    } catch (err) {
      if ((err as { code?: string })?.code === 'auth/user-not-found') {
        res.status(404).json({
          status: 'error',
          code: 'PATIENT_LINK_NOT_AUTHORIZED',
          message: 'No matching patient account has authorized this caretaker email and device code. Ask the patient to enter your account email in their Settings and confirm their device code.',
        });
        return;
      }
      throw err;
    }

    const patient = await linkPatientWithCaretaker({
      caretakerUid: identity.uid,
      caretakerEmail: identity.email,
      patientUid: patientAccount.uid,
      patientEmail: body.patientEmail,
      deviceId: body.deviceId,
    });
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ status: 'ok', patient });
  } catch (err) {
    if (err instanceof CaretakerLinkError) {
      res.status(err.status).json({ status: 'error', code: err.code, message: err.message });
      return;
    }

    logFirebaseError('caretaker patient link', err);
    res.status(503).json({
      status: 'error',
      code: 'DATABASE_UNAVAILABLE',
      message: 'Patient linking is temporarily unavailable. Please retry shortly.',
    });
  }
}
