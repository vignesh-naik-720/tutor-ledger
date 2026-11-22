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
} from '../types';

let cachedCsrfToken: string | null = null;

export async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;
  try {
    const res = await fetch('/api/v1/auth/session', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      cachedCsrfToken = data.csrf_token;
      return data.csrf_token;
    }
  } catch {}
  return '';
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method?.toUpperCase() || '')) {
    const csrf = await getCsrfToken();
    if (csrf) {
      headers['X-CSRF-Token'] = csrf;
    }
  }

  const res = await fetch(`/api/v1${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    let errorDetail = 'Request failed';
    try {
      const json = await res.json();
      errorDetail = json.error?.message || json.error?.code || errorDetail;
    } catch {
      try {
        const text = await res.text();
        if (text && text.includes('ECONNREFUSED')) {
          errorDetail = 'Backend server (port 3001) is not running. Please start the backend.';
        }
      } catch {}
    }
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      errorDetail = 'Backend server is not reachable. Please start the backend service.';
    }
    const err = new Error(errorDetail);
    (err as any).status = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Auth & Setup
  getSetupStatus: () => request<{ owner_exists: boolean; is_sample_data: boolean; currency_code: string }>('/setup/status'),
  setupOwner: (data: { setup_secret: string; password: string; currency_code?: string; minimum_balance_minor?: number }) =>
    request<{ status: string; ledger_id: string; csrf_token: string }>('/setup/owner', { method: 'POST', body: JSON.stringify(data) }),
  login: (password: string) =>
    request<{ status: string; csrf_token: string; ledger_id: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }).then((res) => {
      cachedCsrfToken = res.csrf_token;
      return res;
    }),
  logout: () =>
    request<{ status: string }>('/auth/logout', { method: 'POST' }).then((res) => {
      cachedCsrfToken = null;
      return res;
    }),
  getSession: () =>
    request<{ status: string; ledger_id: string; csrf_token: string; idle_timeout_seconds: number }>('/auth/session').then(
      (res) => {
        cachedCsrfToken = res.csrf_token;
        return res;
      },
    ),
  loadSampleData: () => request<{ status: string; familiesCount: number; invoicesCount: number }>('/setup/sample-data', { method: 'POST' }),
  removeSampleData: () => request<{ status: string }>('/setup/sample-data', { method: 'DELETE' }),

  // Families
  getFamilies: () => request<{ families: Family[]; currency_code: string }>('/families'),
  createFamily: (data: { name: string; phone: string; default_fee_minor?: number; default_term_days?: number; default_tone?: string }) =>
    request<{ family: Family; duplicate_phone: boolean }>('/families', { method: 'POST', body: JSON.stringify(data) }),
  deleteFamily: (id: string) => request<{ status: string; deleted_id: string }>(`/families/${id}`, { method: 'DELETE' }),

  // Invoices & Payments
  getInvoices: () => request<{ invoices: Invoice[]; currency_code: string }>('/invoices'),
  createInvoice: (data: { family_id: string; client_event_id: string }) =>
    request<{ invoice: Invoice }>('/invoices', { method: 'POST', body: JSON.stringify(data) }),
  recordPayment: (invoiceId: string, data: { amount_minor: number; date_received: string; client_event_id: string; source?: string; was_offline?: boolean }) =>
    request<{ payment: any }>(`/invoices/${invoiceId}/payments`, { method: 'POST', body: JSON.stringify(data) }),
  getInvoicePayments: (invoiceId: string) => request<{ payments: any[] }>(`/invoices/${invoiceId}/payments`),

  // Chase Today & Who Owes
  getChaseToday: () => request<{ chase_today: ChaseTodayItem[]; total_count: number; total_amount_minor: number }>('/chase-today'),
  getWhoOwes: (showAll = false) => request<WhoOwesResponse>(`/who-owes?all=${showAll}`),

  // Reminders
  draftReminder: (data: { invoice_id: string; tone: string; use_ai?: boolean; custom_note?: string; payment_details?: string }) =>
    request<{ draft: any }>('/reminders', { method: 'POST', body: JSON.stringify(data) }),
  openReminderLink: (reminderId: string, ownerConfirmed = true) =>
    request<{ url: string; status: string }>(`/reminders/${reminderId}/open-link`, {
      method: 'POST',
      body: JSON.stringify({ owner_confirmed: ownerConfirmed }),
    }),

  // Forecast & Scenarios
  getForecast: () => request<ForecastResponse>('/forecast'),
  getScenarios: () => request<{ scenarios: Scenario[] }>('/scenarios'),
  createScenario: (data: { name: string; type: string; parameters: any; is_on: boolean }) =>
    request<{ scenario: Scenario }>('/scenarios', { method: 'POST', body: JSON.stringify(data) }),
  toggleScenario: (id: string, isOn: boolean) =>
    request<{ status: string; id: string; is_on: boolean }>(`/scenarios/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_on: isOn }),
    }),

  // Bills & Expenses
  getBills: () => request<{ bills: RecurringBill[] }>('/bills'),
  createBill: (data: { name: string; amount_minor: number; next_due_date: string }) =>
    request<{ bill: RecurringBill }>('/bills', { method: 'POST', body: JSON.stringify(data) }),
  getExpenses: () => request<{ expenses: OneOffExpense[] }>('/expenses'),
  createExpense: (data: { description: string; amount_minor: number; expense_date: string }) =>
    request<{ expense: OneOffExpense }>('/expenses', { method: 'POST', body: JSON.stringify(data) }),

  // Alerts & AI & WhatsApp
  getAlerts: () => request<{ alerts: AppAlert[]; count: number }>('/alerts'),
  getCashFlowInsights: () => request<{ insights: CashFlowInsight }>('/ai/cashflow-insights'),
  parsePaymentMessageAI: (text: string) => request<{ result: any }>('/ai/parse-payment', { method: 'POST', body: JSON.stringify({ text }) }),
  draftReminderAI: (data: any) => request<any>('/ai/draft-reminder', { method: 'POST', body: JSON.stringify(data) }),
  simulateWhatsApp: (text: string) =>
    request<{ reply: string; action?: string; hasPending?: boolean }>('/whatsapp/simulate', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  getWhatsAppStatus: () =>
    request<{
      status: string;
      webhookUrl: string;
      twilioSandboxNumber: string;
      hasPendingVerification: boolean;
      pendingDetails: { student: string; amount: number; method: string } | null;
    }>('/whatsapp/status'),

  // Settings & Export
  getSettings: () => request<{ settings: LedgerSettings }>('/settings'),
  updateMinimumBalance: (minimum_balance_minor: number) =>
    request<{ status: string }>('/settings/minimum-balance', { method: 'PUT', body: JSON.stringify({ minimum_balance_minor }) }),
  updateLedgerSettings: (data: Partial<LedgerSettings>) =>
    request<{ status: string }>('/settings/ledger', { method: 'PUT', body: JSON.stringify(data) }),
};
