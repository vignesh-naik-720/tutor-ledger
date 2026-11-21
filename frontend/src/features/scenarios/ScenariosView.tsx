import React, { useState } from 'react';
import type { Scenario, ForecastResponse } from '../../types';
import { api } from '../../services/api';
import { Sliders, CheckCircle2, TrendingDown, Plus, Sparkles, AlertTriangle } from 'lucide-react';

interface ScenariosViewProps {
  scenarios: Scenario[];
  forecast: ForecastResponse | null;
  currencySymbol: string;
  onRefresh: () => void;
}

export const ScenariosView: React.FC<ScenariosViewProps> = ({
  scenarios,
  forecast,
  currencySymbol,
  onRefresh,
}) => {
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState('Extra Classroom Supplies Expense');
  const [customExpenseAmount, setCustomExpenseAmount] = useState('5000');
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async (scenario: Scenario) => {
    setTogglingId(scenario.id);
    try {
      await api.toggleScenario(scenario.id, !scenario.is_on);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle scenario');
    } finally {
      setTogglingId(null);
    }
  };

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createScenario({
        name: customName,
        type: 'custom',
        parameters: {
          customOutflowChangeMinor: parseInt(customExpenseAmount, 10) * 100,
        },
        is_on: true,
      });
      setShowCustomModal(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to create scenario');
    }
  };

  const baselineLowest = forecast?.baseline?.lowestCashMinor ? forecast.baseline.lowestCashMinor / 100 : 0;
  const scenarioLowest = forecast?.scenario?.lowestCashMinor ? forecast.scenario.lowestCashMinor / 100 : null;
  const scenarioWeek = forecast?.scenario?.lowestCashWeekIndex;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>🔮 What-If Scenarios</h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Simulate risks and decisions before they happen. Toggling updates the 13-week cash curve immediately without altering recorded ledger records (FR-038).
          </p>
        </div>

        <button className="btn-primary" onClick={() => setShowCustomModal(true)}>
          <Plus size={16} />
          Create Custom Scenario
        </button>
      </div>

      {/* Comparison Impact Bar */}
      {scenarioLowest !== null && (
        <div
          className="glass-card"
          style={{
            borderLeft: '4px solid #6366f1',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#818cf8' }}>
              Scenario Comparison Active vs Baseline
            </div>
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '2px' }}>
              Baseline lowest: <strong>{currencySymbol}{baselineLowest.toLocaleString('en-IN')}</strong>. Scenario lowest: <strong style={{ color: scenarioLowest < baselineLowest ? '#f87171' : '#34d399' }}>{currencySymbol}{scenarioLowest.toLocaleString('en-IN')}</strong> in Week {scenarioWeek}.
            </div>
          </div>
          <div className="badge badge-indigo">
            {scenarios.filter((s) => s.is_on).length} Scenarios Combined
          </div>
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderRadius: '8px', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* Scenarios Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {scenarios.map((sc) => {
          const isBusy = togglingId === sc.id;
          return (
            <div
              key={sc.id}
              className="glass-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '20px',
                borderColor: sc.is_on ? '#10b981' : 'rgba(255, 255, 255, 0.08)',
                background: sc.is_on ? 'rgba(16, 185, 129, 0.08)' : 'rgba(30, 41, 59, 0.7)',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span className={`badge ${sc.is_on ? 'badge-emerald' : 'badge-indigo'}`}>
                    {sc.type.replace('builtin_', '').replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: sc.is_on ? '#34d399' : '#64748b' }}>
                    {sc.is_on ? 'ON (ACTIVE)' : 'OFF'}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
                  {sc.name}
                </h3>

                <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4', marginBottom: '16px' }}>
                  {sc.type === 'builtin_late_payment' && 'Shifts expected fee receipts 15 days later to stress-test your cash reserve.'}
                  {sc.type === 'builtin_bill_rise' && 'Models a 15% increase in classroom rent or utility costs.'}
                  {sc.type === 'builtin_new_family' && 'Simulates cash inflows from a new regular tuition student joining.'}
                  {sc.type === 'builtin_family_leaves' && 'Removes upcoming fee receipts if a family leaves at month end.'}
                  {sc.type === 'custom' && 'User-defined what-if parameter modification.'}
                </p>
              </div>

              <button
                className={sc.is_on ? 'btn-primary' : 'btn-secondary'}
                style={{ width: '100%', fontSize: '0.85rem' }}
                onClick={() => handleToggle(sc)}
                disabled={isBusy}
              >
                {isBusy ? 'Applying...' : sc.is_on ? 'Turn Off Scenario' : 'Turn On Scenario'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Custom Scenario Modal */}
      {showCustomModal && (
        <div className="modal-backdrop">
          <div className="glass-card" style={{ maxWidth: '440px', width: '100%' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '12px' }}>
              Create Custom What-If Scenario
            </h3>
            <form onSubmit={handleCreateCustom} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  Scenario Title
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  Additional Outflow Amount ({currencySymbol})
                </label>
                <input
                  type="number"
                  className="input-field"
                  value={customExpenseAmount}
                  onChange={(e) => setCustomExpenseAmount(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowCustomModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save & Apply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
