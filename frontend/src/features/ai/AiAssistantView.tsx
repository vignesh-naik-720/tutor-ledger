import React, { useState } from 'react';
import type { Family, CashFlowInsight } from '../../types';
import { api } from '../../services/api';
import {
  Sparkles,
  MessageSquare,
  DollarSign,
  Send,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';

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
  // Parser State
  const [pastedMessage, setPastedMessage] = useState(
    "Namaste Sir, Aryan's father here. Sent ₹3,500 via Google Pay today for Oct tuition fee. Ref: UPI/293847291847. Thanks!",
  );
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<any | null>(null);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('');
  const [confirmingPay, setConfirmingPay] = useState(false);
  const [parseNotice, setParseNotice] = useState<string | null>(null);

  // Reminder Composer State
  const [targetFamilyId, setTargetFamilyId] = useState<string>(families[0]?.id || '');
  const [tone, setTone] = useState<'friendly' | 'neutral' | 'firm' | 'urgent'>('friendly');
  const [reminderAmount, setReminderAmount] = useState('4500');
  const [customNote, setCustomNote] = useState('Next revision test is scheduled for Tuesday');
  const [generatingReminder, setGeneratingReminder] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState<string>('');

  const handleParse = async () => {
    if (!pastedMessage.trim()) return;
    setParsing(true);
    setParseNotice(null);
    try {
      const res = await api.parsePaymentMessageAI(pastedMessage);
      setParseResult(res.result);

      // Auto-match family if candidate detected
      if (res.result.family_name_candidate) {
        const match = families.find((f) =>
          f.name.toLowerCase().includes(res.result.family_name_candidate.toLowerCase()),
        );
        if (match) setSelectedFamilyId(match.id);
      } else if (families.length > 0 && !selectedFamilyId) {
        setSelectedFamilyId(families[0]!.id);
      }
    } catch (err: any) {
      setParseNotice(`Parsing failed: ${err.message}`);
    } finally {
      setParsing(false);
    }
  };

  const handleConfirmParsedPayment = async () => {
    if (!parseResult || !parseResult.amount_minor || !selectedFamilyId) {
      setParseNotice('Please select a family and ensure a valid amount is detected.');
      return;
    }
    setConfirmingPay(true);
    setParseNotice(null);

    try {
      // Find open invoice for this family
      const invoicesRes = await api.getInvoices();
      const openInv = invoicesRes.invoices.find(
        (i) => i.family_id === selectedFamilyId && (i.status === 'open' || i.status === 'partially-paid'),
      );

      let targetInvId = openInv?.id;
      if (!targetInvId) {
        // Create an invoice first using family defaults
        const newInv = await api.createInvoice({
          family_id: selectedFamilyId,
          client_event_id: crypto.randomUUID(),
        });
        targetInvId = newInv.invoice.id;
      }

      await api.recordPayment(targetInvId, {
        amount_minor: parseResult.amount_minor,
        date_received: parseResult.date || new Date().toISOString().slice(0, 10),
        client_event_id: crypto.randomUUID(),
        source: 'confirmed_pasted_message',
      });

      setParseNotice('Payment recorded successfully into ledger! Invoice updated.');
      onPaymentRecorded();
      setTimeout(() => {
        setParseResult(null);
        setPastedMessage('');
      }, 2000);
    } catch (err: any) {
      setParseNotice(`Error saving payment: ${err.message}`);
    } finally {
      setConfirmingPay(false);
    }
  };

  const handleGenerateReminder = async () => {
    const fam = families.find((f) => f.id === targetFamilyId);
    if (!fam) return;

    setGeneratingReminder(true);
    try {
      const res = await api.draftReminderAI({
        family_name: fam.name,
        amount_formatted: `${currencySymbol}${parseInt(reminderAmount, 10).toLocaleString('en-IN')}`,
        due_date: new Date().toISOString().slice(0, 10),
        days_overdue: 7,
        tone,
        custom_note: customNote,
        payment_details: 'GPay/PhonePe: 9876543210 (UPI: tutor@okaxis)',
      });
      setGeneratedDraft(res.reminderText);
    } catch (err: any) {
      setGeneratedDraft('Failed to generate reminder draft. Please try again.');
    } finally {
      setGeneratingReminder(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top AI Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Sparkles size={22} color="#10b981" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>AI Financial Copilot & Smart Tools</h2>
          <span className="badge badge-emerald">Gemini & Local Hybrid AI</span>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
          Tutors run their days on WhatsApp. Use smart parsing to log payments in seconds and generate personalized reminders that maintain great parent relationships.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        {/* Tool 1: Smart WhatsApp Message Parser */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <MessageSquare size={20} color="#34d399" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>1. Paste WhatsApp Payment Message</h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '12px' }}>
              Paste forwarded SMS, GPay confirmation, or parent message. Extracts amount, mode, transaction ID and flags ambiguities.
            </p>

            <textarea
              className="input-field"
              rows={4}
              value={pastedMessage}
              onChange={(e) => setPastedMessage(e.target.value)}
              placeholder="Paste WhatsApp text here..."
              style={{ fontSize: '0.85rem', marginBottom: '10px' }}
            />

            <button className="btn-primary" style={{ width: '100%' }} onClick={handleParse} disabled={parsing}>
              <Sparkles size={16} />
              {parsing ? 'AI Analyzing Text...' : 'Parse Payment Details'}
            </button>

            {/* Extracted Card */}
            {parseResult && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '14px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#34d399' }}>EXTRACTED PAYMENT</span>
                  <span className={`badge ${parseResult.amount_flagged ? 'badge-amber' : 'badge-emerald'}`}>
                    {parseResult.amount_flagged ? 'Review Needed' : 'High Confidence'}
                  </span>
                </div>

                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc', marginBottom: '6px' }}>
                  {currencySymbol}
                  {((parseResult.amount_minor || 0) / 100).toLocaleString('en-IN')}
                </div>

                <div style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div>Mode: <strong>{parseResult.payment_mode || 'UPI'}</strong></div>
                  {parseResult.reference_id && <div>Ref/UTR: <strong>{parseResult.reference_id}</strong></div>}
                  {parseResult.is_partial && <div style={{ color: '#fbbf24' }}>⚡ Marked as Partial Payment</div>}
                </div>

                <div style={{ marginTop: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
                    Match to Tutoring Family:
                  </label>
                  <select
                    className="input-field"
                    value={selectedFamilyId}
                    onChange={(e) => setSelectedFamilyId(e.target.value)}
                    style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                  >
                    {families.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  className="btn-primary"
                  style={{ width: '100%', marginTop: '12px' }}
                  onClick={handleConfirmParsedPayment}
                  disabled={confirmingPay}
                >
                  <CheckCircle2 size={16} />
                  {confirmingPay ? 'Recording...' : 'Confirm & Record in Ledger'}
                </button>
              </div>
            )}

            {parseNotice && (
              <div style={{ marginTop: '10px', fontSize: '0.8rem', color: parseNotice.includes('Error') ? '#f87171' : '#34d399' }}>
                {parseNotice}
              </div>
            )}
          </div>
        </div>

        {/* Tool 2: WhatsApp Reminder Composer with Tone Control */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <MessageSquare size={20} color="#6366f1" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>2. AI WhatsApp Reminder Polish</h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '12px' }}>
              Draft polite, relationship-preserving reminders with Indian/global context. Choose the right tone for each parent.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  Select Family
                </label>
                <select
                  className="input-field"
                  value={targetFamilyId}
                  onChange={(e) => setTargetFamilyId(e.target.value)}
                >
                  {families.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                    Fee Amount ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    value={reminderAmount}
                    onChange={(e) => setReminderAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                    Tone
                  </label>
                  <select
                    className="input-field"
                    value={tone}
                    onChange={(e) => setTone(e.target.value as any)}
                  >
                    <option value="friendly">😊 Friendly</option>
                    <option value="neutral">🤝 Professional</option>
                    <option value="firm">⚠️ Firm Follow-up</option>
                    <option value="urgent">🚨 Urgent Attention</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  Custom Context (e.g. exams or syllabus progress)
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="e.g. Next mock test is on Tuesday"
                />
              </div>

              <button className="btn-secondary" onClick={handleGenerateReminder} disabled={generatingReminder}>
                <Sparkles size={16} color="#818cf8" />
                {generatingReminder ? 'Generating...' : 'Generate WhatsApp Draft'}
              </button>
            </div>

            {generatedDraft && (
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>PROPOSED TEXT:</div>
                <div style={{ fontSize: '0.85rem', color: '#f1f5f9', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                  {generatedDraft}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
