import type { Request, Response } from 'express';
import type { ServerResponse } from 'node:http';

type PostHandler = (req: Request, res: Response) => Promise<void>;
type ApiHandler = (req: Request, res: Response) => Promise<void>;

function isAllowedOrigin(origin: string): boolean {
  return origin === 'https://localhost' ||
    origin === 'https://fallguard-aashish-eca0.vercel.app' ||
    /^https:\/\/fallguard-[a-z0-9-]+-aashish-eca0\.vercel\.app$/i.test(origin);
}

function addCorsHeaders(res: ServerResponse, origin: string, method: 'GET' | 'POST'): void {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', `${method}, OPTIONS`);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
  res.setHeader('Vary', 'Origin');
}

function handleCors(req: Request, rawRes: ServerResponse, method: 'GET' | 'POST'): boolean {
  const origin = req.headers.origin;
  if (req.method === 'OPTIONS') {
    if (typeof origin === 'string' && isAllowedOrigin(origin)) {
      addCorsHeaders(rawRes, origin, method);
      rawRes.statusCode = 204;
    } else {
      rawRes.statusCode = 403;
    }
    rawRes.end();
    return true;
  }

  if (typeof origin === 'string') {
    if (!isAllowedOrigin(origin)) {
      rawRes.statusCode = 403;
      rawRes.setHeader('Content-Type', 'application/json; charset=utf-8');
      rawRes.end(JSON.stringify({
        status: 'error',
        code: 'CORS_ORIGIN_NOT_ALLOWED',
        message: 'This app origin is not allowed to access the API.',
      }));
      return true;
    }
    addCorsHeaders(rawRes, origin, method);
  }

  return false;
}

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
export function createVercelMethodHandler(
  handler: ApiHandler,
  method: 'GET' | 'POST'
): ApiHandler {
  return async (req, rawRes) => {
    const nodeResponse = rawRes as unknown as ServerResponse;
    if (handleCors(req, nodeResponse, method)) return;
    const res = createExpressResponse(rawRes as unknown as ServerResponse);

    if (req.method !== method) {
      res.setHeader('Allow', method);
      res.status(405).json({
        status: 'error',
        code: 'METHOD_NOT_ALLOWED',
        message: `This endpoint accepts ${method} requests only.`,
      });
      return;
    }

    try {
      await handler(req, res);
    } catch {
      console.error(`[FallGuard API] Unhandled ${method} function error.`);
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

export function createVercelPostHandler(handler: PostHandler): PostHandler {
  return createVercelMethodHandler(handler, 'POST');
}

export function createVercelGetHandler(handler: ApiHandler): ApiHandler {
  return createVercelMethodHandler(handler, 'GET');
}
