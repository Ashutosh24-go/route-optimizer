import React, { useState, useEffect } from 'react';

const ALG_COLORS = {
  'Nearest neighbor': '#3b82f6',
  '2-opt': '#10b981',
  'Held-Karp': '#8b5cf6',
  'Brute force': '#f59e0b'
};

export function RouteComparison({ onNotify }) {
  const [benchmarkData, setBenchmarkData] = useState({ resultsTable: [], chartSeries: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBenchmark();
  }, []);

  async function fetchBenchmark() {
    setLoading(true);
    try {
      const res = await fetch('/api/benchmark');
      const data = await res.json();
      setBenchmarkData(data);
    } catch (err) {
      onNotify('Error loading benchmark data: ' + err.message, true);
    } finally {
      setLoading(false);
    }
  }

  const resultsTable = benchmarkData.resultsTable || [];
  const chartSeries = benchmarkData.chartSeries || {};
  const sizes = [5, 10, 50, 100];
  const width = 460;
  const height = 230;
  const pad = { top: 20, right: 30, bottom: 35, left: 55 };

  const xMap = (n) => {
    const idx = sizes.indexOf(n);
    return pad.left + (idx / (sizes.length - 1)) * (width - pad.left - pad.right);
  };

  // Compute Time Series coordinates (log scale)
  const timeSeries = chartSeries.computeTimeVsN || {};
  const timeLines = Object.entries(timeSeries).map(([alg, points]) => {
    if (!points || points.length === 0) return null;
    const color = ALG_COLORS[alg] || '#0066FF';
    const coords = points.map((pt) => {
      const x = xMap(pt.n);
      const logVal = Math.log10(Math.max(0.05, pt.timeMs));
      const normY = (logVal - -1) / (2 - -1);
      const clamped = Math.max(0, Math.min(1, normY));
      const y = height - pad.bottom - clamped * (height - pad.top - pad.bottom);
      return { x, y, pt };
    });

    const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
    return { alg, color, coords, pathD };
  }).filter(Boolean);

  // Tour Cost Series coordinates (linear scale)
  const maxCost = 800;
  const costSeries = chartSeries.costVsN || {};
  const costLines = Object.entries(costSeries).map(([alg, points]) => {
    if (!points || points.length === 0) return null;
    const color = ALG_COLORS[alg] || '#0066FF';
    const coords = points.map((pt) => {
      const x = xMap(pt.n);
      const y = height - pad.bottom - (Math.min(maxCost, pt.costKm) / maxCost) * (height - pad.top - pad.bottom);
      return { x, y, pt };
    });

    const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
    return { alg, color, coords, pathD };
  }).filter(Boolean);

  const timeTicks = [
    { label: '0.1 ms', val: 0.1 },
    { label: '1 ms', val: 1 },
    { label: '10 ms', val: 10 },
    { label: '100 ms', val: 100 }
  ];

  const costTicks = [0, 200, 400, 600, 800];

  return (
    <div className="flex flex-col min-w-0">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">Route Comparison</h1>
        <p className="text-sm text-slate-500 mt-1 font-normal">Empirical benchmark comparing Nearest Neighbor, 2-opt, Held-Karp, and Brute Force across 5, 10, 50, and 100 stops.</p>
      </header>

      {/* Benchmark Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Chart 1: Compute Time */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Compute Time vs Instance Size (n)</h2>
              <p className="text-[11px] text-slate-400">Median execution time (ms, logarithmic scale)</p>
            </div>
            <span className="text-[10px] font-semibold text-slate-500 px-2 py-0.5 bg-slate-100 rounded">ms vs n</span>
          </div>

          <div className="h-64 relative flex items-center justify-center">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
              <line x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} stroke="#cbd5e1" strokeWidth="1"/>
              <line x1={pad.left} y1={pad.top} x2={pad.left} y2={height - pad.bottom} stroke="#cbd5e1" strokeWidth="1"/>

              {sizes.map((n) => {
                const x = xMap(n);
                return (
                  <g key={n}>
                    <line x1={x} y1={height - pad.bottom} x2={x} y2={height - pad.bottom + 4} stroke="#94a3b8"/>
                    <text x={x} y={height - pad.bottom + 18} fontSize="10" fill="#64748b" textAnchor="middle" fontFamily="Inter">
                      n={n}
                    </text>
                  </g>
                );
              })}

              {timeTicks.map((tick, i) => {
                const y = height - pad.bottom - (i / (timeTicks.length - 1)) * (height - pad.top - pad.bottom);
                return (
                  <g key={tick.label}>
                    <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#f1f5f9" strokeWidth="1"/>
                    <text x={pad.left - 8} y={y + 3} fontSize="9" fill="#94a3b8" textAnchor="end" fontFamily="Inter">
                      {tick.label}
                    </text>
                  </g>
                );
              })}

              {timeLines.map((line) => (
                <g key={line.alg}>
                  <path d={line.pathD} fill="none" stroke={line.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  {line.coords.map((c, i) => (
                    <circle key={i} cx={c.x.toFixed(1)} cy={c.y.toFixed(1)} r="4" fill="#ffffff" stroke={line.color} strokeWidth="2">
                      <title>{`${line.alg} (n=${c.pt.n}): ${c.pt.timeMs} ms`}</title>
                    </circle>
                  ))}
                </g>
              ))}
            </svg>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-600">
            <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-[#3b82f6] rounded"></span> Nearest neighbor</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-[#10b981] rounded"></span> 2-opt</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-[#8b5cf6] rounded"></span> Held-Karp</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-[#f59e0b] rounded"></span> Brute force</div>
          </div>
        </div>

        {/* Chart 2: Tour Cost */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Tour Distance vs Instance Size (n)</h2>
              <p className="text-[11px] text-slate-400">Total round trip distance (km)</p>
            </div>
            <span className="text-[10px] font-semibold text-slate-500 px-2 py-0.5 bg-slate-100 rounded">km vs n</span>
          </div>

          <div className="h-64 relative flex items-center justify-center">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
              <line x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} stroke="#cbd5e1" strokeWidth="1"/>
              <line x1={pad.left} y1={pad.top} x2={pad.left} y2={height - pad.bottom} stroke="#cbd5e1" strokeWidth="1"/>

              {sizes.map((n) => {
                const x = xMap(n);
                return (
                  <g key={n}>
                    <line x1={x} y1={height - pad.bottom} x2={x} y2={height - pad.bottom + 4} stroke="#94a3b8"/>
                    <text x={x} y={height - pad.bottom + 18} fontSize="10" fill="#64748b" textAnchor="middle" fontFamily="Inter">
                      n={n}
                    </text>
                  </g>
                );
              })}

              {costTicks.map((val) => {
                const y = height - pad.bottom - (val / maxCost) * (height - pad.top - pad.bottom);
                return (
                  <g key={val}>
                    <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#f1f5f9" strokeWidth="1"/>
                    <text x={pad.left - 8} y={y + 3} fontSize="9" fill="#94a3b8" textAnchor="end" fontFamily="Inter">
                      {val} km
                    </text>
                  </g>
                );
              })}

              {costLines.map((line) => (
                <g key={line.alg}>
                  <path d={line.pathD} fill="none" stroke={line.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  {line.coords.map((c, i) => (
                    <circle key={i} cx={c.x.toFixed(1)} cy={c.y.toFixed(1)} r="4" fill="#ffffff" stroke={line.color} strokeWidth="2">
                      <title>{`${line.alg} (n=${c.pt.n}): ${c.pt.costKm} km`}</title>
                    </circle>
                  ))}
                </g>
              ))}
            </svg>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-600">
            <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-[#3b82f6] rounded"></span> Nearest neighbor</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-[#10b981] rounded"></span> 2-opt</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-[#8b5cf6] rounded"></span> Held-Karp (Optimal)</div>
          </div>
        </div>
      </div>

      {/* Benchmark Results Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Benchmark Results Table</h2>
          <span className="text-xs text-slate-500">5 repetitions per solver &bull; Seeded PRNG (mulberry32)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="text-[11px] font-semibold text-slate-900 border-b border-slate-200 bg-slate-50/50">
              <tr>
                <th className="py-3 px-4 font-semibold text-center w-16">Size (n)</th>
                <th className="py-3 px-3 font-semibold">Algorithm</th>
                <th className="py-3 px-3 font-semibold">Status</th>
                <th className="py-3 px-3 font-semibold">Tour Cost</th>
                <th className="py-3 px-3 font-semibold">Compute Time</th>
                <th className="py-3 px-3 font-semibold">Gap from Optimal</th>
                <th className="py-3 px-4 font-semibold">Notes / Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {resultsTable.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    {loading ? 'Running benchmark instances...' : 'No benchmark data available'}
                  </td>
                </tr>
              ) : (
                resultsTable.map((r, idx) => {
                  const isCompleted = r.status === 'completed';
                  const statusBadge = isCompleted ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      did not finish
                    </span>
                  );

                  let gapContent = <span className="text-slate-400">—</span>;
                  if (r.gapFromOptimal !== null) {
                    if (r.gapFromOptimal === 0) {
                      gapContent = <span className="text-emerald-700 font-bold">0.0% (Optimal)</span>;
                    } else {
                      gapContent = <span className="text-amber-700 font-medium">+{r.gapFromOptimal.toFixed(1)}%</span>;
                    }
                  }

                  return (
                    <tr key={idx} className={`${!isCompleted ? 'bg-slate-50/40 text-slate-500' : 'hover:bg-slate-50'} transition`}>
                      <td className="py-2.5 px-4 text-center font-bold text-slate-900">{r.n}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{r.algorithm}</td>
                      <td className="py-2.5 px-3">{statusBadge}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        {r.costKm !== null ? `${r.costKm.toFixed(1)} km` : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-800">
                        {r.computeTimeMs !== null ? `${r.computeTimeMs.toFixed(2)} ms` : '—'}
                      </td>
                      <td className="py-2.5 px-3">{gapContent}</td>
                      <td className="py-2.5 px-4">
                        {r.reason ? (
                          <span className="text-slate-500 italic text-[10px]">{r.reason}</span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
