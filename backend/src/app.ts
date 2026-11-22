import fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import { errorHandler } from './http/errorHandler.js';
import { applySecurityHeaders } from './security/headers.js';
import { resolveSession } from './auth/session.js';
import type { ApiDeps } from './http/apiCommon.js';

// Import all routes
import { authRoutes } from './routes/auth.js';
import { setupRoutes } from './routes/setup.js';
import { familyRoutes } from './routes/families.js';
import { invoiceRoutes } from './routes/invoices.js';
import { paymentRoutes } from './routes/payments.js';
import { chaseTodayRoutes } from './routes/chaseToday.js';
import { whoOwesRoutes } from './routes/whoOwes.js';
import { reminderRoutes } from './routes/reminders.js';
import { forecastRoutes } from './routes/forecast.js';
import { scenarioRoutes } from './routes/scenarios.js';
import { billRoutes } from './routes/bills.js';
import { alertRoutes } from './routes/alerts.js';
import { aiRoutes } from './routes/ai.js';
import { settingsRoutes } from './routes/settings.js';
import { whatsappRoutes } from './routes/whatsapp.js';

export interface AppOptions {
  deps: ApiDeps;
  setupSecret: string;
}

export function buildApp(opts: AppOptions): FastifyInstance {
  const app = fastify({
    logger: false,
    trustProxy: true,
  });

  // Global Error Handler
  app.setErrorHandler(errorHandler);

  // Security Headers
  app.addHook('onRequest', async (_request, reply) => {
    applySecurityHeaders((k, v) => reply.header(k, v));
  });

  // CORS (support frontend Vite dev server and production origin)
  app.register(fastifyCors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Origin'],
  });

  // Cookie plugin
  app.register(fastifyCookie);

  // Support application/x-www-form-urlencoded (Twilio webhooks)
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, body, done) => {
    try {
      const params = new URLSearchParams(body as string);
      const result: Record<string, string> = {};
      for (const [k, v] of params.entries()) {
        result[k] = v;
      }
      done(null, result);
    } catch (err: any) {
      done(err, undefined);
    }
  });

  // Session & Ledger Scoping Hook
  // Resolves the session from cookie __Host-tl_session and assigns request.ledgerId
  app.addHook('onRequest', async (request, reply) => {
    const url = request.url;

    // Public endpoints allow-list (contracts/api.md)
    if (
      url === '/' ||
      url.startsWith('/api/v1/setup/status') ||
      url.startsWith('/api/v1/setup/owner') ||
      url.startsWith('/api/v1/auth/login') ||
      url.startsWith('/api/v1/whatsapp/webhook') ||
      request.method === 'OPTIONS'
    ) {
      return;
    }

    const rawCookie = request.cookies['__Host-tl_session'] || request.cookies['tl_session'];
    if (!rawCookie) {
      return reply.code(401).send({
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      });
    }

    const sess = await resolveSession(rawCookie, opts.deps.pepper);
    if (!sess) {
      return reply.code(401).send({
        error: { code: 'SESSION_EXPIRED', message: 'Session expired' },
      });
    }

    request.ledgerId = sess.ledgerId;
  });

  // Root Welcome & Navigation route (when visited directly on port 3001)
  app.get('/', async (request, reply) => {
    const acceptsHtml = request.headers.accept?.includes('text/html');
    if (acceptsHtml) {
      reply.type('text/html').send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Tutor Ledger API</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 16px; }
            .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 36px; max-width: 520px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            .badge { display: inline-block; background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
            h1 { font-size: 26px; font-weight: 700; margin: 0 0 10px 0; color: #ffffff; letter-spacing: -0.02em; }
            p { color: #94a3b8; font-size: 15px; margin: 0 0 24px 0; line-height: 1.6; }
            .btn-group { display: flex; flex-direction: column; gap: 10px; }
            @media (min-width: 480px) { .btn-group { flex-direction: row; justify-content: center; } }
            .btn { display: inline-flex; align-items: center; justify-content: center; background: #2563eb; color: #ffffff; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; transition: background 0.15s; }
            .btn:hover { background: #1d4ed8; }
            .btn-secondary { background: #334155; color: #e2e8f0; }
            .btn-secondary:hover { background: #475569; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">● API Active & Healthy</div>
            <h1>Tutor Ledger Backend API</h1>
            <p>You have reached the API service running on port 3001. To interact with the Tutor Ledger application, open the frontend web interface:</p>
            <div class="btn-group">
              <a href="http://localhost:5173" class="btn">🚀 Open Web App (Port 5173)</a>
              <a href="http://localhost:8080" class="btn btn-secondary">🗄️ Database Viewer (Adminer)</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    return reply.send({
      service: 'Tutor Ledger API',
      status: 'healthy',
      version: '1.0.0',
      web_app_url: 'http://localhost:5173',
      adminer_url: 'http://localhost:8080',
      endpoints: {
        setup_status: '/api/v1/setup/status',
        whatsapp_webhook: '/api/v1/whatsapp/webhook',
      },
    });
  });

  // Register Routes under /api/v1
  app.register(
    async (v1) => {
      await authRoutes(v1, opts.deps);
      await setupRoutes(v1, opts.deps, opts.setupSecret);
      await familyRoutes(v1, opts.deps);
      await invoiceRoutes(v1, opts.deps);
      await paymentRoutes(v1, opts.deps);
      await chaseTodayRoutes(v1, opts.deps);
      await whoOwesRoutes(v1, opts.deps);
      await reminderRoutes(v1, opts.deps);
      await forecastRoutes(v1, opts.deps);
      await scenarioRoutes(v1, opts.deps);
      await billRoutes(v1, opts.deps);
      await alertRoutes(v1, opts.deps);
      await aiRoutes(v1, opts.deps);
      await settingsRoutes(v1, opts.deps);
      await whatsappRoutes(v1, opts.deps);
    },
    { prefix: '/api/v1' },
  );

  return app;
}
