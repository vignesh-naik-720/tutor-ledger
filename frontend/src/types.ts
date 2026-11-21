// Frontend Data Types

export interface Family {
  id: string;
  name: string;
  phone_masked: string;
  default_fee_minor: number;
  default_term_days: number;
  default_tone: 'friendly' | 'neutral' | 'firm';
  avg_delay_days: number | null;
  payment_count: number;
}

export interface Invoice {
  id: string;
  family_id: string;
  family_name?: string;
  period_start: string;
  period_end: string;
  amount_minor: number;
  paid_minor?: number;
  remaining_minor?: number;
  issue_date: string;
  due_date: string;
  status: 'draft' | 'due-awaiting-confirmation' | 'open' | 'partially-paid' | 'paid' | 'void';
  version: number;
  currency_code: string;
}

export interface Payment {
  id: string;
  amount_minor: number;
  date_received: string;
  source: string;
  was_offline: boolean;
  recorded_at: string;
}

export interface ChaseTodayItem {
  invoice_id: string;
  family_id: string;
  family_name: string;
  phone_masked: string;
  phone_full: string;
  remaining_minor: number;
  due_date: string;
  days_overdue: number;
  priority_score: number;
  thin_history: boolean;
  default_tone: 'friendly' | 'neutral' | 'firm';
}

export interface FamilyWhoOwes {
  family_id: string;
  family_name: string;
  phone_masked: string;
  outstanding_minor: number;
  oldest_unpaid_date: string;
  total_invoiced_minor: number;
  open_invoices_count: number;
  days_oldest_overdue: number;
  default_tone: 'friendly' | 'neutral' | 'firm';
}

export interface WhoOwesResponse {
  currency_code: string;
  total_outstanding_minor: number;
  families_owing_count: number;
  average_days_to_pay: number;
  families: FamilyWhoOwes[];
  has_more: boolean;
}

export interface ForecastPoint {
  weekIndex: number;
  weekStart: string;
  weekEnd: string;
  openingBalanceMinor: number;
  inflowsMinor: number;
  outflowsMinor: number;
  closingBalanceMinor: number;
  bestClosingMinor: number;
  worstClosingMinor: number;
  inflowSources: Array<{
    sourceType: string;
    sourceId: string;
    description: string;
    amountMinor: number;
    date: string;
    familyId?: string;
    confidence?: string;
  }>;
  outflowSources: Array<{
    sourceType: string;
    sourceId: string;
    description: string;
    amountMinor: number;
    date: string;
  }>;
  confidence: 'high' | 'medium' | 'low';
  belowMinimum: boolean;
}

export interface ForecastResponse {
  currency_code: string;
  baseline: {
    weeks: ForecastPoint[];
    lowestCashWeekIndex: number;
    lowestCashMinor: number;
    fallsBelowMinimum: boolean;
    minBalanceThreshold: number;
  };
  scenario: {
    weeks: ForecastPoint[];
    lowestCashWeekIndex: number;
    lowestCashMinor: number;
    fallsBelowMinimum: boolean;
    minBalanceThreshold: number;
  } | null;
  active_scenarios_count: number;
}

export interface Scenario {
  id: string;
  name: string;
  type: string;
  parameters: any;
  is_on: boolean;
}

export interface AppAlert {
  id: string;
  rule: 'CASH_BELOW_MINIMUM' | 'INVOICE_OVERDUE';
  severity: number;
  raised_at: string;
  title: string;
  message: string;
  action: 'OPEN_REMINDER' | 'OPEN_SCENARIO' | 'OPEN_CHASE_TODAY';
  action_label: string;
  action_target_id?: string;
}

export interface CashFlowInsight {
  status: 'safe' | 'caution' | 'critical';
  summary: string;
  lowestCashWeek: number;
  lowestCashFormatted: string;
  actions: string[];
  riskAnalysis: string;
}

export interface RecurringBill {
  id: string;
  name: string;
  amount_minor: number;
  frequency: 'monthly';
  next_due_date: string;
  is_active: boolean;
}

export interface OneOffExpense {
  id: string;
  description: string;
  amount_minor: number;
  expense_date: string;
}

export interface LedgerSettings {
  currency_code: string;
  currency_exponent: number;
  owner_timezone: string;
  minimum_balance_minor: number;
  opening_balance_minor: number;
  is_sample_data: boolean;
}
