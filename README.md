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

For this Firebase project, the Realtime Database URL is `https://fallguard-929ff-default-rtdb.asia-southeast1.firebasedatabase.app`. Use this exact region-specific URL for both `VITE_FIREBASE_DATABASE_URL` and `FIREBASE_DATABASE_URL`; the older `.firebaseio.com` host points to the wrong region. Vite embeds the `VITE_` value at build time, so redeploy after changing it in Vercel.

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
| `VITE_API_BASE_URL` | Config | Optional public API origin; the Android build gets this from `.env.android` |
| `FIREBASE_DATABASE_URL` | Config | Server-side Firebase Admin database target; use the exact Realtime Database URL |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Secret | Firebase Admin service account JSON, stored as one JSON string |
| `FALLGUARD_DEVICE_CREDENTIALS` | Secret | JSON map from normalized device IDs to their pre-shared tokens |

The `VITE_` variables are embedded in the browser bundle and must not contain private credentials. Keep the service account JSON and device token registry unprefixed and server-side. Production requests fail with a database error if Firebase Admin is unavailable; the in-memory adapter is for local development and tests only.

After setting the variables, redeploy the Vercel project. Smoke-test routing without credentials: both POST endpoints should return a JSON `401` response (missing device credentials), not Vercel's platform `404`. An authenticated heartbeat should return `200` after the device ID/token pair is configured and the Admin service account can write to the same Realtime Database.

The Admin SDK requires the service account's `project_id` to be `fallguard-929ff` and the exact region-specific URL above. The service account key and device credentials are read only by server code; never add either value to a `VITE_` variable.

### Database paths and verification

- Heartbeats update `/devices/{UPPERCASE_DEVICE_ID}` (`status`, `lastSeen`, and optional `batteryLevel`/`firmwareVersion`). The update preserves the existing `patientUid` owner field.
- Pairing atomically writes `/users/{uid}/deviceId` and `/devices/{UPPERCASE_DEVICE_ID}/{deviceId,patientUid}`. Existing telemetry on the device node is preserved. A device already owned by another UID is rejected.
- Fall events are written to `/fall_events/{eventId}` with `patientUid` and `patientName`. The client reads only exact `patientUid` or legacy `userId` queries; caretaker queries are limited to linked patient UIDs. The checked-in rules enforce those query bounds. If an older account only has `/users/{uid}/deviceId`, the API repairs `/devices/{deviceId}/patientUid` on lookup only when exactly one user matches.

`GET /api/health` is a read-only diagnostic. It reads only the reserved `__fallguard_health_probe__` node and returns Firebase Admin and Realtime Database readiness states, never a URL, credential, or patient field. A `200` means the Admin SDK initialized and a real database read succeeded; it does not prove that a device write was accepted. A `503` means to check the server-side variables and Vercel function logs, which emit safe error codes without service-account contents.

For a real write check after deployment:

1. In Vercel Production, set `FIREBASE_DATABASE_URL` to `https://fallguard-929ff-default-rtdb.asia-southeast1.firebasedatabase.app`, set `FIREBASE_SERVICE_ACCOUNT_KEY` to the Firebase service account JSON for project `fallguard-929ff`, and ensure `FALLGUARD_DEVICE_CREDENTIALS` contains the matching token for `FG-8821-X`.
2. Publish the checked-in `database.rules.json` from Firebase Console → Realtime Database → Rules. Keep the scoped authenticated rules; do not add root-wide public `.read` or `.write` grants. Firebase Admin writes use the service account, while browser pairing and reading continue to be governed by these rules.
3. Deploy the changes to Vercel Production. Check `GET https://fallguard-aashish-eca0.vercel.app/api/health` and expect `200` with both checks ready/reachable.
4. Send one authenticated heartbeat and expect `200`. Confirm in Realtime Database that `/devices/FG-8821-X/lastSeen` changes and the paired `patientUid` remains present. This confirms an actual production write.
5. To verify event ingestion, use a dedicated test patient/device pairing and a controlled test event. Expect `201`, then confirm `/fall_events/{eventId}` has `patientUid` and `patientName`. A successful heartbeat alone does not verify event ownership resolution.

Do not use a real patient's device for the event test unless you intend to create an alert in that patient's dashboard.

## Android app (Capacitor)

The Android app bundles the Vite frontend in the native project and connects to the production API at `https://fallguard-aashish-eca0.vercel.app`. Firebase client configuration is embedded at build time from the public `VITE_FIREBASE_*` variables. Never place `FIREBASE_SERVICE_ACCOUNT_KEY` or `FALLGUARD_DEVICE_CREDENTIALS` in the Android app.

Requirements: Node.js 22 or newer, Android Studio 2025.2.1 or newer, and an Android SDK installed through Android Studio. Capacitor 8 requires Android Studio and an Android SDK; Android Studio supplies the JDK used by Gradle.

From the repository root:

1. Install packages with `npm install`.
2. Ensure `.env` has the public `VITE_FIREBASE_*` values from the Firebase Web App settings.
3. Build the Android web bundle and synchronize it into the native project with `npm run android:build`.
4. Open the project in Android Studio with `npm run android:open`, allow Gradle sync to finish, then run it on a connected device or emulator.
5. To create a local debug APK, use **Build → Build APK(s)** in Android Studio. It will be written to `android/app/build/outputs/apk/debug/app-debug.apk`.

After frontend changes, rerun `npm run android:build` before opening or running the Android project so its bundled assets are current. The Android build uses `.env.android` for the public API base URL; the Vercel web build continues to use same-origin `/api` routes. The server allows the Capacitor Android origin (`https://localhost`) for these API calls.

## Useful scripts

- `npm run dev` starts the server and app.
- `npm run build` creates the production frontend build.
- `npm run android:build` creates the Android web bundle and syncs it to Capacitor.
- `npm run android:open` opens the Android Studio project.
- `npm run lint` runs the TypeScript check.
- `npm test` runs the tests.
