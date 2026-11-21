// Pasted-message parser (T045). Pure, bounded tokenizer. It never evaluates, deserialises or
// stores its input. It returns pre-fill candidates for amount and date only (FR-023, FR-024,
// research R-10). Input over 2,000 characters is rejected.

export const MAX_MESSAGE_CHARS = 2000;

export interface ParsedDraft {
  amount_minor: number | null;
  date: string | null; // YYYY-MM-DD
  amount_flagged: boolean;
  candidates: number; // number of distinct amount candidates found
}

export type ParseResult = { ok: true; draft: ParsedDraft } | { ok: false; reason: 'TOO_LONG' };

const AMOUNT_RE = /(?:^|[^\w.])(\d{1,9}(?:,\d{3})*(?:\.\d{1,2})?)(?![\w])/g;
const ISO_DATE_RE = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const TERM_NUMBER_RE = /\bterm\s*:?\s*\d{1,9}(?:,\d{3})*(?:\.\d{1,2})?/gi;

function toMinor(token: string, exponent: number): number | null {
  const normalised = token.replace(/,/g, '');
  const [whole = '', frac = ''] = normalised.split('.');
  if (frac.length > exponent) return null;
  const padded = frac.padEnd(exponent, '0');
  const value = Number(whole + padded);
  return Number.isSafeInteger(value) ? value : null;
}

function isValidIsoDate(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function parsePaymentMessage(text: string, currencyExponent = 2): ParseResult {
  if (text.length > MAX_MESSAGE_CHARS) {
    return { ok: false, reason: 'TOO_LONG' };
  }

  // Blank out ISO dates first so their digits (2026, 11, 20) are not read as amounts.
  const amountText = text.replace(ISO_DATE_RE, ' ').replace(TERM_NUMBER_RE, ' ');
  const amounts = new Set<number>();
  for (const match of amountText.matchAll(AMOUNT_RE)) {
    const token = match[1];
    if (!token) continue;
    const minor = toMinor(token, currencyExponent);
    if (minor !== null && minor > 0) amounts.add(minor);
  }

  const dates: string[] = [];
  for (const match of text.matchAll(ISO_DATE_RE)) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    if (isValidIsoDate(y, m, d)) dates.push(`${match[1]}-${match[2]}-${match[3]}`);
  }

  const amountList = [...amounts];
  const amountMinor = amountList.length === 1 ? (amountList[0] ?? null) : null;
  // FR-024: ambiguous (several distinct amounts) or unreadable amounts are flagged.
  const flagged = amountList.length !== 1;
  const date = dates.length === 1 ? (dates[0] ?? null) : null;

  return {
    ok: true,
    draft: {
      amount_minor: amountMinor,
      date,
      amount_flagged: flagged,
      candidates: amountList.length,
    },
  };
}
