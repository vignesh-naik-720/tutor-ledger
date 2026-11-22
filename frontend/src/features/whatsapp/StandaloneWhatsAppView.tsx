import React, { useState, useEffect, useRef } from 'react';
import type { Family, Invoice } from '../../types';
import { api } from '../../services/api';
import {
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Send,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  Search,
  MoreVertical,
  Paperclip,
  Smile,
  ArrowLeft,
  Check,
  CheckCheck,
  Phone,
  Video,
  UserCheck,
} from 'lucide-react';

interface ChatItem {
  id: string;
  name: string;
  studentName: string;
  subtitle: string;
  time: string;
  avatarText: string;
  avatarBg: string;
  unreadCount?: number;
  isBot?: boolean;
  phone?: string;
  amountFormatted?: string;
  isOverdue?: boolean;
}

interface Message {
  id: string;
  sender: 'tutor' | 'bot' | 'parent';
  senderName?: string;
  text: string;
  time: string;
  hasInteractiveOptions?: boolean;
}

interface StandaloneWhatsAppViewProps {
  onBackToApp?: () => void;
  isEmbedded?: boolean;
  families?: Family[];
  invoices?: Invoice[];
  currencySymbol?: string;
  onRefreshLedger?: () => void;
}

const AVATAR_COLORS = [
  '#059669', // Emerald
  '#1d4ed8', // Blue
  '#7c3aed', // Purple
  '#b45309', // Amber
  '#be123c', // Rose
  '#0284c7', // Sky
  '#4338ca', // Indigo
  '#0f766e', // Teal
];

