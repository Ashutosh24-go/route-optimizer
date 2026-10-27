import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import { CONFIG } from './src/config.js';
import { buildGraph } from './src/graph.js';
import { OrderStore } from './src/orders.js';
import { DriverStore } from './src/drivers.js';
import { StatusManager } from './src/status.js';
import { planRoute } from './src/tsp.js';
import { getCachedBenchmark } from './src/benchmark.js';
import { getSeedLocations, seedDatabase } from './src/seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// In-memory data stores
const rawLocations = getSeedLocations();
const locationsMap = new Map();
for (const loc of rawLocations) {
  locationsMap.set(loc.id, loc);
}

// Build connected 4-NN graph
const graph = buildGraph(rawLocations);

const orderStore = new OrderStore();
const driverStore = new DriverStore();
const statusManager = new StatusManager();

// Seed database on startup
seedDatabase({ orderStore, driverStore, statusManager, locationsMap });

// Serve static frontend files from /public
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback for frontend client routing (ignoring /api)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==========================================
// API Endpoints
// ==========================================

// GET /api/config
app.get('/api/config', (req, res) => {
  res.json({
    mapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
  });
});

// GET /api/locations (Helper for frontend forms)
app.get('/api/locations', (req, res) => {
  res.json({
    locations: Array.from(locationsMap.values())
  });
});

// GET /api/orders (sorted by deadline by default, ?sort= supported)
app.get('/api/orders', (req, res) => {
  const sortBy = req.query.sort || 'deadline';
  const orders = orderStore.getAllOrders(sortBy).map((ord) => {
    const loc = locationsMap.get(ord.locationId);
    return {
      ...ord,
      address: loc ? loc.name : `Location ${ord.locationId}`,
      lat: loc ? loc.lat : null,
      lng: loc ? loc.lng : null
    };
  });
  res.json({ orders });
});

// POST /api/orders
app.post('/api/orders', (req, res) => {
  try {
    const { locationId, weight, priority, deadline } = req.body;
    const newOrder = orderStore.addOrder(
      { locationId, weight, priority, deadline },
      locationsMap
    );
    const loc = locationsMap.get(newOrder.locationId);
    res.status(201).json({
      order: {
        ...newOrder,
        address: loc ? loc.name : `Location ${newOrder.locationId}`,
        lat: loc ? loc.lat : null,
        lng: loc ? loc.lng : null
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/orders/:id/cancel
app.post('/api/orders/:id/cancel', (req, res) => {
  const { id } = req.params;
  const order = orderStore.getOrder(id);
  if (!order) {
    return res.status(404).json({ error: `Order ${id} not found` });
  }

  try {
    const logEntry = statusManager.cancelOrder(order, driverStore, orderStore);
    res.json({ success: true, order, logEntry });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/queue
app.get('/api/queue', (req, res) => {
  const snapshot = orderStore.getQueueSnapshot();
  const enrich = (o) => {
    if (!o) return null;
    const loc = locationsMap.get(o.locationId);
    return {
      ...o,
      address: loc ? loc.name : `Location ${o.locationId}`
    };
  };

  res.json({
    queue: snapshot.queue.map(enrich),
    nextOrder: enrich(snapshot.nextOrder)
  });
});

// POST /api/queue/dispatch
app.post('/api/queue/dispatch', (req, res) => {
  const minOrder = orderStore.extractMinPending();
  if (!minOrder) {
    return res.status(400).json({ error: 'No pending orders in the queue to dispatch' });
  }

  // If order has no driver, assign it
  if (!minOrder.driverId) {
    const assignResult = driverStore.assignSingleOrder(
      minOrder,
      orderStore,
      statusManager
    );
    return res.json({
      dispatched: true,
      order: minOrder,
      assignment: assignResult
    });
  }

  // If already has driver, advance to In transit
  try {
    const advanceResult = statusManager.advanceOrder(
      minOrder,
      driverStore,
      orderStore
    );
    return res.json({
      dispatched: true,
      order: advanceResult.order,
      logEntry: advanceResult.logEntry
    });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/drivers
app.get('/api/drivers', (req, res) => {
  const drivers = driverStore.getDrivers(orderStore);
  res.json({ drivers });
});

// POST /api/assign
app.post('/api/assign', (req, res) => {
  const result = driverStore.assignOrders(orderStore, statusManager);
  res.json(result);
});

// GET /api/route?driverId=&algorithm=
app.get('/api/route', (req, res) => {
  const driverId = req.query.driverId || 'DRV-1';
  const algorithm = req.query.algorithm || '2-opt';

  const driver = driverStore.getDriver(driverId, orderStore);
  if (!driver) {
    return res.status(404).json({ error: `Driver ${driverId} not found` });
  }

  const assignedOrders = driver.assignedOrders
    .map((id) => orderStore.getOrder(id))
    .filter((ord) => ord && ord.status !== 'Cancelled');

  try {
    const routeResult = planRoute({
      algorithm,
      driver,
      orders: assignedOrders,
      graph,
      locationsMap
    });

    res.json({
      driver: {
        id: driver.id,
        name: driver.name,
        capacityKg: driver.capacityKg,
        load: driver.load
      },
      ...routeResult
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/status/:id/advance
app.post('/api/status/:id/advance', (req, res) => {
  const { id } = req.params;
  const order = orderStore.getOrder(id);
  if (!order) {
    return res.status(404).json({ error: `Order ${id} not found` });
  }

  try {
    const result = statusManager.advanceOrder(order, driverStore, orderStore);
    res.json({ success: true, order: result.order, logEntry: result.logEntry });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/status
app.get('/api/status', (req, res) => {
  const statusData = statusManager.getStatusGrouped(orderStore);
  res.json(statusData);
});

// GET /api/benchmark
app.get('/api/benchmark', (req, res) => {
  try {
    const benchmarkData = getCachedBenchmark();
    res.json(benchmarkData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Delivery & Route Optimization System server running on http://localhost:${PORT}`);
});

export { app, server, orderStore, driverStore, statusManager, graph, locationsMap };
