// AI Assistant for Tutor Ledger
// Provides:
// 1. Intelligent payment message parsing (WhatsApp / UPI / SMS)
// 2. Personalized WhatsApp payment reminder drafting with adaptive tones
// 3. 13-Week Cash Flow Financial Copilot & Advisor
//
// Automatically integrates with Gemini API when GEMINI_API_KEY is configured in .env,
// and gracefully falls back to an intelligent local heuristic NLP engine when no key is present.

export interface ParsedPaymentAIResult {
  amount_minor: number | null;
  date: string | null;
  family_name_candidate: string | null;
  payment_mode: string | null;
  reference_id: string | null;
  is_partial: boolean;
  amount_flagged: boolean;
  confidence: 'high' | 'medium' | 'low';
  raw_summary: string;
  suggested_notes: string;
}

export interface ReminderAIOptions {
  familyName: string;
  studentName?: string;
  amountFormatted: string;
  dueDate: string;
  daysOverdue: number;
  tone: 'friendly' | 'neutral' | 'firm' | 'urgent';
  paymentDetails?: string;
  customNote?: string;
}

export interface CashFlowInsightAI {
  status: 'safe' | 'caution' | 'critical';
  summary: string;
  lowestCashWeek: number;
  lowestCashFormatted: string;
  actions: string[];
  riskAnalysis: string;
}

/**
 * Intelligent Payment Message Parser
 */