export const StandaloneWhatsAppView: React.FC<StandaloneWhatsAppViewProps> = ({
  onBackToApp,
  isEmbedded = false,
  families: initialFamilies,
  invoices: initialInvoices,
  currencySymbol = '₹',
  onRefreshLedger,
}) => {
  const [loadedFamilies, setLoadedFamilies] = useState<Family[]>(initialFamilies || []);
  const [loadedInvoices, setLoadedInvoices] = useState<Invoice[]>(initialInvoices || []);
  const [activeChatId, setActiveChatId] = useState<string>('butler');
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [inputVal, setInputVal] = useState('');
  const [sending, setSending] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [activePendingBanner, setActivePendingBanner] = useState<{ student: string; amount: string } | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  // Cross-window synchronization
  useEffect(() => {
    try {
      broadcastRef.current = new BroadcastChannel('tutor_ledger_sync');
    } catch {
      // Fallback if not supported
    }
    return () => {
      broadcastRef.current?.close();
    };
  }, []);

  // Fetch real families & invoices if not provided (e.g. opened in standalone window)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [famsRes, invsRes] = await Promise.all([
          api.getFamilies().catch(() => ({ families: [] })),
          api.getInvoices().catch(() => ({ invoices: [] })),
        ]);
        if (famsRes.families && famsRes.families.length > 0) {
          setLoadedFamilies(famsRes.families);
        }
        if (invsRes.invoices && invsRes.invoices.length > 0) {
          setLoadedInvoices(invsRes.invoices);
        }
      } catch (err) {
        console.warn('Error fetching families for WhatsApp simulation:', err);
      }
    };

    if (!initialFamilies || initialFamilies.length === 0) {
      fetchData();
    } else {
      setLoadedFamilies(initialFamilies);
      if (initialInvoices) setLoadedInvoices(initialInvoices);
    }
  }, [initialFamilies, initialInvoices]);

  // Build dynamic chats list from REAL registered families
  const chats: ChatItem[] = [
    {
      id: 'butler',
      name: 'Tutor Ledger Butler 🤖',
      studentName: 'Assistant',
      subtitle: activePendingBanner
        ? `⚠️ Bank verification required for ${activePendingBanner.student}`
        : 'Official Verification & Fee Chasing Assistant',
      time: 'Just now',
      avatarText: 'TL',
      avatarBg: '#059669',
      unreadCount: activePendingBanner ? 1 : undefined,
      isBot: true,
    },
    ...loadedFamilies.map((fam, idx) => {
      // Extract student name from parenthesis or first word
      const match = fam.name.match(/\((.*?)\)/);
      const studentName = match ? match[1]!.split('-')[0]!.trim() : fam.name.split(' ')[0]!;
      const openInv = loadedInvoices.find(
        (i) => i.family_id === fam.id && (i.status === 'open' || i.status === 'partially-paid'),
      );
      const fee = openInv ? openInv.amount_minor / 100 : (fam.default_fee_minor || 400000) / 100;
      const formattedFee = `${currencySymbol}${fee.toLocaleString('en-IN')}`;
      const isOverdue = !!openInv;

      return {
        id: fam.id,
        name: fam.name,
        studentName,
        subtitle: isOverdue ? `⚠️ Due: ${formattedFee} (Fee Overdue)` : 'All fees settled ✓',
        time: isOverdue ? 'Yesterday' : 'Nov 18',
        avatarText: fam.name.slice(0, 2).toUpperCase(),
        avatarBg: AVATAR_COLORS[idx % AVATAR_COLORS.length]!,
        phone: fam.phone_masked,
        amountFormatted: formattedFee,
        isOverdue,
      };
    }),
  ];

  // Initialize realistic conversation history for each real registered family
  useEffect(() => {
    if (loadedFamilies.length === 0) return;

    setMessages((prev) => {
      const next = { ...prev };

      // Initialize Butler if empty
      if (!next.butler || next.butler.length === 0) {
        const topFam = loadedFamilies[0];
        const topStudent = topFam?.name.match(/\((.*?)\)/)?.[1]?.split('-')[0]?.trim() || 'Aarav';
        next.butler = [
          {
            id: 'b1',
            sender: 'bot',
            text: "👋 *Tutor Ledger WhatsApp Butler Online*\n\nI monitor student payments from all registered families. When parents report fees on WhatsApp, I check with you before updating your ledger balances.\n\n*Quick Commands:*\n• Reply *1* for Today's Overdue Fees\n• Reply *2* for 13-Week Cash Health Summary",
            time: '08:30 AM',
          },
          {
            id: 'b2',
            sender: 'tutor',
            text: `Namaste Sir, paid 4500 for ${topStudent} via Google Pay ref UPI-849201948. Please check.`,
            time: '08:32 AM',
          },
          {
            id: 'b3',
            sender: 'bot',
            text: `📩 *Payment Claim Detected!*\n\n👤 *Student:* ${topStudent}\n💰 *Claimed Amount:* ${currencySymbol}4,500 via UPI/GPay\n🔢 *Ref ID:* UPI-849201948\n\n⚠️ *Bank Verification Layer:*\nParents sometimes send pending payment requests or old screenshots. *Did you verify that ${currencySymbol}4,500 was actually credited to your bank account?*\n\nTap an option below to proceed:`,
            time: '08:32 AM',
            hasInteractiveOptions: true,
          },
        ];
      }

      // Initialize each registered family chat
      loadedFamilies.forEach((fam) => {
        if (!next[fam.id] || next[fam.id]!.length === 0) {
          const match = fam.name.match(/\((.*?)\)/);
          const studentName = match ? match[1]!.split('-')[0]!.trim() : fam.name.split(' ')[0]!;
          const openInv = loadedInvoices.find(
            (i) => i.family_id === fam.id && (i.status === 'open' || i.status === 'partially-paid'),
          );
          const fee = openInv ? openInv.amount_minor / 100 : (fam.default_fee_minor || 400000) / 100;
          const formattedFee = `${currencySymbol}${fee.toLocaleString('en-IN')}`;

          next[fam.id] = [
            {
              id: `${fam.id}_1`,
              sender: 'tutor',
              text: `Namaste! Gentle reminder that ${studentName}'s tuition fee of ${formattedFee} was scheduled for this month. Please let me know once transferred.`,
              time: 'Yesterday',
            },
            {
              id: `${fam.id}_2`,
              sender: 'parent',
              senderName: fam.name.split('(')[0]?.trim() || 'Parent',
              text: `Namaste Sir! Noted. I am initiating the payment of ${formattedFee} for ${studentName} via GPay today.`,
              time: '08:15 AM',
            },
          ];
        }
      });

      return next;
    });
  }, [loadedFamilies, loadedInvoices, currencySymbol]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChatId]);

  const currentChat = chats.find((c) => c.id === activeChatId) || chats[0]!;
  const currentMessages = messages[activeChatId] || [];

  // Send message handler (works for BOTH Butler and registered parent chats!)
  const handleSendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || sending) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setInputVal('');
    setSending(true);

    if (activeChatId === 'butler') {
      // 1. Sent inside Butler chat
      const userMsg: Message = {
        id: String(Date.now()),
        sender: 'tutor',
        text: trimmed,
        time,
      };

      setMessages((prev) => ({
        ...prev,
        butler: [...(prev.butler || []), userMsg],
      }));

      try {
        const res = await api.simulateWhatsApp(trimmed);
        const botMsg: Message = {
          id: String(Date.now() + 1),
          sender: 'bot',
          text: res.reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          hasInteractiveOptions: res.hasPending,
        };

        setMessages((prev) => ({
          ...prev,
          butler: [...(prev.butler || []), botMsg],
        }));

        if (res.action === 'payment_confirmed') {
          setActivePendingBanner(null);
          broadcastRef.current?.postMessage({ type: 'REFRESH_LEDGER' });
          if (onRefreshLedger) onRefreshLedger();
          setSyncNotice('✅ Payment verified! Tutor Ledger records updated in real time.');
          setTimeout(() => setSyncNotice(null), 4000);
        }
      } catch (err: any) {
        setMessages((prev) => ({
          ...prev,
          butler: [
            ...(prev.butler || []),
            {
              id: String(Date.now() + 1),
              sender: 'bot',
              text: `⚠️ Butler error: ${err.message}`,
              time,
            },
          ],
        }));
      } finally {
        setSending(false);
      }
    } else {
      // 2. Sent inside a Registered Family / Parent chat
      const parentName = currentChat.name.split('(')[0]?.trim() || 'Parent';
      const parentMsg: Message = {
        id: String(Date.now()),
        sender: 'parent',
        senderName: parentName,
        text: trimmed,
        time,
      };

      // Append to the parent's chat immediately!
      setMessages((prev) => ({
        ...prev,
        [activeChatId]: [...(prev[activeChatId] || []), parentMsg],
      }));

      // Check if message looks like a payment claim
      const hasPaymentIntent = /paid|transferred|sent|gpay|google\s*pay|phonepe|paytm|upi|ref|rs|₹|\d{3,6}/i.test(trimmed);

      if (hasPaymentIntent) {
        // Automatically forward claim to Butler and prompt the tutor!
        try {
          const enrichText = trimmed.includes(currentChat.studentName)
            ? trimmed
            : `${trimmed} for ${currentChat.studentName} (${currentChat.name})`;

          const res = await api.simulateWhatsApp(enrichText);

          // Add to Butler chat
          const botNotice: Message = {
            id: String(Date.now() + 2),
            sender: 'bot',
            text: res.reply,
            time,
            hasInteractiveOptions: res.hasPending,
          };

          setMessages((prev) => ({
            ...prev,
            butler: [...(prev.butler || []), botNotice],
          }));

          if (res.hasPending) {
            setActivePendingBanner({
              student: currentChat.studentName,
              amount: currentChat.amountFormatted || `${currencySymbol}4,500`,
            });
          }
        } catch (err) {
          console.warn('Error simulating payment parsing in Butler:', err);
        }
      }
      setSending(false);
    }
  };

  const handleSimulateParentPayment = (chat: ChatItem) => {
    setActiveChatId(chat.id);
    const text = `Namaste Sir! I have paid ${chat.amountFormatted} for ${chat.studentName} via Google Pay ref UPI-${Math.floor(100000000 + Math.random() * 900000000)}. Please verify your account.`;
    handleSendMessage(text);
  };

  const openInPopout = () => {
    window.open(
      '/?view=whatsapp',
      'TutorWhatsAppWindow',
      'width=540,height=850,menubar=no,toolbar=no,location=no,status=no',
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: isEmbedded ? '720px' : '100vh',
        width: '100%',
        background: '#111b21',
        fontFamily: 'Segoe UI, Helvetica Neue, Helvetica, Arial, sans-serif',
        overflow: 'hidden',
        color: '#e9edef',
        borderRadius: isEmbedded ? '12px' : 0,
        boxShadow: isEmbedded ? '0 12px 36px rgba(0,0,0,0.2)' : 'none',
      }}
    >
      {/* Top Banner & Real-Time Sync Status */}
      <div
        style={{
          background: '#202c33',
          padding: '8px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #2a3942',
          fontSize: '0.8rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#25d366' }} />
          <span style={{ fontWeight: 700, color: '#00a884' }}>WhatsApp Web (Live Registered Families)</span>
          <span style={{ color: '#8696a0' }}>• {loadedFamilies.length} Registered Families in Sync</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {syncNotice && (
            <span style={{ background: '#059669', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
              {syncNotice}
            </span>
          )}

          {isEmbedded ? (
            <button
              onClick={openInPopout}
              style={{
                background: '#00a884',
                color: '#111b21',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <ExternalLink size={13} />
              Popout Window (Side-by-Side)
            </button>
          ) : (
            onBackToApp && (
              <button
                onClick={onBackToApp}
                style={{
                  background: '#2a3942',
                  color: '#e9edef',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <ArrowLeft size={13} />
                Open Ledger Dashboard
              </button>
            )
          )}
        </div>
      </div>

      {/* Main Split Interface */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar: Real Registered Families Roster */}
        <div
          style={{
            width: isEmbedded ? '320px' : '360px',
            borderRight: '1px solid #2a3942',
            background: '#111b21',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* User profile header */}
          <div
            style={{
              background: '#202c33',
              padding: '10px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#00a884',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#111b21',
                  fontWeight: 800,
                }}
              >
                SJ
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Sarah Jenkins</div>
                <div style={{ fontSize: '0.7rem', color: '#8696a0' }}>Tutor • Online</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '14px', color: '#aebac1' }}>
              <MessageSquare size={18} style={{ cursor: 'pointer' }} />
              <MoreVertical size={18} style={{ cursor: 'pointer' }} />
            </div>
          </div>

          {/* Search bar */}
          <div style={{ padding: '8px 12px', background: '#111b21' }}>
            <div
              style={{
                background: '#202c33',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                padding: '6px 12px',
                gap: '10px',
                color: '#8696a0',
              }}
            >
              <Search size={15} />
              <input
                type="text"
                placeholder="Search registered families..."
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#e9edef',
                  fontSize: '0.8rem',
                  outline: 'none',
                  width: '100%',
                }}
              />
            </div>
          </div>

          {/* Chats Roster */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {chats.map((chat) => {
              const isSelected = chat.id === activeChatId;
              return (
                <div
                  key={chat.id}
                  onClick={() => setActiveChatId(chat.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 14px',
                    gap: '12px',
                    cursor: 'pointer',
                    background: isSelected ? '#2a3942' : 'transparent',
                    borderBottom: '1px solid rgba(42, 57, 66, 0.4)',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      background: chat.avatarBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      flexShrink: 0,
                    }}
                  >
                    {chat.avatarText}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: '0.875rem',
                          color: '#e9edef',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {chat.name}
                        {chat.isBot && <ShieldCheck size={14} color="#00a884" />}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: isSelected ? '#00a884' : '#8696a0' }}>{chat.time}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                      <div
                        style={{
                          fontSize: '0.775rem',
                          color: chat.isOverdue ? '#f87171' : '#8696a0',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontWeight: chat.isOverdue ? 600 : 400,
                        }}
                      >
                        {chat.subtitle}
                      </div>
                      {chat.unreadCount && (
                        <span
                          style={{
                            background: '#25d366',
                            color: '#111b21',
                            fontSize: '0.675rem',
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: '999px',
                          }}
                        >
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Area: Conversation Screen */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0b141a' }}>
          {/* Chat Header */}
          <div
            style={{
              background: '#202c33',
              padding: '10px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #2a3942',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: currentChat.avatarBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 700,
                }}
              >
                {currentChat.avatarText}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#e9edef', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {currentChat.name}
                  {currentChat.isBot && <ShieldCheck size={15} color="#00a884" />}
                </div>
                <div style={{ fontSize: '0.725rem', color: '#8696a0' }}>
                  {currentChat.isBot
                    ? 'Official Tutor Ledger Butler • Automated Bank Verification'
                    : `Student: ${currentChat.studentName} • Registered Parent`}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', color: '#aebac1' }}>
              <Video size={18} style={{ cursor: 'pointer' }} />
              <Phone size={18} style={{ cursor: 'pointer' }} />
              <Search size={18} style={{ cursor: 'pointer' }} />
              <MoreVertical size={18} style={{ cursor: 'pointer' }} />
            </div>
          </div>

          {/* Quick Simulation Triggers Bar */}
          <div
            style={{
              background: '#182229',
              borderBottom: '1px solid #2a3942',
              padding: '6px 12px',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              overflowX: 'auto',
            }}
          >
            <span style={{ fontSize: '0.7rem', color: '#8696a0', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              ⚡ Quick Actions:
            </span>

            {!currentChat.isBot ? (
              <button
                onClick={() => handleSimulateParentPayment(currentChat)}
                style={{
                  background: '#202c33',
                  border: '1px solid #00a884',
                  color: '#00a884',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.725rem',
                  cursor: 'pointer',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                💬 Simulate Parent Sending: "Paid {currentChat.amountFormatted} via GPay"
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleSendMessage('1')}
                  style={{
                    background: '#202c33',
                    border: '1px solid #2a3942',
                    color: '#e9edef',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '0.725rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ☀️ 8:30 AM Daily Overdue Briefing
                </button>
                <button
                  onClick={() => handleSendMessage('2')}
                  style={{
                    background: '#202c33',
                    border: '1px solid #2a3942',
                    color: '#e9edef',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '0.725rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  💰 13-Week Cash Health
                </button>
              </>
            )}
          </div>

          {/* Pending Banner Alert if user is in a parent chat */}
          {activePendingBanner && !currentChat.isBot && (
            <div
              style={{
                background: 'rgba(5, 150, 105, 0.15)',
                borderBottom: '1px solid #059669',
                padding: '8px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.8rem',
              }}
            >
              <span>
                🔔 <strong>Butler Alert:</strong> Payment claim of <strong>{activePendingBanner.amount}</strong> detected for <strong>{activePendingBanner.student}</strong>.
              </span>
              <button
                onClick={() => setActiveChatId('butler')}
                style={{
                  background: '#059669',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Go to Butler & Verify →
              </button>
            </div>
          )}

          {/* Message History Container */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          >
            <div style={{ textAlign: 'center', margin: '4px 0' }}>
              <span
                style={{
                  background: '#182229',
                  color: '#8696a0',
                  fontSize: '0.675rem',
                  padding: '4px 10px',
                  borderRadius: '6px',
                }}
              >
                🔒 Messages with registered family are encrypted. Live sync enabled with Tutor Ledger.
              </span>
            </div>

            {currentMessages.map((msg) => {
              const isTutor = msg.sender === 'tutor';
              return (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: isTutor ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div
                    style={{
                      background: isTutor ? '#005c4b' : '#202c33',
                      color: '#e9edef',
                      padding: '8px 12px',
                      borderRadius: isTutor ? '8px 8px 2px 8px' : '8px 8px 8px 2px',
                      boxShadow: '0 1px 0.5px rgba(11,20,26,0.13)',
                      fontSize: '0.85rem',
                      lineHeight: 1.4,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {msg.senderName && (
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#53bdeb', marginBottom: '2px' }}>
                        {msg.senderName}
                      </div>
                    )}

                    {msg.text}

                    <div
                      style={{
                        textAlign: 'right',
                        fontSize: '0.65rem',
                        marginTop: '3px',
                        color: '#8696a0',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      {msg.time}
                      {isTutor && <CheckCheck size={14} color="#53bdeb" />}
                    </div>
                  </div>

                  {/* Interactive Bank Verification Menu Buttons */}
                  {msg.hasInteractiveOptions && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        marginTop: '4px',
                        padding: '8px',
                        background: '#182229',
                        border: '1px dashed #00a884',
                        borderRadius: '8px',
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#00a884', textTransform: 'uppercase' }}>
                        ⚡ Interactive WhatsApp Options
                      </div>

                      <button
                        onClick={() => handleSendMessage('1')}
                        disabled={sending}
                        style={{
                          background: '#00a884',
                          color: '#111b21',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          textAlign: 'left',
                        }}
                      >
                        <CheckCircle2 size={15} />
                        [1] Yes, money credited in bank (Record Payment)
                      </button>

                      <button
                        onClick={() => handleSendMessage('2')}
                        disabled={sending}
                        style={{
                          background: '#202c33',
                          color: '#e9edef',
                          border: '1px solid #2a3942',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          textAlign: 'left',
                        }}
                      >
                        <AlertTriangle size={15} color="#f59e0b" />
                        [2] Partial / Different amount received
                      </button>

                      <button
                        onClick={() => handleSendMessage('3')}
                        disabled={sending}
                        style={{
                          background: '#202c33',
                          color: '#f87171',
                          border: '1px solid #2a3942',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          textAlign: 'left',
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

          {/* Chat Input Bar */}
          <div
            style={{
              background: '#202c33',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <Smile size={22} style={{ color: '#8696a0', cursor: 'pointer' }} />
            <Paperclip size={22} style={{ color: '#8696a0', cursor: 'pointer' }} />

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputVal);
              }}
              style={{ flex: 1, display: 'flex' }}
            >
              <input
                type="text"
                placeholder={
                  activeChatId === 'butler'
                    ? "Type command (1, 2) or paste payment text..."
                    : `Send message as ${currentChat.name.split('(')[0]?.trim()} (e.g. "I paid ${currentChat.amountFormatted} via GPay")...`
                }
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                style={{
                  width: '100%',
                  background: '#2a3942',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '9px 14px',
                  color: '#e9edef',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
            </form>

            <button
              onClick={() => handleSendMessage(inputVal)}
              disabled={sending || !inputVal.trim()}
              style={{
                background: '#00a884',
                color: '#111b21',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
