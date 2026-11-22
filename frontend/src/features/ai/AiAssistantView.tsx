import React, { useState, useEffect, useRef } from 'react';
import type { Family, CashFlowInsight } from '../../types';
import { api } from '../../services/api';
import {
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Send,
  Smartphone,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Copy,
  Check,
} from 'lucide-react';

interface AiAssistantViewProps {
  families: Family[];
  currencySymbol: string;
  cashFlowInsights: CashFlowInsight | null;
  onPaymentRecorded: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'tutor' | 'bot';
  text: string;
  timestamp: string;
  action?: string;
  hasInteractiveOptions?: boolean;
}

export const AiAssistantView: React.FC<AiAssistantViewProps> = ({
  families,
  currencySymbol,
  cashFlowInsights,
  onPaymentRecorded,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'bot',
      text: "👋 *Tutor Ledger WhatsApp Butler Active*\n\nI monitor your student fee receipts and safeguard your cash flow. Paste any parent payment text here or forward it to verify before marking invoices paid.\n\n*Quick Commands:*\n• Reply *1* for Today's Overdue Fees\n• Reply *2* for 13-Week Cash Health Summary",
      timestamp: '08:30 AM',
      hasInteractiveOptions: false,
    },
    {
      id: '2',
      sender: 'tutor',
      text: "Namaste Sir, paid 3000 for Aarav Sharma via Google Pay ref UPI-849201948. Please check.",
      timestamp: '08:32 AM',
    },
    {
      id: '3',
      sender: 'bot',
      text: "📩 *Payment Claim Detected!*\n\n👤 *Student:* Aarav Sharma\n💰 *Claimed Amount:* ₹3,000 via UPI/GPay\n🔢 *Ref ID:* UPI-849201948\n\n⚠️ *Bank Verification Layer:*\nParents sometimes send pending payment requests or old screenshots. *Did you verify that ₹3,000 was actually credited to your bank account?*\n\nTap an option below to proceed:",
      timestamp: '08:32 AM',
      action: 'claim_detected',
      hasInteractiveOptions: true,
    },
  ]);

  const [inputVal, setInputVal] = useState('');
  const [sending, setSending] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [activePending, setActivePending] = useState(true);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Determine current host for webhook display
    const host = window.location.host;
    const protocol = window.location.protocol;
    setWebhookUrl(`${protocol}//${host}/api/v1/whatsapp/webhook`);

    // Fetch initial status
    api.getWhatsAppStatus()
      .then((res) => {
        setActivePending(res.hasPendingVerification);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || sending) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'tutor',
      text: trimmed,
      timestamp: time,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal('');
    setSending(true);

    try {
      const res = await api.simulateWhatsApp(trimmed);
      const botMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'bot',
        text: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: res.action,
        hasInteractiveOptions: res.hasPending,
      };

      setMessages((prev) => [...prev, botMsg]);
      setActivePending(res.hasPending || false);

      if (res.action === 'payment_confirmed') {
        onPaymentRecorded();
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'bot',
        text: `⚠️ Error contacting WhatsApp Butler: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  const handleOptionClick = (optionNumber: string) => {
    handleSendMessage(optionNumber);
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>📱 WhatsApp Bot & Verification Center</h2>
            <span className="badge badge-emerald" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
              Live Bot Active
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Two-way WhatsApp management. Daily briefing, fee chasing, and banking verification happen directly in chat without opening manual forms.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1.25fr) minmax(300px, 1fr)', gap: '20px' }} className="mobile-stack">
        {/* Left Column: Interactive WhatsApp Phone Simulator */}
        <div
          className="bento-card"
          style={{
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
          }}
        >
          {/* WhatsApp Phone Header Bar */}
          <div
            style={{
              background: '#075e54',
              color: '#ffffff',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: '#25d366',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.1rem',
                }}
              >
                TL
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Tutor Ledger Butler
                  <ShieldCheck size={14} color="#60a5fa" />
                </div>
                <div style={{ fontSize: '0.725rem', opacity: 0.9 }}>online • +1 (415) 523-8886 (Twilio Sandbox)</div>
              </div>
            </div>

            <button
              onClick={() => handleSendMessage('menu')}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                color: '#ffffff',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Reset / Menu
            </button>
          </div>

          {/* WhatsApp Chat Bubbles Container */}
          <div
            style={{
              padding: '16px',
              minHeight: '380px',
              maxHeight: '440px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              background: 'var(--card-bg-secondary)',
            }}
          >
            {messages.map((m) => {
              const isTutor = m.sender === 'tutor';
              return (
                <div
                  key={m.id}
                  style={{
                    alignSelf: isTutor ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div
                    style={{
                      background: isTutor ? 'var(--brand-emerald-light, #dcfce7)' : 'var(--card-bg)',
                      color: isTutor ? 'var(--brand-emerald-text, #065f46)' : 'var(--text-main)',
                      padding: '10px 14px',
                      borderRadius: isTutor ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      border: '1px solid var(--border-color)',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.04)',
                      fontSize: '0.85rem',
                      lineHeight: 1.45,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {m.text}

                    <div
                      style={{
                        textAlign: 'right',
                        fontSize: '0.675rem',
                        marginTop: '4px',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      {m.timestamp}
                      {isTutor && <span style={{ color: '#2563eb' }}>✓✓</span>}
                    </div>
                  </div>

                  {/* Interactive WhatsApp Banking Menu Buttons */}
                  {m.hasInteractiveOptions && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        marginTop: '4px',
                        padding: '8px',
                        background: 'var(--card-bg)',
                        border: '1px dashed var(--brand-primary)',
                        borderRadius: '10px',
                      }}
                    >
                      <div style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--brand-primary)', textTransform: 'uppercase' }}>
                        ⚡ Interactive WhatsApp Options
                      </div>

                      <button
                        className="btn-primary"
                        onClick={() => handleOptionClick('1')}
                        disabled={sending}
                        style={{
                          justifyContent: 'flex-start',
                          padding: '8px 12px',
                          fontSize: '0.8rem',
                          background: 'var(--brand-emerald)',
                        }}
                      >
                        <CheckCircle2 size={15} />
                        [1] Yes, money credited in bank (Record Payment)
                      </button>

                      <button
                        className="btn-secondary"
                        onClick={() => handleOptionClick('2')}
                        disabled={sending}
                        style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.8rem' }}
                      >
                        <AlertTriangle size={15} color="var(--brand-amber)" />
                        [2] Partial / Different amount received
                      </button>

                      <button
                        className="btn-secondary"
                        onClick={() => handleOptionClick('3')}
                        disabled={sending}
                        style={{
                          justifyContent: 'flex-start',
                          padding: '8px 12px',
                          fontSize: '0.8rem',
                          color: 'var(--brand-rose)',
                        }}
                      >
                        [3] ❌ Not received yet (False / Uncredited claim)
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>

          {/* Quick Prompt Chips */}
          <div
            style={{
              padding: '8px 12px',
              background: 'var(--card-bg)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
            }}
          >
            <button
              onClick={() => handleSendMessage('Hi sir, paid 3000 for Aarav Sharma via GPay')}
              style={{
                fontSize: '0.725rem',
                padding: '4px 8px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-surface-subtle)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              💬 "Paid ₹3000 for Aarav"
            </button>
            <button
              onClick={() => handleSendMessage('1')}
              style={{
                fontSize: '0.725rem',
                padding: '4px 8px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-surface-subtle)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              ☀️ Daily Overdue Brief
            </button>
            <button
              onClick={() => handleSendMessage('2')}
              style={{
                fontSize: '0.725rem',
                padding: '4px 8px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-surface-subtle)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              💰 13-Week Cash Health
            </button>
          </div>

          {/* WhatsApp Text Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputVal);
            }}
            style={{
              padding: '10px 12px',
              background: 'var(--card-bg)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <input
              type="text"
              className="input-field"
              placeholder="Paste parent's text or reply 1, 2, 3..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              style={{ flex: 1, fontSize: '0.85rem' }}
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={sending || !inputVal.trim()}
              style={{ padding: '8px 14px', borderRadius: '50%', width: '40px', height: '40px', justifyContent: 'center' }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>

        {/* Right Column: Real WhatsApp Phone Setup Guide (Twilio Sandbox) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Card 1: Twilio Sandbox Live Connect */}
          <div className="bento-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Smartphone size={18} color="var(--brand-primary)" />
              <div className="bento-label" style={{ margin: 0 }}>Connect Your Real WhatsApp</div>
            </div>

            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
              Twilio WhatsApp Sandbox Setup
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Follow these 3 quick steps to receive daily briefs and payment verification menus directly on your phone's WhatsApp:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Step 1 */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'var(--brand-primary-light)',
                    color: 'var(--brand-primary)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  1
                </span>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Save Twilio's WhatsApp number on your phone: <strong style={{ color: 'var(--text-main)' }}>+1 415 523 8886</strong>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'var(--brand-primary-light)',
                    color: 'var(--brand-primary)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  2
                </span>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Open WhatsApp and text your sandbox join code (e.g. <strong style={{ color: 'var(--brand-primary)' }}>join silver-fox</strong>) to that number.
                </div>
              </div>

              {/* Step 3 */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'var(--brand-primary-light)',
                    color: 'var(--brand-primary)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  3
                </span>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  In your Twilio Console (WhatsApp Sandbox Settings), set the Webhook URL to:
                  <div
                    style={{
                      marginTop: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      background: 'var(--bg-surface-subtle)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '6px 10px',
                    }}
                  >
                    <code style={{ fontSize: '0.725rem', flex: 1, wordBreak: 'break-all', color: 'var(--brand-primary)' }}>
                      {webhookUrl}
                    </code>
                    <button
                      type="button"
                      onClick={copyWebhook}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      {copied ? <Check size={14} color="var(--brand-emerald)" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                    *For local testing, expose port 3001 using: <code>npx localtunnel --port 3001</code>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Why the Banking Verification Layer Matters */}
          <div
            className="bento-card"
            style={{
              background: 'var(--brand-emerald-light, rgba(5, 150, 105, 0.05))',
              borderColor: 'rgba(5, 150, 105, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <ShieldCheck size={18} color="var(--brand-emerald)" />
              <div className="bento-label" style={{ margin: 0, color: 'var(--brand-emerald)' }}>
                Verification Protocol
              </div>
            </div>

            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
              Why Verification Before Updating Records?
            </h4>
            <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              Parents frequently share payment screenshots that are pending, or mistakenly enter the wrong amount. Tutor Ledger introduces this verification checkpoint so no invoice is marked paid until the tutor acknowledges that the money is physically in their bank account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
