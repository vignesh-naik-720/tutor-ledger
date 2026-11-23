import React, { useState } from 'react';
import type { AppAlert, CashFlowInsight, WhoOwesResponse, ForecastResponse, ChaseTodayItem, ForecastPoint } from '../../types';
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
  ShieldAlert,
  ChevronRight,
  Send,
  Calendar,
  Smartphone,
} from 'lucide-react';

interface DashboardViewProps {
  whoOwes: WhoOwesResponse | null;
  alerts: AppAlert[];
  cashFlowInsights: CashFlowInsight | null;
  forecast?: ForecastResponse | null;
  chaseItems?: ChaseTodayItem[];
  onNavigate: (tab: string, targetId?: string) => void;
  currencySymbol: string;
  onRefresh?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  whoOwes,
  alerts,
  cashFlowInsights,
  forecast,
  chaseItems = [],
  onNavigate,
  currencySymbol,
  onRefresh,
}) => {
  const totalOutstanding = whoOwes ? whoOwes.total_outstanding_minor / 100 : 0;
  const familiesOwingCount = whoOwes ? whoOwes.families_owing_count : 0;
  const avgDelay = whoOwes ? whoOwes.average_days_to_pay : 0;

  // 13-week runway metrics
  const weeks: ForecastPoint[] = forecast?.baseline?.weeks || [];
  const lowestWeek = weeks.find((w) => w.weekIndex === forecast?.baseline?.lowestCashWeekIndex) || weeks[0];
  const dipWeek = weeks.find((w) => w.belowMinimum);
  const currentWeekBal = weeks[0]?.closingBalanceMinor ? weeks[0].closingBalanceMinor / 100 : 42000;
  const lowestBal = lowestWeek ? lowestWeek.closingBalanceMinor / 100 : 18500;
  const maxBal = Math.max(...weeks.map((w) => w.closingBalanceMinor / 100), 50000);

  // Compute receivables aging from families
  const families = whoOwes?.families || [];
  const agingCurrent = families
    .filter((f) => f.days_oldest_overdue <= 30)
    .reduce((sum, f) => sum + f.outstanding_minor, 0) / 100;
  const aging30_60 = families
    .filter((f) => f.days_oldest_overdue > 30 && f.days_oldest_overdue <= 60)
    .reduce((sum, f) => sum + f.outstanding_minor, 0) / 100;
  const aging60_90 = families
    .filter((f) => f.days_oldest_overdue > 60 && f.days_oldest_overdue <= 90)
    .reduce((sum, f) => sum + f.outstanding_minor, 0) / 100;
  const aging90Plus = families
    .filter((f) => f.days_oldest_overdue > 90)
    .reduce((sum, f) => sum + f.outstanding_minor, 0) / 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* =========================================================================
          BENTO ROW 1: PRIMARY ACTIONS & HERO STATUS
          ========================================================================= */}
      <div className="bento-grid">
        {/* Bento 1 (Hero Primary: 7 cols) — Urgent Overdue & WhatsApp Chase Action */}
        <div
          className="bento-card"
          style={{
            gridColumn: 'span 7',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'var(--bg-card)',
            borderLeft: '4px solid var(--brand-primary)',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div className="bento-label" style={{ color: 'var(--brand-primary)' }}>
                <Zap size={14} />
                Chase Today • Urgent Priority
              </div>
              <span className="badge badge-amber" style={{ fontSize: '0.7rem' }}>
                {familiesOwingCount} Families Pending
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '6px' }}>
              <span style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.03em' }}>
                {currencySymbol}
                {totalOutstanding.toLocaleString('en-IN')}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>overdue to you</span>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 }}>
              Parents are delayed by an average of <strong>{avgDelay} days</strong>. Send polite, relationship-preserving
              WhatsApp reminders in 1 click without awkward friction.
            </p>

            {/* Quick Chase Chips */}
            {chaseItems.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                {chaseItems.slice(0, 3).map((item) => (
                  <div
                    key={item.invoice_id}
                    onClick={() => onNavigate('chase', item.invoice_id)}
                    style={{
                      background: 'var(--bg-surface-subtle)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.family_name}</span>
                    <span style={{ color: 'var(--brand-amber)', fontWeight: 700 }}>
                      {currencySymbol}
                      {(item.remaining_minor / 100).toLocaleString('en-IN')}
                    </span>
                    <ChevronRight size={12} color="var(--text-dim)" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button className="btn-primary" onClick={() => onNavigate('chase')}>
              <Send size={15} />
              Open Chase Today Queue ({familiesOwingCount})
            </button>
            <button className="btn-secondary" onClick={() => onNavigate('who_owes')}>
              <Users size={15} />
              View Aging Report
            </button>
          </div>
        </div>

        {/* Bento 2 (Hero Secondary: 5 cols) — 13-Week Cash Health & Runway */}
        <div
          className="bento-card"
          style={{
            gridColumn: 'span 5',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div className="bento-label">
                <TrendingUp size={14} color="var(--brand-sky)" />
                13-Week Cash Runway
              </div>
              {dipWeek ? (
                <span className="badge badge-amber" style={{ fontSize: '0.7rem' }}>
                  ⚠️ Dip in Week {dipWeek.weekIndex}
                </span>
              ) : (
                <span className="badge badge-emerald" style={{ fontSize: '0.7rem' }}>
                  Buffer Safe
                </span>
              )}
            </div>

            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Current Projected Balance
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                {currencySymbol}
                {currentWeekBal.toLocaleString('en-IN')}
              </div>
            </div>

            <div
              style={{
                marginTop: '14px',
                padding: '10px 12px',
                borderRadius: '10px',
                background: dipWeek ? 'var(--brand-amber-light)' : 'var(--bg-surface-subtle)',
                border: `1px solid ${dipWeek ? 'var(--brand-amber-border)' : 'var(--border-color)'}`,
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.4,
              }}
            >
              {dipWeek ? (
                <span>
                  <strong>Upcoming Dip:</strong> Week {dipWeek.weekIndex} drops to{' '}
                  <strong style={{ color: 'var(--brand-amber)' }}>
                    {currencySymbol}
                    {lowestBal.toLocaleString('en-IN')}
                  </strong>{' '}
                  due to holiday schedule pause and rent expenses.
                </span>
              ) : (
                <span>Your cash reserves remain comfortably above your minimum safety buffer for all 13 weeks.</span>
              )}
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <button
              className="btn-secondary"
              style={{ width: '100%' }}
              onClick={() => onNavigate('forecast')}
            >
              <Calendar size={15} color="var(--brand-sky)" />
              Inspect 13-Week Forecast & Drilldown
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          BENTO ROW 2: 13-WEEK RUNWAY VISUALIZER (Wide 8 cols) & SMART ALERTS (4 cols)
          ========================================================================= */}
      <div className="bento-grid">
        {/* Bento 3 (Wide: 8 cols) — Mini 13-Week Cash Flow Bar Chart */}
        <div className="bento-card" style={{ gridColumn: 'span 8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <div className="bento-label">Deterministic 13-Week Cash Flow Trajectory</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Rolling Weekly Cash Runway
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--brand-primary)' }} />
                Normal Week
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--brand-amber)' }} />
                Holiday Dip
              </span>
            </div>
          </div>

          {/* Interactive Mini Bar Chart */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '8px',
              height: '140px',
              padding: '10px 0',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            {weeks.map((w: ForecastPoint) => {
              const bal = w.closingBalanceMinor / 100;
              const heightPct = Math.max(15, Math.min(100, (bal / maxBal) * 100));
              const isDip = w.belowMinimum;

              return (
                <div
                  key={w.weekIndex}
                  onClick={() => onNavigate('forecast')}
                  title={`Week ${w.weekIndex}: ${currencySymbol}${bal.toLocaleString('en-IN')}`}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'flex-end',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '36px',
                      height: `${heightPct}%`,
                      borderRadius: '6px 6px 2px 2px',
                      background: isDip ? 'var(--brand-amber)' : 'var(--brand-primary)',
                      opacity: isDip ? 0.95 : 0.85,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.opacity = '1';
                      (e.currentTarget as HTMLElement).style.transform = 'scaleY(1.04)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.opacity = isDip ? '0.95' : '0.85';
                      (e.currentTarget as HTMLElement).style.transform = 'scaleY(1)';
                    }}
                  />
                  <span
                    style={{
                      fontSize: '0.65rem',
                      color: isDip ? 'var(--brand-amber)' : 'var(--text-muted)',
                      fontWeight: isDip ? 700 : 500,
                      marginTop: '6px',
                    }}
                  >
                    W{w.weekIndex}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '12px',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
            }}
          >
            <span>Click any week column to drill down into line-item inflows and scheduled expenses.</span>
            <button
              onClick={() => onNavigate('scenarios')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--brand-primary)',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              Test What-If Scenarios <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Bento 4 (4 cols) — Capped Smart Alerts */}
        <div
          className="bento-card"
          style={{
            gridColumn: 'span 4',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div className="bento-label">
                <ShieldAlert size={14} color="var(--brand-amber)" />
                Smart Alerts (Max 3/Wk)
              </div>
              <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>
                Capped
              </span>
            </div>

            {alerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                <CheckCircle2 size={32} color="var(--brand-emerald)" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>All Caught Up</div>
                <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>No urgent risks detected this week.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {alerts.slice(0, 3).map((alert) => (
                  <div
                    key={alert.id}
                    style={{
                      background: 'var(--bg-surface-subtle)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={14} color="var(--brand-amber)" />
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {alert.title}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                      {alert.message}
                    </p>
                    {alert.action && (
                      <button
                        onClick={() =>
                          onNavigate(
                            alert.action === 'OPEN_CHASE_TODAY'
                              ? 'chase'
                              : alert.action === 'OPEN_SCENARIO'
                              ? 'scenarios'
                              : 'forecast',
                          )
                        }
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--brand-primary)',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          textAlign: 'left',
                          cursor: 'pointer',
                          paddingTop: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {alert.action_label || 'Take Action'} <ChevronRight size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              paddingTop: '12px',
              borderTop: '1px solid var(--border-color)',
              fontSize: '0.725rem',
              color: 'var(--text-dim)',
            }}
          >
            Strictly limited to 3 alerts per week with 1 single action to prevent notification fatigue.
          </div>
        </div>
      </div>

      {/* =========================================================================
          BENTO ROW 3: WHATSAPP BOT & BANK VERIFICATION (6 cols) & RECEIVABLES AGING (6 cols)
          ========================================================================= */}
      <div className="bento-grid">
        {/* Bento 5 (6 cols) — WhatsApp Bot & Bank Verification Hub */}
        <div className="bento-card" style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Smartphone size={16} color="var(--brand-primary)" />
                <div className="bento-label" style={{ margin: 0 }}>WhatsApp Bot & Verification</div>
              </div>
              <span className="badge badge-emerald" style={{ fontSize: '0.65rem' }}>
                ● Twilio Live
              </span>
            </div>

            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
              Direct WhatsApp Management
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.4 }}>
              Zero manual typing. When parents report fees on WhatsApp, the bot requests your 1-tap banking verification before updating ledger balances.
            </p>

            <div
              style={{
                background: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '0.775rem',
                color: 'var(--text-secondary)',
                marginBottom: '14px',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>
                💬 Interactive WhatsApp Butler:
              </div>
              <div>• Reply <strong>1</strong>: Confirm money in bank & auto-close invoice</div>
              <div>• Reply <strong>2</strong>: Adjust for partial amount received</div>
              <div>• Reply <strong>3</strong>: Reject false / uncredited claim</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} className="mobile-stack">
            <button
              className="btn-primary mobile-full-width"
              onClick={() => onNavigate('ai')}
              style={{ flex: 1, fontSize: '0.8rem', minHeight: '40px' }}
            >
              <MessageSquare size={14} />
              Open WhatsApp Bot Hub
            </button>
            <button
              className="btn-secondary mobile-full-width"
              onClick={() => onNavigate('chase')}
              style={{ fontSize: '0.8rem', minHeight: '40px' }}
            >
              Chase List ({chaseItems.length})
            </button>
          </div>
        </div>

        {/* Bento 6 (6 cols) — Receivables Aging Breakdown */}
        <div className="bento-card" style={{ gridColumn: 'span 6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div className="bento-label" style={{ margin: 0 }}>
              <Clock size={14} />
              Receivables Aging Buckets
            </div>
            <button
              onClick={() => onNavigate('who_owes')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--brand-primary)',
                fontWeight: 600,
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              Full Breakdown →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
            {[
              {
                label: 'Current (< 30 days)',
                amount: agingCurrent,
                color: 'var(--brand-emerald)',
                pct: totalOutstanding > 0 ? (agingCurrent / totalOutstanding) * 100 : 50,
              },
              {
                label: '30–60 days late',
                amount: aging30_60,
                color: 'var(--brand-primary)',
                pct: totalOutstanding > 0 ? (aging30_60 / totalOutstanding) * 100 : 25,
              },
              {
                label: '60–90 days late',
                amount: aging60_90,
                color: 'var(--brand-amber)',
                pct: totalOutstanding > 0 ? (aging60_90 / totalOutstanding) * 100 : 15,
              },
              {
                label: '90+ days overdue',
                amount: aging90Plus,
                color: 'var(--brand-rose)',
                pct: totalOutstanding > 0 ? (aging90Plus / totalOutstanding) * 100 : 10,
              },
            ].map((bucket, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{bucket.label}</span>
                  <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>
                    {currencySymbol}
                    {bucket.amount.toLocaleString('en-IN')}
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    borderRadius: '3px',
                    background: 'var(--bg-surface-subtle)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.max(2, Math.min(100, bucket.pct))}%`,
                      background: bucket.color,
                      borderRadius: '3px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
