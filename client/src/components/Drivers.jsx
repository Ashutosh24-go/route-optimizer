import React, { useState, useEffect } from 'react';

export function Drivers({ onNotify, onNavigateToRoute }) {
  const [drivers, setDrivers] = useState([]);
  const [ordersMap, setOrdersMap] = useState(new Map());
  const [assignmentResult, setAssignmentResult] = useState(null);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [drvRes, ordRes] = await Promise.all([
        fetch('/api/drivers'),
        fetch('/api/orders')
      ]);
      const drvData = await drvRes.json();
      const ordData = await ordRes.json();

      setDrivers(drvData.drivers || []);
      const map = new Map();
      (ordData.orders || []).forEach((o) => map.set(o.id, o));
      setOrdersMap(map);
    } catch (err) {
      onNotify('Error loading drivers data: ' + err.message, true);
    }
  }

  async function handleAssignOrders() {
    setAssigning(true);
    try {
      const res = await fetch('/api/assign', { method: 'POST' });
      const result = await res.json();
      setAssignmentResult(result);
      onNotify(`Assignment complete: ${result.assigned?.length || 0} assigned, ${result.pending?.length || 0} stayed pending.`);
      loadData();
    } catch (err) {
      onNotify('Error during assignment: ' + err.message, true);
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="flex flex-col min-w-0">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">Drivers</h1>
          <p className="text-sm text-slate-500 mt-1 font-normal">Monitor fleet capacity and execute priority order assignment.</p>
        </div>
        <button
          onClick={handleAssignOrders}
          disabled={assigning}
          className="bg-[#0066FF] hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm px-6 py-2.5 rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
          </svg>
          {assigning ? 'Assigning...' : 'Assign orders'}
        </button>
      </header>

      {/* Assignment Results Banner */}
      {assignmentResult && (
        <div className="mb-6 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <h3 className="text-sm font-bold text-slate-900">Assignment Results</h3>
            <button
              onClick={() => setAssignmentResult(null)}
              className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
            >
              &times;
            </button>
          </div>
          <div className="text-xs space-y-3">
            {(assignmentResult.assigned || []).length > 0 ? (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3 text-emerald-900">
                <strong className="block font-semibold mb-1">Assigned Orders ({assignmentResult.assigned.length}):</strong>
                <ul className="list-disc pl-5 space-y-0.5">
                  {assignmentResult.assigned.map((a) => (
                    <li key={a.orderId}>
                      Order <strong>{a.orderId}</strong> ({a.weight} kg) assigned to <strong>{a.driverName}</strong> ({a.remainingCapacity} kg remaining)
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-slate-500">No new orders assigned.</div>
            )}

            {(assignmentResult.pending || []).length > 0 && (
              <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-amber-900">
                <strong className="block font-semibold mb-1">Stayed Pending ({assignmentResult.pending.length}):</strong>
                <ul className="list-disc pl-5 space-y-0.5">
                  {assignmentResult.pending.map((p) => (
                    <li key={p.orderId}>
                      Order <strong>{p.orderId}</strong> ({p.weight} kg): {p.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Drivers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {drivers.length === 0 ? (
          <div className="col-span-full py-8 text-center text-slate-400">Loading drivers...</div>
        ) : (
          drivers.map((d) => {
            const load = d.load || 0;
            const cap = d.capacityKg || 1;
            const pct = Math.min(100, Math.round((load / cap) * 100));
            const remaining = Math.max(0, Math.round((cap - load) * 10) / 10);

            let barColor = 'bg-[#0066FF]';
            if (pct >= 95) barColor = 'bg-red-500';
            else if (pct >= 75) barColor = 'bg-amber-500';

            return (
              <div
                key={d.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-blue-50 text-[#0066FF] font-bold flex items-center justify-center text-sm border border-blue-100">
                        {d.name.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">{d.name}</h2>
                        <span className="text-[11px] text-slate-400 font-mono">{d.id}</span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {load.toFixed(1)} / {cap} kg
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4 mb-2">
                    <div className="flex justify-between text-[11px] text-slate-500 font-medium mb-1.5">
                      <span>Capacity utilization</span>
                      <span className="font-bold text-slate-800">{pct}% ({remaining} kg free)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className={`${barColor} h-2 rounded-full transition-all duration-300`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>

                  {/* Assigned Orders */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-600 block mb-2">
                      Assigned Orders ({(d.assignedOrders || []).length})
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar">
                      {(d.assignedOrders || []).length > 0 ? (
                        d.assignedOrders.map((id) => {
                          const ord = ordersMap.get(id);
                          const w = ord ? `${ord.weight} kg` : '';
                          return (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200"
                            >
                              {id} <span className="text-slate-400 font-normal">{w}</span>
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-slate-400 text-xs italic">No orders currently assigned</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Max Capacity: <strong className="text-slate-800">{cap} kg</strong></span>
                  <button
                    onClick={() => onNavigateToRoute && onNavigateToRoute(d.id)}
                    className="text-[#0066FF] hover:underline font-medium text-xs cursor-pointer"
                  >
                    View route &rarr;
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
