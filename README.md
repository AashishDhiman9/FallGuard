# FallGuard

FallGuard is a patient fall detection and caretaker monitoring app with a React dashboard, Firebase integration, and a device API.

## Run locally

Prerequisite: Node.js.

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and enter your Firebase web app settings for the `VITE_FIREBASE_*` variables.
3. Set `FALLGUARD_DEVICE_CREDENTIALS` to a JSON object mapping device IDs to their secret tokens, for example `{"DEVICE_ID":"DEVICE_TOKEN"}`.
4. Start the app with `npm run dev`.

The Firebase Admin service account setting is optional for local development. Keep real credentials in `.env` or your deployment's secret manager; `.env` is excluded from Git.

## Deploy to Vercel

Vercel builds the Vite frontend with `npm run build` into `dist`. The device API is deployed as Node.js functions from the root `api/` directory:

- `POST /api/device/heartbeat` → `api/device/heartbeat.ts`
- `POST /api/device/event` → `api/device/event.ts`

These filesystem routes invoke the same handlers mounted by the local Express server. No rewrite to the SPA is needed; keep `/api/*` routed to the functions.

Configure these variables in Vercel for **Production** (and **Preview** if those deployments should accept devices):

| Variable | Visibility | Purpose |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | Config | Firebase web app configuration |
| `VITE_FIREBASE_AUTH_DOMAIN` | Config | Firebase web app configuration |
| `VITE_FIREBASE_DATABASE_URL` | Config | Firebase web app configuration |
| `VITE_FIREBASE_PROJECT_ID` | Config | Firebase web app configuration |
| `VITE_FIREBASE_STORAGE_BUCKET` | Config | Firebase web app configuration |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Config | Firebase web app configuration |
| `VITE_FIREBASE_APP_ID` | Config | Firebase web app configuration |
| `VITE_FIREBASE_MEASUREMENT_ID` | Config | Optional; only needed if analytics is added |
| `FIREBASE_DATABASE_URL` | Config | Server-side Firebase Admin database target; use the exact Realtime Database URL |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Secret | Firebase Admin service account JSON, stored as one JSON string |
| `FALLGUARD_DEVICE_CREDENTIALS` | Secret | JSON map from normalized device IDs to their pre-shared tokens |

The `VITE_` variables are embedded in the browser bundle and must not contain private credentials. Keep the service account JSON and device token registry unprefixed and server-side. Production requests fail with a database error if Firebase Admin is unavailable; the in-memory adapter is for local development and tests only.

After setting the variables, redeploy the Vercel project. Smoke-test routing without credentials: both POST endpoints should return a JSON `401` response (missing device credentials), not Vercel's platform `404`. An authenticated heartbeat should return `200` after the device ID/token pair is configured and the Admin service account can write to the same Realtime Database.

## Useful scripts

- `npm run dev` starts the server and app.
- `npm run build` creates the production frontend build.
- `npm run lint` runs the TypeScript check.
- `npm test` runs the tests.
