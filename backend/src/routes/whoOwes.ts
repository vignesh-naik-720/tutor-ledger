// Who Owes Me Route (FR-028..FR-030)
import type { FastifyInstance } from 'fastify';
import { getWhoOwes } from '../domain/whoOwes.js';
import { loadLedger, type ApiDeps } from '../http/apiCommon.js';

export async function whoOwesRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  app.get('/who-owes', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const ledger = await loadLedger(ledgerId);

    const queryParams = request.query as { limit?: string; all?: string };
    const limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 5;
    const showAll = queryParams.all === 'true';

    const result = await getWhoOwes(
      ledgerId,
      deps.fieldKey,
      ledger.currency_code ?? 'INR',
      limit,
      showAll,
    );

    return reply.send(result);
  });
}
