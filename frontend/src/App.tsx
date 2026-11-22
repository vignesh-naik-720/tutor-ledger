import React, { useState, useEffect, useCallback } from 'react';
import { api } from './services/api';
import type {
  Family,
  Invoice,
  ChaseTodayItem,
  WhoOwesResponse,
  ForecastResponse,
  Scenario,
  AppAlert,
  CashFlowInsight,
  RecurringBill,
  OneOffExpense,
  LedgerSettings,
} from './types';

// Views
import { AuthModal } from './features/auth/AuthModal';
import { DashboardView } from './features/dashboard/DashboardView';
import { ChaseTodayView } from './features/chase/ChaseTodayView';
import { WhoOwesView } from './features/whoOwes/WhoOwesView';
import { ForecastView } from './features/forecast/ForecastView';
import { ScenariosView } from './features/scenarios/ScenariosView';
import { AiAssistantView } from './features/ai/AiAssistantView';
import { InvoicesView } from './features/invoices/InvoicesView';
import { FamiliesView } from './features/families/FamiliesView';
import { SettingsView } from './features/settings/SettingsView';
import { StandaloneWhatsAppView } from './features/whatsapp/StandaloneWhatsAppView';

import {
  LayoutDashboard,
  Zap,
  Users,
  TrendingUp,
  Sliders,
  Sparkles,
  Smartphone,
  FileText,
  UserCheck,
  Settings,
  LogOut,
  RefreshCw,
  Sun,
  Moon,
  Menu,
  X,
} from 'lucide-react';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('tutor_ledger_theme') as 'light' | 'dark') || 'light';
  });

  const isStandaloneWhatsApp =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('view') === 'whatsapp';

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tutor_ledger_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [ownerExists, setOwnerExists] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | undefined>(undefined);
  const [presetFamilyId, setPresetFamilyId] = useState<string | undefined>(undefined);

  // Data states
  const [families, setFamilies] = useState<Family[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [chaseItems, setChaseItems] = useState<ChaseTodayItem[]>([]);
  const [whoOwesData, setWhoOwesData] = useState<WhoOwesResponse | null>(null);
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [alerts, setAlerts] = useState<AppAlert[]>([]);
  const [cashFlowInsights, setCashFlowInsights] = useState<CashFlowInsight | null>(null);
  const [bills, setBills] = useState<RecurringBill[]>([]);
  const [expenses, setExpenses] = useState<OneOffExpense[]>([]);
  const [settings, setSettings] = useState<LedgerSettings | null>(null);

  const [showAllWhoOwes, setShowAllWhoOwes] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkAuth = async () => {
    try {
      const statusRes = await api.getSetupStatus();
      setOwnerExists(statusRes.owner_exists);
      if (!statusRes.owner_exists) {
        setAuthenticated(false);
        return;
      }
      await api.getSession();
      setAuthenticated(true);
    } catch {
      setAuthenticated(false);
    }
  };

  const loadData = useCallback(async () => {
    if (!authenticated) return;
    setLoading(true);
    try {
      const [
        famsRes,
        invsRes,
        chaseRes,
        whoRes,
        fcRes,
        scenRes,
        alertRes,
        aiRes,
        billsRes,
        expRes,
        settRes,
      ] = await Promise.all([
        api.getFamilies().catch(() => ({ families: [], currency_code: 'INR' })),
        api.getInvoices().catch(() => ({ invoices: [], currency_code: 'INR' })),
        api.getChaseToday().catch(() => ({ chase_today: [], total_count: 0, total_amount_minor: 0 })),
        api.getWhoOwes(showAllWhoOwes).catch(() => null),
        api.getForecast().catch(() => null),
        api.getScenarios().catch(() => ({ scenarios: [] })),
        api.getAlerts().catch(() => ({ alerts: [], count: 0 })),
        api.getCashFlowInsights().catch(() => ({ insights: null })),
        api.getBills().catch(() => ({ bills: [] })),
        api.getExpenses().catch(() => ({ expenses: [] })),
        api.getSettings().catch(() => ({ settings: null })),
      ]);

      setFamilies(famsRes.families || []);
      setInvoices(invsRes.invoices || []);
      setChaseItems(chaseRes.chase_today || []);
      setWhoOwesData(whoRes);
      setForecastData(fcRes);
      setScenarios(scenRes.scenarios || []);
      setAlerts(alertRes.alerts || []);
      setCashFlowInsights(aiRes.insights);
      setBills(billsRes.bills || []);
      setExpenses(expRes.expenses || []);
      setSettings(settRes.settings);
    } finally {
      setLoading(false);
    }
  }, [authenticated, showAllWhoOwes]);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (authenticated) {
      loadData();
    }
  }, [authenticated, loadData]);

  const handleLogout = async () => {
    await api.logout();
    setAuthenticated(false);
  };

  const currencySymbol = settings?.currency_code === 'GBP' ? '£' : settings?.currency_code === 'USD' ? '$' : '₹';

  const navigateTo = (tab: string, targetId?: string) => {
    setActiveTab(tab);
    if (targetId) {
      setSelectedInvoiceId(targetId);
    }
  };

  // Real-time synchronization across windows/tabs (e.g., when WhatsApp confirms payment)
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('tutor_ledger_sync');
      channel.onmessage = (event) => {
        if (event.data?.type === 'REFRESH_LEDGER') {
          loadData();
        }
      };
    } catch {}
    return () => channel?.close();
  }, [loadData]);

  // If opening in standalone WhatsApp window mode
  if (isStandaloneWhatsApp) {
    return (
      <StandaloneWhatsAppView
        families={families}
        invoices={invoices}
        currencySymbol={currencySymbol}
        onRefreshLedger={loadData}
        onBackToApp={() => {
          window.location.href = '/';
        }}
      />
    );
  }

  if (authenticated === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: 'var(--text-muted)' }}>
        Starting Tutor Ledger...
      </div>
    );
  }

  if (!authenticated) {
    return <AuthModal onAuthenticated={() => setAuthenticated(true)} ownerExists={ownerExists} />;
  }

  const overdueCount = chaseItems.length;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Application Navbar */}
      <header
        style={{
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          padding: '12px 24px',
          transition: 'background 0.2s ease, border-color 0.2s ease',
        }}
      >
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => setActiveTab('dashboard')}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'var(--brand-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
              }}
            >
              <FileText size={20} />
            </div>
            <div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
                Tutor Ledger
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--brand-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                WhatsApp-First Back Office
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Theme Toggle Button */}
            <button
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              {theme === 'light' ? (
                <>
                  <Moon size={14} color="var(--brand-primary)" />
                  <span style={{ fontWeight: 600 }}>Dark</span>
                </>
              ) : (
                <>
                  <Sun size={14} color="var(--brand-amber)" />
                  <span style={{ fontWeight: 600 }}>Light</span>
                </>
              )}
            </button>

            {/* Launch WhatsApp Companion Window Button */}
            <button
              className="btn-secondary desktop-nav-tabs"
              style={{
                padding: '6px 12px',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#00a884',
                borderColor: 'rgba(0, 168, 132, 0.4)',
                background: 'rgba(0, 168, 132, 0.08)',
                fontWeight: 600,
              }}
              onClick={() =>
                window.open(
                  '/?view=whatsapp',
                  'TutorWhatsAppWindow',
                  'width=540,height=840,menubar=no,toolbar=no,location=no,status=no',
                )
              }
              title="Launch Tutor's WhatsApp Companion in a separate side-by-side window"
            >
              <Smartphone size={14} color="#00a884" />
              WhatsApp Window
            </button>

            <button
              className="btn-secondary desktop-nav-tabs"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={loadData}
              title="Refresh ledger records"
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              {loading ? 'Refreshing...' : 'Sync'}
            </button>

            <button
              className="desktop-nav-tabs"
              onClick={handleLogout}
              style={{
                background: 'none',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                borderRadius: '8px',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
              title="End session"
            >
              <LogOut size={14} />
              Sign Out
            </button>

            {/* Mobile Hamburger Menu Toggle Button */}
            <button
              className="btn-secondary mobile-menu-btn"
              style={{ padding: '8px', display: 'none', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Mobile Navigation Drawer */}
      <aside className={`mobile-nav-drawer ${mobileMenuOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <FileText size={18} />
            </div>
            <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)' }}>Tutor Ledger</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Links inside mobile drawer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, overflowY: 'auto' }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'chase', label: 'Chase Today', icon: Zap, badge: overdueCount > 0 ? overdueCount : undefined },
            { id: 'who_owes', label: 'Who Owes Me', icon: Users },
            { id: 'forecast', label: '13-Wk Cash Forecast', icon: TrendingUp },
            { id: 'scenarios', label: 'What-If Scenarios', icon: Sliders },
            { id: 'ai', label: 'WhatsApp Bot Hub', icon: Smartphone, highlight: true },
            { id: 'invoices', label: 'Invoices & Payments', icon: FileText },
            { id: 'families', label: 'Students / Families', icon: UserCheck },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedInvoiceId(undefined);
                  setMobileMenuOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isActive ? 'var(--brand-primary-light)' : 'transparent',
                  color: isActive ? 'var(--brand-primary)' : 'var(--text-main)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  minHeight: '44px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={18} color={isActive ? 'var(--brand-primary)' : 'var(--text-muted)'} />
                  <span>{tab.label}</span>
                </div>
                {tab.badge !== undefined && (
                  <span
                    style={{
                      background: 'var(--brand-rose)',
                      color: '#ffffff',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: '999px',
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Mobile Drawer Footer Actions */}
        <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            className="btn-secondary"
            style={{ width: '100%', minHeight: '42px', padding: '10px', fontSize: '0.85rem' }}
            onClick={() => {
              loadData();
              setMobileMenuOpen(false);
            }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Sync Ledger Records
          </button>

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              handleLogout();
            }}
            style={{
              width: '100%',
              minHeight: '42px',
              padding: '10px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--brand-rose)',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Navigation Tabs (Desktop) */}
      <div className="desktop-nav-tabs" style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-surface)', padding: '0 24px', overflowX: 'auto', transition: 'background 0.2s ease' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', gap: '4px' }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'chase', label: 'Chase Today', icon: Zap, badge: overdueCount > 0 ? overdueCount : undefined },
            { id: 'who_owes', label: 'Who Owes Me', icon: Users },
            { id: 'forecast', label: '13-Wk Cash Forecast', icon: TrendingUp },
            { id: 'scenarios', label: 'What-If Scenarios', icon: Sliders },
            { id: 'ai', label: 'WhatsApp Bot Hub', icon: Smartphone, highlight: true },
            { id: 'invoices', label: 'Invoices & Payments', icon: FileText },
            { id: 'families', label: 'Students / Families', icon: UserCheck },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedInvoiceId(undefined);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '13px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--brand-primary)' : '2px solid transparent',
                  color: isActive ? 'var(--brand-primary)' : tab.highlight ? 'var(--brand-sky)' : 'var(--text-muted)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    style={{
                      background: 'var(--brand-rose)',
                      color: '#ffffff',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '999px',
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <main style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '24px 24px', flex: 1 }}>
        {activeTab === 'dashboard' && (
          <DashboardView
            whoOwes={whoOwesData}
            alerts={alerts}
            cashFlowInsights={cashFlowInsights}
            forecast={forecastData}
            chaseItems={chaseItems}
            onNavigate={navigateTo}
            currencySymbol={currencySymbol}
          />
        )}

        {activeTab === 'chase' && (
          <ChaseTodayView
            items={chaseItems}
            currencySymbol={currencySymbol}
            onRefresh={loadData}
            selectedInvoiceId={selectedInvoiceId}
          />
        )}

        {activeTab === 'who_owes' && (
          <WhoOwesView
            data={whoOwesData}
            currencySymbol={currencySymbol}
            onChaseFamily={(famId) => {
              const item = chaseItems.find((c) => c.family_id === famId);
              if (item) {
                setSelectedInvoiceId(item.invoice_id);
                setActiveTab('chase');
              } else {
                setActiveTab('chase');
              }
            }}
            onRecordPayment={(famId) => {
              setPresetFamilyId(famId);
              setActiveTab('invoices');
            }}
            onToggleShowAll={(show) => {
              setShowAllWhoOwes(show);
              api.getWhoOwes(show).then(setWhoOwesData);
            }}
            showAll={showAllWhoOwes}
          />
        )}

        {activeTab === 'forecast' && (
          <ForecastView forecast={forecastData} currencySymbol={currencySymbol} />
        )}

        {activeTab === 'scenarios' && (
          <ScenariosView
            scenarios={scenarios}
            forecast={forecastData}
            currencySymbol={currencySymbol}
            onRefresh={loadData}
          />
        )}

        {activeTab === 'ai' && (
          <AiAssistantView
            families={families}
            currencySymbol={currencySymbol}
            cashFlowInsights={cashFlowInsights}
            onPaymentRecorded={loadData}
          />
        )}

        {activeTab === 'invoices' && (
          <InvoicesView
            invoices={invoices}
            families={families}
            currencySymbol={currencySymbol}
            onRefresh={loadData}
            presetFamilyId={presetFamilyId}
          />
        )}

        {activeTab === 'families' && (
          <FamiliesView families={families} currencySymbol={currencySymbol} onRefresh={loadData} />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            bills={bills}
            expenses={expenses}
            currencySymbol={currencySymbol}
            onRefresh={loadData}
          />
        )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-color)', padding: '16px 24px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        Tutor Ledger • WhatsApp-First Financial Back Office for Home Tutors • Problem Statement 1 (Ace Builders Hackathon 2026)
      </footer>
    </div>
  );
}
