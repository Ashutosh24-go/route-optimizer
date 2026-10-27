import React, { useState, useEffect } from 'react';
import { PriorityBadge, StatusBadge } from './Badges.jsx';

export function PriorityQueue({ onNotify }) {
  const [queue, setQueue] = useState([]);
  const [nextOrder, setNextOrder] = useState(null);
  const [dispatching, setDispatching] = useState(false);

  useEffect(() => {
    fetchQueue();
  }, []);

  async function fetchQueue() {
    try {
      const res = await fetch('/api/queue');
      const data = await res.json();
      setQueue(data.queue || []);
      setNextOrder(data.nextOrder || null);
    } catch (err) {
      onNotify('Error loading priority queue: ' + err.message, true);
    }
  }

  async function handleDispatch() {
    setDispatching(true);
    try {
      const res = await fetch('/api/queue/dispatch', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        onNotify(data.error || 'Failed to dispatch order', true);
      } else {
        if (data.assignment) {
          if (data.assignment.assigned) {
            onNotify(`Dispatched ${data.order.id} and assigned to ${data.assignment.driverName}`);
          } else {
            onNotify(`Dispatched ${data.order.id}, but: ${data.assignment.reason}`, true);
          }
        } else {
          onNotify(`Dispatched and advanced order ${data.order.id}`);
        }
        fetchQueue();
      }
    } catch (err) {
      onNotify('Error dispatching: ' + err.message, true);
    } finally {
      setDispatching(false);
    }
  }

  return (
    <div className="flex flex-col min-w-0">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">Priority Queue</h1>
          <p className="text-sm text-slate-500 mt-1 font-normal">Min-heap keyed by priority rank (Urgent &gt; Normal &gt; Low), earliest deadline, and creation order.</p>
        </div>
        <button
          onClick={handleDispatch}
          disabled={!nextOrder || dispatching}
          className={`bg-[#0066FF] hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm px-6 py-2.5 rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer ${
            !nextOrder || dispatching ? 'opacity-40 cursor-not-allowed' : ''
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
          </svg>
          {dispatching ? 'Dispatching...' : 'Dispatch next order'}
        </button>
      </header>

      {/* Next Order Callout Card */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0066FF] animate-pulse"></span>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Next Order to Serve (Heap Root)</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">Min-Heap Peek</span>
        </div>

        {!nextOrder ? (
          <div className="py-4 text-center text-slate-400 font-medium text-xs">
            No pending orders currently in the priority queue.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase block">Order ID</span>
              <span className="text-base font-bold text-slate-900">{nextOrder.id}</span>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase block">Priority</span>
              <div className="mt-0.5"><PriorityBadge priority={nextOrder.priority}/></div>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase block">Deadline</span>
              <span className="text-sm font-semibold text-slate-800">{nextOrder.deadline}</span>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase block">Weight</span>
              <span className="text-sm font-semibold text-slate-800">{nextOrder.weight.toFixed(1)} kg</span>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase block">Destination</span>
              <span className="text-xs text-slate-700 truncate block">{nextOrder.address}</span>
            </div>
          </div>
        )}
      </section>

      {/* Queue Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Queue ({queue.length})</h2>
          <span className="text-xs text-slate-500">Sorted by min-heap extraction order</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="text-[11px] font-semibold text-slate-900 border-b border-slate-200 bg-slate-50/50">
              <tr>
                <th className="py-3 px-4 font-semibold text-center w-14">Pos</th>
                <th className="py-3 px-3 font-semibold">Order ID</th>
                <th className="py-3 px-3 font-semibold">Priority</th>
                <th className="py-3 px-3 font-semibold">Deadline</th>
                <th className="py-3 px-3 font-semibold">Weight</th>
                <th className="py-3 px-3 font-semibold">Address</th>
                <th className="py-3 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {queue.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">Queue is empty</td>
                </tr>
              ) : (
                queue.map((ord, idx) => {
                  const isFirst = idx === 0;
                  const rowBg = ord.priority === 'Urgent'
                    ? 'bg-red-50/70 hover:bg-red-100/60'
                    : isFirst
                    ? 'bg-blue-50/30 hover:bg-blue-50/60'
                    : 'hover:bg-slate-50';

                  return (
                    <tr key={ord.id} className={`${rowBg} transition`}>
                      <td className="py-2.5 px-4 text-center">
                        {isFirst ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0066FF] text-white">
                            #1 Top
                          </span>
                        ) : (
                          <span className="text-slate-500 font-semibold">#{idx + 1}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{ord.id}</td>
                      <td className="py-2.5 px-3"><PriorityBadge priority={ord.priority}/></td>
                      <td className="py-2.5 px-3 text-slate-800 font-medium">{ord.deadline}</td>
                      <td className="py-2.5 px-3 text-slate-600">{ord.weight.toFixed(1)} kg</td>
                      <td className="py-2.5 px-3 text-slate-800">{ord.address}</td>
                      <td className="py-2.5 px-4"><StatusBadge status={ord.status}/></td>
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
