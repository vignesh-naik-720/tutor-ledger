import React, { useState } from 'react';
import type { WhoOwesResponse, FamilyWhoOwes } from '../../types';
import { DollarSign, Clock, Users, ArrowUpRight, MessageSquare, CreditCard } from 'lucide-react';

interface WhoOwesViewProps {
  data: WhoOwesResponse | null;
  currencySymbol: string;
  onChaseFamily: (familyId: string) => void;
  onRecordPayment: (familyId: string) => void;
  onToggleShowAll: (showAll: boolean) => void;
  showAll: boolean;
}

export const WhoOwesView: React.FC<WhoOwesViewProps> = ({
  data,
  currencySymbol,
  onChaseFamily,
  onRecordPayment,
  onToggleShowAll,
  showAll,
}) => {
  if (!data) {
    return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Loading receivables data...</div>;
  }

  const totalOutstanding = data.total_outstanding_minor / 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>👥 Who Owes Me</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Single unified ledger view of every family with an unpaid balance, oldest unpaid date, and historical payment delay.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }} className="mobile-full-width">
          <button
            className={showAll ? 'btn-primary mobile-full-width' : 'btn-secondary mobile-full-width'}
            onClick={() => onToggleShowAll(!showAll)}
          >
            {showAll ? 'Showing All Families' : 'Showing Top 5 (Click to Show All)'}
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div className="bento-card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>TOTAL BALANCE RECEIVABLE</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
            {currencySymbol}
            {totalOutstanding.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="bento-card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>FAMILIES OWING</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--brand-emerald)', marginTop: '4px' }}>
            {data.families_owing_count} Families
          </div>
        </div>

        <div className="bento-card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>AVERAGE DAYS TO PAY</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--brand-amber)', marginTop: '4px' }}>
            {data.average_days_to_pay} Days
          </div>
        </div>
      </div>

      {/* List of Families */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {data.families.map((fam, idx) => {
          const outstanding = fam.outstanding_minor / 100;
          const totalInvoiced = fam.total_invoiced_minor / 100;
          const isOverdue = fam.days_oldest_overdue > 0;

          return (
            <div
              key={fam.family_id}
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
                  <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)' }}>{fam.family_name}</span>
                  {isOverdue ? (
                    <span className="badge badge-rose">{fam.days_oldest_overdue} days overdue</span>
                  ) : (
                    <span className="badge badge-emerald">Within term</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '14px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px', flexWrap: 'wrap' }}>
                  <span>Phone: <strong style={{ color: 'var(--text-secondary)' }}>{fam.phone_masked}</strong></span>
                  <span>Oldest unpaid: {fam.oldest_unpaid_date}</span>
                  <span>Open invoices: {fam.open_invoices_count}</span>
                  <span>Total invoiced: {currencySymbol}{totalInvoiced.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="mobile-stack mobile-full-width" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ textAlign: 'right' }} className="mobile-full-width">
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {currencySymbol}
                    {outstanding.toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Balance Owed</div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }} className="mobile-full-width">
                  <button className="btn-secondary mobile-full-width" onClick={() => onRecordPayment(fam.family_id)} title="Record a payment">
                    <CreditCard size={15} />
                    Record Pay
                  </button>
                  <button className="btn-whatsapp mobile-full-width" onClick={() => onChaseFamily(fam.family_id)}>
                    <MessageSquare size={15} />
                    Chase
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {data.has_more && !showAll && (
        <div style={{ textAlign: 'center', marginTop: '10px' }}>
          <button className="btn-secondary" onClick={() => onToggleShowAll(true)}>
            Show Remaining Families ({data.families_owing_count - data.families.length} more)
          </button>
        </div>
      )}
    </div>
  );
};
