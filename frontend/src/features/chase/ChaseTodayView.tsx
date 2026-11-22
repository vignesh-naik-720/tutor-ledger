import React, { useState } from 'react';
import type { ChaseTodayItem } from '../../types';
import { api } from '../../services/api';
import {
  MessageSquare,
  AlertCircle,
  ExternalLink,
  Sparkles,
  CheckCircle,
  Clock,
  ShieldCheck,
  Send,
  X,
} from 'lucide-react';

interface ChaseTodayViewProps {
  items: ChaseTodayItem[];
  currencySymbol: string;
  onRefresh: () => void;
  selectedInvoiceId?: string;
}

export const ChaseTodayView: React.FC<ChaseTodayViewProps> = ({
  items,
  currencySymbol,
  onRefresh,
  selectedInvoiceId,
}) => {
  const [activeItem, setActiveItem] = useState<ChaseTodayItem | null>(() => {
    if (selectedInvoiceId) {
      return items.find((it) => it.invoice_id === selectedInvoiceId) || null;
    }
    return null;
  });

  const [tone, setTone] = useState<'friendly' | 'neutral' | 'firm' | 'urgent'>('friendly');
  const [useAi, setUseAi] = useState(true);
  const [customNote, setCustomNote] = useState('');
  const [draftedText, setDraftedText] = useState<string>('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [ownerConfirmed, setOwnerConfirmed] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [openingWa, setOpeningWa] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOpenDraftModal = async (item: ChaseTodayItem) => {
    setActiveItem(item);
    setTone(item.default_tone as any || 'friendly');
    setOwnerConfirmed(false);
    setError(null);
    setSuccessNotice(null);
    setLoadingDraft(true);

    try {
      const res = await api.draftReminder({
        invoice_id: item.invoice_id,
        tone: item.default_tone || 'friendly',
        use_ai: true,
      });
      setDraftedText(res.draft.text);
      setDraftId(res.draft.id);
    } catch (err: any) {
      setError(err.message || 'Failed to draft reminder');
    } finally {
      setLoadingDraft(false);
    }
  };

  const handleRegenerateDraft = async (newTone: 'friendly' | 'neutral' | 'firm' | 'urgent') => {
    if (!activeItem) return;
    setTone(newTone);
    setLoadingDraft(true);
    setError(null);

    try {
      const res = await api.draftReminder({
        invoice_id: activeItem.invoice_id,
        tone: newTone,
        use_ai: useAi,
        custom_note: customNote,
      });
      setDraftedText(res.draft.text);
      setDraftId(res.draft.id);
    } catch (err: any) {
      setError(err.message || 'Failed to generate reminder');
    } finally {
      setLoadingDraft(false);
    }
  };

  const handleOpenInWhatsApp = async () => {
    if (!draftId) return;
    if (!ownerConfirmed) {
      setError('Please review and check the confirmation box before opening WhatsApp.');
      return;
    }
    setOpeningWa(true);
    setError(null);

    try {
      // Calls server to validate phone, check invoice is not paid, record confirmation, and return wa.me URL
      const res = await api.openReminderLink(draftId, true);
      // Open wa.me link in new tab
      window.open(res.url, '_blank');
      setSuccessNotice('Opened in WhatsApp! You can now send it directly from your WhatsApp chat.');
      setTimeout(() => {
        setActiveItem(null);
        onRefresh();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Could not open WhatsApp link');
    } finally {
      setOpeningWa(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>⚡ Chase Today Queue</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Overdue invoices ranked by Priority Score (Amount Owed × Days Overdue). Ties ordered by older due date.
          </p>
        </div>
        <div className="badge badge-amber" style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
          {items.length} Invoices to Follow Up
        </div>
      </div>

      {items.length === 0 ? (
        <div className="bento-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <CheckCircle size={44} color="var(--brand-emerald)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>Chase Queue is Clean!</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            No overdue invoices waiting. All tutoring families have paid or are within their payment terms.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.map((it, idx) => {
            const amount = it.remaining_minor / 100;
            return (
              <div
                key={it.invoice_id}
                className="bento-card mobile-stack"
                style={{
                  padding: '18px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                  borderLeft: idx === 0 ? '4px solid var(--brand-rose)' : idx < 3 ? '4px solid var(--brand-amber)' : '4px solid var(--brand-primary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '240px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: 'var(--bg-surface-subtle)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                      color: idx === 0 ? 'var(--brand-rose)' : 'var(--text-secondary)',
                      flexShrink: 0,
                    }}
                  >
                    #{idx + 1}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>{it.family_name}</span>
                      <span className="badge badge-rose">{it.days_overdue} days late</span>
                      {it.thin_history && <span className="badge badge-indigo">Thin History</span>}
                    </div>

                    <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span>Phone: <strong style={{ color: 'var(--text-secondary)' }}>{it.phone_masked}</strong></span>
                      <span>Due: {it.due_date}</span>
                      <span>Score: {it.priority_score.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                <div className="mobile-stack mobile-full-width" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ textAlign: 'right' }} className="mobile-full-width">
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {currencySymbol}
                      {amount.toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Outstanding</div>
                  </div>

                  <button className="btn-whatsapp mobile-full-width" onClick={() => handleOpenDraftModal(it)}>
                    <MessageSquare size={16} />
                    Chase on WhatsApp
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review & Send Modal */}
      {activeItem && (
        <div className="modal-backdrop">
          <div className="bento-card" style={{ maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <MessageSquare size={22} color="var(--brand-emerald)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>Review WhatsApp Reminder</h3>
              </div>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                onClick={() => setActiveItem(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ background: 'var(--bg-surface-subtle)', border: '1px solid var(--border-color)', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Recipient:</span>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{activeItem.family_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Amount Owed:</span>
                <span style={{ fontWeight: 700, color: 'var(--brand-emerald)' }}>
                  {currencySymbol}
                  {(activeItem.remaining_minor / 100).toLocaleString('en-IN')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Days Overdue:</span>
                <span style={{ fontWeight: 700, color: 'var(--brand-rose)' }}>{activeItem.days_overdue} days</span>
              </div>
            </div>

            {/* Tone Selector */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Select Reminder Tone:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {(['friendly', 'neutral', 'firm', 'urgent'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    style={{
                      padding: '8px 4px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'capitalize',
                      border: tone === t ? '2px solid var(--brand-primary)' : '1px solid var(--border-color)',
                      background: tone === t ? 'var(--brand-primary-light)' : 'var(--bg-surface-subtle)',
                      color: tone === t ? 'var(--brand-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleRegenerateDraft(t)}
                  >
                    {t === 'friendly' && '😊 '}
                    {t === 'neutral' && '🤝 '}
                    {t === 'firm' && '⚠️ '}
                    {t === 'urgent' && '🚨 '}
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Drafted Message preview */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Proposed Message (Plain text for WhatsApp):
                </label>
                <span style={{ fontSize: '0.75rem', color: draftedText.length > 500 ? 'var(--brand-rose)' : 'var(--text-muted)' }}>
                  {draftedText.length}/500 chars
                </span>
              </div>
              <textarea
                className="input-field"
                rows={4}
                value={draftedText}
                onChange={(e) => setDraftedText(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', lineHeight: '1.4' }}
                disabled={loadingDraft}
              />
            </div>

            {/* Confirmation Gate (FR-025: strictly never auto-sent) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px',
                background: 'var(--brand-emerald-light)',
                border: '1px solid var(--brand-emerald-border)',
                borderRadius: '8px',
                marginBottom: '16px',
              }}
            >
              <input
                type="checkbox"
                id="confirmSend"
                checked={ownerConfirmed}
                onChange={(e) => setOwnerConfirmed(e.target.checked)}
                style={{ marginTop: '3px', cursor: 'pointer' }}
              />
              <label htmlFor="confirmSend" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <strong>I have reviewed this reminder.</strong> Nothing is sent automatically; this button will open my
                WhatsApp with the text pre-filled so I can press send myself.
              </label>
            </div>

            {error && (
              <div style={{ padding: '8px 12px', background: 'var(--brand-rose-light)', border: '1px solid var(--brand-rose-border)', color: 'var(--brand-rose)', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '12px' }}>
                {error}
              </div>
            )}
            {successNotice && (
              <div style={{ padding: '8px 12px', background: 'var(--brand-emerald-light)', border: '1px solid var(--brand-emerald-border)', color: 'var(--brand-emerald)', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '12px' }}>
                {successNotice}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }} className="mobile-stack">
              <button className="btn-secondary mobile-full-width" onClick={() => setActiveItem(null)}>
                Cancel
              </button>
              <button
                className="btn-whatsapp mobile-full-width"
                onClick={handleOpenInWhatsApp}
                disabled={!ownerConfirmed || openingWa || loadingDraft}
              >
                <ExternalLink size={16} />
                {openingWa ? 'Opening WhatsApp...' : 'Open in WhatsApp & Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
