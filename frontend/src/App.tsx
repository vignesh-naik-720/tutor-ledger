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

import {
  LayoutDashboard,
  Zap,
  Users,
  TrendingUp,
  Sliders,
  Sparkles,
  FileText,
  UserCheck,
  Settings,
  LogOut,
  RefreshCw,
} from 'lucide-react';

export default function App() {
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

  if (authenticated === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: '#94a3b8' }}>
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
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          padding: '12px 24px',
        }}
      >
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => setActiveTab('dashboard')}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
              }}
            >
              <FileText size={22} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
                Tutor Ledger
              </div>
              <div style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 600, textTransform: 'uppercase' }}>
                WhatsApp-First Back Office
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={loadData}
              title="Refresh ledger records"
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              {loading ? 'Refreshing...' : 'Sync'}
            </button>

            <button
              onClick={handleLogout}
              style={{
                background: 'none',
                border: '1px solid #334155',
                color: '#94a3b8',
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
          </div>
        </div>
      </header>

      {/* Main Navigation Tabs */}
      <div style={{ borderBottom: '1px solid #1e293b', background: '#0b0f19', padding: '0 24px', overflowX: 'auto' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', gap: '4px' }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'chase', label: 'Chase Today', icon: Zap, badge: overdueCount > 0 ? overdueCount : undefined },
            { id: 'who_owes', label: 'Who Owes Me', icon: Users },
            { id: 'forecast', label: '13-Wk Cash Forecast', icon: TrendingUp },
            { id: 'scenarios', label: 'What-If Scenarios', icon: Sliders },
            { id: 'ai', label: 'AI Copilot & Parser', icon: Sparkles, highlight: true },
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
                  padding: '14px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #10b981' : '2px solid transparent',
                  color: isActive ? '#34d399' : tab.highlight ? '#818cf8' : '#94a3b8',
                  fontWeight: isActive ? 700 : 600,
                  fontSize: '0.875rem',
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
                      background: '#ef4444',
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
      <main style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '28px 24px', flex: 1 }}>
        {activeTab === 'dashboard' && (
          <DashboardView
            whoOwes={whoOwesData}
            alerts={alerts}
            cashFlowInsights={cashFlowInsights}
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
      <footer style={{ borderTop: '1px solid #1e293b', padding: '16px 24px', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
        Tutor Ledger • WhatsApp-First Financial Back Office for Home Tutors • Problem Statement 1 (Ace Builders Hackathon 2026)
      </footer>
    </div>
  );
}
