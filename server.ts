import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { deviceRouter } from './src/server/deviceRouter.js';
import { initFirebaseAdmin } from './src/server/adminDb.js';
import { handleHealth } from './src/server/healthRoute.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  // Initialize server database adapter / Firebase Admin
  initFirebaseAdmin();

  const app = express();

  // Limit request size to 64kb to protect against oversized or flood requests
  app.use(express.json({ limit: '64kb' }));

  // Device ingestion endpoints for ESP32-C3
  app.use('/api/device', deviceRouter);

  // Health check endpoint
  app.get('/api/health', handleHealth);

  if (!isProd) {
    // In development mode, mount Vite middleware to serve client SPA with HMR/bundling
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production mode, serve pre-built assets from dist directory
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FallGuard server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start FallGuard server:', err);
  process.exit(1);
});
