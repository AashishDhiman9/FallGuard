import type { Request, Response } from 'express';
import type { ServerResponse } from 'node:http';

type PostHandler = (req: Request, res: Response) => Promise<void>;

/** Bridges Express's chainable response helpers to Vercel's native Node response. */
function createExpressResponse(res: ServerResponse): Response {
  const response = {
    get headersSent() {
      return res.headersSent;
    },
    setHeader(name: string, value: string | number | readonly string[]) {
      res.setHeader(name, value);
      return response;
    },
    status(statusCode: number) {
      res.statusCode = statusCode;
      return response;
    },
    json(body: unknown) {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      res.end(JSON.stringify(body));
      return response;
    },
  };

  return response as unknown as Response;
}

/** Adapts the existing Express route handler to a Vercel Node function. */
export function createVercelPostHandler(handler: PostHandler): PostHandler {
  return async (req, rawRes) => {
    const res = createExpressResponse(rawRes as unknown as ServerResponse);

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