export async function parsePaymentMessageWithAI(
  text: string,
  currencyExponent = 2,
  knownFamilyNames: string[] = [],
  apiKey?: string,
): Promise<ParsedPaymentAIResult> {
  const cleanText = text.trim().slice(0, 2000);

  // If Gemini API Key is configured, attempt LLM-powered extraction first
  if (apiKey && apiKey.trim().length > 10) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are a financial assistant for a home tutor. Extract payment confirmation details from this WhatsApp/SMS message.
Return ONLY valid JSON matching this schema:
{
  "amount": number or null (decimal amount, e.g. 3500.00),
  "date": "YYYY-MM-DD" or null,
  "family_name_candidate": string or null,
  "payment_mode": string or null (e.g. GPay, PhonePe, Paytm, Bank Transfer, UPI, Cash),
  "reference_id": string or null,
  "is_partial": boolean,
  "amount_flagged": boolean (true if ambiguous or multiple conflicting amounts exist),
  "confidence": "high" | "medium" | "low",
  "raw_summary": string (short 1-line explanation),
  "suggested_notes": string
}

Message text:
"""${cleanText}"""`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          }),
        },
      );

      if (response.ok) {
        const data = (await response.json()) as any;
        const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (jsonText) {
          const parsed = JSON.parse(jsonText);
          const amountMinor =
            typeof parsed.amount === 'number'
              ? Math.round(parsed.amount * Math.pow(10, currencyExponent))
              : null;
          return {
            amount_minor: amountMinor,
            date: parsed.date || new Date().toISOString().slice(0, 10),
            family_name_candidate: parsed.family_name_candidate || null,
            payment_mode: parsed.payment_mode || 'UPI / Online',
            reference_id: parsed.reference_id || null,
            is_partial: Boolean(parsed.is_partial),
            amount_flagged: Boolean(parsed.amount_flagged),
            confidence: parsed.confidence || 'high',
            raw_summary: parsed.raw_summary || 'Extracted via Gemini AI',
            suggested_notes: parsed.suggested_notes || '',
          };
        }
      }
    } catch {
      // Fall through to local smart heuristic parser on network error
    }
  }

  // --- Local Intelligent Rule-based NLP Parser ---
  return parsePaymentMessageLocal(cleanText, currencyExponent, knownFamilyNames);
}

function parsePaymentMessageLocal(
  text: string,
  currencyExponent: number,
  knownFamilyNames: string[],
): ParsedPaymentAIResult {
  // 1. Detect candidate amounts (e.g., Rs. 3500, ₹3,500, paid 3500, remaining 1000)
  const amountRegex =
    /(?:rs\.?|inr|₹|\$|£|€|paid|sent|transferred|remaining|balance|due|pay|amount(?:\s*of)?)\s*[:\-]?\s*(\d{1,7}(?:,\d{3})*(?:\.\d{1,2})?)/gi;
  const standaloneAmountRegex = /\b(\d{3,6}(?:\.\d{1,2})?)\b/g;

  const foundAmounts: number[] = [];
  let m: RegExpExecArray | null;

  while ((m = amountRegex.exec(text)) !== null) {
    if (m[1]) {
      const num = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(num) && num > 0) {
        foundAmounts.push(num);
      }
    }
  }

  // Also check standalone numbers for any secondary mentions
  while ((m = standaloneAmountRegex.exec(text)) !== null) {
    if (m[1]) {
      const num = parseFloat(m[1]);
      if (!isNaN(num) && num > 0 && num !== 2024 && num !== 2025 && num !== 2026) {
        if (!foundAmounts.includes(num)) {
          foundAmounts.push(num);
        }
      }
    }
  }

  // Detect payment mode
  let mode = 'Online Transfer';
  if (/gpay|google\s*pay/i.test(text)) mode = 'Google Pay';
  else if (/phonepe|phone\s*pe/i.test(text)) mode = 'PhonePe';
  else if (/paytm/i.test(text)) mode = 'Paytm';
  else if (/upi/i.test(text)) mode = 'UPI';
  else if (/neft|rtgs|imps|bank\s*transfer/i.test(text)) mode = 'Bank Transfer';
  else if (/cash/i.test(text)) mode = 'Cash';

  // Detect reference ID
  let refId: string | null = null;
  const refMatch =
    /(?:ref|utr|txn|transaction|id|ref\s*no\.?)\s*[:\-]?\s*([a-zA-Z0-9\-_]{8,28})/i.exec(text);
  if (refMatch?.[1]) {
    refId = refMatch[1];
  }

  // Detect partial payment intention
  const isPartial =
    /part|partial|remaining|balance|rest|next\s*week|next\s*month|advance/i.test(text);

  // Match family name if known
  let familyCandidate: string | null = null;
  for (const name of knownFamilyNames) {
    if (new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i').test(text)) {
      familyCandidate = name;
      break;
    }
  }

  // Distinct amounts
  const uniqueAmounts = Array.from(new Set(foundAmounts));
  const amountFlagged = uniqueAmounts.length > 1;
  const primaryAmount = uniqueAmounts.length > 0 ? uniqueAmounts[0] : null;

  const todayIso = new Date().toISOString().slice(0, 10);
  const amountMinor =
    primaryAmount !== null && primaryAmount !== undefined
      ? Math.round(primaryAmount * Math.pow(10, currencyExponent))
      : null;

  return {
    amount_minor: amountMinor,
    date: todayIso,
    family_name_candidate: familyCandidate,
    payment_mode: mode,
    reference_id: refId,
    is_partial: isPartial,
    amount_flagged: amountFlagged,
    confidence: uniqueAmounts.length === 1 ? 'high' : uniqueAmounts.length > 1 ? 'medium' : 'low',
    raw_summary: primaryAmount
      ? `Detected ${mode} payment of ${primaryAmount}${isPartial ? ' (Partial payment indicated)' : ''}`
      : 'No clear amount found in message',
    suggested_notes: `${mode}${refId ? ` (Ref: ${refId})` : ''}`,
  };
}

/**
 * Intelligent WhatsApp Reminder Generator
 */
export async function generateReminderWithAI(
  opts: ReminderAIOptions,
  apiKey?: string,
): Promise<{ reminderText: string; toneUsed: string }> {
  // If Gemini API Key available, generate dynamic personalized text
  if (apiKey && apiKey.trim().length > 10) {
    try {
      const prompt = `You are a respectful, empathetic professional assistant for a home tutor.
Draft a WhatsApp reminder message for a parent about an invoice.
Tutor-parent relationships are delicate and require respect and clarity.

Details:
- Parent/Family Name: ${opts.familyName}
- Student Name: ${opts.studentName || opts.familyName}
- Amount Due: ${opts.amountFormatted}
- Due Date: ${opts.dueDate}
- Days Overdue: ${opts.daysOverdue} days
- Tone: ${opts.tone} (friendly = warm and gentle; neutral = polite, clear and professional; firm = respectful but firm and urgent; urgent = immediate action needed before next class)
${opts.paymentDetails ? `- Payment info: ${opts.paymentDetails}` : ''}
${opts.customNote ? `- Custom note: ${opts.customNote}` : ''}

Rules:
1. Message MUST be under 400 characters.
2. Use natural WhatsApp formatting (like *bold* for amount and dates).
3. Do NOT include placeholders like [Your Name]. Sign off as "Warm regards, Your Tutor".
4. Output ONLY the message text.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 250 },
          }),
        },
      );

      if (response.ok) {
        const data = (await response.json()) as any;
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text && text.length <= 500) {
          return { reminderText: text, toneUsed: opts.tone };
        }
      }
    } catch {
      // Fallback to local template generator
    }
  }

  // Local Intelligent Template Fallback
  let text = '';
  const child = opts.studentName || 'your child';

  switch (opts.tone) {
    case 'friendly':
      text =
        `Hello ${opts.familyName}! 😊 Hope ${child} is enjoying our recent lessons. ` +
        `Just a gentle reminder that the tuition fee of *${opts.amountFormatted}* was due on *${opts.dueDate}*. ` +
        `Whenever convenient, kindly transfer the fees. Thank you so much for your support! 🙏`;
      break;
    case 'firm':
      text =
        `Dear ${opts.familyName}, this is a follow-up regarding the tuition fee of *${opts.amountFormatted}*, ` +
        `which was due on *${opts.dueDate}* (${opts.daysOverdue} days overdue). ` +
        `Kindly arrange the payment today or let me know if you need assistance. Thank you.`;
      break;
    case 'urgent':
      text =
        `Dear ${opts.familyName}, please note that the tuition fee of *${opts.amountFormatted}* is now *${opts.daysOverdue} days overdue*. ` +
        `To keep upcoming tutoring sessions on schedule, kindly clear this invoice today. Thank you for your prompt attention.`;
      break;
    case 'neutral':
    default:
      text =
        `Hello ${opts.familyName}, this is a reminder that the tuition invoice for *${opts.amountFormatted}* ` +
        `was due on *${opts.dueDate}* (${opts.daysOverdue} days ago). ` +
        `Please confirm once paid. Thank you!`;
      break;
  }

  if (opts.paymentDetails) {
    text += `\nUPI/Payment: ${opts.paymentDetails}`;
  }

  return {
    reminderText: text.slice(0, 500),
    toneUsed: opts.tone,
  };
}

