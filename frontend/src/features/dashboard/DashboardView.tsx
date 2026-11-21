import React from 'react';
import type { AppAlert, CashFlowInsight, WhoOwesResponse } from '../../types';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  DollarSign,
  MessageSquare,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

interface DashboardViewProps {
  whoOwes: WhoOwesResponse | null;
  alerts: AppAlert[];
  cashFlowInsights: CashFlowInsight | null;
  onNavigate: (tab: string, targetId?: string) => void;
  currencySymbol: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  whoOwes,
  alerts,
  cashFlowInsights,
  onNavigate,
  currencySymbol,
}) => {
  const totalOutstanding = whoOwes ? whoOwes.total_outstanding_minor / 100 : 0;
  const familiesOwingCount = whoOwes ? whoOwes.families_owing_count : 0;
  const avgDelay = whoOwes ? whoOwes.average_days_to_pay : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner Greeting */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(99, 102, 241, 0.12) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: '16px',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className="badge badge-emerald">Active Ledger</span>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Today: {new Date().toLocaleDateString('en-IN', { dateStyle: 'full' })}</span>
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff' }}>
            Good day, Tutor! Here is your money overview.
          </h1>
          <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '4px' }}>
            Turn today's cash follow-ups into 3 simple WhatsApp taps.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn-primary"
            onClick={() => onNavigate('chase')}
            style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
          >
            <Zap size={16} />
            Chase Today ({familiesOwingCount})
          </button>
          <button className="btn-secondary" onClick={() => onNavigate('ai')}>
            <Sparkles size={16} color="#34d399" />
            Paste WhatsApp Message
          </button>
        </div>
      </div>

      {/* 4 Key Metrics Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
            <span>TOTAL OWED TO YOU</span>
            <DollarSign size={18} color="#34d399" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f8fafc', marginTop: '8px' }}>
            {currencySymbol}
            {totalOutstanding.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#34d399', marginTop: '4px' }}>
            Across {familiesOwingCount} families with open balances
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
            <span>AVG. PAYMENT DELAY</span>
            <Clock size={18} color="#fbbf24" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f8fafc', marginTop: '8px' }}>
            {avgDelay} days
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
            Historical average time parents take to pay
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
            <span>OVERDUE INVOICES</span>
            <AlertTriangle size={18} color="#f43f5e" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fb7185', marginTop: '8px' }}>
            {alerts.filter((a) => a.rule === 'INVOICE_OVERDUE').length} Invoices
          </div>
          <div style={{ fontSize: '0.8rem', color: '#f43f5e', marginTop: '4px' }}>
            Ready to chase with 1-click WhatsApp text
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
            <span>13-WEEK CASH DIP</span>
            <TrendingDown size={18} color="#818cf8" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#818cf8', marginTop: '8px' }}>
            Week 7
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
            Rent & lab kit printout expenses coincide
          </div>
        </div>
      </div>

      {/* Smart Alerts Section (Rule-based, max 3/week, single-action buttons per FR-039..FR-041) */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={20} color="#f59e0b" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Smart Action Alerts (Rule-Based)</h2>
            <span className="badge badge-amber">Capped at 3/week</span>
          </div>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Each alert has exactly one next action</span>
        </div>

        {alerts.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
            <CheckCircle2 size={32} color="#10b981" style={{ margin: '0 auto 8px' }} />
            No urgent alerts right now! All payments and cash buffers are on schedule.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {alerts.map((al) => {
              const isCash = al.rule === 'CASH_BELOW_MINIMUM';
              return (
                <div
                  key={al.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderRadius: '12px',
                    background: isCash ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                    border: `1px solid ${isCash ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        padding: '10px',
                        borderRadius: '10px',
                        background: isCash ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      }}
                    >
                      {isCash ? <TrendingDown size={22} color="#f87171" /> : <AlertTriangle size={22} color="#fbbf24" />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc' }}>{al.title}</div>
                      <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '2px' }}>{al.message}</div>
                    </div>
                  </div>

                  <button
                    className="btn-primary"
                    style={{
                      background: isCash
                        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                        : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      fontSize: '0.8rem',
                      padding: '8px 16px',
                    }}
                    onClick={() => {
                      if (al.action === 'OPEN_REMINDER') onNavigate('chase', al.action_target_id);
                      else if (al.action === 'OPEN_SCENARIO') onNavigate('scenarios');
                      else onNavigate('chase');
                    }}
                  >
                    {al.action_label}
                    <ArrowRight size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI Financial Copilot Insight Box */}
      {cashFlowInsights && (
        <div
          className="glass-card"
          style={{
            border: '1px solid rgba(99, 102, 241, 0.3)',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(30, 27, 75, 0.4) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <Sparkles size={20} color="#818cf8" />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
              AI Financial Copilot • Advice for Home Tutors
            </h2>
            <span className="badge badge-indigo">Tutor Intelligence</span>
          </div>

          <p style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.6', marginBottom: '16px' }}>
            {cashFlowInsights.summary}
          </p>

          <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '14px' }}>
            {cashFlowInsights.riskAnalysis}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase' }}>
              Recommended Next Steps Today:
            </div>
            {cashFlowInsights.actions.map((act, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.85rem',
                  color: '#e2e8f0',
                  padding: '6px 10px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '6px',
                }}
              >
                <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
                <span>{act}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
