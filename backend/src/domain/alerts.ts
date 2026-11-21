// Smart alerts with single action (FR-039..FR-041).
// Capped at 3 alerts per week. Each alert has EXACTLY ONE action.

export type AlertRuleCode = 'CASH_BELOW_MINIMUM' | 'INVOICE_OVERDUE';
export type AlertAction = 'OPEN_REMINDER' | 'OPEN_SCENARIO' | 'OPEN_CHASE_TODAY';

export interface AppAlert {
  id: string;
  rule: AlertRuleCode;
  severity: number; // 1-10 (higher = more urgent)
  raised_at: string;
  title: string;
  message: string;
  action: AlertAction;
  action_label: string;
  action_target_id?: string;
}

export interface AlertEvaluationContext {
  lowestCashMinor: number;
  lowestCashWeek: number;
  minimumBalanceMinor: number;
  overdueInvoices: Array<{
    invoiceId: string;
    familyId: string;
    familyName: string;
    amountMinor: number;
    daysOverdue: number;
  }>;
}

export function evaluateAlerts(ctx: AlertEvaluationContext): AppAlert[] {
  const alerts: AppAlert[] = [];

  // Rule 1: Cash falls below minimum threshold
  if (ctx.lowestCashMinor < ctx.minimumBalanceMinor) {
    const isNegative = ctx.lowestCashMinor <= 0;
    alerts.push({
      id: 'alert-cash-min',
      rule: 'CASH_BELOW_MINIMUM',
      severity: isNegative ? 10 : 8,
      raised_at: new Date().toISOString(),
      title: isNegative ? 'Critical Cash Deficit Projected' : 'Cash Below Safety Cushion',
      message: `Forecast dips to ₹${(ctx.lowestCashMinor / 100).toLocaleString('en-IN')} in Week ${ctx.lowestCashWeek}, below your minimum cushion of ₹${(ctx.minimumBalanceMinor / 100).toLocaleString('en-IN')}.`,
      action: 'OPEN_SCENARIO',
      action_label: 'View What-If Scenarios',
    });
  }

  // Rule 2: Invoices overdue
  if (ctx.overdueInvoices.length > 0) {
    // Top overdue
    const topOverdue = ctx.overdueInvoices[0]!;
    alerts.push({
      id: `alert-overdue-${topOverdue.invoiceId}`,
      rule: 'INVOICE_OVERDUE',
      severity: topOverdue.daysOverdue > 14 ? 9 : 7,
      raised_at: new Date().toISOString(),
      title: `${topOverdue.familyName} is ${topOverdue.daysOverdue} days overdue`,
      message: `Invoice for ₹${(topOverdue.amountMinor / 100).toLocaleString('en-IN')} was due ${topOverdue.daysOverdue} days ago. A WhatsApp reminder is ready.`,
      action: 'OPEN_REMINDER',
      action_label: 'Send WhatsApp Reminder',
      action_target_id: topOverdue.invoiceId,
    });

    if (ctx.overdueInvoices.length > 1) {
      alerts.push({
        id: 'alert-chase-queue',
        rule: 'INVOICE_OVERDUE',
        severity: 6,
        raised_at: new Date().toISOString(),
        title: `${ctx.overdueInvoices.length} invoices waiting to be chased`,
        message: 'Prioritized collection queue is ready to review and send follow-ups in 2 taps.',
        action: 'OPEN_CHASE_TODAY',
        action_label: 'Open Chase Today',
      });
    }
  }

  // Cap at at most 3 alerts per week (FR-039)
  alerts.sort((a, b) => b.severity - a.severity);
  return alerts.slice(0, 3);
}