/**
 * 13-Week Cash Flow Copilot & Financial Advisor
 */
export function generateCashFlowInsights(
  lowestCashMinor: number,
  lowestCashWeek: number,
  minimumBalanceMinor: number,
  overdueInvoicesCount: number,
  totalOverdueMinor: number,
  currencyCode = 'INR',
): CashFlowInsightAI {
  const isBelowMin = lowestCashMinor < minimumBalanceMinor;
  const isCritical = lowestCashMinor <= 0;

  const symbol = currencyCode === 'INR' ? '₹' : currencyCode === 'GBP' ? '£' : '$';
  const fmt = (minor: number) =>
    `${symbol}${(Math.abs(minor) / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const actions: string[] = [];
  let status: 'safe' | 'caution' | 'critical' = 'safe';
  let summary = '';
  let riskAnalysis = '';

  if (isCritical) {
    status = 'critical';
    summary = `⚠️ Critical cash alert: Forecast dips into negative cash (${fmt(lowestCashMinor)}) in Week ${lowestCashWeek}.`;
    riskAnalysis =
      `Your upcoming bills will exceed incoming collections by Week ${lowestCashWeek}. ` +
      `You currently have ${overdueInvoicesCount} overdue invoices totaling ${fmt(totalOverdueMinor)}.`;
    actions.push(`Chase the top ${Math.min(3, overdueInvoicesCount)} overdue invoices today via WhatsApp.`);
    actions.push(`Delay or split non-essential study materials or personal withdrawals before Week ${lowestCashWeek}.`);
    actions.push(`Ask 1-2 regular families if they would like to pay advance for the upcoming term.`);
  } else if (isBelowMin) {
    status = 'caution';
    summary = `⚡ Cash dip alert: Cash falls to ${fmt(lowestCashMinor)} in Week ${lowestCashWeek}, below your safety minimum of ${fmt(minimumBalanceMinor)}.`;
    riskAnalysis =
      `While you won't run out of money, your emergency reserve is threatened in Week ${lowestCashWeek} ` +
      `due to recurring bills coinciding with late fee payments.`;
    actions.push(`Send friendly reminders to families with overdue invoices (${fmt(totalOverdueMinor)} outstanding).`);
    actions.push(`Test the "Sharma family 15 days late" scenario in What-If Scenarios to inspect sensitivity.`);
    actions.push(`Ensure your recurring rent or software bills are scheduled after expected fee inflow dates.`);
  } else {
    status = 'safe';
    summary = `✅ Healthy cash flow: Projected minimum balance is ${fmt(lowestCashMinor)} in Week ${lowestCashWeek}, comfortably above your ${fmt(minimumBalanceMinor)} safety buffer.`;
    riskAnalysis =
      `Your tuition fee schedule supports upcoming expenses over the next 13 weeks. ` +
      `${overdueInvoicesCount > 0 ? `Recovering the ${overdueInvoicesCount} overdue invoices will add ${fmt(totalOverdueMinor)} to your reserves.` : 'All accounts are in good standing.'}`;
    if (overdueInvoicesCount > 0) {
      actions.push(`Send standard reminders to the ${overdueInvoicesCount} overdue families to maintain prompt payment habits.`);
    }
    actions.push(`Consider opening a 3-month recurring deposit with surplus cash.`);
  }

  return {
    status,
    summary,
    lowestCashWeek,
    lowestCashFormatted: fmt(lowestCashMinor),
    actions,
    riskAnalysis,
  };
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
