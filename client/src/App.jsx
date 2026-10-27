import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar.jsx';
import { RoutePlanning } from './components/RoutePlanning.jsx';
import { Orders } from './components/Orders.jsx';
import { PriorityQueue } from './components/PriorityQueue.jsx';
import { Drivers } from './components/Drivers.jsx';
import { DeliveryStatus } from './components/DeliveryStatus.jsx';
import { RouteComparison } from './components/RouteComparison.jsx';

export default function App() {
  const [currentTab, setCurrentTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    const validTabs = ['orders', 'queue', 'drivers', 'route-planning', 'delivery-status', 'route-comparison'];
    return validTabs.includes(hash) ? hash : 'route-planning';
  });

  const [notification, setNotification] = useState(null);

  useEffect(() => {
    window.location.hash = currentTab;
  }, [currentTab]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const validTabs = ['orders', 'queue', 'drivers', 'route-planning', 'delivery-status', 'route-comparison'];
      if (validTabs.includes(hash)) {
        setCurrentTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  function handleNotify(message, isError = false) {
    setNotification({ message, isError });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 6000);
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-row">
      {/* Sidebar Navigation */}
      <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 p-8 overflow-y-auto">
        {/* Notification Toast Banner */}
        {notification && (
          <div
            className={`p-3 mb-4 rounded-lg text-xs font-medium flex items-center justify-between shadow-sm transition-all ${
              notification.isError
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}
          >
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-600 ml-4 font-bold cursor-pointer"
            >
              &times;
            </button>
          </div>
        )}

        {/* Dynamic Screen View */}
        {currentTab === 'route-planning' && <RoutePlanning onNotify={handleNotify} />}
        {currentTab === 'orders' && <Orders onNotify={handleNotify} />}
        {currentTab === 'queue' && <PriorityQueue onNotify={handleNotify} />}
        {currentTab === 'drivers' && (
          <Drivers
            onNotify={handleNotify}
            onNavigateToRoute={() => setCurrentTab('route-planning')}
          />
        )}
        {currentTab === 'delivery-status' && <DeliveryStatus onNotify={handleNotify} />}
        {currentTab === 'route-comparison' && <RouteComparison onNotify={handleNotify} />}
      </main>
    </div>
  );
}
