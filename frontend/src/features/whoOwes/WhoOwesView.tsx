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
    return <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>Loading receivables data...</div>;
  }

  const totalOutstanding = data.total_outstanding_minor / 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>👥 Who Owes Me</h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Single unified ledger view of every family with an unpaid balance, oldest unpaid date, and historical payment delay.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className={showAll ? 'btn-primary' : 'btn-secondary'}
            onClick={() => onToggleShowAll(!showAll)}
          >
            {showAll ? 'Showing All Families' : 'Showing Top 5 (Click to Show All)'}
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>TOTAL BALANCE RECEIVABLE</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', marginTop: '6px' }}>
            {currencySymbol}
            {totalOutstanding.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>FAMILIES OWING</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#34d399', marginTop: '6px' }}>
            {data.families_owing_count} Families
          </div>
        </div>

        <div className="glass-card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>AVERAGE DAYS TO PAY</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fbbf24', marginTop: '6px' }}>
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
              className="glass-card"
              style={{
                padding: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#f8fafc' }}>{fam.family_name}</span>
                  {isOverdue ? (
                    <span className="badge badge-rose">{fam.days_oldest_overdue} days overdue</span>
                  ) : (
                    <span className="badge badge-emerald">Within term</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '16px', fontSize: '0.825rem', color: '#94a3b8', marginTop: '6px' }}>
                  <span>Phone: {fam.phone_masked}</span>
                  <span>Oldest unpaid: {fam.oldest_unpaid_date}</span>
                  <span>Open invoices: {fam.open_invoices_count}</span>
                  <span>Total invoiced: {currencySymbol}{totalInvoiced.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc' }}>
                    {currencySymbol}
                    {outstanding.toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Balance Owed</div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-secondary" onClick={() => onRecordPayment(fam.family_id)} title="Record a payment">
                    <CreditCard size={15} />
                    Record Pay
                  </button>
                  <button className="btn-whatsapp" onClick={() => onChaseFamily(fam.family_id)}>
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
