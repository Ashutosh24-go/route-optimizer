import React from 'react';

const NAV_ITEMS = [
  {
    id: 'orders',
    title: 'Orders',
    icon: (
      <svg className="w-6 h-6 mb-1 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  },
  {
    id: 'queue',
    title: 'Priority queue',
    icon: (
      <svg className="w-6 h-6 mb-1 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M4 6h16M4 10h16M4 14h16M4 18h16" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  },
  {
    id: 'drivers',
    title: 'Drivers',
    icon: (
      <svg className="w-6 h-6 mb-1 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  },
  {
    id: 'route-planning',
    title: 'Route planning',
    icon: (
      <svg className="w-6 h-6 mb-1 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  },
  {
    id: 'delivery-status',
    title: 'Delivery status',
    icon: (
      <svg className="w-6 h-6 mb-1 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  },
  {
    id: 'route-comparison',
    title: 'Route comparison',
    icon: (
      <svg className="w-6 h-6 mb-1 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
];

export function Sidebar({ currentTab, onSelectTab }) {
  return (
    <aside className="w-[200px] min-h-screen bg-white border-r border-slate-200 flex flex-col flex-shrink-0 z-20">
      <div className="py-6 flex flex-col space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = currentTab === item.id;
          if (isActive) {
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className="relative flex flex-col items-center justify-center py-3.5 px-3 bg-[#eff6ff] text-[#0066FF] font-medium border-l-[3.5px] border-[#0066FF] text-center w-full cursor-pointer"
              >
                {item.icon}
                <span className="text-xs font-medium tracking-tight leading-tight">{item.title}</span>
              </button>
            );
          }
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className="flex flex-col items-center justify-center py-3.5 px-3 text-slate-500 hover:text-slate-800 transition group text-center w-full cursor-pointer"
            >
              <div className="text-slate-400 group-hover:text-slate-600 transition">
                {item.icon}
              </div>
              <span className="text-xs font-normal leading-tight">{item.title}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
