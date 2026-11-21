import { describe, expect, it } from 'vitest';
import { build13WeekForecast, type ForecastInput } from '../src/forecast.js';
import { applyScenarios, type ScenarioDefinition } from '../src/scenarios.js';

describe('Shared Forecast Engine (pure, deterministic)', () => {
  const baseInput: ForecastInput = {
    startDate: '2026-11-23',
    openingBalanceMinor: 2500000, // ₹25,000.00
    minimumBalanceMinor: 1000000, // ₹10,000.00
    invoices: [
      {
        id: 'inv-1',
        familyId: 'fam-1',
        familyName: 'Sharma Family',
        amountMinor: 500000,
        remainingMinor: 500000,
        dueDate: '2026-12-07', // Week 3
        status: 'open',
        familyPaymentCount: 5,
        familyAvgDelayDays: 7, // Due on week 3 + 7 days -> Lands in Week 4
      },
      {
        id: 'inv-2',
        familyId: 'fam-2',
        familyName: 'Verma Family',
        amountMinor: 600000,
        remainingMinor: 600000,
        dueDate: '2026-11-25', // Week 1
        status: 'open',
        familyPaymentCount: 1, // thin history (< 3)
        familyAvgDelayDays: null, // no history delay -> widens band
      },
    ],
    bills: [
      {
        id: 'bill-rent',
        name: 'Study Room Rent',
        amountMinor: 800000, // ₹8,000.00
        frequency: 'monthly',
        nextDueDate: '2026-12-01', // Week 2
        isActive: true,
      },
    ],
    expenses: [
      {
        id: 'exp-books',
        description: 'Textbooks and worksheets',
        amountMinor: 150000,
        expenseDate: '2026-11-28', // Week 1
      },
    ],
  };

  it('computes 13 weeks with deterministic balances and source traceability', () => {
    const result = build13WeekForecast(baseInput);
    expect(result.weeks).toHaveLength(13);
    expect(result.weeks[0]?.weekIndex).toBe(1);
    expect(result.weeks[0]?.openingBalanceMinor).toBe(2500000);

    // Week 1 should have expense 150000 and inv-2 inflow 600000
    expect(result.weeks[0]?.inflowsMinor).toBe(600000);
    expect(result.weeks[0]?.outflowsMinor).toBe(150000);
    expect(result.weeks[0]?.closingBalanceMinor).toBe(2500000 + 600000 - 150000);

    // Week 1 has thin history invoice -> confidence is low
    expect(result.weeks[0]?.confidence).toBe('low');

    // Traceability: verify source records are attached
    expect(result.weeks[0]?.inflowSources[0]?.sourceId).toBe('inv-2');
    expect(result.weeks[0]?.outflowSources[0]?.sourceId).toBe('exp-books');
  });

  it('shifts invoice with historical delay correctly (FR-032)', () => {
    const result = build13WeekForecast(baseInput);
    // inv-1 is due 2026-12-07 + 7 days = 2026-12-14.
    // Start date is 2026-11-23. Days diff = 21 days -> Week 4.
    const week4 = result.weeks[3];
    expect(week4?.inflowsMinor).toBe(500000);
    expect(week4?.inflowSources[0]?.sourceId).toBe('inv-1');
  });

  it('applies what-if scenario (late payment by 15 days) seamlessly', () => {
    const scenario: ScenarioDefinition = {
      id: 'sc-1',
      name: 'Sharma 15 days late',
      type: 'builtin_late_payment',
      isOn: true,
      parameters: {
        latePayment: {
          familyId: 'fam-1',
          delayDays: 15,
        },
      },
    };

    const transformed = applyScenarios(baseInput, [scenario]);
    const result = build13WeekForecast(transformed);
    // Formerly week 4 (2026-12-14), delayed +15 days -> 2026-12-29 (Week 6)
    const week4 = result.weeks[3];
    expect(week4?.inflowsMinor).toBe(0);

    const week6 = result.weeks[5];
    expect(week6?.inflowsMinor).toBe(500000);
  });

  it('applies bill rise scenario using basis points', () => {
    const scenario: ScenarioDefinition = {
      id: 'sc-bill',
      name: 'Rent rises by 15%',
      type: 'builtin_bill_rise',
      isOn: true,
      parameters: {
        billRise: {
          billId: 'bill-rent',
          percentBp: 1500, // 15%
        },
      },
    };

    const transformed = applyScenarios(baseInput, [scenario]);
    // 800000 + 15% = 920000
    expect(transformed.bills[0]?.amountMinor).toBe(920000);
  });
});
