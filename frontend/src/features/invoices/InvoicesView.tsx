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
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>📝 Invoices & Payments</h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Create an invoice in 1 confirmation step using saved family defaults. Mark paid in full or partial in 2 taps (FR-016..FR-018).
          </p>
        </div>

        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={16} />
          Create Invoice
        </button>
      </div>

      {notice && (
        <div style={{ padding: '10px 14px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', borderRadius: '8px', fontSize: '0.85rem' }}>
          {notice}
        </div>
      )}

      {/* Invoice List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {invoices.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ color: '#94a3b8' }}>No invoices created yet. Click "Create Invoice" to issue one using family defaults.</p>
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
                className="glass-card"
                style={{
                  padding: '18px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#f8fafc' }}>
                      {inv.family_name || 'Tutoring Family'}
                    </span>
                    <span className={`badge ${isPaid ? 'badge-emerald' : isPartial ? 'badge-amber' : 'badge-rose'}`}>
                      {inv.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '14px', fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
                    <span>Issue: {inv.issue_date}</span>
                    <span>Due: {inv.due_date}</span>
                    <span>Total: {currencySymbol}{total.toLocaleString('en-IN')}</span>
                    {isPartial && <span style={{ color: '#fbbf24' }}>Remaining: {currencySymbol}{remaining.toLocaleString('en-IN')}</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: isPaid ? '#34d399' : '#f8fafc' }}>
                      {currencySymbol}
                      {remaining.toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{isPaid ? 'Paid in Full' : 'Due'}</div>
                  </div>

                  {!isPaid && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn-primary" onClick={() => handleQuickPayFull(inv)} title="Mark Paid in Full in 1 tap">
                        <Check size={14} />
                        Mark Paid (2 Taps)
                      </button>
                      <button className="btn-secondary" onClick={() => handleOpenPartialPayModal(inv)} title="Record partial payment">
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
          <div className="glass-card" style={{ maxWidth: '440px', width: '100%', border: '1px solid #10b981' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Create Invoice in 1 Confirmation</h3>
              <button style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }} onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '16px' }}>
              Select a family. The invoice fee and payment term are automatically pre-filled from that family's saved defaults.
            </p>

            <form onSubmit={handleCreateInvoice} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
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
                <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                    <span>Default Fee:</span>
                    <strong style={{ color: '#34d399' }}>{currencySymbol}{(selectedFamily.default_fee_minor / 100).toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', marginTop: '4px' }}>
                    <span>Payment Term:</span>
                    <strong style={{ color: '#f8fafc' }}>{selectedFamily.default_term_days} days</strong>
                  </div>
                </div>
              )}

              {error && <div style={{ color: '#f87171', fontSize: '0.8rem' }}>{error}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={creating}>
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
          <div className="glass-card" style={{ maxWidth: '420px', width: '100%' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '10px' }}>
              Record Payment
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '14px' }}>
              For {payingInvoice.family_name || 'Family'}. Remaining due: {currencySymbol}{((payingInvoice.remaining_minor ?? payingInvoice.amount_minor) / 100).toLocaleString('en-IN')}.
            </p>

            <form onSubmit={handleRecordCustomPayment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="btn-secondary" onClick={() => setPayingInvoice(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={recordingPay}>
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
