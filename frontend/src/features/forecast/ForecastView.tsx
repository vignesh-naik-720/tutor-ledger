import React, { useState } from 'react';
import type { ForecastResponse, ForecastPoint } from '../../types';
import { TrendingUp, AlertTriangle, Info, Calendar, ArrowRight, Layers } from 'lucide-react';

interface ForecastViewProps {
  forecast: ForecastResponse | null;
  currencySymbol: string;
}

export const ForecastView: React.FC<ForecastViewProps> = ({ forecast, currencySymbol }) => {
  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number>(1);

  if (!forecast || !forecast.baseline) {
    return <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>Loading 13-week forecast...</div>;
  }

  const { baseline, scenario } = forecast;
  const weeks = scenario ? scenario.weeks : baseline.weeks;
  const selectedWeek = weeks[selectedWeekIdx - 1] || weeks[0];

  const minThreshold = baseline.minBalanceThreshold / 100;
  const lowestWeek = scenario ? scenario.lowestCashWeekIndex : baseline.lowestCashWeekIndex;
  const lowestCash = scenario ? scenario.lowestCashMinor / 100 : baseline.lowestCashMinor / 100;
  const fallsBelowMin = scenario ? scenario.fallsBelowMinimum : baseline.fallsBelowMinimum;

  // SVG Chart Dimensions & Scaling
  const width = 800;
  const height = 240;
  const padX = 40;
  const padY = 30;

  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  // Find min/max values for scaling
  const allValues = weeks.flatMap((w) => [
    w.closingBalanceMinor / 100,
    w.bestClosingMinor / 100,
    w.worstClosingMinor / 100,
    minThreshold,
  ]);
  const minVal = Math.min(0, ...allValues);
  const maxVal = Math.max(10000, ...allValues) * 1.15;
  const valRange = maxVal - minVal || 1;

  const getX = (idx: number) => padX + (idx / 12) * chartW;
  const getY = (val: number) => height - padY - ((val - minVal) / valRange) * chartH;

  // Build SVG path strings
  const baselinePoints = weeks.map((w, idx) => `${getX(idx)},${getY(w.closingBalanceMinor / 100)}`);
  const bestPoints = weeks.map((w, idx) => `${getX(idx)},${getY(w.bestClosingMinor / 100)}`);
  const worstPoints = [...weeks].reverse().map((w, idx) => `${getX(12 - idx)},${getY(w.worstClosingMinor / 100)}`);

  const areaPolygon = `${bestPoints.join(' ')} ${worstPoints.join(' ')}`;
  const baselineLine = `M ${baselinePoints.join(' L ')}`;
  const minLineY = getY(minThreshold);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>📈 13-Week Cash Forecast</h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Pure deterministic projection built from upcoming fee dates (adjusted by historical family delays) and bills.
          </p>
        </div>

        {scenario && (
          <div className="badge badge-indigo" style={{ padding: '6px 14px' }}>
            What-If Scenario Active (Transformed View)
          </div>
        )}
      </div>

      {/* Forecast Status Header */}
      <div
        className="glass-card"
        style={{
          borderLeft: fallsBelowMin ? '4px solid #ef4444' : '4px solid #10b981',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {fallsBelowMin ? <AlertTriangle size={24} color="#f87171" /> : <TrendingUp size={24} color="#34d399" />}
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: fallsBelowMin ? '#f87171' : '#34d399' }}>
              {fallsBelowMin
                ? `Projected Cash Dip Below Cushion in Week ${lowestWeek}`
                : `Healthy Cash Position (Comfortably Above Safety Cushion)`}
            </div>
            <div style={{ fontSize: '0.825rem', color: '#94a3b8' }}>
              Lowest projected balance: <strong>{currencySymbol}{lowestCash.toLocaleString('en-IN')}</strong> in Week {lowestWeek}. Safety threshold: {currencySymbol}{minThreshold.toLocaleString('en-IN')}.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#10b981' }}></span> Baseline
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'rgba(16, 185, 129, 0.2)' }}></span> Best / Worst Band
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '2px', background: '#f59e0b' }}></span> Safety Cushion
          </span>
        </div>
      </div>

      {/* SVG Forecast Chart */}
      <div className="glass-card" style={{ padding: '24px 16px' }}>
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', minWidth: '600px' }}>
            <defs>
              <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const y = padY + pct * chartH;
              return (
                <line key={i} x1={padX} y1={y} x2={width - padX} y2={y} stroke="#334155" strokeDasharray="4 4" strokeWidth="0.8" />
              );
            })}

            {/* Minimum Balance Cushion Line (Amber dashed) */}
            <line
              x1={padX}
              y1={minLineY}
              x2={width - padX}
              y2={minLineY}
              stroke="#f59e0b"
              strokeWidth="1.5"
              strokeDasharray="6 4"
            />
            <text x={padX + 6} y={minLineY - 6} fill="#fbbf24" fontSize="10" fontWeight="600">
              Min Safety Cushion: {currencySymbol}{minThreshold.toLocaleString('en-IN')}
            </text>

            {/* Best / Worst Uncertainty Band */}
            <polygon points={areaPolygon} fill="url(#bandGrad)" />

            {/* Baseline Cash Curve */}
            <path d={baselineLine} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

            {/* Interactive Week Points */}
            {weeks.map((w, idx) => {
              const cx = getX(idx);
              const cy = getY(w.closingBalanceMinor / 100);
              const isSelected = selectedWeekIdx === w.weekIndex;
              const isLowest = w.weekIndex === lowestWeek;
              const isWeek7 = w.weekIndex === 7;

              return (
                <g key={w.weekIndex} onClick={() => setSelectedWeekIdx(w.weekIndex)} style={{ cursor: 'pointer' }}>
                  {/* Vertical bar on hover/select */}
                  {isSelected && (
                    <line x1={cx} y1={padY} x2={cx} y2={height - padY} stroke="#6366f1" strokeWidth="1.5" strokeDasharray="3 3" />
                  )}

                  {/* Marker Dot */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 6 : isLowest ? 5 : 4}
                    fill={isLowest ? '#f43f5e' : isSelected ? '#6366f1' : '#10b981'}
                    stroke="#0f172a"
                    strokeWidth="2"
                  />

                  {/* Week Label */}
                  <text
                    x={cx}
                    y={height - padY + 16}
                    fill={isSelected ? '#6366f1' : '#94a3b8'}
                    fontSize="10"
                    fontWeight={isSelected ? '700' : '500'}
                    textAnchor="middle"
                  >
                    W{w.weekIndex}
                  </text>

                  {/* Week 7 Dip Callout */}
                  {isWeek7 && (
                    <text x={cx} y={padY + 12} fill="#818cf8" fontSize="10" fontWeight="700" textAnchor="middle">
                      ▼ W7 Dip
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '16px', flexWrap: 'wrap' }}>
          {weeks.map((w) => (
            <button
              key={w.weekIndex}
              onClick={() => setSelectedWeekIdx(w.weekIndex)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: selectedWeekIdx === w.weekIndex ? '1px solid #10b981' : '1px solid #334155',
                background: selectedWeekIdx === w.weekIndex ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.6)',
                color: selectedWeekIdx === w.weekIndex ? '#34d399' : '#94a3b8',
                cursor: 'pointer',
              }}
            >
              Week {w.weekIndex}
            </button>
          ))}
        </div>
      </div>

      {/* Week Drilldown & Traceability Inspector (FR-034: 100% Traceability) */}
      {selectedWeek && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Calendar size={20} color="#34d399" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                Week {selectedWeek.weekIndex} Breakdown ({selectedWeek.weekStart} to {selectedWeek.weekEnd})
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {selectedWeek.confidence === 'low' && (
                <span className="badge badge-amber">Thin / No Payment History (Wide Band)</span>
              )}
              {selectedWeek.belowMinimum && <span className="badge badge-rose">Below Safety Cushion</span>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>OPENING BALANCE</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                {currencySymbol}
                {(selectedWeek.openingBalanceMinor / 100).toLocaleString('en-IN')}
              </div>
            </div>

            <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: '#34d399' }}>EXPECTED INFLOWS</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#34d399' }}>
                +{currencySymbol}
                {(selectedWeek.inflowsMinor / 100).toLocaleString('en-IN')}
              </div>
            </div>

            <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: '#f87171' }}>EXPECTED OUTFLOWS</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f87171' }}>
                -{currencySymbol}
                {(selectedWeek.outflowsMinor / 100).toLocaleString('en-IN')}
              </div>
            </div>

            <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>CLOSING BALANCE</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: selectedWeek.belowMinimum ? '#f87171' : '#f8fafc' }}>
                {currencySymbol}
                {(selectedWeek.closingBalanceMinor / 100).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Traceable Sources List */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Inflow Sources */}
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399', marginBottom: '8px' }}>
                Inflow Records ({selectedWeek.inflowSources.length})
              </div>
              {selectedWeek.inflowSources.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>No invoices expected this week.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selectedWeek.inflowSources.map((src, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(16, 185, 129, 0.06)',
                        border: '1px solid rgba(16, 185, 129, 0.15)',
                        borderRadius: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.8rem',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{src.description}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Expected Date: {src.date}</div>
                      </div>
                      <div style={{ fontWeight: 700, color: '#34d399' }}>
                        +{currencySymbol}
                        {(src.amountMinor / 100).toLocaleString('en-IN')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Outflow Sources */}
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f87171', marginBottom: '8px' }}>
                Outflow Records ({selectedWeek.outflowSources.length})
              </div>
              {selectedWeek.outflowSources.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>No bills or expenses due this week.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selectedWeek.outflowSources.map((src, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(239, 68, 68, 0.06)',
                        border: '1px solid rgba(239, 68, 68, 0.15)',
                        borderRadius: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.8rem',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{src.description}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Due Date: {src.date}</div>
                      </div>
                      <div style={{ fontWeight: 700, color: '#f87171' }}>
                        -{currencySymbol}
                        {(src.amountMinor / 100).toLocaleString('en-IN')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
