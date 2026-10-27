import React, { useState, useEffect, useRef } from 'react';
import { PriorityBadge, StatusBadge } from './Badges.jsx';

export function RoutePlanning({ onNotify }) {
  const [drivers, setDrivers] = useState([]);
  const [selectedDriverId, setSelectedDriverId] = useState('DRV-1');
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('2-opt');
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedStopNum, setSelectedStopNum] = useState(null);
  const [mapNotice, setMapNotice] = useState('');

  const mapRef = useRef(null);
  const googleMapInstance = useRef(null);
  const markersRef = useRef([]);
  const polylinesRef = useRef([]);
  const infoWindowRef = useRef(null);

  // Load Drivers
  useEffect(() => {
    fetch('/api/drivers')
      .then((res) => res.json())
      .then((data) => {
        setDrivers(data.drivers || []);
      })
      .catch((err) => {
        onNotify('Failed to load drivers: ' + err.message, true);
      });
  }, []);

  // Fetch Route whenever driver or algorithm changes
  useEffect(() => {
    fetchRoute();
  }, [selectedDriverId, selectedAlgorithm]);

  // Initialize Google Maps
  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((cfg) => {
        if (cfg.mapsApiKey) {
          if (!window.google || !window.google.maps) {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${cfg.mapsApiKey}&libraries=geometry`;
            script.async = true;
            script.defer = true;
            script.onload = () => initGoogleMap();
            script.onerror = () => setMapNotice('Failed to load Google Maps JavaScript API.');
            document.head.appendChild(script);
          } else {
            initGoogleMap();
          }
        } else {
          setMapNotice('Google Maps API key not configured. Stop list and algorithm optimization continue functioning normally.');
        }
      })
      .catch(() => {
        setMapNotice('Map configuration could not be loaded.');
      });
  }, []);

  function initGoogleMap() {
    if (!mapRef.current || !window.google || !window.google.maps) return;
    googleMapInstance.current = new window.google.maps.Map(mapRef.current, {
      center: { lat: 28.6315, lng: 77.2167 },
      zoom: 11.5,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'simplified' }] }
      ]
    });
    infoWindowRef.current = new window.google.maps.InfoWindow();
    if (routeData) {
      renderMapOverlays(routeData);
    }
  }

  async function fetchRoute() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/route?driverId=${encodeURIComponent(selectedDriverId)}&algorithm=${encodeURIComponent(selectedAlgorithm)}`
      );
      const data = await res.json();
      if (!res.ok) {
        onNotify(data.error || 'Failed to calculate route', true);
      } else {
        setRouteData(data);
        renderMapOverlays(data);
      }
    } catch (err) {
      onNotify('Error fetching route: ' + err.message, true);
    } finally {
      setLoading(false);
    }
  }

  function renderMapOverlays(data) {
    if (!googleMapInstance.current || !data) return;

    // Clear existing
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();

    // 1. Depot Marker
    if (data.depot) {
      const depotPos = { lat: data.depot.lat, lng: data.depot.lng };
      bounds.extend(depotPos);

      const depotMarker = new window.google.maps.Marker({
        position: depotPos,
        map: googleMapInstance.current,
        title: 'Depot - ' + data.depot.name,
        label: {
          text: 'Depot',
          color: '#ffffff',
          fontSize: '10px',
          fontWeight: 'bold'
        },
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: '#1e293b',
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#ffffff'
        }
      });
      markersRef.current.push(depotMarker);
    }

    // Identify last delivered stop
    let lastDeliveredIdx = -1;
    (data.stops || []).forEach((stop, idx) => {
      if (stop.status === 'Delivered') lastDeliveredIdx = idx;
    });

    // 2. Stop Markers
    (data.stops || []).forEach((stop) => {
      const pos = { lat: stop.lat, lng: stop.lng };
      bounds.extend(pos);

      let ringColor = '#0066FF';
      if (stop.status === 'Delivered') ringColor = '#10b981';
      else if (stop.priority === 'Urgent') ringColor = '#ef4444';
      else if (stop.priority === 'Low') ringColor = '#06b6d4';

      const marker = new window.google.maps.Marker({
        position: pos,
        map: googleMapInstance.current,
        label: {
          text: String(stop.stopNumber),
          color: '#0f172a',
          fontSize: '11px',
          fontWeight: 'bold'
        },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 13,
          fillColor: '#ffffff',
          fillOpacity: 1,
          strokeWeight: 3.5,
          strokeColor: ringColor
        }
      });

      marker.addListener('click', () => {
        handleStopSelect(stop);
      });

      marker._stopNumber = stop.stopNumber;
      markersRef.current.push(marker);
    });

    // 3. Dijkstra Polyline
    if (data.polyline && data.polyline.length > 1) {
      let cutIndex = 0;
      if (lastDeliveredIdx >= 0) {
        const lastDeliveredStop = data.stops[lastDeliveredIdx];
        for (let p = 0; p < data.polyline.length; p++) {
          if (
            Math.abs(data.polyline[p].lat - lastDeliveredStop.lat) < 1e-4 &&
            Math.abs(data.polyline[p].lng - lastDeliveredStop.lng) < 1e-4
          ) {
            cutIndex = p + 1;
            break;
          }
        }
      }

      if (cutIndex > 1) {
        const completedLine = new window.google.maps.Polyline({
          path: data.polyline.slice(0, cutIndex).map((pt) => ({ lat: pt.lat, lng: pt.lng })),
          geodesic: true,
          strokeColor: '#10b981',
          strokeOpacity: 0.9,
          strokeWeight: 4.5,
          map: googleMapInstance.current
        });
        polylinesRef.current.push(completedLine);
      }

      const plannedLine = new window.google.maps.Polyline({
        path: data.polyline.slice(cutIndex > 0 ? cutIndex - 1 : 0).map((pt) => ({ lat: pt.lat, lng: pt.lng })),
        geodesic: true,
        strokeColor: '#0066FF',
        strokeOpacity: 0.9,
        strokeWeight: 4.5,
        map: googleMapInstance.current
      });
      polylinesRef.current.push(plannedLine);
    }

    if (!bounds.isEmpty()) {
      googleMapInstance.current.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    }
  }

  function handleStopSelect(stop) {
    setSelectedStopNum(stop.stopNumber);

    if (infoWindowRef.current && googleMapInstance.current) {
      const marker = markersRef.current.find((m) => m._stopNumber === stop.stopNumber);
      if (marker) {
        const content = `
          <div style="font-family:Inter,sans-serif; padding:4px; max-width:200px; font-size:12px; line-height:1.4;">
            <div style="font-weight:700; color:#0f172a; border-bottom:1px solid #e2e8f0; padding-bottom:4px; margin-bottom:4px;">
              #${stop.stopNumber} ${stop.address}
            </div>
            <div style="color:#64748b;">Weight: <strong style="color:#0f172a;">${stop.weight} kg</strong></div>
            <div style="color:#64748b;">Deadline: <strong style="color:#0f172a;">${stop.deadline}</strong></div>
            <div style="color:#64748b;">Status: <strong style="color:#0f172a;">${stop.status}</strong></div>
            <div style="color:#64748b;">Planned Arrival: <strong style="color:#0f172a;">${stop.plannedArrival}</strong> ${stop.isLate ? '<span style="color:#ef4444;font-weight:bold;">(LATE)</span>' : ''}</div>
          </div>
        `;
        infoWindowRef.current.setContent(content);
        infoWindowRef.current.open(googleMapInstance.current, marker);
        googleMapInstance.current.panTo(marker.getPosition());
      }
    }
  }

  // Calculate algorithm limits for current driver
  const currentDriver = drivers.find((d) => d.id === selectedDriverId);
  const stopCount = currentDriver ? (currentDriver.assignedOrders || []).length : 0;
  const isBfDisabled = stopCount > 10;
  const isHkDisabled = stopCount > 15;

  return (
    <div className="flex flex-col min-w-0">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">Route Planning</h1>
        <p className="text-sm text-slate-500 mt-1 font-normal">Plan an optimized route for the selected driver using available orders.</p>
      </header>

      {/* Controls Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          {/* Driver Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-800" htmlFor="driver-select">Driver</label>
            <div className="relative min-w-[260px]">
              <select
                id="driver-select"
                value={selectedDriverId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setSelectedDriverId(newId);
                  const drv = drivers.find((d) => d.id === newId);
                  const count = drv ? (drv.assignedOrders || []).length : 0;
                  if (count > 10 && selectedAlgorithm === 'bruteForce') setSelectedAlgorithm('2-opt');
                  if (count > 15 && selectedAlgorithm === 'heldKarp') setSelectedAlgorithm('2-opt');
                }}
                className="w-full appearance-none bg-white border border-slate-300 rounded-lg px-3.5 py-1.5 pr-8 text-sm font-medium text-slate-800 shadow-sm hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0066FF] cursor-pointer"
              >
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.load} / {d.capacityKg} kg)
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Algorithm Segmented Control */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-800">Algorithm</label>
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setSelectedAlgorithm('nearestNeighbor')}
                className={`px-3.5 py-1.5 rounded-md font-medium transition cursor-pointer ${
                  selectedAlgorithm === 'nearestNeighbor' ? 'bg-[#0066FF] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Nearest neighbor
              </button>
              <button
                type="button"
                onClick={() => setSelectedAlgorithm('2-opt')}
                className={`px-4 py-1.5 rounded-md font-medium transition cursor-pointer ${
                  selectedAlgorithm === '2-opt' ? 'bg-[#0066FF] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2-opt
              </button>
              <button
                type="button"
                disabled={isHkDisabled}
                title={isHkDisabled ? `Held-Karp supports at most 15 stops (current has ${stopCount})` : ''}
                onClick={() => setSelectedAlgorithm('heldKarp')}
                className={`px-3.5 py-1.5 rounded-md font-medium transition ${
                  isHkDisabled
                    ? 'opacity-40 cursor-not-allowed text-slate-400'
                    : selectedAlgorithm === 'heldKarp'
                    ? 'bg-[#0066FF] text-white shadow-sm cursor-pointer'
                    : 'text-slate-600 hover:text-slate-900 cursor-pointer'
                }`}
              >
                Held-Karp
              </button>
              <button
                type="button"
                disabled={isBfDisabled}
                title={isBfDisabled ? `Brute force supports at most 10 stops (current has ${stopCount})` : ''}
                onClick={() => setSelectedAlgorithm('bruteForce')}
                className={`px-3.5 py-1.5 rounded-md font-medium transition ${
                  isBfDisabled
                    ? 'opacity-40 cursor-not-allowed text-slate-400'
                    : selectedAlgorithm === 'bruteForce'
                    ? 'bg-[#0066FF] text-white shadow-sm cursor-pointer'
                    : 'text-slate-600 hover:text-slate-900 cursor-pointer'
                }`}
              >
                Brute force
              </button>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-end self-end pt-1 sm:pt-0">
          <button
            type="button"
            onClick={fetchRoute}
            disabled={loading}
            className="bg-[#0066FF] hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm px-6 py-2 rounded-lg shadow-sm transition flex items-center justify-center cursor-pointer"
          >
            {loading ? 'Planning...' : 'Plan route'}
          </button>
        </div>
      </section>

      {/* Dashboard Body Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Map View + Metrics (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
            <div className="relative w-full h-[470px] map-canvas-container select-none">
              <div ref={mapRef} className="w-full h-full"></div>

              {mapNotice && (
                <div className="absolute top-3 left-3 bg-white/95 border border-slate-300 text-slate-700 text-xs px-3 py-2 rounded-lg shadow-md z-10 max-w-sm">
                  <span className="font-bold text-amber-700 block mb-0.5">Map Notice</span>
                  {mapNotice}
                </div>
              )}
            </div>

            {/* Route Legend Strip */}
            <div className="px-4 py-2.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] text-slate-600 gap-y-2">
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-full border-2 border-[#0066FF] bg-white inline-block"></span>
                <span>Normal priority</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-full border-2 border-[#ef4444] bg-white inline-block"></span>
                <span>Urgent priority</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-full border-2 border-[#06b6d4] bg-white inline-block"></span>
                <span>Low priority</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-full border-2 border-[#10b981] bg-white inline-block"></span>
                <span>Delivered</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-4 h-1 bg-[#0066FF] rounded-full inline-block"></span>
                <span>Planned route</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-4 h-1 bg-[#10b981] rounded-full inline-block"></span>
                <span>Completed route</span>
              </div>
            </div>
          </div>

          {/* 4-Stat Metric Cards Strip */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm grid grid-cols-4 divide-x divide-slate-200 text-left">
            <div className="px-4 first:pl-2">
              <div className="text-2xl font-bold text-slate-900 tracking-tight">{routeData?.stopsCount ?? 0}</div>
              <div className="text-xs font-normal text-slate-500 mt-0.5">Stops</div>
            </div>
            <div className="px-4">
              <div className="text-2xl font-bold text-slate-900 tracking-tight">{routeData ? `${routeData.totalDistance.toFixed(1)} km` : '0.0 km'}</div>
              <div className="text-xs font-normal text-slate-500 mt-0.5">Total distance (round trip)</div>
            </div>
            <div className="px-4">
              <div className="text-2xl font-bold text-slate-900 tracking-tight">{routeData?.algorithm ?? '2-opt'}</div>
              <div className="text-xs font-normal text-slate-500 mt-0.5">Algorithm</div>
            </div>
            <div className="px-4 last:pr-2">
              <div className="text-2xl font-bold text-slate-900 tracking-tight">{routeData ? `${Math.round(routeData.computeTimeMs)} ms` : '0 ms'}</div>
              <div className="text-xs font-normal text-slate-500 mt-0.5">Compute time</div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Stops Table & Results (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col justify-between overflow-hidden min-h-[580px]">
          <div>
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Stops ({routeData?.stopsCount ?? 0})</h2>
              {routeData?.driver && (
                <span className="text-xs font-medium text-slate-500">
                  {routeData.driver.name} &bull; {routeData.driver.load}/{routeData.driver.capacityKg} kg
                </span>
              )}
            </div>

            <div className="overflow-x-auto custom-scrollbar max-h-[460px]">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="text-[11px] font-semibold text-slate-900 border-b border-slate-200 bg-white sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 pl-4 pr-1 text-center w-8">#</th>
                    <th className="py-2.5 px-2 font-semibold">Address</th>
                    <th className="py-2.5 px-2 font-semibold">Priority</th>
                    <th className="py-2.5 px-2 font-semibold">Weight</th>
                    <th className="py-2.5 px-2 font-semibold">Deadline</th>
                    <th className="py-2.5 pr-4 pl-2 font-semibold text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {(!routeData?.stops || routeData.stops.length === 0) ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-400">
                        {loading ? 'Calculating optimal route...' : 'No stops assigned to this driver'}
                      </td>
                    </tr>
                  ) : (
                    routeData.stops.map((stop) => {
                      const isUrgent = stop.priority === 'Urgent';
                      const isSelected = selectedStopNum === stop.stopNumber;
                      const rowBg = isSelected
                        ? 'ring-2 ring-[#0066FF] bg-blue-50/50'
                        : isUrgent
                        ? 'bg-red-50/70 hover:bg-red-100/60'
                        : 'hover:bg-slate-50';

                      return (
                        <tr
                          key={stop.stopNumber}
                          onClick={() => handleStopSelect(stop)}
                          className={`${rowBg} cursor-pointer transition`}
                        >
                          <td className="py-2 pl-4 pr-1 text-center font-normal text-slate-800">{stop.stopNumber}</td>
                          <td className={`py-2 px-2 text-slate-800 ${isUrgent ? 'font-medium' : ''}`}>{stop.address}</td>
                          <td className="py-2 px-2"><PriorityBadge priority={stop.priority}/></td>
                          <td className="py-2 px-2 text-slate-600">{stop.weight.toFixed(1)} kg</td>
                          <td className="py-2 px-2 text-slate-600">
                            <span>{stop.deadline}</span>
                            {stop.isLate && (
                              <span className="ml-1 px-1.5 py-0.2 bg-red-100 text-red-700 text-[9px] font-bold rounded">LATE</span>
                            )}
                          </td>
                          <td className="py-2 pr-4 pl-2"><StatusBadge status={stop.status}/></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Algorithm Result Summary Box */}
          <div className="p-5 border-t border-slate-200 bg-white">
            <h3 className="text-sm font-bold text-slate-900 mb-1.5">Algorithm result</h3>
            {routeData?.comparison ? (
              <div>
                <p className="text-xs text-slate-500">
                  <span className="text-slate-600">{routeData.algorithm} found </span>
                  <span className="font-bold text-slate-900">{routeData.totalDistance.toFixed(1)} km </span>
                  <span className="text-slate-600">in </span>
                  <span className="font-bold text-slate-900">{Math.round(routeData.computeTimeMs)} ms.</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {routeData.comparison.text}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Plan a route to view comparison results.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
