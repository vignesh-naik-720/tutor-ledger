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
      url.startsWith('/api/v1/setup/status') ||
      url.startsWith('/api/v1/setup/owner') ||
      url.startsWith('/api/v1/auth/login') ||
      url.startsWith('/api/v1/whatsapp/webhook') ||
      request.method === 'OPTIONS'
    ) {
      return;
    }

    const rawCookie = request.cookies['__Host-tl_session'];
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
