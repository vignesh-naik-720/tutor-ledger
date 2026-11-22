import React, { useState } from 'react';
import type { LedgerSettings, RecurringBill, OneOffExpense, OwnerProfile } from '../../types';
import { api } from '../../services/api';
import { Settings, Shield, Plus, Download, Trash2, RefreshCw, CheckCircle2, User } from 'lucide-react';

interface SettingsViewProps {
  settings: LedgerSettings | null;
  bills: RecurringBill[];
  expenses: OneOffExpense[];
  currencySymbol: string;
  onRefresh: () => void;
  owner?: OwnerProfile | null;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  bills,
  expenses,
  currencySymbol,
  onRefresh,
  owner,
}) => {
  const [minBalance, setMinBalance] = useState<string>(
    settings ? String(settings.minimum_balance_minor / 100) : '10000',
  );
  const [savingMin, setSavingMin] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // New Bill state
  const [showBillModal, setShowBillModal] = useState(false);
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('12000');
  const [billDueDate, setBillDueDate] = useState(new Date().toISOString().slice(0, 10));

  const handleUpdateMinBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMin(true);
    try {
      await api.updateMinimumBalance(parseInt(minBalance, 10) * 100);
      setNotice('Safety cushion updated! Cash alerts re-evaluated.');
      onRefresh();
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      alert(`Error updating balance: ${err.message}`);
    } finally {
      setSavingMin(false);
    }
  };

  const handleLoadSampleData = async () => {
    if (!window.confirm('Load sample data (12 families, 2 recurring bill cycles, and Week 7 cash dip)?')) return;
    setSampleLoading(true);
    try {
      await api.loadSampleData();
      setNotice('12 Sample families loaded successfully!');
      onRefresh();
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSampleLoading(false);
    }
  };

  const handleRemoveSampleData = async () => {
    if (!window.confirm('Remove sample data? Your own manually added families and invoices will remain intact.')) return;
    setSampleLoading(true);
    try {
      await api.removeSampleData();
      setNotice('Sample records removed.');
      onRefresh();
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSampleLoading(false);
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/v1/export', { credentials: 'include' });
      if (!res.ok) throw new Error('Export request failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tutor_ledger_export_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createBill({
        name: billName,
        amount_minor: parseInt(billAmount, 10) * 100,
        next_due_date: billDueDate,
      });
      setShowBillModal(false);
      setBillName('');
      onRefresh();
    } catch (err: any) {
      alert(`Error adding bill: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>⚙️ Settings & Ledger Configuration</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Configure your safety cushion threshold, recurring monthly expenses, sample dataset, and full ledger export.
        </p>
      </div>

      {notice && (
        <div style={{ padding: '10px 14px', background: 'var(--badge-emerald-bg)', color: 'var(--badge-emerald-text)', border: '1px solid rgba(5, 150, 105, 0.2)', borderRadius: '8px', fontSize: '0.85rem' }}>
          {notice}
        </div>
      )}

      {/* Tutor Profile Card */}
      {owner && (
        <div className="bento-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'var(--brand-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '1.1rem',
              }}
            >
              {owner.name ? owner.name.slice(0, 1).toUpperCase() : 'T'}
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{owner.name}</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tutor Profile & Authentication</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>Registered Email</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: '2px', wordBreak: 'break-all' }}>{owner.email}</div>
            </div>
            {owner.dob && (
              <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>Date of Birth</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: '2px' }}>{owner.dob}</div>
              </div>
            )}
            <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>Ledger Currency</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: '2px' }}>{settings?.currency_code || 'INR'} ({currencySymbol})</div>
            </div>
          </div>
        </div>
      )}

      {/* Minimum Safety Cushion Settings */}
      <div className="bento-card">
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px' }}>Minimum Safety Cushion</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          The minimum bank reserve you want to maintain. When the 13-week forecast dips below this amount, smart cash alerts trigger.
        </p>

        <form onSubmit={handleUpdateMinBalance} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ maxWidth: '240px', width: '100%' }}>
            <input
              type="number"
              className="input-field"
              value={minBalance}
              onChange={(e) => setMinBalance(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={savingMin}>
            {savingMin ? 'Updating...' : 'Save Cushion Threshold'}
          </button>
        </form>
      </div>

      {/* Recurring Monthly Bills */}
      <div className="bento-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Recurring Monthly Bills</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tuition room rent, broadband, teaching software, etc.</p>
          </div>
          <button className="btn-secondary" onClick={() => setShowBillModal(true)}>
            <Plus size={16} />
            Add Recurring Bill
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {bills.map((b) => (
            <div
              key={b.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'var(--card-bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '0.875rem',
              }}
            >
              <div>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{b.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '10px' }}>Next due: {b.next_due_date}</span>
              </div>
              <strong style={{ color: 'var(--brand-rose)' }}>
                -{currencySymbol}{(b.amount_minor / 100).toLocaleString('en-IN')}/mo
              </strong>
            </div>
          ))}
        </div>
      </div>

      {/* Sample Data & Full Export */}
      <div className="bento-card">
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px' }}>Sample Dataset & Backup</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Instantly load realistic sample data (12 families, bills, week 7 cash dip) or download a full backup.
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }} className="mobile-stack">
          <button className="btn-secondary mobile-full-width" onClick={handleLoadSampleData} disabled={sampleLoading}>
            <RefreshCw size={16} />
            {sampleLoading ? 'Processing...' : 'Load 12 Families Sample Data (FR-014)'}
          </button>
          <button className="btn-secondary mobile-full-width" style={{ color: 'var(--brand-rose)', borderColor: 'rgba(225, 29, 72, 0.25)' }} onClick={handleRemoveSampleData} disabled={sampleLoading}>
            <Trash2 size={16} />
            Remove Sample Data Only
          </button>
          <button className="btn-primary mobile-full-width" onClick={handleExportData} disabled={exporting}>
            <Download size={16} />
            {exporting ? 'Exporting...' : 'Export Full Ledger (JSON)'}
          </button>
        </div>
      </div>

      {/* Bill Add Modal */}
      {showBillModal && (
        <div className="modal-backdrop">
          <div className="bento-card" style={{ maxWidth: '420px', width: '100%' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '12px' }}>Add Recurring Monthly Bill</h3>
            <form onSubmit={handleAddBill} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Bill Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={billName}
                  onChange={(e) => setBillName(e.target.value)}
                  placeholder="e.g. Tuition Space Rent"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Amount ({currencySymbol}/mo)
                </label>
                <input
                  type="number"
                  className="input-field"
                  value={billAmount}
                  onChange={(e) => setBillAmount(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Next Due Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={billDueDate}
                  onChange={(e) => setBillDueDate(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowBillModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
