import React, { useState, useEffect } from 'react';
import { PriorityBadge, StatusBadge } from './Badges.jsx';

export function DeliveryStatus({ onNotify }) {
  const [statusData, setStatusData] = useState({ groups: {}, changeLog: [] });
  const [locationsMap, setLocationsMap] = useState(new Map());

  useEffect(() => {
    loadLocations();
    fetchStatus();
  }, []);

  async function loadLocations() {
    try {
      const res = await fetch('/api/locations');
      const data = await res.json();
      const map = new Map();
      (data.locations || []).forEach((l) => map.set(l.id, l.name));
      setLocationsMap(map);
    } catch (err) {}
  }

  async function fetchStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setStatusData(data);
    } catch (err) {
      onNotify('Error loading delivery status: ' + err.message, true);
    }
  }

  async function handleAdvance(id) {
    try {
      const res = await fetch(`/api/status/${encodeURIComponent(id)}/advance`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        onNotify(data.error || 'Cannot advance status', true);
      } else {
        onNotify(`Order ${id} advanced to ${data.order.status}`);
        fetchStatus();
      }
    } catch (err) {
      onNotify('Error advancing order: ' + err.message, true);
    }
  }

  const groups = statusData.groups || {};
  const pending = groups['Pending'] || [];
  const assigned = groups['Assigned'] || [];
  const inTransit = groups['In transit'] || [];
  const delivered = groups['Delivered'] || [];
  const changeLog = statusData.changeLog || [];

  function renderCard(ord, showAdvance = true) {
    const address = locationsMap.get(ord.locationId) || `Location ${ord.locationId}`;
    const isUrgent = ord.priority === 'Urgent';

    return (
      <div
        key={ord.id}
        className={`border border-slate-200 rounded-lg p-3 bg-white shadow-xs hover:border-slate-300 transition text-xs ${
          isUrgent ? 'border-l-4 border-l-red-500' : ''
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-bold text-slate-900">{ord.id}</span>
          <PriorityBadge priority={ord.priority} />
        </div>
        <div className="text-[11px] text-slate-700 truncate font-medium mb-1">{address}</div>
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span>{ord.weight.toFixed(1)} kg</span>
          <span>Deadline: <strong className="text-slate-700">{ord.deadline}</strong></span>
        </div>
        {showAdvance ? (
          <button
            onClick={() => handleAdvance(ord.id)}
            className="mt-2 w-full py-1 text-[11px] font-medium bg-[#0066FF] hover:bg-blue-700 text-white rounded transition shadow-sm cursor-pointer flex items-center justify-center gap-1"
          >
            Advance status &rarr;
          </button>
        ) : (
          <div className="mt-2 text-center text-[10px] text-emerald-700 font-semibold bg-emerald-50 py-1 rounded border border-emerald-200">
            Completed
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-w-0">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">Delivery Status</h1>
        <p className="text-sm text-slate-500 mt-1 font-normal">Track order lifecycle stages, advance statuses, and inspect audit logs.</p>
      </header>

      {/* Grouped Status Columns */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {/* Pending */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col min-h-[380px]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Pending</h2>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">{pending.length}</span>
          </div>
          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[460px] custom-scrollbar pr-1">
            {pending.length > 0 ? (
              pending.map((o) => renderCard(o, true))
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">No pending orders</div>
            )}
          </div>
        </div>

        {/* Assigned */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col min-h-[380px]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              <h2 className="text-xs font-bold text-purple-900 uppercase tracking-wider">Assigned</h2>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700">{assigned.length}</span>
          </div>
          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[460px] custom-scrollbar pr-1">
            {assigned.length > 0 ? (
              assigned.map((o) => renderCard(o, true))
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">No assigned orders</div>
            )}
          </div>
        </div>

        {/* In transit */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col min-h-[380px]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <h2 className="text-xs font-bold text-amber-900 uppercase tracking-wider">In transit</h2>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">{inTransit.length}</span>
          </div>
          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[460px] custom-scrollbar pr-1">
            {inTransit.length > 0 ? (
              inTransit.map((o) => renderCard(o, true))
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">No orders in transit</div>
            )}
          </div>
        </div>

        {/* Delivered */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col min-h-[380px]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <h2 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Delivered</h2>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">{delivered.length}</span>
          </div>
          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[460px] custom-scrollbar pr-1">
            {delivered.length > 0 ? (
              delivered.map((o) => renderCard(o, false))
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">No delivered orders</div>
            )}
          </div>
        </div>
      </div>

      {/* Status Change Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Status Change Log ({changeLog.length})</h2>
          <span className="text-xs text-slate-400">Chronological transition history</span>
        </div>

        <div className="overflow-x-auto max-h-72 custom-scrollbar">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="text-[11px] font-semibold text-slate-900 border-b border-slate-200 bg-slate-50/50 sticky top-0">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                <th className="py-2.5 px-4 font-semibold">Order ID</th>
                <th className="py-2.5 px-4 font-semibold">From Status</th>
                <th className="py-2.5 px-4 font-semibold">To Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {changeLog.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-6 text-center text-slate-400">No transitions recorded yet</td>
                </tr>
              ) : (
                [...changeLog].reverse().map((entry, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-4 text-slate-500 font-mono text-[10px]">
                      {new Date(entry.time).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{entry.orderId}</td>
                    <td className="py-2.5 px-4"><StatusBadge status={entry.from} /></td>
                    <td className="py-2.5 px-4 flex items-center gap-1.5">
                      <span className="text-slate-400">&rarr;</span>
                      <StatusBadge status={entry.to} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
