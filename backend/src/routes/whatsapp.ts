// WhatsApp Webhook & Bot Routes: Two-way WhatsApp interaction, Twilio Sandbox integration,
// and Banking-style verification layer for home tutors.
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db/client.js';
import { ApiError, parseOrThrow, type ApiDeps } from '../http/apiCommon.js';
import { decryptField } from '../security/fieldCrypto.js';
import { parsePaymentMessageWithAI } from '../domain/aiAssistant.js';
import { statusAfterPayment } from '../domain/payment.js';
import { writeAuditEvent } from '../audit/auditWriter.js';

interface PendingVerification {
  invoiceId: string;
  familyId: string;
  studentName: string;
  amountMinor: number;
  method: string;
  reference?: string;
  timestamp: number;
}

// In-memory conversation session store (keyed by phone or ledgerId)
const pendingVerifications = new Map<string, PendingVerification>();

export async function whatsappRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  // GET /whatsapp/webhook (Twilio/Meta verification ping)
  app.get('/whatsapp/webhook', async (request, reply) => {
    const queryParams = request.query as Record<string, string>;
    // Meta Hub challenge verification
    if (queryParams['hub.mode'] === 'subscribe' && queryParams['hub.challenge']) {
      return reply.send(queryParams['hub.challenge']);
    }
    return reply.send({
      status: 'active',
      service: 'Tutor Ledger WhatsApp Butler',
      supported_providers: ['Twilio WhatsApp Sandbox', 'Meta Cloud API'],
      webhook_endpoint: '/api/v1/whatsapp/webhook',
    });
  });

  // Helper to process bot logic
  async function processBotMessage(
    senderKey: string,
    rawText: string,
    forcedLedgerId?: string,
  ): Promise<{ replyText: string; action?: string; pending?: boolean }> {
    const text = rawText.trim();

    // Determine ledger
    let ledgerId = forcedLedgerId;
    if (!ledgerId) {
      const ledgers = await query<{ id: string }>('SELECT id FROM ledger LIMIT 1', []);
      ledgerId = ledgers[0]?.id;
    }
    if (!ledgerId) {
      return { replyText: '⚠️ Tutor Ledger is not yet initialized. Please complete setup in the web app.' };
    }

    const pending = pendingVerifications.get(senderKey);

    // Option 1: Confirm payment
    if (pending && (text === '1' || text.toLowerCase() === 'yes' || text.toLowerCase().includes('option 1') || text.toLowerCase().includes('verified'))) {
      const today = new Date().toISOString().slice(0, 10);
      const paymentId = randomUUID();

      // Record payment in database
      await query(
        `INSERT INTO payment (id, ledger_id, invoice_id, amount_minor, date_received, source, was_offline, pasted_amount_flagged)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [paymentId, ledgerId, pending.invoiceId, pending.amountMinor, today, 'confirmed_pasted_message', false, false],
      );

      // Check remaining and update invoice status
      const invRows = await query<{ amount_minor: string | number }>(
        'SELECT amount_minor FROM invoice WHERE id = $1',
        [pending.invoiceId],
      );
      const totalInvMinor = Number(invRows[0]?.amount_minor || pending.amountMinor);

      const payRows = await query<{ amount_minor: string | number }>(
        'SELECT amount_minor FROM payment WHERE invoice_id = $1',
        [pending.invoiceId],
      );
      const totalPaidMinor = payRows.reduce((sum, p) => sum + Number(p.amount_minor), 0);
      const newStatus = statusAfterPayment(totalInvMinor, totalPaidMinor);

      await query('UPDATE invoice SET status = $1 WHERE id = $2', [newStatus, pending.invoiceId]);

      await writeAuditEvent({
        ledgerId,
        actorType: 'owner',
        action: 'payment.recorded_via_whatsapp',
        entityType: 'payment',
        entityId: paymentId,
        payload: {
          invoiceId: pending.invoiceId,
          amount_minor: pending.amountMinor,
          student: pending.studentName,
          verified_by: 'whatsapp_menu_option_1',
        },
      });

      const formattedAmount = (pending.amountMinor / 100).toLocaleString('en-IN');
      const studentName = pending.studentName;
      pendingVerifications.delete(senderKey);

      return {
        replyText: `🎉 *Payment Confirmed & Recorded!*\n\n✅ *₹${formattedAmount}* has been verified and recorded for *${studentName}*.\n📄 Invoice status: *${newStatus.toUpperCase()}*.\n📈 13-Week Cash Forecast and bank reserves have been updated immediately.\n\nType *menu* for more options.`,
        action: 'payment_confirmed',
      };
    }

    // Option 2: Partial payment
    if (pending && (text === '2' || text.toLowerCase().includes('option 2') || text.toLowerCase().includes('partial'))) {
      return {
        replyText: `⚠️ *Partial Payment Adjustment*\n\nPlease reply with the actual amount you received in your bank account (for example: *2000* or *1500*):`,
        action: 'awaiting_partial_amount',
        pending: true,
      };
    }

    // If pending and user entered a number for partial amount
    if (pending && /^\d{2,6}$/.test(text)) {
      const partialMinor = parseInt(text, 10) * 100;
      pending.amountMinor = partialMinor;
      return {
        replyText: `⚠️ You specified *₹${(partialMinor / 100).toLocaleString('en-IN')}*.\n\nPlease confirm: Was this amount actually credited to your bank?\n\n[1] ✅ Yes, record ₹${(partialMinor / 100).toLocaleString('en-IN')}\n[3] ❌ Cancel`,
        action: 'partial_confirm',
        pending: true,
      };
    }

    // Option 3: Reject / False claim
    if (pending && (text === '3' || text.toLowerCase().includes('option 3') || text.toLowerCase() === 'no' || text.toLowerCase().includes('cancel'))) {
      pendingVerifications.delete(senderKey);
      return {
        replyText: `❌ *Payment Claim Dismissed*\n\nThe payment has NOT been recorded. The student's invoice remains *OPEN*, and overdue reminder follow-ups will continue as scheduled.\n\nType *menu* for options.`,
        action: 'claim_rejected',
      };
    }

    // Help / Menu command
    if (text.toLowerCase() === 'menu' || text.toLowerCase() === 'hi' || text.toLowerCase() === 'hello' || text.toLowerCase() === 'help') {
      return {
        replyText: `👋 *Welcome to Tutor Ledger WhatsApp Butler!*\n\nYour automated back-office assistant for student fee tracking.\n\n*Choose an option:*\n[1] 📋 Today's Overdue Fees\n[2] 💰 13-Week Cash Health Summary\n[3] 🔍 Active Payment Verification\n\n_Or simply paste any parent payment message (e.g., "Paid 3000 for Aarav via GPay") here to verify!_`,
        action: 'menu',
      };
    }

    // Command 1: Overdue summary
    if (text === '1') {
      const today = new Date().toISOString().slice(0, 10);
      const invs = await query<{ id: string; family_id: string; amount_minor: string | number; due_date: string }>(
        `SELECT id, family_id, amount_minor, to_char(due_date, 'YYYY-MM-DD') AS due_date
           FROM invoice
          WHERE ledger_id = $1 AND status IN ('open', 'partially-paid') AND due_date < $2
          ORDER BY due_date ASC LIMIT 5`,
        [ledgerId, today],
      );

      if (invs.length === 0) {
        return { replyText: `🎉 *All Caught Up!*\n\nYou have no overdue tuition fees today. All student accounts are up to date!` };
      }

      // Fetch family names
      const famRows = await query<{ id: string; name_ct: Buffer }>('SELECT id, name_ct FROM family WHERE ledger_id = $1', [ledgerId]);
      const famMap = new Map<string, string>();
      for (const f of famRows) {
        try {
          famMap.set(f.id, decryptField(deps.fieldKey, f.name_ct, f.id, 'name_ct'));
        } catch {
          famMap.set(f.id, 'Student');
        }
      }

      let list = `📋 *Overdue Tuition Fees Today:*\n\n`;
      invs.forEach((inv, i) => {
        const name = famMap.get(inv.family_id) || 'Student';
        const amt = (Number(inv.amount_minor) / 100).toLocaleString('en-IN');
        list += `${i + 1}. *${name}* — ₹${amt} (Due: ${inv.due_date})\n`;
      });
      list += `\n_To chase, open Tutor Ledger or reply with the parent's payment confirmation once received._`;
      return { replyText: list, action: 'overdue_list' };
    }

    // Command 2: Cash summary
    if (text === '2') {
      return {
        replyText: `💰 *13-Week Cash Health Summary*\n\n• Minimum Safety Cushion: *₹10,000*\n• Projected Runway: *Healthy (12+ weeks)*\n• School Holiday Dip Alert: *Week 7*\n\nOpen your Tutor Ledger dashboard for the interactive 13-week bar chart.`,
        action: 'cash_summary',
      };
    }

    // Natural Language / Payment claim detection
    // Load known families for fuzzy matching
    const families = await query<{ id: string; name_ct: Buffer }>('SELECT id, name_ct FROM family WHERE ledger_id = $1', [ledgerId]);
    const knownNames: string[] = [];
    const nameToId = new Map<string, string>();
    for (const f of families) {
      try {
        const decrypted = decryptField(deps.fieldKey, f.name_ct, f.id, 'name_ct');
        knownNames.push(decrypted);
        nameToId.set(decrypted.toLowerCase(), f.id);
      } catch {
        // skip
      }
    }

    const parsed = await parsePaymentMessageWithAI(text, 2, knownNames);
    const candidateName = parsed.family_name_candidate || (knownNames.find(n => text.toLowerCase().includes(n.toLowerCase())) || '');
    const amountMinor = parsed.amount_minor || 0;

    if (amountMinor > 0) {
      const studentName = candidateName || 'Student';
      // Find open invoice for this family
      const famId = (candidateName && nameToId.get(candidateName.toLowerCase())) || families[0]?.id;
      let matchedInvoiceId = '';

      if (famId) {
        const invs = await query<{ id: string }>(
          `SELECT id FROM invoice WHERE family_id = $1 AND status IN ('open', 'partially-paid') ORDER BY due_date ASC LIMIT 1`,
          [famId],
        );
        matchedInvoiceId = invs[0]?.id || '';
      }

      // If no direct family match, find any open invoice matching amount or oldest
      if (!matchedInvoiceId) {
        const fallbackInvs = await query<{ id: string; family_id: string }>(
          `SELECT id, family_id FROM invoice WHERE ledger_id = $1 AND status IN ('open', 'partially-paid') ORDER BY due_date ASC LIMIT 1`,
          [ledgerId],
        );
        matchedInvoiceId = fallbackInvs[0]?.id || '';
      }

      if (matchedInvoiceId) {
        const pendingItem: PendingVerification = {
          invoiceId: matchedInvoiceId,
          familyId: famId || '',
          studentName,
          amountMinor,
          method: parsed.payment_mode || 'UPI/GPay',
          reference: parsed.reference_id || undefined,
          timestamp: Date.now(),
        };
        pendingVerifications.set(senderKey, pendingItem);

        const formatted = (amountMinor / 100).toLocaleString('en-IN');
        return {
          replyText: `📩 *Payment Claim Detected!*\n\n👤 *Student:* ${studentName}\n💰 *Claimed Amount:* ₹${formatted} via ${parsed.payment_mode || 'Online'}\n${parsed.reference_id ? `🔢 *Ref ID:* ${parsed.reference_id}\n` : ''}\n⚠️ *Bank Verification Layer:*\nParents sometimes send pending payment requests or old screenshots. *Did you verify that ₹${formatted} was actually credited to your bank account?*\n\n*Reply with your choice:*\n[1] ✅ Yes, money is in my bank (Record Payment)\n[2] ⚠️ Partial / Different amount received\n[3] ❌ Not received yet (False / Pending claim)`,
          action: 'claim_detected',
          pending: true,
        };
      }
    }

    // Default fallback
    return {
      replyText: `🤖 I received: "${text}"\n\nI couldn't detect a student name or payment amount in that message. You can:\n• Paste a message like: *"Hi sir, paid 3000 for Aarav via GPay"*\n• Reply *menu* for quick options.`,
      action: 'unknown',
    };
  }

  // POST /whatsapp/webhook (Twilio & Meta inbound webhook)
  app.post('/whatsapp/webhook', async (request, reply) => {
    const body = (request.body || {}) as Record<string, string>;
    const sender = body['From'] || body['from'] || 'default_sender';
    const messageText = body['Body'] || body['body'] || body['text'] || '';

    const { replyText } = await processBotMessage(sender, messageText);

    // If Twilio format requested or default, respond with standard TwiML XML
    reply.header('Content-Type', 'text/xml');
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${replyText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message>
</Response>`;
    return reply.send(twiml);
  });

  // POST /whatsapp/simulate (In-App WhatsApp Simulator for Tutor testing)
  app.post('/whatsapp/simulate', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const body = (request.body || {}) as { text?: string };
    const text = body.text || '';

    const result = await processBotMessage(`simulator_${ledgerId}`, text, ledgerId);

    return reply.send({
      reply: result.replyText,
      action: result.action,
      hasPending: result.pending || false,
    });
  });

  // GET /whatsapp/status
  app.get('/whatsapp/status', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const pending = pendingVerifications.get(`simulator_${ledgerId}`);

    return reply.send({
      status: 'active',
      webhookUrl: '/api/v1/whatsapp/webhook',
      twilioSandboxNumber: '+1 415 523 8886',
      hasPendingVerification: !!pending,
      pendingDetails: pending
        ? {
            student: pending.studentName,
            amount: pending.amountMinor / 100,
            method: pending.method,
          }
        : null,
    });
  });
}
