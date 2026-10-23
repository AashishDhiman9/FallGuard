# FallGuard

FallGuard is a patient fall detection and caretaker monitoring app with a React dashboard, Firebase integration, and a device API.

## Run locally

Prerequisite: Node.js.

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and enter your Firebase web app settings for the `VITE_FIREBASE_*` variables.
3. Set `FALLGUARD_DEVICE_CREDENTIALS` to a JSON object mapping device IDs to their secret tokens, for example `{"DEVICE_ID":"DEVICE_TOKEN"}`.
4. Start the app with `npm run dev`.

The Firebase Admin service account setting is optional for local development. Keep real credentials in `.env` or your deployment's secret manager; `.env` is excluded from Git.

## Useful scripts

- `npm run dev` starts the server and app.
- `npm run build` creates the production frontend build.
- `npm run lint` runs the TypeScript check.
- `npm test` runs the tests.
