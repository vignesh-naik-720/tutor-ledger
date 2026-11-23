// Offline queue item (device only; never a server table). Payload is encrypted on the
// device with a non-extractable WebCrypto key; this type carries no names or phone numbers.

export type OfflineQueueItemType = 'payment' | 'invoice_confirm';

export interface OfflineQueueItem {
  client_event_id: string; // UUID; same idempotency key as Payment
  type: OfflineQueueItemType;
  family_id: string; // UUID
  invoice_id: string; // UUID
  amount_minor: number | null; // integer minor units; null for invoice_confirm
  currency_code: string; // ISO 4217
  date_received: string; // YYYY-MM-DD in ledger timezone
  queued_at: string; // ISO timestamp
  payload_ct: ArrayBuffer; // [ENC on device]
}

export const OFFLINE_QUEUE_TYPES: readonly OfflineQueueItemType[] = ['payment', 'invoice_confirm'];

export function isOfflineQueueItemType(value: unknown): value is OfflineQueueItemType {
  return typeof value === 'string' && (OFFLINE_QUEUE_TYPES as readonly string[]).includes(value);
}
