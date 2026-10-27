import React from 'react';

export function PriorityBadge({ priority }) {
  if (priority === 'Urgent') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-200">
        Urgent
      </span>
    );
  }
  if (priority === 'Low') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-50 text-[#06b6d4] border border-cyan-200">
        Low
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-[#0066FF] border border-blue-200">
      Normal
    </span>
  );
}

export function StatusBadge({ status }) {
  switch (status) {
    case 'Delivered':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Delivered
        </span>
      );
    case 'In transit':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>In transit
        </span>
      );
    case 'Assigned':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mr-1.5"></span>Assigned
        </span>
      );
    case 'Cancelled':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700 border border-red-200">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>Cancelled
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>Pending
        </span>
      );
  }
}
