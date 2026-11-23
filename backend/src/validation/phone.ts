// Phone validation (T026, research R-4). E.164: a leading '+', then 8-15 digits, first digit non-zero.
// Separators (spaces, dashes, dots, parentheses) are stripped before the check; the value is
// rejected otherwise, never guessed at.

const E164 = /^\+[1-9][0-9]{7,14}$/;

export function normalisePhone(input: string): string | null {
  const trimmed = input.trim();
  const stripped = trimmed.replace(/[\s\-.()]/g, '');
  return E164.test(stripped) ? stripped : null;
}

export function isE164(value: string): boolean {
  return E164.test(value);
}
