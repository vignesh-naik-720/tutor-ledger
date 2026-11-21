import React, { useState } from 'react';
import type { Family } from '../../types';
import { api } from '../../services/api';
import { Users, Plus, Phone, Trash2, CheckCircle2, X } from 'lucide-react';

interface FamiliesViewProps {
  families: Family[];
  currencySymbol: string;
  onRefresh: () => void;
}

export const FamiliesView: React.FC<FamiliesViewProps> = ({ families, currencySymbol, onRefresh }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+919876543210');
  const [fee, setFee] = useState('4500');
  const [termDays, setTermDays] = useState('7');
  const [tone, setTone] = useState<'friendly' | 'neutral' | 'firm'>('friendly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.createFamily({
        name,
        phone,
        default_fee_minor: parseInt(fee, 10) * 100,
        default_term_days: parseInt(termDays, 10),
        default_tone: tone,
      });
      setShowAddModal(false);
      setName('');
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to add family');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (family: Family) => {
    if (!window.confirm(`Permanently delete ${family.name} and all associated records?`)) return;
    try {
      await api.deleteFamily(family.id);
      onRefresh();
    } catch (err: any) {
      alert(`Error deleting family: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>👨‍👩‍👧‍👦 Tutoring Families</h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Store essential details (name, phone, default fee, term days, preferred reminder tone). Personal data is encrypted at rest (FR-004, FR-008).
          </p>
        </div>

        <button className="btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={16} />
          Add Family
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {families.map((f) => (
          <div key={f.id} className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <span className="badge badge-emerald">{f.default_tone}</span>
                <button
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                  onClick={() => handleDelete(f)}
                  title="Permanently Delete Family"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
                {f.name}
              </h3>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <Phone size={13} />
                <span>{f.phone_masked}</span>
              </div>

              <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '10px 12px', borderRadius: '8px', fontSize: '0.825rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#94a3b8' }}>Default Fee:</span>
                  <strong>{currencySymbol}{(f.default_fee_minor / 100).toLocaleString('en-IN')}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#94a3b8' }}>Payment Term:</span>
                  <strong>{f.default_term_days} days</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Payment Delay:</span>
                  <span>{f.avg_delay_days !== null ? `${Math.round(f.avg_delay_days)} days` : 'No history yet'}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="modal-backdrop">
          <div className="glass-card" style={{ maxWidth: '440px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Add New Family</h3>
              <button style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }} onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddFamily} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  Family / Student Name
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sharma Family (Aryan - 10th Maths)"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  Phone Number (with Country Code, E.164)
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+919876543210"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                    Fee ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                    Term (Days)
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    value={termDays}
                    onChange={(e) => setTermDays(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  Default Reminder Tone
                </label>
                <select className="input-field" value={tone} onChange={(e) => setTone(e.target.value as any)}>
                  <option value="friendly">Friendly 😊</option>
                  <option value="neutral">Professional 🤝</option>
                  <option value="firm">Firm ⚠️</option>
                </select>
              </div>

              {error && <div style={{ color: '#f87171', fontSize: '0.8rem' }}>{error}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Add Family'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
