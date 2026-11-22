import React from 'react';
import type { Family, CashFlowInsight } from '../../types';
import { StandaloneWhatsAppView } from '../whatsapp/StandaloneWhatsAppView';
import { ExternalLink, Smartphone, ShieldCheck } from 'lucide-react';

interface AiAssistantViewProps {
  families: Family[];
  currencySymbol: string;
  cashFlowInsights: CashFlowInsight | null;
  onPaymentRecorded: () => void;
}

export const AiAssistantView: React.FC<AiAssistantViewProps> = ({
  families,
  currencySymbol,
  cashFlowInsights,
  onPaymentRecorded,
}) => {
  const openInPopout = () => {
    window.open(
      '/?view=whatsapp',
      'TutorWhatsAppWindow',
      'width=540,height=840,menubar=no,toolbar=no,location=no,status=no',
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header with Quick Popout Launcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>📱 WhatsApp Bot Companion & Verification Hub</h2>
            <span className="badge badge-emerald" style={{ fontSize: '0.7rem' }}>
              ● Live Companion Sync
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Experience real-world tutor operations. Confirm fee payments directly through WhatsApp interactive menus with 1-tap banking verification.
          </p>
        </div>

        <button
          className="btn-primary"
          onClick={openInPopout}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <ExternalLink size={16} />
          Popout WhatsApp to Separate Window
        </button>
      </div>

      {/* Embedded WhatsApp Web Experience */}
      <StandaloneWhatsAppView
        isEmbedded={true}
        families={families}
        currencySymbol={currencySymbol}
        onRefreshLedger={onPaymentRecorded}
      />
    </div>
  );
};
