import React, { useState } from 'react';
import type { Invoice, Family } from '../../types';
import { api } from '../../services/api';
import { Plus, Check, CheckCircle2, DollarSign, Calendar, AlertCircle, Ban, CreditCard, X } from 'lucide-react';

interface InvoicesViewProps {
  invoices: Invoice[];
  families: Family[];
  currencySymbol: string;
  onRefresh: () => void;
  presetFamilyId?: string;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  invoices,
  families,
  currencySymbol,
  onRefresh,
  presetFamilyId,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(Boolean(presetFamilyId));
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>(presetFamilyId || families[0]?.id || '');
  const [creating, setCreating] = useState(false);

  // Pay modal
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [isFullPay, setIsFullPay] = useState(true);
  const [recordingPay, setRecordingPay] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Quick 1-step invoice create from family defaults (FR-016)
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFamilyId) return;
    setCreating(true);
    setError(null);

    try {
      await api.createInvoice({
        family_id: selectedFamilyId,
        client_event_id: crypto.randomUUID(),
      });
      setShowCreateModal(false);
      onRefresh();
      setNotice('Invoice created in 1 step using family defaults!');
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create invoice');
    } finally {
      setCreating(false);
    }
  };

  // 2-tap payment marking (FR-017, FR-018)
  const handleQuickPayFull = async (inv: Invoice) => {
    const remaining = inv.remaining_minor ?? inv.amount_minor;
    try {
      await api.recordPayment(inv.id, {
        amount_minor: remaining,
        date_received: new Date().toISOString().slice(0, 10),
        client_event_id: crypto.randomUUID(),
        source: 'owner_entry',
      });
      onRefresh();
      setNotice(`Invoice for ${inv.family_name || 'Family'} marked as paid in full in 2 taps!`);
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      alert(`Payment error: ${err.message}`);
    }
  };

  const handleOpenPartialPayModal = (inv: Invoice) => {
    setPayingInvoice(inv);
    const rem = (inv.remaining_minor ?? inv.amount_minor) / 100;
    setPayAmount(String(rem));
    setIsFullPay(true);
  };

  const handleRecordCustomPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice) return;
    setRecordingPay(true);

    try {
      const amountMinor = Math.round(parseFloat(payAmount) * 100);
      await api.recordPayment(payingInvoice.id, {
        amount_minor: amountMinor,
        date_received: new Date().toISOString().slice(0, 10),
        client_event_id: crypto.randomUUID(),
        source: 'owner_entry',
      });
      setPayingInvoice(null);
      onRefresh();
      setNotice('Payment recorded into ledger!');
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Payment recording failed');
    } finally {
      setRecordingPay(false);
    }
  };

  const selectedFamily = families.find((f) => f.id === selectedFamilyId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>📝 Invoices & Payments</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Create an invoice in 1 confirmation step using saved family defaults. Mark paid in full or partial in 2 taps (FR-016..FR-018).
          </p>
        </div>

        <button className="btn-primary mobile-full-width" onClick={() => setShowCreateModal(true)}>
          <Plus size={16} />
          Create Invoice
        </button>
      </div>

      {notice && (
        <div style={{ padding: '10px 14px', background: 'var(--brand-emerald-light)', border: '1px solid var(--brand-emerald-border)', color: 'var(--brand-emerald)', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600 }}>
          {notice}
        </div>
      )}

      {/* Invoice List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {invoices.length === 0 ? (
          <div className="bento-card" style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ color: 'var(--text-muted)' }}>No invoices created yet. Click "Create Invoice" to issue one using family defaults.</p>
          </div>
        ) : (
          invoices.map((inv) => {
            const total = inv.amount_minor / 100;
            const remaining = (inv.remaining_minor ?? inv.amount_minor) / 100;
            const isPaid = inv.status === 'paid';
            const isPartial = inv.status === 'partially-paid';

            return (
              <div
                key={inv.id}
                className="bento-card mobile-stack"
                style={{
                  padding: '18px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div style={{ flex: 1, minWidth: '240px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                      {inv.family_name || 'Tutoring Family'}
                    </span>
                    <span className={`badge ${isPaid ? 'badge-emerald' : isPartial ? 'badge-amber' : 'badge-rose'}`}>
                      {inv.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '14px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', flexWrap: 'wrap' }}>
                    <span>Issue: {inv.issue_date}</span>
                    <span>Due: {inv.due_date}</span>
                    <span>Total: {currencySymbol}{total.toLocaleString('en-IN')}</span>
                    {isPartial && <span style={{ color: 'var(--brand-amber)', fontWeight: 700 }}>Remaining: {currencySymbol}{remaining.toLocaleString('en-IN')}</span>}
                  </div>
                </div>

                <div className="mobile-stack mobile-full-width" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ textAlign: 'right' }} className="mobile-full-width">
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: isPaid ? 'var(--brand-emerald)' : 'var(--text-main)' }}>
                      {currencySymbol}
                      {remaining.toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isPaid ? 'Paid in Full' : 'Due'}</div>
                  </div>

                  {!isPaid && (
                    <div style={{ display: 'flex', gap: '8px' }} className="mobile-full-width">
                      <button className="btn-primary mobile-full-width" onClick={() => handleQuickPayFull(inv)} title="Mark Paid in Full in 1 tap">
                        <Check size={14} />
                        Mark Paid (2 Taps)
                      </button>
                      <button className="btn-secondary mobile-full-width" onClick={() => handleOpenPartialPayModal(inv)} title="Record partial payment">
                        <CreditCard size={14} />
                        Partial
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 1-Step Invoice Creation Modal (FR-016) */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="bento-card" style={{ maxWidth: '440px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>Create Invoice in 1 Confirmation</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }} onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Select a family. The invoice fee and payment term are automatically pre-filled from that family's saved defaults.
            </p>

            <form onSubmit={handleCreateInvoice} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Select Family
                </label>
                <select
                  className="input-field"
                  value={selectedFamilyId}
                  onChange={(e) => setSelectedFamilyId(e.target.value)}
                  required
                >
                  {families.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({currencySymbol}{(f.default_fee_minor / 100).toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>

              {selectedFamily && (
                <div style={{ background: 'var(--bg-surface-subtle)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '10px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                    <span>Default Fee:</span>
                    <strong style={{ color: 'var(--brand-emerald)' }}>{currencySymbol}{(selectedFamily.default_fee_minor / 100).toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <span>Payment Term:</span>
                    <strong style={{ color: 'var(--text-main)' }}>{selectedFamily.default_term_days} days</strong>
                  </div>
                </div>
              )}

              {error && <div style={{ color: 'var(--brand-rose)', fontSize: '0.8rem', background: 'var(--brand-rose-light)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--brand-rose-border)' }}>{error}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }} className="mobile-stack">
                <button type="button" className="btn-secondary mobile-full-width" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary mobile-full-width" disabled={creating}>
                  {creating ? 'Creating...' : 'Confirm & Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Partial / Custom Payment Modal */}
      {payingInvoice && (
        <div className="modal-backdrop">
          <div className="bento-card" style={{ maxWidth: '420px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '10px' }}>
              Record Payment
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              For {payingInvoice.family_name || 'Family'}. Remaining due: {currencySymbol}{((payingInvoice.remaining_minor ?? payingInvoice.amount_minor) / 100).toLocaleString('en-IN')}.
            </p>

            <form onSubmit={handleRecordCustomPayment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Payment Amount ({currencySymbol})
                </label>
                <input
                  type="number"
                  className="input-field"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  step="any"
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }} className="mobile-stack">
                <button type="button" className="btn-secondary mobile-full-width" onClick={() => setPayingInvoice(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary mobile-full-width" disabled={recordingPay}>
                  {recordingPay ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
