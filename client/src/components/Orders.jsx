import React, { useState, useEffect } from 'react';
import { PriorityBadge, StatusBadge } from './Badges.jsx';

export function Orders({ onNotify }) {
  const [orders, setOrders] = useState([]);
  const [locations, setLocations] = useState([]);
  const [driversMap, setDriversMap] = useState(new Map());
  const [sortBy, setSortBy] = useState('deadline');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [formLocationId, setFormLocationId] = useState('');
  const [formWeight, setFormWeight] = useState('');
  const [formPriority, setFormPriority] = useState('Normal');
  const [formDeadline, setFormDeadline] = useState('11:00 AM');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadLocations();
    loadDrivers();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [sortBy]);

  async function loadLocations() {
    try {
      const res = await fetch('/api/locations');
      const data = await res.json();
      const locList = (data.locations || []).filter((l) => l.id !== 0);
      setLocations(locList);
      if (locList.length > 0 && !formLocationId) {
        setFormLocationId(locList[0].id);
      }
    } catch (err) {}
  }

  async function loadDrivers() {
    try {
      const res = await fetch('/api/drivers');
      const data = await res.json();
      const map = new Map();
      (data.drivers || []).forEach((d) => map.set(d.id, d.name));
      setDriversMap(map);
    } catch (err) {}
  }

  async function fetchOrders() {
    try {
      const res = await fetch(`/api/orders?sort=${encodeURIComponent(sortBy)}`);
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err) {
      onNotify('Error fetching orders: ' + err.message, true);
    }
  }

  async function handleCancelOrder(id) {
    if (!window.confirm(`Are you sure you want to cancel order ${id}?`)) return;
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        onNotify(data.error || 'Failed to cancel order', true);
      } else {
        onNotify(`Order ${id} cancelled successfully.`);
        fetchOrders();
      }
    } catch (err) {
      onNotify('Error cancelling order: ' + err.message, true);
    }
  }

  async function handleAddOrderSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: parseInt(formLocationId, 10),
          weight: parseFloat(formWeight),
          priority: formPriority,
          deadline: formDeadline.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        onNotify(data.error || 'Validation error', true);
      } else {
        onNotify(`Created order ${data.order.id} successfully!`);
        setIsModalOpen(false);
        setFormWeight('');
        fetchOrders();
      }
    } catch (err) {
      onNotify('Failed to add order: ' + err.message, true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col min-w-0">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">Orders</h1>
          <p className="text-sm text-slate-500 mt-1 font-normal">Manage incoming orders, delivery deadlines, and priorities.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#0066FF] hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm px-5 py-2 rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
          </svg>
          Add order
        </button>
      </header>

      {/* Controls Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <label htmlFor="sort-select" className="text-xs font-semibold text-slate-700">Sort by:</label>
          <select
            id="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-[#0066FF] cursor-pointer"
          >
            <option value="deadline">Earliest deadline</option>
            <option value="priority">Priority (Urgent first)</option>
            <option value="id">Order ID</option>
          </select>
        </div>
        <div className="text-xs text-slate-500">
          Total: <span className="font-bold text-slate-800">{orders.length}</span> orders
        </div>
      </section>

      {/* Orders Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="text-[11px] font-semibold text-slate-900 border-b border-slate-200 bg-slate-50/50">
              <tr>
                <th className="py-3 px-4 font-semibold">Order ID</th>
                <th className="py-3 px-3 font-semibold">Address</th>
                <th className="py-3 px-3 font-semibold">Priority</th>
                <th className="py-3 px-3 font-semibold">Weight</th>
                <th className="py-3 px-3 font-semibold">Deadline</th>
                <th className="py-3 px-3 font-semibold">Status</th>
                <th className="py-3 px-3 font-semibold">Driver</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">No orders found</td>
                </tr>
              ) : (
                orders.map((ord) => {
                  const isUrgent = ord.priority === 'Urgent';
                  const rowBg = isUrgent ? 'bg-red-50/70 hover:bg-red-100/60' : 'hover:bg-slate-50';
                  const driverName = ord.driverId ? (driversMap.get(ord.driverId) || ord.driverId) : '—';
                  const canCancel = ord.status === 'Pending' || ord.status === 'Assigned';

                  return (
                    <tr key={ord.id} className={`${rowBg} transition`}>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{ord.id}</td>
                      <td className={`py-2.5 px-3 text-slate-800 ${isUrgent ? 'font-medium' : ''}`}>{ord.address}</td>
                      <td className="py-2.5 px-3"><PriorityBadge priority={ord.priority}/></td>
                      <td className="py-2.5 px-3 text-slate-600">{ord.weight.toFixed(1)} kg</td>
                      <td className="py-2.5 px-3 text-slate-700 font-medium">{ord.deadline}</td>
                      <td className="py-2.5 px-3"><StatusBadge status={ord.status}/></td>
                      <td className="py-2.5 px-3 text-slate-700">{driverName}</td>
                      <td className="py-2.5 px-4 text-right">
                        {canCancel ? (
                          <button
                            onClick={() => handleCancelOrder(ord.id)}
                            className="px-2.5 py-1 text-[11px] font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded border border-red-200 transition cursor-pointer"
                          >
                            Cancel
                          </button>
                        ) : (
                          <span className="text-slate-300 text-[10px]">Locked</span>
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

      {/* Add Order Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Add New Order</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddOrderSubmit} className="p-6 flex flex-col space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Location</label>
                <select
                  value={formLocationId}
                  onChange={(e) => setFormLocationId(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:ring-1 focus:ring-[#0066FF] focus:outline-none"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="500"
                  required
                  placeholder="e.g. 7.5"
                  value={formWeight}
                  onChange={(e) => setFormWeight(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:ring-1 focus:ring-[#0066FF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                <select
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:ring-1 focus:ring-[#0066FF] focus:outline-none"
                >
                  <option value="Normal">Normal</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Deadline Time (e.g. 4:30 PM)</label>
                <input
                  type="text"
                  required
                  placeholder="11:00 AM"
                  value={formDeadline}
                  onChange={(e) => setFormDeadline(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:ring-1 focus:ring-[#0066FF] focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#0066FF] hover:bg-blue-700 text-white rounded-lg text-xs font-medium shadow-sm cursor-pointer"
                >
                  {submitting ? 'Creating...' : 'Create order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
