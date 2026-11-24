import 'dotenv/config';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { setupWebSocketServer } from './src/server/ws.ts';
import { createRateLimiter } from './src/server/rateLimit.ts';
import { UPLOADS_ROOT, uploadMiddleware } from './src/server/upload.ts';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';

import authRoutes from './src/server/routes/auth.ts';
import socialRoutes from './src/server/routes/social.ts';
import storiesRoutes from './src/server/routes/stories.ts';
import reelsRoutes from './src/server/routes/reels.ts';
import liveRoutes from './src/server/routes/live.ts';
import chatRoutes from './src/server/routes/chat.ts';
import cloudRoutes from './src/server/routes/cloud.ts';
import aiRoutes from './src/server/routes/ai.ts';
import communityRoutes from './src/server/routes/community.ts';
import platformRoutes from './src/server/routes/platform.ts';
import locationRoutes from './src/server/routes/location.ts';
import pushRoutes from './src/server/routes/push.ts';
import universeRoutes from './src/server/routes/universe.ts';
import communitiesAdminRoutes from './src/server/routes/communitiesAdmin.ts';
import engagementRoutes from './src/server/routes/engagement.ts';
import ecosystemRoutes from './src/server/routes/ecosystem.ts';
import storeRoutes from './src/server/routes/store.ts';
import governanceRoutes from './src/server/routes/governance.ts';
import callsRoutes from './src/server/routes/calls.ts';
import { hasValidGeminiKey } from './src/server/gemini.ts';

interface PendingServerSharePayload {
  title: string;
  text: string;
  url: string;
  files: Array<{
    name: string;
    mimeType: string;
    size: number;
    url: string;
  }>;
  createdAt: number;
}

const pendingServerShares = new Map<string, PendingServerSharePayload>();

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

async function bootstrap() {
  const app = express();
  const server = http.createServer(app);

  const allowedOrigins = new Set(
    (
      process.env.ALLOWED_ORIGINS ||
      'https://tiger-omar.samarelgaly84.workers.dev'
    )
      .split(',')
      .map((o) => o.trim().replace(/\/+$/, ''))
      .filter(Boolean)
  );

  // Security & CORS headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    const origin = typeof req.headers.origin === 'string' ? req.headers.origin.replace(/\/+$/, '') : '';
    if (
      origin &&
      (allowedOrigins.has(origin) ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:'))
    ) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,Accept');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      if (req.method === 'OPTIONS') {
        return res.status(204).end();
      }
    }

    next();
  });

  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Rate limiting
  app.use('/api', createRateLimiter({ windowMs: 60_000, max: 300 }));
  app.use('/api/ai', createRateLimiter({ windowMs: 60_000, max: 30, message: 'AI rate limit reached. Please wait a minute.' }));

  // Static uploaded media & files
  app.use('/uploads', express.static(UPLOADS_ROOT, { maxAge: '7d' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'TIGER CONNECT Platform',
      aiConfigured: hasValidGeminiKey(),
      timestamp: new Date().toISOString(),
    });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/social', socialRoutes);
  app.use('/api/stories', storiesRoutes);
  app.use('/api/reels', reelsRoutes);
  app.use('/api/live', liveRoutes);
  app.use('/api/chats', chatRoutes);
  app.use('/api/cloud', cloudRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/community', communityRoutes);
  app.use('/api/platform', platformRoutes);
  app.use('/api/location', locationRoutes);
  app.use('/api/push', pushRoutes);
  app.use('/api/universe', universeRoutes);
  app.use('/api/communities-admin', communitiesAdminRoutes);
  app.use('/api/engagement', engagementRoutes);
  app.use('/api/ecosystem', ecosystemRoutes);
  app.use('/api/store', storeRoutes);
  app.use('/api/governance', governanceRoutes);
  app.use('/api/calls', callsRoutes);

  // Express fallback for OS / Android Web Share Target POST /share-target when Service Worker is not intercepting
  app.post('/share-target', uploadMiddleware.array('files', 10), (req, res) => {
    try {
      const token = crypto.randomBytes(16).toString('hex');
      const uploadedFiles = Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];
      const payload: PendingServerSharePayload = {
        title: String(req.body?.title || ''),
        text: String(req.body?.text || ''),
        url: String(req.body?.url || ''),
        files: uploadedFiles.map((f) => ({
          name: f.originalname || f.filename,
          mimeType: f.mimetype || 'application/octet-stream',
          size: f.size,
          url: `/uploads/${f.filename}`,
        })),
        createdAt: Date.now(),
      };
      pendingServerShares.set(token, payload);
      // Expire after 15 minutes
      setTimeout(() => {
        pendingServerShares.delete(token);
      }, 15 * 60_000).unref?.();
      res.redirect(303, `/?server_share=${encodeURIComponent(token)}`);
    } catch (err) {
      console.error('POST /share-target fallback error:', err);
      res.redirect(303, '/');
    }
  });

  app.get('/api/share/incoming/:token', requireAuth, (req: AuthRequest, res) => {
    const token = String(req.params.token || '').trim();
    const entry = pendingServerShares.get(token);
    if (!entry) {
      return res.status(404).json({ error: 'Shared payload not found or expired' });
    }
    pendingServerShares.delete(token);
    res.json({ payload: entry });
  });

  // API 404 fallback
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // Attach WebSocket server on same HTTP server & port
  setupWebSocketServer(server);

  if (!IS_PROD) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      plugins: [
        {
          name: 'tiger-disable-hmr-ws',
          transform(code: string, id: string) {
            if (id.includes('vite/dist/client/client.mjs') || id.endsWith('/@vite/client')) {
              return {
                code: code.replace(
                  'transport.connect(createHMRHandler(handleMessage));',
                  '/* HMR WebSocket disabled in middleware mode */'
                ),
                map: null,
              };
            }
          },
        },
      ],
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global error middleware
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled server error:', err);
    const status = err?.status || (err?.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
    res.status(status).json({
      error: err?.message || 'Internal server error',
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`TIGER Platform server listening on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start TIGER server:', err);
  process.exit(1);
});
