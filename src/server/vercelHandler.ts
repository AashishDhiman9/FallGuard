import type { Request, Response } from 'express';

type PostHandler = (req: Request, res: Response) => Promise<void>;

/** Adapts the existing Express route handler to a Vercel Node function. */
export function createVercelPostHandler(handler: PostHandler): PostHandler {
  return async (req, res) => {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      res.status(405).json({
        status: 'error',
        code: 'METHOD_NOT_ALLOWED',
        message: 'This endpoint accepts POST requests only.',
      });
      return;
    }

    try {
      await handler(req, res);
    } catch (err) {
      console.error('Unhandled device API function error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          status: 'error',
          code: 'INTERNAL_SERVER_ERROR',
          message: 'The device request could not be processed.',
        });
      }
    }
  };
}
